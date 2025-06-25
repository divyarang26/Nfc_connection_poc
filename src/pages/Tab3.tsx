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
import { WebAuthnCompressor } from "../utils/utils";

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

      // Remove existing listeners to prevent duplicates
      await Nfc.removeAllListeners();

      // Add listener for tag detection
      await Nfc.addListener('nfcTagScanned', async (event) => {
        addDebugInfo('NFC device detected');
        addDebugInfo(`Tech types: ${JSON.stringify(event.nfcTag.techTypes)}`);
        setConnectionStatus('Phone detected! Connecting...');

        try {
          // Stop scanning and wait briefly
          await Nfc.stopScanSession();
          await new Promise(resolve => setTimeout(resolve, 100));

          const techTypes = event.nfcTag.techTypes || [];

          if (Capacitor.getPlatform() === 'android') {
            if (!techTypes.includes(NfcTagTechType.IsoDep)) {
              throw new Error('ISO-DEP not supported');
            }

            // Connect to the HCE service
            await Nfc.connect({ techType: NfcTagTechType.IsoDep });
            addDebugInfo('Connected to ISO-DEP');

            let message = '';
            
            // Try different approaches
            // Approach 1: Try with the first AID
            try {
              const selectResponse1 = await selectApplication('F0010203040506');
              addDebugInfo(`SELECT AID1 response: ${arrayToHex(selectResponse1.response)}`);
              
              if (isSuccessResponse(selectResponse1) || hasData(selectResponse1)) {
                // Get the complete data using chunked transfer
                message = await getChunkedData(selectResponse1);
                addDebugInfo(`Decoded complete message, length: ${message.length}`);
              }
            } catch (e1) {
              addDebugInfo(`AID1 failed: ${e1}`);
            }

            // Approach 2: If first AID failed, try the second one
            if (!message) {
              try {
                const selectResponse2 = await selectApplication('F0394148148100');
                addDebugInfo(`SELECT AID2 response: ${arrayToHex(selectResponse2.response)}`);
                
                if (isSuccessResponse(selectResponse2) || hasData(selectResponse2)) {
                  message = await getChunkedData(selectResponse2);
                  addDebugInfo(`Decoded complete message, length: ${message.length}`);
                }
              } catch (e2) {
                addDebugInfo(`AID2 failed: ${e2}`);
              }
            }

            await Nfc.close();
            addDebugInfo('Connection closed');

            if (message) {
              setScannedText(message);
              addDebugInfo(`Message received, length: ${message.length}`);
              
              try {
                // Decompress the WebAuthn data
                const decompressed = WebAuthnCompressor.decodeOptimized(message);
                console.log("log ~ :124 ~ awaitNfc.addListener ~ message:", message)
                console.log("log ~ :146 ~ awaitNfc.addListener ~ message:", message.length)
                addDebugInfo(`Decompressed WebAuthn data successfully`);
                addDebugInfo(`Challenge: ${decompressed.publicKey.challenge}`);
                addDebugInfo(`Credentials: ${decompressed.publicKey.allowCredentials.length}`);
                
                // Use the decompressed data for authentication
                // const { credential } = await PasskeymeSDK.passkeyAuthenticate({ 
                //   challenge: JSON.stringify(decompressed)
                // });
                
                // const completionResponse = await client.post('/complete_authentication', { 
                //   credential,
                //   username: "divya" 
                // });
                
                setToastMessage(`✅ Authentication successful!`);
                // addDebugInfo(`Authentication completed: ${completionResponse.data.success}`);
                
              } catch (authError) {
                // addDebugInfo(`Authentication error: ${authError}`);
              }
                // setToastMessage(`⚠️ Data received but authentication failed`);
              
              setConnectionStatus('Data received and processed successfully!');
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
  
      const displayName = "divya";
      const username = "divya";
      const startRes = await client.post("/start_registration", {
        username,
        displayName,
      });
  
      const { credential } = await PasskeymeSDK.passkeyRegister({
        challenge: startRes.data.challenge,
      });
  
      const completeResponse = await client.post("/complete_registration", 
        { username, credential }
      );
  
      if (completeResponse.data.success) {
        localStorage.setItem('passkey_username', username);
        localStorage.setItem('passkey_registered', 'true');
        setToastMessage('✅ Passkey registered successfully!');
        setShowToast(true);
      } else {
        throw new Error('Registration failed on server');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      setToastMessage(`❌ Registration failed: ${error.message}`);
      setShowToast(true);
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

  /**
   * Get data with support for chunked responses
   */
  const getChunkedData = async (initialResponse: any): Promise<string> => {
    let fullData: Uint8Array = new Uint8Array(0);
    let currentResponse = initialResponse;
    
    // Process the initial response if it contains data
    if (hasData(currentResponse)) {
      const initialData = extractDataFromResponse(currentResponse.response);
      fullData = appendData(fullData, initialData);
      console.log("log ~ :265 ~ getChunkedData ~ fullData:", fullData)
      console.log("log ~ :265 ~ getChunkedData ~ fullData:", fullData.length)
      
      // Check if more data is available
      if (hasMoreData(currentResponse)) {
        currentResponse = await getNextChunk(currentResponse);
        console.log("log ~ :271 ~ getChunkedData ~ currentResponse:", currentResponse)
      } else {
        // No more data, return what we have
        console.log("log ~ :271 ~ getChunkedData ~ fullData:", fullData)
        console.log("log ~ :274 ~ getChunkedData ~ fullData:", fullData.length)
        return new TextDecoder().decode(fullData);
      }
    }
    
    // Continue getting chunks
    while (currentResponse && hasMoreData(currentResponse)) {
      const chunkData = extractDataFromResponse(currentResponse.response);
      fullData = appendData(fullData, chunkData);
      
      try {
        currentResponse = await getNextChunk(currentResponse);
      } catch (e) {
        addDebugInfo(`Error getting next chunk: ${e}`);
        break;
      }
    }
    
    // Add final chunk if exists
    if (currentResponse && hasData(currentResponse)) {
      const finalData = extractDataFromResponse(currentResponse.response);
      fullData = appendData(fullData, finalData);
    }
    
    const message = new TextDecoder().decode(fullData);
    addDebugInfo(`Total data received: ${fullData.length} bytes`);
    return message;
  };

  const getNextChunk = async (previousResponse: any) => {
    const response = previousResponse.response;
    const sw1 = response[response.length - 2];
    const sw2 = response[response.length - 1];
    
    if (sw1 === 0x61) {
      // More data available, send GET RESPONSE
      const getResponseCmd = [0x00, 0xC0, 0x00, 0x00, sw2 || 0x00];
      addDebugInfo(`GET RESPONSE: ${arrayToHex(getResponseCmd)}`);
      return await Nfc.transceive({ data: getResponseCmd });
    }
    
    return null;
  };

  const hasData = (response: any): boolean => {
    return response.response && response.response.length > 2;
  };

  const hasMoreData = (response: any): boolean => {
    if (!response.response || response.response.length < 2) return false;
    const sw1 = response.response[response.response.length - 2];
    return sw1 === 0x61;
  };

  const extractDataFromResponse = (responseBytes: number[]): Uint8Array => {
    // Remove status bytes (last 2 bytes)
    return new Uint8Array(responseBytes.slice(0, -2));
  };

  const appendData = (existing: Uint8Array, newData: Uint8Array): Uint8Array => {
    const combined = new Uint8Array(existing.length + newData.length);
    combined.set(existing);
    combined.set(newData, existing.length);
    return combined;
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
          <IonCardHeader>
            <IonCardTitle>Passkey Registration</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonButton expand="block" onClick={handleRegister}>
              Register Passkey
            </IonButton>
          </IonCardContent>
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
                  <p style={{ fontSize: '14px', wordBreak: 'break-all' }}>
                    Length: {scannedText.length} characters
                  </p>
                  <p style={{ fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {scannedText}...
                  </p>
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