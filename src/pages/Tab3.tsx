// src/pages/NFCRead.tsx (Tab3.tsx)
import React, { useState, useEffect, useMemo } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonText,
  IonToast,
  IonLoading,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
} from '@ionic/react';
import { Nfc, NfcTagTechType, PollingOption } from '@capawesome-team/capacitor-nfc';
import { Capacitor } from '@capacitor/core';
import axios from "axios";
import { PasskeymeSDK } from 'passkeyme-ionic-cap-plugin';


const Tab3: React.FC = () => {
  const [scannedText, setScannedText] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const API_URL = "https://passkeyme.com";
const APP_UUID = "cad7760b-3ee4-4df8-b7b4-73cdeaff0774";
const API_KEY = "36LP0Z0frQaYgqduOXl6fjW0llIhQNXr";

  useEffect(() => {
    return () => {
      if (isLoading) {
        Nfc.stopScanSession();
      }
      Nfc.removeAllListeners();
    };
  }, [isLoading]);

  const addDebugInfo = (info: string) => {
    console.log(info);
    setDebugInfo(prev => [...prev, info]);
  };

  const handleRead = async () => {
    try {
      setIsLoading(true);
      setConnectionStatus('Starting NFC scan...');
      setScannedText('');
      setDebugInfo([]);

      // Prevents multiple listener registrations (avoids duplication bugs).
      await Nfc.removeAllListeners();

      // Adds a listener for when a tag/device is detected
      await Nfc.addListener('nfcTagScanned', async (event) => {
        addDebugInfo('NFC device detected');
        addDebugInfo(`Tech types: ${JSON.stringify(event.nfcTag.techTypes)}`);
        setConnectionStatus('Phone detected! Connecting...');

        try {
          // Stops scanning (we found our tag) and waits briefly before connecting
//           If you don't stop it, the scan session might:
// Interfere with Nfc.connect()
// Keep detecting other tags or retrying
// Cause bugs like duplicated connections or crashes
          await Nfc.stopScanSession();
//Pauses the execution for 100 milliseconds after stopping the scan session.
// It’s a small "cool-down" delay to let the NFC hardware settle before trying to connect with the detected tag.
          await new Promise(resolve => setTimeout(resolve, 100));


          // What is techTypes?
          // techTypes is an array of strings describing the NFC protocols (technologies) that the scanned tag supports.
          
          // Each string represents a type of communication technology, like:
          
          // "Ndef" – NDEF data format (used by typical NFC cards and stickers)
          
          // "IsoDep" – ISO 14443-4 protocol (used by secure cards and HCE services)
          
          // "MifareClassic" or "MifareUltralight" – specific NFC chip families
          
          // "NfcA", "NfcB" – low-level protocols

          const techTypes = event.nfcTag.techTypes || [];
          

          // Only continues on Android, and only if the device supports ISO-DEP (required for HCE).

          if (Capacitor.getPlatform() === 'android') {
            if (!techTypes.includes(NfcTagTechType.IsoDep)) {
              throw new Error('ISO-DEP not supported');
            }

            // Connect to the HCE service
            // Opens connection to the other phone using ISO-DEP protocol.
            await Nfc.connect({ techType: NfcTagTechType.IsoDep });
            addDebugInfo('Connected to ISO-DEP');

            // Try different approaches
            let message = '';
            
            // Approach 1: Try with the first AID
            try {
              // Selects the AID registered by the other phone’s HCE service.
              const selectResponse1 = await selectApplication('F0010203040506');
              addDebugInfo(`SELECT AID1 response: ${arrayToHex(selectResponse1.response)}`);
              
              if (isSuccessResponse(selectResponse1)) {
                // If AID is accepted, request data and decode the message.
                const dataResponse = await getData();
                addDebugInfo(`GET DATA response: ${arrayToHex(dataResponse.response)}`);
                
                if (isSuccessResponse(dataResponse)) {
                  message = decodeResponse(dataResponse.response);
                  addDebugInfo(`Decoded message: ${message}`);
                }
              }
            } catch (e1) {
              addDebugInfo(`AID1 failed: ${e1}`);
            }

            // Approach 2: If first AID failed, try the second one
            if (!message) {
              try {
                const selectResponse2 = await selectApplication('F0394148148100');
                addDebugInfo(`SELECT AID2 response: ${arrayToHex(selectResponse2.response)}`);
                
                if (isSuccessResponse(selectResponse2)) {
                  const dataResponse = await getData();
                  addDebugInfo(`GET DATA response: ${arrayToHex(dataResponse.response)}`);
                  
                  if (isSuccessResponse(dataResponse)) {
                    message = decodeResponse(dataResponse.response);
                    addDebugInfo(`Decoded message: ${message}`);
                  }
                }
              } catch (e2) {
                addDebugInfo(`AID2 failed: ${e2}`);
              }
            }

            // Approach 3: Try reading without GET DATA command
            if (!message) {
              try {
                // Some HCE implementations return data directly after SELECT
                const selectResponse = await selectApplication('F0010203040506');
                if (selectResponse.response && selectResponse.response.length > 2) {
                  // Check if there's data beyond the status bytes
                  const responseData = selectResponse.response.slice(0, -2);
                  if (responseData.length > 0) {
                    message = new TextDecoder().decode(new Uint8Array(responseData));
                    addDebugInfo(`Message from SELECT: ${message}`);
                  }
                }
              } catch (e3) {
                addDebugInfo(`Direct read failed: ${e3}`);
              }
            }

            await Nfc.close();
            addDebugInfo('Connection closed');

            if (message) {
              setScannedText(message);
              let username = "divya"
              console.log("log ~ :182 ~ awaitNfc.addListener ~ message:", message)
              const { credential } = await PasskeymeSDK.passkeyAuthenticate({ challenge: message});
              let completionresponse = await client.post(`/complete_authentication`, { credential });
              // setResult(JSON.stringify(completionresponse.data));
              setToastMessage(`✅ Successfully read: "${message}"`);
              setConnectionStatus('Data received successfully!');
            } else {
              throw new Error('No data received from HCE service');
            }

          } else {
            setToastMessage('❌ HCE reading is only supported on Android');
          }

        } catch (error: any) {
          addDebugInfo(`Error: ${error.message}`);
          setToastMessage(`❌ Error: ${error.message}`);
          setConnectionStatus('Communication failed');
          console.log("log ~ :191 ~ awaitNfc.addListener ~ error.message:", error.message)
          
          try {
            await Nfc.close();
          } catch (closeError) {
            addDebugInfo(`Close error: ${closeError}`);
          }
        }

        setIsLoading(false);
        setShowToast(true);
      });

      await Nfc.addListener('scanSessionError', (event) => {
        addDebugInfo(`Scan error: ${event.message}`);
        setToastMessage(`❌ Scan error: ${event.message}`);
        setShowToast(true);
        setIsLoading(false);
      });

      await Nfc.startScanSession({
        pollingOptions: [PollingOption.iso14443]
      });

      addDebugInfo('NFC scan session started');

    } catch (err: any) {
      addDebugInfo(`Start scan error: ${err.message}`);
      setIsLoading(false);
      setToastMessage(`❌ Failed to start scan: ${err.message}`);
      setShowToast(true);
    }
  };
  const client = useMemo(() => {
    return axios.create({
      baseURL: `${API_URL}/webauthn/${APP_UUID}`,
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
      },
    });
  }, []);

  const handleRegister = async () => {
   
  
    try {
      setIsLoading(true);
  
      const displayName = "divya"; // Use entered username
      const username = "divya";
      const startRes = await client.post("/start_registration", {
        username,
        displayName,
      });
      console.log("log ~ :239 ~ handleRegister ~ startRes:", startRes)
  
      const { credential } = await PasskeymeSDK.passkeyRegister({
        challenge: startRes.data.challenge,
      });
      console.log("log ~ :243 ~ handleRegister ~ credential:", credential)
  
      const completeResponse = await client.post("/complete_registration", 
        { username, credential }
      );
      console.log("log ~ :248 ~ handleRegister ~ completeResponse:", completeResponse)
  
      if (completeResponse.data.success) {
        // Store username with credential
        localStorage.setItem('passkey_username', username);
        localStorage.setItem('passkey_registered', 'true');
       
      } else {
        throw new Error('Registration failed on server');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectApplication = async (aid: string) => {
    const aidBytes = hexToArray(aid);
    const selectCommand = [
      0x00, // CLA
      0xA4, // INS (SELECT)
      0x04, // P1
      0x00, // P2
      aidBytes.length, // Lc
      ...aidBytes, // AID
      0x00  // Le
    ];

    addDebugInfo(`SELECT command: ${arrayToHex(selectCommand)}`);
    return await Nfc.transceive({ data: selectCommand });
  };

  const getData = async () => {
    // Try different GET DATA commands
    const getDataCommands = [
      [0x00, 0xCA, 0x00, 0x00, 0x00], // Standard GET DATA
      [0x00, 0xCA, 0x00, 0x00], // Without Le
      [0x00, 0xB0, 0x00, 0x00, 0x00], // READ BINARY
      [0x80, 0xCA, 0x00, 0x00, 0x00], // Proprietary GET DATA
    ];

    for (const cmd of getDataCommands) {
      try {
        addDebugInfo(`Trying command: ${arrayToHex(cmd)}`);
        const response = await Nfc.transceive({ data: cmd });
        if (isSuccessResponse(response)) {
          return response;
        }
      } catch (e) {
        addDebugInfo(`Command failed: ${e}`);
      }
    }

    throw new Error('All GET DATA commands failed');
  };

  const hexToArray = (hex: string): number[] => {
    const result = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.substr(i, 2), 16));
    }
    return result;
  };

  const arrayToHex = (array: number[]): string => {
    return array.map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
  };

  const isSuccessResponse = (response: any): boolean => {
    if (response.response && response.response.length >= 2) {
      const len = response.response.length;
      return response.response[len - 2] === 0x90 && response.response[len - 1] === 0x00;
    }
    return false;
  };

  const decodeResponse = (responseBytes: number[]): string => {
    const dataBytes = responseBytes.slice(0, -2);
    const decoder = new TextDecoder('utf-8');
    const uint8Array = new Uint8Array(dataBytes);
    return decoder.decode(uint8Array);
  };

  const stopReading = async () => {
    try {
      await Nfc.stopScanSession();
      await Nfc.removeAllListeners();
      setIsLoading(false);
      setConnectionStatus('');
    } catch (error) {
      console.error('Error stopping scan:', error);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Read NFC (from HCE)</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard> 
          <IonButton onClick={handleRegister}>register passkey</IonButton>
        </IonCard>
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Read Data from Another Phone</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonButton 
              expand="block" 
              onClick={isLoading ? stopReading : handleRead}
              color={isLoading ? 'danger' : 'primary'}
            >
              {isLoading ? 'Stop Reading' : 'Start Reading'}
            </IonButton>

            {connectionStatus && (
              <IonText color="medium" style={{ display: 'block', marginTop: '20px', textAlign: 'center' }}>
                <p>{connectionStatus}</p>
              </IonText>
            )}

            {scannedText && (
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
                <IonText color="success">
                  <h3>Received Message:</h3>
                  <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{scannedText}</p>
                </IonText>
              </div>
            )}

            {/* Debug Information */}
            {debugInfo.length > 0 && (
              <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8f8f8', borderRadius: '5px', fontSize: '12px' }}>
                <IonText>
                  <h4>Debug Info:</h4>
                  {debugInfo.map((info, index) => (
                    <p key={index} style={{ margin: '2px 0', fontFamily: 'monospace' }}>{info}</p>
                  ))}
                </IonText>
              </div>
            )}

            <IonText color="primary" style={{ display: 'block', marginTop: '20px', fontSize: '14px' }}>
              <p>📱 Make sure the other phone has the Write NFC page open.</p>
              <p>Hold the phones back-to-back when scanning.</p>
            </IonText>
          </IonCardContent>
        </IonCard>

        <IonLoading 
          isOpen={isLoading} 
          message="Hold phones back-to-back..." 
        />
        
        <IonToast
          isOpen={showToast}
          message={toastMessage}
          duration={3000}
          onDidDismiss={() => setShowToast(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default Tab3;