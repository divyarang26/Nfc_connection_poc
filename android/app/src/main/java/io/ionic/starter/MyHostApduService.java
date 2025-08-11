package io.ionic.starter;

import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;
import android.util.Log;
import java.util.Arrays;
import android.content.SharedPreferences;
import android.content.Context;
import org.json.JSONObject;
import org.json.JSONException;
import android.content.Intent;
public class MyHostApduService extends HostApduService {
    private static final String TAG = "MyHostApduService";

    // AID for PoC HCE
    // private static final byte[] APP_AID_POC = HexStringToByteArray("F0010203040508");
        // AID for EbioroApplet (you'll need to replace with actual AID)
    private static final byte[] APP_AID_POC = HexStringToByteArray("F0010203040508");
    
    // EbioroApplet command codes


    // EbioroApplet / PoC commands
    private static final byte CLA = 0x00;
    private static final byte INS_VERIFY = 0x20;
    private static final byte INS_CHANGE_REFERENCE_DATA = 0x24;
    private static final byte INS_RESET_RETRY_COUNTER = 0x2C;
    private static final byte INS_PERFORM_SECURITY_OPERATION = 0x2A;
    private static final byte INS_MANAGE_SECURITY_ENVIRONMENT = 0x22;
    private static final byte INS_GENERATE_ASYMMETRIC_KEYPAIR = 0x46;
    private static final byte INS_GET_PUBLIC_KEY = 0x47;
    private static final byte INS_GET_RAW_PUBLIC_KEY = 0x48;
    private static final byte INS_WRITE_DATA = 0x60; // custom write command

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

    // Default PIN
    private static final byte[] DEFAULT_PIN = {0x31, 0x32, 0x33, 0x34, 0x35, 0x36}; // "123456"

    @Override

    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "🟢 HCE SERVICE CREATED!");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "🟡 HCE SERVICE STARTED!");
        return super.onStartCommand(intent, flags, startId);
    }
    public byte[] processCommandApdu(byte[] commandApdu, Bundle extras) {
        Log.d(TAG, "Received APDU: " + ByteArrayToHexString(commandApdu));

        if (commandApdu == null || commandApdu.length < 4) {
            return APDU_UNKNOWN;
        }

        byte ins = commandApdu[1];

        // Handle SELECT AID
        if (ins == (byte)0xA4) {
            return handleSelect(commandApdu);
        }

        // Must select first
        if (!isAppletSelected) {
            Log.d(TAG, "Applet not selected yet");
            return APDU_UNKNOWN;
        }

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
            case (byte)0xC0:
                return getNextChunk();
            case INS_WRITE_DATA:
                return handleWriteData(commandApdu);
            default:
                Log.d(TAG, "Unknown INS: " + String.format("%02X", ins));
                return APDU_UNKNOWN;
        }
    }

