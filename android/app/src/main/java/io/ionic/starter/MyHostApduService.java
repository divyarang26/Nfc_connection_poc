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

    // AID from your apduservice.xml
    private static final byte[] AID1 = HexStringToByteArray("F0010203040506");
    private static final byte[] AID2 = HexStringToByteArray("F0394148148100");

    // Response codes
    private static final byte[] APDU_SELECT_OK = {(byte)0x90, (byte)0x00};
    private static final byte[] APDU_UNKNOWN = {(byte)0x6F, (byte)0x00};
    
    // Maximum chunk size (leave room for status bytes)
    private static final int MAX_CHUNK_SIZE = 250;

    // State tracking
    private boolean isSelected = false;
    private String currentNfcMessage = "NFC Data Transferred Successfully!";
    private byte[] remainingData = null;
    private int currentOffset = 0;

    @Override
    public byte[] processCommandApdu(byte[] commandApdu, Bundle extras) {
        Log.d(TAG, "Received APDU: " + ByteArrayToHexString(commandApdu));

        if (commandApdu == null || commandApdu.length < 4) {
            return APDU_UNKNOWN;
        }

        // Extract command parts
        byte cla = commandApdu[0];
        byte ins = commandApdu[1];
        byte p1 = commandApdu[2];
        byte p2 = commandApdu[3];

        // Check if this is a SELECT command
        if (ins == (byte)0xA4) {
            Log.d(TAG, "SELECT command received");
            // Check if it's selecting our AID
            if (commandApdu.length > 5) {
                int lc = commandApdu[4];
                if (commandApdu.length >= 5 + lc) {
                    byte[] aid = Arrays.copyOfRange(commandApdu, 5, 5 + lc);
                    if (Arrays.equals(aid, AID1) || Arrays.equals(aid, AID2)) {
                        Log.d(TAG, "Our AID selected!");
                        isSelected = true;

                        // Refresh the message from storage
                        updateCurrentNfcMessageFromStorage();
                        
                        // Initialize data for chunked transfer
                        remainingData = currentNfcMessage.getBytes();
                        currentOffset = 0;
                        
                        // Return first chunk
                        return getNextChunk();
                    }
                }
            }
            isSelected = false;
            return APDU_UNKNOWN;
        }

        // If not selected, reject other commands
        if (!isSelected) {
            Log.d(TAG, "Not selected, rejecting command");
            return APDU_UNKNOWN;
        }

        // GET RESPONSE command (0xC0) - used to get remaining data
        if (ins == (byte)0xC0) {
            Log.d(TAG, "GET RESPONSE command - sending next chunk");
            return getNextChunk();
        }

        // Handle various GET DATA commands
        if ((cla == 0x00 || cla == (byte)0x80) &&
            (ins == (byte)0xCA || ins == (byte)0xB0 || ins == (byte)0xCB)) {
            Log.d(TAG, "GET DATA command received (CLA=" + String.format("%02X", cla) +
                          ", INS=" + String.format("%02X", ins) + ")");

            // Reset and send first chunk
            updateCurrentNfcMessageFromStorage();
            remainingData = currentNfcMessage.getBytes();
            currentOffset = 0;
            return getNextChunk();
        }

        // Handle READ BINARY command
        if (ins == (byte)0xB0) {
            Log.d(TAG, "READ BINARY command received");
            updateCurrentNfcMessageFromStorage();
            remainingData = currentNfcMessage.getBytes();
            currentOffset = 0;
            return getNextChunk();
        }

        // For any other command after selection, return the data
        if (isSelected) {
            Log.d(TAG, "Unknown command after selection, returning data anyway");
            updateCurrentNfcMessageFromStorage();
            remainingData = currentNfcMessage.getBytes();
            currentOffset = 0;
            return getNextChunk();
        }

        return APDU_UNKNOWN;
    }

    /**
     * Get the next chunk of data
     */
    private byte[] getNextChunk() {
        if (remainingData == null || currentOffset >= remainingData.length) {
            // No more data
            return APDU_SELECT_OK;
        }

        // Calculate chunk size
        int remainingBytes = remainingData.length - currentOffset;
        int chunkSize = Math.min(remainingBytes, MAX_CHUNK_SIZE);
        
        // Extract chunk
        byte[] chunk = Arrays.copyOfRange(remainingData, currentOffset, currentOffset + chunkSize);
        currentOffset += chunkSize;
        
        // Check if more data remains
        boolean hasMoreData = currentOffset < remainingData.length;
        
        // Build response
        byte[] response;
        if (hasMoreData) {
            // Data + status indicating more data (61XX where XX is next chunk size or 00)
            response = new byte[chunk.length + 2];
            System.arraycopy(chunk, 0, response, 0, chunk.length);
            response[response.length - 2] = (byte)0x61;
            // Indicate how many bytes are available (max 255, use 00 for more)
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
        isSelected = false;
        remainingData = null;
        currentOffset = 0;
    }

    /**
     * Reads the NFC message from Capacitor's SharedPreferences and updates
     * the internal `currentNfcMessage` field.
     * This method handles parsing the JSON format that Capacitor uses.
     */
    private void updateCurrentNfcMessageFromStorage() {
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String storedMessage = null;

        try {
            // Capacitor stores values as JSON objects with a "value" key
            String jsonData = prefs.getString("nfc_message", null);
            if (jsonData != null) {
                try {
                    // Attempt to parse the JSON string
                    JSONObject json = new JSONObject(jsonData);
                    storedMessage = json.optString("value", null);

                    if (storedMessage == null || storedMessage.isEmpty()) {
                         Log.w(TAG, "'value' key missing or empty in JSON data. Attempting to use raw data.");
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
            } else {
                Log.d(TAG, "No 'nfc_message' found in CapacitorStorage.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error retrieving message from storage: " + e.getMessage());
        }

        // Update the currentNfcMessage only if a valid message was retrieved
        if (storedMessage != null && !storedMessage.isEmpty()) {
            currentNfcMessage = storedMessage;
            Log.d(TAG, "Updated NFC message, length: " + currentNfcMessage.length());
        } else {
            if (!"NFC Data Transferred Successfully!".equals(currentNfcMessage)) {
                Log.d(TAG, "No valid message retrieved, using default");
                currentNfcMessage = "NFC Data Transferred Successfully!";
            }
        }
    }

    /**
     * Converts a byte array to a hexadecimal string representation.
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
     * Converts a hexadecimal string to a byte array.
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