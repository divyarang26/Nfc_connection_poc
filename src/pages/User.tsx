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
} from '@ionic/react';
import { Nfc, NfcTagTechType, PollingOption } from '@capawesome-team/capacitor-nfc';
import { Capacitor } from '@capacitor/core';

// User Device - Reads data from merchant via NFC with chunked transfer support
const User: React.FC = () => {
  const [receivedData, setReceivedData] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [dataProgress, setDataProgress] = useState('');

  useEffect(() => {
    return () => {
      if (isScanning) {
        Nfc.stopScanSession();
      }
      Nfc.removeAllListeners();
    };
  }, [isScanning]);

  // Read data from merchant via NFC
  const readData = async () => {
    try {
      setIsScanning(true);
      setConnectionStatus('Starting NFC scan...');
      setReceivedData('');
      setDataProgress('');

      await Nfc.removeAllListeners();

      await Nfc.addListener('nfcTagScanned', async (event) => {
        setConnectionStatus('Merchant device detected! Reading data...');

        try {
          await Nfc.stopScanSession();
          await new Promise(resolve => setTimeout(resolve, 100));

          const techTypes = event.nfcTag.techTypes || [];

          if (Capacitor.getPlatform() === 'android' && techTypes.includes(NfcTagTechType.IsoDep)) {
            await Nfc.connect({ techType: NfcTagTechType.IsoDep });

            // Select the HCE application
            const selectResponse = await selectApplication('F0010203040506');
            
            if (selectResponse.response && selectResponse.response.length > 2) {
              // Read all chunks of data
              const completeData = await readAllChunks(selectResponse);
              
              if (completeData) {
                setReceivedData(completeData);
                setConnectionStatus('Data received successfully!');
                setToastMessage('✅ All data received from merchant!');
              } else {
                setToastMessage('⚠️ No data received from merchant');
                setConnectionStatus('No data found');
              }
            } else {
              setToastMessage('❌ Failed to communicate with merchant device');
              setConnectionStatus('Communication failed');
            }

            await Nfc.close();
          } else {
            setToastMessage('❌ Incompatible NFC technology');
            setConnectionStatus('Technology not supported');
          }
        } catch (error: any) {
          setToastMessage(`❌ Error reading data: ${error.message}`);
          setConnectionStatus('Failed to read data');
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

  // Helper function to select HCE application
  const selectApplication = async (aid: string) => {
    const aidBytes = hexToArray(aid);
    const selectCommand = [
      0x00, 0xA4, 0x04, 0x00, // CLA INS P1 P2
      aidBytes.length,         // Lc
      ...aidBytes,            // AID
      0x00                    // Le
    ];
    return await Nfc.transceive({ data: selectCommand });
  };

  // Read all chunks of data
  const readAllChunks = async (initialResponse: any): Promise<string> => {
    let allData: number[] = [];
    let currentResponse = initialResponse;
    let chunkCount = 0;
    
    try {
      // Process chunks until we get all data
      while (currentResponse && currentResponse.response && currentResponse.response.length > 2) {
        const response = currentResponse.response;
        const sw1 = response[response.length - 2];
        const sw2 = response[response.length - 1];
        
        // Extract data (excluding status bytes)
        const chunkData = response.slice(0, -2);
        allData = allData.concat(chunkData);
        chunkCount++;
        
        // Update progress
        setDataProgress(`Reading chunk ${chunkCount}... (${allData.length} bytes)`);
        
        // Check if more data is available (status 61XX)
        if (sw1 === 0x61) {
          // More data available, send GET RESPONSE command
          const getResponseCommand = [0x00, 0xC0, 0x00, 0x00, sw2 || 0x00];
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
          <IonTitle>User Device</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>NFC Data Reader</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonButton 
              expand="block" 
              onClick={isScanning ? stopReading : readData}
              color={isScanning ? 'danger' : 'primary'}
            >
              {isScanning ? 'Stop Reading' : 'Read Data from Merchant'}
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
                  <h4>Data Received from Merchant</h4>
                  <p style={{ 
                    fontSize: '14px', 
                    wordBreak: 'break-all', 
                    backgroundColor: 'white', 
                    padding: '10px', 
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    maxHeight: '300px',
                    overflow: 'auto'
                  }}>
                    {receivedData}
                  </p>
                  <p style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>
                    Length: {receivedData.length} characters
                  </p>
                </IonText>
              </div>
            )}

            <IonText color="primary" style={{ display: 'block', marginTop: '20px', fontSize: '14px' }}>
              <p>📱 Hold your phone near the merchant device</p>
              <p>📡 Make sure the merchant has activated NFC first</p>
            </IonText>
          </IonCardContent>
        </IonCard>

        <IonLoading 
          isOpen={isScanning} 
          message="Hold phones back-to-back to read data..." 
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