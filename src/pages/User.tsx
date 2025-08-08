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
  IonIcon,
} from '@ionic/react';
import { keyOutline, checkmarkCircleOutline, alertCircleOutline } from 'ionicons/icons';
import { Nfc, NfcTagTechType, PollingOption } from '@capawesome-team/capacitor-nfc';
import { Capacitor } from '@capacitor/core';

// User Device - Reads public key from merchant's EbioroApplet HCE
const User: React.FC = () => {
  const [receivedPublicKey, setReceivedPublicKey] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [dataProgress, setDataProgress] = useState('');
  const [keyFormat, setKeyFormat] = useState<'unknown' | 'pem' | 'jwk' | 'raw'>('unknown');

  useEffect(() => {
    return () => {
      if (isScanning) {
        Nfc.stopScanSession();
      }
      Nfc.removeAllListeners();
    };
  }, [isScanning]);

  // Simplified EbioroApplet APDU commands (no PIN required)
  const APDU_COMMANDS = {
    SELECT_AID: (aid: string) => {
      const aidBytes = hexToArray(aid);
      return [0x00, 0xA4, 0x04, 0x00, aidBytes.length, ...aidBytes, 0x00];
    },
    GET_PUBLIC_KEY: () => {
      return [0x00, 0x47, 0x00, 0x00, 0x00];
    },
    GET_RESPONSE: (length: number) => {
      return [0x00, 0xC0, 0x00, 0x00, length || 0x00];
    }
  };

  // Read public key from merchant's EbioroApplet HCE
  const readPublicKey = async () => {
    try {
      setIsScanning(true);
      setConnectionStatus('Starting NFC scan for public key...');
      setReceivedPublicKey('');
      setDataProgress('');
      setKeyFormat('unknown');

      await Nfc.removeAllListeners();

      await Nfc.addListener('nfcTagScanned', async (event) => {
        setConnectionStatus('EbioroApplet detected! Reading public key...');

        try {
          await Nfc.stopScanSession();
          await new Promise(resolve => setTimeout(resolve, 100));

          const techTypes = event.nfcTag.techTypes || [];

          if (Capacitor.getPlatform() === 'android' && techTypes.includes(NfcTagTechType.IsoDep)) {
            await Nfc.connect({ techType: NfcTagTechType.IsoDep });

            // 1. Select EbioroApplet
            setDataProgress('Selecting EbioroApplet...');
            const selectResponse = await Nfc.transceive({ 
              data: APDU_COMMANDS.SELECT_AID('F0010203040506') 
            });
            
            if (!checkResponse(selectResponse, 'SELECT')) {
              throw new Error('Failed to select EbioroApplet');
            }

            // 2. Get Public Key (No PIN verification needed!)
            setDataProgress('Requesting public key...');
            const keyResponse = await Nfc.transceive({ 
              data: APDU_COMMANDS.GET_PUBLIC_KEY() 
            });
            
            const publicKeyData = await readAllChunks(keyResponse, 'Public Key');
            console.log("log ~ :97 ~ readPublicKey ~ publicKeyData:", publicKeyData)

            if (publicKeyData) {
              setReceivedPublicKey(publicKeyData);
              setKeyFormat(detectKeyFormat(publicKeyData));
              setConnectionStatus('Public key received successfully!');
              setToastMessage('✅ Public key received from EbioroApplet!');
            } else {
              setToastMessage('⚠️ No public key data received');
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

  // Detect the format of the received public key
  const detectKeyFormat = (keyData: string): 'pem' | 'jwk' | 'raw' | 'unknown' => {
    const trimmed = keyData.trim();
    
    if (trimmed.startsWith('-----BEGIN') && trimmed.endsWith('-----')) {
      return 'pem';
    } else if (trimmed.startsWith('{') && trimmed.includes('"kty"')) {
      return 'jwk';
    } else if (trimmed.length > 50 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
      return 'raw';
    }
    
    return 'unknown';
  };

  const getFormatIcon = () => {
    switch (keyFormat) {
      case 'pem': return checkmarkCircleOutline;
      case 'jwk': return checkmarkCircleOutline;
      case 'raw': return alertCircleOutline;
      default: return keyOutline;
    }
  };

  const getFormatColor = () => {
    switch (keyFormat) {
      case 'pem': return 'success';
      case 'jwk': return 'success';
      case 'raw': return 'warning';
      default: return 'medium';
    }
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

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(receivedPublicKey);
      setToastMessage('📋 Public key copied to clipboard!');
      setShowToast(true);
    } catch (error) {
      setToastMessage('❌ Failed to copy to clipboard');
      setShowToast(true);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>User Device (Public Key Reader)</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={keyOutline} style={{ marginRight: '8px' }} />
              Read Public Key from EbioroApplet
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonButton 
              expand="block" 
              onClick={isScanning ? stopReading : readPublicKey}
              color={isScanning ? 'danger' : 'primary'}
              size="large"
            >
              <IonIcon icon={keyOutline} slot="start" />
              {isScanning ? 'Stop Reading' : 'Read Public Key'}
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

            {receivedPublicKey && (
              <div style={{ marginTop: '20px' }}>
                <IonItem>
                  <IonIcon icon={getFormatIcon()} color={getFormatColor()} slot="start" />
                  <IonLabel>
                    <h3>Public Key Received</h3>
                    <p>Format: {keyFormat.toUpperCase()} | Size: {receivedPublicKey.length} chars</p>
                  </IonLabel>
                </IonItem>

                <div style={{ 
                  marginTop: '15px', 
                  padding: '15px', 
                  backgroundColor: '#e8f5e9', 
                  borderRadius: '8px' 
                }}>
                  <div style={{ 
                    fontSize: '12px', 
                    wordBreak: 'break-all', 
                    backgroundColor: 'white', 
                    padding: '15px', 
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    maxHeight: '300px',
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    lineHeight: '1.4'
                  }}>
                    {receivedPublicKey}
                  </div>

                  <IonButton 
                    fill="outline" 
                    expand="block" 
                    onClick={copyToClipboard}
                    style={{ marginTop: '15px' }}
                  >
                    📋 Copy to Clipboard
                  </IonButton>
                </div>
              </div>
            )}

            <div style={{ 
              marginTop: '20px', 
              padding: '15px', 
              backgroundColor: '#f0f8ff', 
              borderRadius: '8px' 
            }}>
              <IonText color="primary">
                <p><strong>✨ Simplified Process:</strong></p>
                <p style={{ fontSize: '14px' }}>
                  1. Hold phones back-to-back to connect
                  <br />2. EbioroApplet automatically selected
                  <br />3. Public key retrieved instantly (no PIN needed!)
                  <br />4. Supports chunked transfer for large keys
                </p>
              </IonText>
            </div>

            <div style={{ 
              marginTop: '15px', 
              padding: '15px', 
              backgroundColor: '#fff3cd', 
              borderRadius: '8px' 
            }}>
              <IonText color="warning">
                <p><strong>🔒 Security Note:</strong></p>
                <p style={{ fontSize: '12px' }}>
                  Public keys don't require authentication as they are meant to be shared.
                  Private operations (like signing) would still require PIN verification.
                </p>
              </IonText>
            </div>
          </IonCardContent>
        </IonCard>

        <IonLoading 
          isOpen={isScanning} 
          message="Hold phones back-to-back to read public key..." 
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