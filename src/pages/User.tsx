import React, { useState, useEffect } from 'react';
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
  IonItem,
  IonLabel,
  IonInput,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react';
import { Nfc, NfcTagTechType, PollingOption } from '@capawesome-team/capacitor-nfc';
import { Capacitor } from '@capacitor/core';

// User Device - Reads data from merchant's EbioroApplet HCE
const User: React.FC = () => {
  const [receivedData, setReceivedData] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [dataProgress, setDataProgress] = useState('');
  const [pin, setPin] = useState('123456');
  const [operation, setOperation] = useState<'sign' | 'getkey'>('sign');

  useEffect(() => {
    return () => {
      if (isScanning) {
        Nfc.stopScanSession();
      }
      Nfc.removeAllListeners();
    };
  }, [isScanning]);

  // EbioroApplet APDU commands
  const APDU_COMMANDS = {
    SELECT_AID: (aid: string) => {
      const aidBytes = hexToArray(aid);
      return [0x00, 0xA4, 0x04, 0x00, aidBytes.length, ...aidBytes, 0x00];
    },
    VERIFY_PIN: (pinDigits: string) => {
      const pinBytes = Array.from(pinDigits).map(d => 0x30 + parseInt(d));
      return [0x00, 0x20, 0x00, 0x01, 0x06, ...pinBytes, 0x00];
    },
    MANAGE_SECURITY_ENV_SIGN: () => {
      // Set algorithm and key for signature (P1=0x41, P2=0xB6)
      // TLV: 80 01 EC (Algorithm: EC) 84 01 00 (Key slot: 0)
      return [0x00, 0x22, 0x41, 0xB6, 0x06, 0x80, 0x01, 0xEC, 0x84, 0x01, 0x00, 0x00];
    },
    PERFORM_SIGN: () => {
      // Sign operation (P1=0x9E, P2=0x9A)
      // In real use, this would include a 32-byte hash
      const dummyHash = new Array(32).fill(0x00);
      return [0x00, 0x2A, 0x9E, 0x9A, 0x20, ...dummyHash, 0x00];
    },
    GET_PUBLIC_KEY: () => {
      return [0x00, 0x47, 0x00, 0x00, 0x00];
    },
    GET_RESPONSE: (length: number) => {
      return [0x00, 0xC0, 0x00, 0x00, length || 0x00];
    }
  };

  // Read data from merchant's EbioroApplet HCE
  const readData = async () => {
    try {
      if (pin.length !== 6) {
        setToastMessage('⚠️ PIN must be exactly 6 digits');
        setShowToast(true);
        return;
      }

      setIsScanning(true);
      setConnectionStatus('Starting NFC scan...');
      setReceivedData('');
      setDataProgress('');

      await Nfc.removeAllListeners();

      await Nfc.addListener('nfcTagScanned', async (event) => {
        setConnectionStatus('EbioroApplet detected! Authenticating...');

        try {
          await Nfc.stopScanSession();
          await new Promise(resolve => setTimeout(resolve, 100));

          const techTypes = event.nfcTag.techTypes || [];

          if (Capacitor.getPlatform() === 'android' && techTypes.includes(NfcTagTechType.IsoDep)) {
            await Nfc.connect({ techType: NfcTagTechType.IsoDep });

            // 1. Select EbioroApplet
            setDataProgress('Selecting applet...');
            const selectResponse = await Nfc.transceive({ 
              data: APDU_COMMANDS.SELECT_AID('F0010203040506') 
            });
            
            if (!checkResponse(selectResponse, 'SELECT')) {
              throw new Error('Failed to select applet');
            }

            // 2. Verify PIN
            setDataProgress('Verifying PIN...');
            const verifyResponse = await Nfc.transceive({ 
              data: APDU_COMMANDS.VERIFY_PIN(pin) 
            });
            
            if (!checkResponse(verifyResponse, 'VERIFY PIN')) {
              const sw1 = verifyResponse.response[verifyResponse.response.length - 2];
              const sw2 = verifyResponse.response[verifyResponse.response.length - 1];
              if (sw1 === 0x63) {
                const triesLeft = sw2 & 0x0F;
                throw new Error(`Wrong PIN! ${triesLeft} tries remaining`);
              }
              throw new Error('PIN verification failed');
            }

            // 3. Perform selected operation
            let finalData = '';
            
            if (operation === 'sign') {
              // Set security environment for signature
              setDataProgress('Setting security environment...');
              const secEnvResponse = await Nfc.transceive({ 
                data: APDU_COMMANDS.MANAGE_SECURITY_ENV_SIGN() 
              });
              
              if (!checkResponse(secEnvResponse, 'MANAGE SECURITY ENV')) {
                throw new Error('Failed to set security environment');
              }

              // Perform signature
              setDataProgress('Performing signature...');
              const signResponse = await Nfc.transceive({ 
                data: APDU_COMMANDS.PERFORM_SIGN() 
              });
              
              finalData = await readAllChunks(signResponse, 'Signature');
              
            } else {
              // Get public key
              setDataProgress('Getting public key...');
              const keyResponse = await Nfc.transceive({ 
                data: APDU_COMMANDS.GET_PUBLIC_KEY() 
              });
              
              finalData = await readAllChunks(keyResponse, 'Public Key');
            }

            if (finalData) {
              setReceivedData(finalData);
              setConnectionStatus(`${operation === 'sign' ? 'Signature' : 'Public Key'} received successfully!`);
              setToastMessage(`✅ ${operation === 'sign' ? 'Signature' : 'Public Key'} received from EbioroApplet!`);
            } else {
              setToastMessage('⚠️ No data received from applet');
              setConnectionStatus('No data found');
            }

            await Nfc.close();
          } else {
            setToastMessage('❌ Incompatible NFC technology');
            setConnectionStatus('Technology not supported');
          }
        } catch (error: any) {
          setToastMessage(`❌ Error: ${error.message}`);
          setConnectionStatus('Operation failed');
        }

        setIsScanning(false);
        setShowToast(true);
      });

      await Nfc.startScanSession({
        pollingOptions: [PollingOption.iso14443]
      });

    } catch (err: any) {
      setIsScanning(false);
      setToastMessage(`❌ Failed to start scan: ${err.message}`);
      setConnectionStatus('Scan failed to start');
      setShowToast(true);
    }
  };

  // Check APDU response status
  const checkResponse = (response: any, operation: string): boolean => {
    if (!response || !response.response || response.response.length < 2) {
      console.error(`${operation}: No response`);
      return false;
    }
    
    const sw1 = response.response[response.response.length - 2];
    const sw2 = response.response[response.response.length - 1];
    
    if (sw1 === 0x90 && sw2 === 0x00) {
      console.log(`${operation}: Success`);
      return true;
    }
    
    console.error(`${operation}: Error SW1=${sw1.toString(16)} SW2=${sw2.toString(16)}`);
    return false;
  };

  // Read all chunks of data (handles status 61XX)
  const readAllChunks = async (initialResponse: any, dataType: string): Promise<string> => {
    let allData: number[] = [];
    let currentResponse = initialResponse;
    let chunkCount = 0;
    
    try {
      while (currentResponse && currentResponse.response && currentResponse.response.length > 2) {
        const response = currentResponse.response;
        const sw1 = response[response.length - 2];
        const sw2 = response[response.length - 1];
        
        // Extract data (excluding status bytes)
        const chunkData = response.slice(0, -2);
        allData = allData.concat(chunkData);
        chunkCount++;
        
        // Update progress
        setDataProgress(`Reading ${dataType} chunk ${chunkCount}... (${allData.length} bytes)`);
        
        // Check if more data is available (status 61XX)
        if (sw1 === 0x61) {
          // More data available, send GET RESPONSE command
          const getResponseCommand = APDU_COMMANDS.GET_RESPONSE(sw2);
          currentResponse = await Nfc.transceive({ data: getResponseCommand });
        } else if (sw1 === 0x90 && sw2 === 0x00) {
          // Success, no more data
          break;
        } else {
          // Error or unexpected status
          console.error(`Unexpected status: ${sw1.toString(16)} ${sw2.toString(16)}`);
          break;
        }
      }
      
      // Convert accumulated data to string
      if (allData.length > 0) {
        const uint8Array = new Uint8Array(allData);
        const decodedData = new TextDecoder().decode(uint8Array);
        setDataProgress(`Complete! ${chunkCount} chunks, ${allData.length} bytes total`);
        return decodedData;
      }
      
    } catch (error) {
      console.error('Error reading chunks:', error);
      setDataProgress(`Error after ${chunkCount} chunks`);
    }
    
    return '';
  };

  const hexToArray = (hex: string): number[] => {
    const result = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.substr(i, 2), 16));
    }
    return result;
  };

  const stopReading = async () => {
    try {
      await Nfc.stopScanSession();
      await Nfc.removeAllListeners();
      setIsScanning(false);
      setConnectionStatus('');
      setDataProgress('');
      setToastMessage('🛑 NFC scan stopped');
      setShowToast(true);
    } catch (error: any) {
      setToastMessage(`❌ Error stopping scan: ${error.message}`);
      setShowToast(true);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>User Device (EbioroApplet Reader)</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Read from EbioroApplet HCE</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="floating">PIN (6 digits)</IonLabel>
              <IonInput
                value={pin}
                onIonChange={(e) => setPin(e.detail.value!)}
                placeholder="123456"
                maxlength={6}
                type="number"
              />
            </IonItem>

            <IonSegment 
              value={operation} 
              onIonChange={e => setOperation(e.detail.value as 'sign' | 'getkey')}
              className="ion-margin-vertical"
            >
              <IonSegmentButton value="sign">
                <IonLabel>Digital Signature</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="getkey">
                <IonLabel>Get Public Key</IonLabel>
              </IonSegmentButton>
            </IonSegment>

            <IonButton 
              expand="block" 
              onClick={isScanning ? stopReading : readData}
              color={isScanning ? 'danger' : 'primary'}
            >
              {isScanning ? 'Stop Reading' : `Read ${operation === 'sign' ? 'Signature' : 'Public Key'}`}
            </IonButton>

            {connectionStatus && (
              <IonText color="medium" style={{ display: 'block', marginTop: '20px', textAlign: 'center' }}>
                <p><strong>Status:</strong> {connectionStatus}</p>
              </IonText>
            )}

            {dataProgress && (
              <IonText color="secondary" style={{ display: 'block', marginTop: '10px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px' }}>{dataProgress}</p>
              </IonText>
            )}

            {receivedData && (
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
                <IonText color="success">
                  <h4>{operation === 'sign' ? 'Digital Signature' : 'Public Key'} Received</h4>
                  <p style={{ 
                    fontSize: '14px', 
                    wordBreak: 'break-all', 
                    backgroundColor: 'white', 
                    padding: '10px', 
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    maxHeight: '300px',
                    overflow: 'auto',
                    fontFamily: 'monospace'
                  }}>
                    {receivedData}
                  </p>
                  <p style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>
                    Length: {receivedData.length} characters
                  </p>
                </IonText>
              </div>
            )}

            <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
              <IonText color="primary" style={{ fontSize: '14px' }}>
                <p><strong>Instructions:</strong></p>
                <p>1. Make sure the merchant device has HCE activated</p>
                <p>2. Enter the same PIN as configured on merchant</p>
                <p>3. Select operation type (Signature or Public Key)</p>
                <p>4. Hold phones back-to-back to connect</p>
              </IonText>
            </div>
          </IonCardContent>
        </IonCard>

        <IonLoading 
          isOpen={isScanning} 
          message="Hold phones back-to-back to read from EbioroApplet..." 
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

export default User;