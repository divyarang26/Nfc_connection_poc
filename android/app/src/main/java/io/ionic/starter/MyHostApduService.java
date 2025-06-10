package io.ionic.starter;

import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;
import android.util.Log;
import java.util.Arrays;
import android.content.SharedPreferences;
import android.content.Context;
import org.json.JSONObject;

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
                        
                        // Some readers expect data immediately after SELECT
                        // Let's return the data with the SELECT response
                        String message = getMessage();
                        if (message != null && !message.isEmpty()) {
                            return buildDataResponse(message);
                        }
                        
                        return APDU_SELECT_OK;
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
            
            String message = getMessage();
            return buildDataResponse(message);
        }
        
        // Handle READ BINARY command
        if (ins == (byte)0xB0) {
            Log.d(TAG, "READ BINARY command received");
            String message = getMessage();
            return buildDataResponse(message);
        }
        
        // For any other command after selection, return the data
        if (isSelected) {
            Log.d(TAG, "Unknown command after selection, returning data anyway");
            String message = getMessage();
            return buildDataResponse(message);
        }
        
        return APDU_UNKNOWN;
    }
    
    @Override
    public void onDeactivated(int reason) {
        Log.d(TAG, "HCE Deactivated: " + reason);
        isSelected = false;
    }
    
    private String getMessage() {
        // Get the message from Capacitor's SharedPreferences
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String message = "hello divya"; // Default message
        
        try {
            // Capacitor stores values as JSON objects with a "value" key
            String jsonData = prefs.getString("nfc_message", null);
            if (jsonData != null) {
                JSONObject json = new JSONObject(jsonData);
                message = json.optString("value", "hello divya");
                Log.d(TAG, "Retrieved message from storage: " + message);
            } else {
                Log.d(TAG, "No stored message, using default");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error reading message from storage: " + e.getMessage());
        }
        
        return message;
    }
    
    private byte[] buildDataResponse(String data) {
        if (data == null) data = "hello divya";
        
        byte[] dataBytes = data.getBytes();
        byte[] response = new byte[dataBytes.length + 2];
        System.arraycopy(dataBytes, 0, response, 0, dataBytes.length);
        response[response.length - 2] = (byte)0x90;
        response[response.length - 1] = (byte)0x00;
        
        Log.d(TAG, "Sending response: " + data + " (hex: " + ByteArrayToHexString(response) + ")");
        return response;
    }
    
    public static String ByteArrayToHexString(byte[] bytes) {
        if (bytes == null) return "null";
        StringBuilder sb = new StringBuilder(bytes.length * 3);
        for (int i = 0; i < bytes.length; i++) {
            if (i > 0) sb.append(" ");
            sb.append(String.format("%02X", bytes[i]));
        }
        return sb.toString();
    }
    
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