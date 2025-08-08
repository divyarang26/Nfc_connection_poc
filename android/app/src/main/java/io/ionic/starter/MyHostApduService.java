package io.ionic.starter;

import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;
import android.util.Log;
import java.util.Arrays;
import android.content.SharedPreferences;
import android.content.Context;
import org.json.JSONObject;
import org.json.JSONException;

public class MyHostApduService extends HostApduService {
    private static final String TAG = "MyHostApduService";

    // AID for EbioroApplet (matching React app)
    private static final byte[] EBIORO_AID = HexStringToByteArray("F0010203040506");
    
    // EbioroApplet command codes
    private static final byte INS_GET_PUBLIC_KEY = 0x47;
    
    // Response codes
    private static final byte[] APDU_SUCCESS = {(byte)0x90, (byte)0x00};
    private static final byte[] APDU_UNKNOWN = {(byte)0x6F, (byte)0x00};
    private static final byte[] APDU_INCORRECT_P1P2 = {(byte)0x6A, (byte)0x86};
    private static final byte[] APDU_WRONG_LENGTH = {(byte)0x67, (byte)0x00};
    
    // Maximum chunk size for data transfer (matching React app)
    private static final int MAX_CHUNK_SIZE = 250;

    // State tracking
    private boolean isAppletSelected = false;
    private String publicKeyData = "";
    private byte[] remainingData = null;
    private int currentOffset = 0;

    @Override
    public byte[] processCommandApdu(byte[] commandApdu, Bundle extras) {
        Log.d(TAG, "Received APDU: " + ByteArrayToHexString(commandApdu));

        if (commandApdu == null || commandApdu.length < 4) {
            Log.w(TAG, "Invalid APDU received");
            return APDU_UNKNOWN;
        }

        byte ins = commandApdu[1];
        byte p1 = commandApdu[2];
        byte p2 = commandApdu[3];

        // Handle SELECT command (standard ISO command)
        if (ins == (byte)0xA4) {
            return handleSelect(commandApdu);
        }

        // Ensure applet is selected before processing other commands
        if (!isAppletSelected) {
            Log.d(TAG, "Applet not selected");
            return APDU_UNKNOWN;
        }

        // Handle EbioroApplet commands
        switch (ins) {
            case INS_GET_PUBLIC_KEY:
                return handleGetPublicKey(commandApdu);
                
            case (byte)0xC0: // GET RESPONSE for chunked data
                return getNextChunk();
                
            default:
                Log.d(TAG, "Unknown instruction: " + String.format("%02X", ins));
                return APDU_UNKNOWN;
        }
    }

    private byte[] handleSelect(byte[] commandApdu) {
        Log.d(TAG, "SELECT command received");
        
        if (commandApdu.length > 5) {
            int lc = commandApdu[4] & 0xFF; // Convert to unsigned byte
            if (commandApdu.length >= 5 + lc) {
                byte[] aid = Arrays.copyOfRange(commandApdu, 5, 5 + lc);
                if (Arrays.equals(aid, EBIORO_AID)) {
                    Log.d(TAG, "EbioroApplet AID selected!");
                    isAppletSelected = true;
                    
                    // Load public key data from storage
                    updatePublicKeyFromStorage();
                    
                    return APDU_SUCCESS;
                }
            }
        }
        
        isAppletSelected = false;
        Log.w(TAG, "Invalid SELECT command or wrong AID");
        return APDU_UNKNOWN;
    }

    private byte[] handleGetPublicKey(byte[] commandApdu) {
        Log.d(TAG, "GET PUBLIC KEY command received");
        
        // Check P1 and P2
        if (commandApdu[2] != 0x00 || commandApdu[3] != 0x00) {
            Log.w(TAG, "Incorrect P1P2 for GET PUBLIC KEY");
            return APDU_INCORRECT_P1P2;
        }
        
        // Prepare public key data for chunked transfer
        updatePublicKeyFromStorage();
        
        if (publicKeyData == null || publicKeyData.isEmpty()) {
            Log.w(TAG, "No public key data available");
            return APDU_UNKNOWN;
        }
        
        remainingData = publicKeyData.getBytes();
        currentOffset = 0;
        
        Log.d(TAG, "Starting chunked transfer of " + remainingData.length + " bytes");
        return getNextChunk();
    }

