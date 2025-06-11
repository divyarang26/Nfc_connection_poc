package io.ionic.starter;

import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;
import android.util.Log;
import java.util.Arrays;
import android.content.SharedPreferences;
import android.content.Context;
import org.json.JSONObject;
import org.json.JSONException; // Import JSONException

public class MyHostApduService extends HostApduService {
    private static final String TAG = "MyHostApduService";

    // AID from your apduservice.xml
    private static final byte[] AID1 = HexStringToByteArray("F0010203040506");
    private static final byte[] AID2 = HexStringToByteArray("F0394148148100");

    // Response codes
    private static final byte[] APDU_SELECT_OK = {(byte)0x90, (byte)0x00};
    private static final byte[] APDU_UNKNOWN = {(byte)0x6F, (byte)0x00};

    // State to track if we're selected
    private boolean isSelected = false;

    // Store the last retrieved message in memory for quick access.
    // Initialize with a meaningful default message.
    private String currentNfcMessage = "NFC Data Transferred Successfully!";

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

                        // IMPORTANT: Refresh the message from storage on SELECT.
                        // This ensures the HCE service gets the latest message
                        // whenever a new communication session starts.
                        updateCurrentNfcMessageFromStorage();

                        // Return the currently stored message (which is now updated).
                        return buildDataResponse(currentNfcMessage);
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

        // Handle various GET DATA commands
        if ((cla == 0x00 || cla == (byte)0x80) &&
            (ins == (byte)0xCA || ins == (byte)0xB0 || ins == (byte)0xCB)) {
            Log.d(TAG, "GET DATA command received (CLA=" + String.format("%02X", cla) +
                          ", INS=" + String.format("%02X", ins) + ")");

            // Ensure we use the latest message even for subsequent GET DATA commands
            // (though `updateCurrentNfcMessageFromStorage()` on SELECT should cover most cases)
            updateCurrentNfcMessageFromStorage();
            return buildDataResponse(currentNfcMessage);
        }

        // Handle READ BINARY command
        if (ins == (byte)0xB0) {
            Log.d(TAG, "READ BINARY command received");
            updateCurrentNfcMessageFromStorage();
            return buildDataResponse(currentNfcMessage);
        }

        // For any other command after selection, return the data
        if (isSelected) {
            Log.d(TAG, "Unknown command after selection, returning data anyway");
            updateCurrentNfcMessageFromStorage();
            return buildDataResponse(currentNfcMessage);
        }

        return APDU_UNKNOWN;
    }

    @Override
    public void onDeactivated(int reason) {
        Log.d(TAG, "HCE Deactivated: " + reason);
        isSelected = false;
    }

    /**
     * Reads the NFC message from Capacitor's SharedPreferences and updates
     * the internal `currentNfcMessage` field.
     * This method handles parsing the JSON format that Capacitor uses.
     */
    private void updateCurrentNfcMessageFromStorage() {
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String storedMessage = null; // Temporary variable to hold the retrieved message

        try {
            // Capacitor stores values as JSON objects with a "value" key
            String jsonData = prefs.getString("nfc_message", null);
            if (jsonData != null) {
                try {
                    // Attempt to parse the JSON string
                    JSONObject json = new JSONObject(jsonData);
                    // Use optString to safely get the "value" key, defaulting to null if not present
                    storedMessage = json.optString("value", null);

                    if (storedMessage == null || storedMessage.isEmpty()) {
                         // If "value" key is missing or empty, but jsonData exists,
                         // it might be a direct string or malformed JSON.
                         // Fallback to raw JSON string if it's not empty, otherwise default.
                         Log.w(TAG, "'value' key missing or empty in JSON data. Attempting to use raw data if not null.");
                         if (!jsonData.isEmpty()) {
                             storedMessage = jsonData;
                         }
                    }
                    Log.d(TAG, "Successfully parsed message from storage: " + storedMessage);
                } catch (JSONException e) {
                    // If jsonData is not valid JSON, treat it as a plain string.
                    Log.w(TAG, "Stored data for 'nfc_message' is not valid JSON, treating as plain string. Error: " + e.getMessage());
                    storedMessage = jsonData; // Use the raw data as the message
                }
            } else {
                Log.d(TAG, "No 'nfc_message' found in CapacitorStorage.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error retrieving message from storage: " + e.getMessage());
            // If any other error occurs during retrieval, `storedMessage` remains null,
            // and the default will be applied below.
        }

        // Update the `currentNfcMessage` only if a valid, non-empty message was retrieved.
        if (storedMessage != null && !storedMessage.isEmpty()) {
            currentNfcMessage = storedMessage;
        } else {
            // If no valid message was found, or if it was empty,
            // ensure the message is set to the default meaningful one.
            if (!"NFC Data Transferred Successfully!".equals(currentNfcMessage)) {
                Log.d(TAG, "No valid message retrieved from storage, reverting to default: NFC Data Transferred Successfully!");
                currentNfcMessage = "NFC Data Transferred Successfully!";
            }
        }
        Log.d(TAG, "Final current NFC message set to: " + currentNfcMessage);
    }


    /**
     * Retrieves the current NFC message to be sent to the reader.
     * This method ensures `currentNfcMessage` is updated from storage before returning.
     * @return The message string.
     */
    private String getMessage() {
        // Ensure the internal message is up-to-date before returning it.
        updateCurrentNfcMessageFromStorage();
        return currentNfcMessage;
    }

    /**
     * Builds the APDU response byte array containing the data and the 0x9000 status word.
     * @param data The string data to include in the response.
     * @return The APDU response byte array.
     */
    private byte[] buildDataResponse(String data) {
        // Fallback to the default message if the provided data is null.
        if (data == null) data = "NFC Data Transferred Successfully!";

        byte[] dataBytes = data.getBytes();
        byte[] response = new byte[dataBytes.length + 2]; // Data + 2-byte status word
        System.arraycopy(dataBytes, 0, response, 0, dataBytes.length);
        response[response.length - 2] = (byte)0x90; // Status word part 1
        response[response.length - 1] = (byte)0x00; // Status word part 2

        Log.d(TAG, "Sending response: " + data + " (hex: " + ByteArrayToHexString(response) + ")");
        return response;
    }

    /**
     * Converts a byte array to a hexadecimal string representation.
     * @param bytes The byte array to convert.
     * @return The hexadecimal string.
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
     * @param s The hexadecimal string to convert.
     * @return The byte array.
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