private byte[] handleSelect(byte[] commandApdu) {
    Log.d(TAG, "SELECT command received");
    Log.d(TAG, "Full APDU: " + ByteArrayToHexString(commandApdu));
    
    // Check if it's a SELECT by AID command (INS=0xA4, P1=0x04, P2=0x00)
    if (commandApdu.length >= 4 && 
        commandApdu[1] == (byte)0xA4 && 
        commandApdu[2] == (byte)0x04 && 
        commandApdu[3] == (byte)0x00) {
        
        if (commandApdu.length > 5) {
            int lc = commandApdu[4] & 0xFF;
            if (commandApdu.length >= 5 + lc) {
                byte[] aid = Arrays.copyOfRange(commandApdu, 5, 5 + lc);

                Log.d(TAG, "AID from APDU: " + ByteArrayToHexString(aid));
                Log.d(TAG, "Expected AID:  " + ByteArrayToHexString(APP_AID_POC));

                if (Arrays.equals(aid, APP_AID_POC)) {
                    Log.d(TAG, "PoC AID selected!");
                    isAppletSelected = true;
                    isPinVerified = false;

                    updateCurrentNfcMessageFromStorage();
                    remainingData = currentNfcMessage.getBytes();
                    currentOffset = 0;
                    return APDU_SUCCESS; // 90 00
                } else {
                    Log.d(TAG, "AID not matched");
                }
            }
        }
    }
    
    isAppletSelected = false;
    Log.d(TAG, "Returning file not found");
    return new byte[]{(byte)0x6A, (byte)0x82}; // File not found
}

    private byte[] handleVerifyPin(byte[] commandApdu) {
        if (commandApdu[2] != 0x00 || commandApdu[3] != 0x01) return APDU_INCORRECT_P1P2;
        if (commandApdu.length < 5 || commandApdu[4] != 0x06) return APDU_WRONG_LENGTH;

        byte[] providedPin = Arrays.copyOfRange(commandApdu, 5, 11);
        if (Arrays.equals(providedPin, DEFAULT_PIN)) {
            isPinVerified = true;
            return APDU_SUCCESS;
        } else {
            return new byte[]{(byte)0x63, (byte)0xC2};
        }
    }

    private byte[] handleChangeReferenceData(byte[] commandApdu) {
        if (commandApdu[2] == 0x01 && commandApdu[3] == 0x01) return APDU_SUCCESS;
        if (commandApdu[2] == 0x00 && commandApdu[3] == 0x01) {
            if (!isPinVerified) return APDU_SECURITY_NOT_SATISFIED;
            return APDU_SUCCESS;
        }
        return APDU_INCORRECT_P1P2;
    }

    private byte[] handleResetRetryCounter(byte[] commandApdu) {
        if (commandApdu[2] != 0x00 || commandApdu[3] != 0x01) return APDU_INCORRECT_P1P2;
        return APDU_SUCCESS;
    }

    private byte[] handlePerformSecurityOperation(byte[] commandApdu) {
        if (!isPinVerified) return APDU_SECURITY_NOT_SATISFIED;
        if (commandApdu[2] == (byte)0x9E && commandApdu[3] == (byte)0x9A) {
            updateCurrentNfcMessageFromStorage();
            remainingData = currentNfcMessage.getBytes();
            currentOffset = 0;
            return getNextChunk();
        }
        return APDU_INCORRECT_P1P2;
    }

    private byte[] handleManageSecurityEnvironment(byte[] commandApdu) {
        if (!isPinVerified) return APDU_SECURITY_NOT_SATISFIED;
        if (commandApdu[2] == 0x41) return APDU_SUCCESS;
        if (commandApdu[2] == (byte)0xF3) return APDU_SUCCESS;
        return APDU_INCORRECT_P1P2;
    }

    private byte[] handleGenerateKeypair(byte[] commandApdu) {
        if (!isPinVerified) return APDU_SECURITY_NOT_SATISFIED;
        return APDU_SUCCESS;
    }

    private byte[] handleGetPublicKey(byte[] commandApdu) {
        updateCurrentNfcMessageFromStorage();
        remainingData = currentNfcMessage.getBytes();
        currentOffset = 0;
        return getNextChunk();
    }

    private byte[] handleWriteData(byte[] commandApdu) {
        Log.d(TAG, "WRITE DATA command received");

        if (commandApdu.length < 5) return APDU_WRONG_LENGTH;

        int lc = commandApdu[4] & 0xFF;
        if (commandApdu.length < 5 + lc) return APDU_WRONG_LENGTH;

        byte[] dataBytes = Arrays.copyOfRange(commandApdu, 5, 5 + lc);
        String receivedData = new String(dataBytes);

        Log.d(TAG, "Received data: " + receivedData);

        try {
            JSONObject json = new JSONObject();
            json.put("value", receivedData);

            SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            prefs.edit().putString("nfc_message", json.toString()).apply();

            Log.d(TAG, "Data saved to storage.");
            return APDU_SUCCESS;
        } catch (JSONException e) {
            Log.e(TAG, "Error saving data: " + e.getMessage());
            return APDU_UNKNOWN;
        }
    }

    private byte[] getNextChunk() {
        if (remainingData == null || currentOffset >= remainingData.length) return APDU_SUCCESS;

        int remainingBytes = remainingData.length - currentOffset;
        int chunkSize = Math.min(remainingBytes, MAX_CHUNK_SIZE);
        byte[] chunk = Arrays.copyOfRange(remainingData, currentOffset, currentOffset + chunkSize);
        currentOffset += chunkSize;

        boolean hasMoreData = currentOffset < remainingData.length;
        byte[] response = new byte[chunk.length + 2];
        System.arraycopy(chunk, 0, response, 0, chunk.length);

        if (hasMoreData) {
            response[response.length - 2] = (byte)0x61;
            int nextChunkSize = Math.min(remainingData.length - currentOffset, 255);
            response[response.length - 1] = (byte)(nextChunkSize & 0xFF);
        } else {
            response[response.length - 2] = (byte)0x90;
            response[response.length - 1] = (byte)0x00;
        }

        return response;
    }

    @Override
    public void onDeactivated(int reason) {
                Log.d(TAG, "🔴 HCE SERVICE DEACTIVATED: " + reason);
        isAppletSelected = false;
        isPinVerified = false;
        remainingData = null;
        currentOffset = 0;
    }

    private void updateCurrentNfcMessageFromStorage() {
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String storedMessage = null;

        try {
            String jsonData = prefs.getString("nfc_message", null);
            if (jsonData != null) {
                try {
                    JSONObject json = new JSONObject(jsonData);
                    storedMessage = json.optString("value", null);
                    if (storedMessage == null || storedMessage.isEmpty()) storedMessage = jsonData;
                } catch (JSONException e) {
                    storedMessage = jsonData;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error retrieving message: " + e.getMessage());
        }

        currentNfcMessage = (storedMessage != null && !storedMessage.isEmpty())
                ? storedMessage
                : "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...\n-----END PUBLIC KEY-----";
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
