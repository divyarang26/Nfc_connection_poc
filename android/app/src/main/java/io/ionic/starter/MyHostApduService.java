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

    // AID for EbioroApplet (you'll need to replace with actual AID)
    private static final byte[] EBIORO_AID = HexStringToByteArray("F0010203040506");
    
    // EbioroApplet command codes
    private static final byte CLA = 0x00;
    private static final byte INS_VERIFY = 0x20;
    private static final byte INS_CHANGE_REFERENCE_DATA = 0x24;
    private static final byte INS_RESET_RETRY_COUNTER = 0x2C;
    private static final byte INS_PERFORM_SECURITY_OPERATION = 0x2A;
    private static final byte INS_MANAGE_SECURITY_ENVIRONMENT = 0x22;
    private static final byte INS_GENERATE_ASYMMETRIC_KEYPAIR = 0x46;
    private static final byte INS_GET_PUBLIC_KEY = 0x47;
    private static final byte INS_GET_RAW_PUBLIC_KEY = 0x48;
    
    // Response codes
    private static final byte[] APDU_SUCCESS = {(byte)0x90, (byte)0x00};
    private static final byte[] APDU_UNKNOWN = {(byte)0x6F, (byte)0x00};
    private static final byte[] APDU_WRONG_LENGTH = {(byte)0x67, (byte)0x00};
    private static final byte[] APDU_INCORRECT_P1P2 = {(byte)0x6A, (byte)0x86};
    private static final byte[] APDU_SECURITY_NOT_SATISFIED = {(byte)0x69, (byte)0x82};
    
    // Maximum chunk size for data transfer
    private static final int MAX_CHUNK_SIZE = 250;

    // State tracking
    private boolean isAppletSelected = false;
    private boolean isPinVerified = false;
    private String currentNfcMessage = "";
    private byte[] remainingData = null;
    private int currentOffset = 0;
    
    // Default PIN (you should change this)
    private static final byte[] DEFAULT_PIN = {0x31, 0x32, 0x33, 0x34, 0x35, 0x36}; // "123456"

    @Override
    public byte[] processCommandApdu(byte[] commandApdu, Bundle extras) {
        Log.d(TAG, "Received APDU: " + ByteArrayToHexString(commandApdu));

        if (commandApdu == null || commandApdu.length < 4) {
            return APDU_UNKNOWN;
        }

        byte cla = commandApdu[0];
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
            case INS_VERIFY:
                return handleVerifyPin(commandApdu);
                
            case INS_CHANGE_REFERENCE_DATA:
                return handleChangeReferenceData(commandApdu);
                
            case INS_RESET_RETRY_COUNTER:
                return handleResetRetryCounter(commandApdu);
                
            case INS_PERFORM_SECURITY_OPERATION:
                return handlePerformSecurityOperation(commandApdu);
                
            case INS_MANAGE_SECURITY_ENVIRONMENT:
                return handleManageSecurityEnvironment(commandApdu);
                
            case INS_GENERATE_ASYMMETRIC_KEYPAIR:
                return handleGenerateKeypair(commandApdu);
                
            case INS_GET_PUBLIC_KEY:
            case INS_GET_RAW_PUBLIC_KEY:
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
            int lc = commandApdu[4];
            if (commandApdu.length >= 5 + lc) {
                byte[] aid = Arrays.copyOfRange(commandApdu, 5, 5 + lc);
                if (Arrays.equals(aid, EBIORO_AID)) {
                    Log.d(TAG, "EbioroApplet AID selected!");
                    isAppletSelected = true;
                    isPinVerified = false; // Reset PIN verification on new selection
                    
                    // Prepare initial response if needed
                    updateCurrentNfcMessageFromStorage();
                    
                    return APDU_SUCCESS;
                }
            }
        }
        
        isAppletSelected = false;
        return APDU_UNKNOWN;
    }

    private byte[] handleVerifyPin(byte[] commandApdu) {
        Log.d(TAG, "VERIFY PIN command received");
        
        // Check P1 and P2
        if (commandApdu[2] != 0x00 || commandApdu[3] != 0x01) {
            return APDU_INCORRECT_P1P2;
        }
        
        // Check PIN length
        if (commandApdu.length < 5 || commandApdu[4] != 0x06) {
            return APDU_WRONG_LENGTH;
        }
        
        // Extract PIN
        byte[] providedPin = Arrays.copyOfRange(commandApdu, 5, 11);
        
        // Verify PIN (in real implementation, this should be secure)
        if (Arrays.equals(providedPin, DEFAULT_PIN)) {
            isPinVerified = true;
            Log.d(TAG, "PIN verified successfully");
            return APDU_SUCCESS;
        } else {
            // In real implementation, track retry count
            Log.d(TAG, "PIN verification failed");
            return new byte[]{(byte)0x63, (byte)0xC2}; // 2 tries remaining
        }
    }

    private byte[] handleChangeReferenceData(byte[] commandApdu) {
        Log.d(TAG, "CHANGE REFERENCE DATA command received");
        
        // For initial PIN setup (P1=0x01)
        if (commandApdu[2] == 0x01 && commandApdu[3] == 0x01) {
            // In real implementation, store the new PIN
            Log.d(TAG, "Initial PIN setup");
            return APDU_SUCCESS;
        }
        
        // For PIN change (P1=0x00)
        if (commandApdu[2] == 0x00 && commandApdu[3] == 0x01) {
            if (!isPinVerified) {
                return APDU_SECURITY_NOT_SATISFIED;
            }
            // In real implementation, verify old PIN and set new PIN
            Log.d(TAG, "PIN change");
            return APDU_SUCCESS;
        }
        
        return APDU_INCORRECT_P1P2;
    }

    private byte[] handleResetRetryCounter(byte[] commandApdu) {
        Log.d(TAG, "RESET RETRY COUNTER command received");
        
        if (commandApdu[2] != 0x00 || commandApdu[3] != 0x01) {
            return APDU_INCORRECT_P1P2;
        }
        
        // In real implementation, reset PIN retry counter
        Log.d(TAG, "PIN retry counter reset");
        return APDU_SUCCESS;
    }

    private byte[] handlePerformSecurityOperation(byte[] commandApdu) {
        Log.d(TAG, "PERFORM SECURITY OPERATION command received");
        
        if (!isPinVerified) {
            return APDU_SECURITY_NOT_SATISFIED;
        }
        
        // Check for signature operation (P1=0x9E, P2=0x9A)
        if (commandApdu[2] == (byte)0x9E && commandApdu[3] == (byte)0x9A) {
            Log.d(TAG, "Digital signature requested");
            
            // In this simplified version, we return the stored message as "signed data"
            updateCurrentNfcMessageFromStorage();
            remainingData = currentNfcMessage.getBytes();
            currentOffset = 0;
            
            return getNextChunk();
        }
        
        return APDU_INCORRECT_P1P2;
    }

    private byte[] handleManageSecurityEnvironment(byte[] commandApdu) {
        Log.d(TAG, "MANAGE SECURITY ENVIRONMENT command received");
        
        if (!isPinVerified) {
            return APDU_SECURITY_NOT_SATISFIED;
        }
        
        // P1=0x41 for SET operation
        if (commandApdu[2] == 0x41) {
            // In real implementation, parse TLV data to set algorithm and key reference
            Log.d(TAG, "Security environment set");
            return APDU_SUCCESS;
        }
        
        // P1=0xF3 for RESTORE operation
        if (commandApdu[2] == (byte)0xF3) {
            Log.d(TAG, "Security environment restored");
            return APDU_SUCCESS;
        }
        
        return APDU_INCORRECT_P1P2;
    }

    private byte[] handleGenerateKeypair(byte[] commandApdu) {
        Log.d(TAG, "GENERATE ASYMMETRIC KEYPAIR command received");
        
        if (!isPinVerified) {
            return APDU_SECURITY_NOT_SATISFIED;
        }
        
        // In real implementation, generate keypair and return public key
        // For now, return success
        return APDU_SUCCESS;
    }

    private byte[] handleGetPublicKey(byte[] commandApdu) {
        Log.d(TAG, "GET PUBLIC KEY command received");
        
        if (!isPinVerified) {
            return APDU_SECURITY_NOT_SATISFIED;
        }
        
        // In this simplified version, return the stored message as "public key data"
        updateCurrentNfcMessageFromStorage();
        remainingData = currentNfcMessage.getBytes();
        currentOffset = 0;
        
        return getNextChunk();
    }

    /**
     * Get the next chunk of data for chunked transfer
     */
    private byte[] getNextChunk() {
        if (remainingData == null || currentOffset >= remainingData.length) {
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
        Log.d(TAG, "HCE Deactivated: " + reason);
        isAppletSelected = false;
        isPinVerified = false;
        remainingData = null;
        currentOffset = 0;
    }

    /**
     * Reads the NFC message from Capacitor's SharedPreferences
     */
    private void updateCurrentNfcMessageFromStorage() {
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String storedMessage = null;

        try {
            String jsonData = prefs.getString("nfc_message", null);
            if (jsonData != null) {
                try {
                    JSONObject json = new JSONObject(jsonData);
                    storedMessage = json.optString("value", null);

                    if (storedMessage == null || storedMessage.isEmpty()) {
                        Log.w(TAG, "'value' key missing or empty in JSON data.");
                        if (!jsonData.isEmpty()) {
                            storedMessage = jsonData;
                        }
                    }
                    Log.d(TAG, "Successfully parsed message from storage, length: " + 
                              (storedMessage != null ? storedMessage.length() : 0));
                } catch (JSONException e) {
                    Log.w(TAG, "Stored data is not valid JSON, treating as plain string.");
                    storedMessage = jsonData;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error retrieving message from storage: " + e.getMessage());
        }

        if (storedMessage != null && !storedMessage.isEmpty()) {
            currentNfcMessage = storedMessage;
            Log.d(TAG, "Updated NFC message, length: " + currentNfcMessage.length());
        } else {
            currentNfcMessage = "NFC Data Transferred Successfully!";
        }
    }

    /**
     * Converts a byte array to a hexadecimal string
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
        int len = s.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4)
                            + Character.digit(s.charAt(i+1), 16));
        }
        return data;
    }
}