    /**
     * Get the next chunk of data for chunked transfer
     */
    private byte[] getNextChunk() {
        if (remainingData == null || currentOffset >= remainingData.length) {
            Log.d(TAG, "No more data to send");
            return APDU_SUCCESS;
        }

        int remainingBytes = remainingData.length - currentOffset;
        int chunkSize = Math.min(remainingBytes, MAX_CHUNK_SIZE);
        
        byte[] chunk = Arrays.copyOfRange(remainingData, currentOffset, currentOffset + chunkSize);
        currentOffset += chunkSize;
        
        boolean hasMoreData = currentOffset < remainingData.length;
        
        byte[] response;
        if (hasMoreData) {
            // Data + status indicating more data (61XX)
            response = new byte[chunk.length + 2];
            System.arraycopy(chunk, 0, response, 0, chunk.length);
            response[response.length - 2] = (byte)0x61;
            int nextChunkSize = Math.min(remainingData.length - currentOffset, 255);
            response[response.length - 1] = (byte)(nextChunkSize & 0xFF);
        } else {
            // Last chunk - data + success status
            response = new byte[chunk.length + 2];
            System.arraycopy(chunk, 0, response, 0, chunk.length);
            response[response.length - 2] = (byte)0x90;
            response[response.length - 1] = (byte)0x00;
        }
        
        Log.d(TAG, String.format("Sending chunk: offset=%d, size=%d, hasMore=%b, total=%d", 
                     currentOffset - chunkSize, chunkSize, hasMoreData, remainingData.length));
        
        return response;
    }

    @Override
    public void onDeactivated(int reason) {
        String reasonText;
        switch (reason) {
            case DEACTIVATION_LINK_LOSS:
                reasonText = "LINK_LOSS";
                break;
            case DEACTIVATION_DESELECTED:
                reasonText = "DESELECTED";
                break;
            default:
                reasonText = "UNKNOWN(" + reason + ")";
                break;
        }
        
        Log.d(TAG, "HCE Deactivated: " + reasonText);
        
        // Reset state
        isAppletSelected = false;
        remainingData = null;
        currentOffset = 0;
    }

    /**
     * Reads the public key data from Capacitor's SharedPreferences
     * This method is enhanced to handle both JSON and plain text data
     */
    private void updatePublicKeyFromStorage() {
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String storedKey = null;

        try {
            String jsonData = prefs.getString("public_key_data", null);
            if (jsonData != null) {
                try {
                    JSONObject json = new JSONObject(jsonData);
                    storedKey = json.optString("value", null);

                    if (storedKey == null || storedKey.isEmpty()) {
                        Log.w(TAG, "'value' key missing or empty in JSON data.");
                        // Fallback: treat the entire JSON as the data
                        if (!jsonData.isEmpty()) {
                            storedKey = jsonData;
                        }
                    }
                    Log.d(TAG, "Successfully parsed public key from storage, length: " + 
                              (storedKey != null ? storedKey.length() : 0));
                } catch (JSONException e) {
                    Log.w(TAG, "Stored data is not valid JSON, treating as plain string: " + e.getMessage());
                    storedKey = jsonData;
                }
            } else {
                Log.w(TAG, "No data found in SharedPreferences");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error retrieving public key from storage: " + e.getMessage());
        }

        if (storedKey != null && !storedKey.isEmpty()) {
            publicKeyData = storedKey;
            Log.d(TAG, "Updated public key data, length: " + publicKeyData.length());
        } else {
            // Default public key data for demo/testing
            publicKeyData = createDefaultTestData();
            Log.d(TAG, "Using default test data, length: " + publicKeyData.length());
        }
    }

    /**
     * Creates default test data when no data is available
     */
    private String createDefaultTestData() {
        return "{\n" +
               "  \"type\": \"default-test-data\",\n" +
               "  \"message\": \"No data was found in storage. This is default test data from the HCE service.\",\n" +
               "  \"timestamp\": \"" + System.currentTimeMillis() + "\",\n" +
               "  \"source\": \"Android HCE Service\",\n" +
               "  \"publicKey\": \"-----BEGIN PUBLIC KEY-----\\n" +
               "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1234567890\\n" +
               "EXAMPLE_PUBLIC_KEY_DATA_HERE_FOR_TESTING_PURPOSES\\n" +
               "-----END PUBLIC KEY-----\",\n" +
               "  \"metadata\": {\n" +
               "    \"version\": \"1.0.0\",\n" +
               "    \"service\": \"MyHostApduService\"\n" +
               "  }\n" +
               "}";
    }

    /**
     * Converts a byte array to a hexadecimal string for logging
     */
    public static String ByteArrayToHexString(byte[] bytes) {
        if (bytes == null) return "null";
        StringBuilder sb = new StringBuilder(bytes.length * 3);
        for (int i = 0; i < bytes.length; i++) {
            if (i > 0) sb.append(" ");
            sb.append(String.format("%02X", bytes[i]));
        }
        return sb.toString();
    }

    /**
     * Converts a hexadecimal string to a byte array
     */
    public static byte[] HexStringToByteArray(String s) {
        if (s == null || s.length() % 2 != 0) {
            Log.w(TAG, "Invalid hex string: " + s);
            return new byte[0];
        }
        
        int len = s.length();
        byte[] data = new byte[len / 2];
        try {
            for (int i = 0; i < len; i += 2) {
                data[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4)
                                + Character.digit(s.charAt(i+1), 16));
            }
        } catch (NumberFormatException e) {
            Log.e(TAG, "Error converting hex string to byte array: " + e.getMessage());
            return new byte[0];
        }
        return data;
    }
}