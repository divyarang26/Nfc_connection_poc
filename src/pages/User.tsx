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

// User Device - Reads data from merchant via NFC
const User: React.FC = () => {
  const [receivedData, setReceivedData] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');

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

      await Nfc.removeAllListeners();

      await Nfc.addListener('nfcTagScanned', async (event) => {
        setConnectionStatus('Merchant device detected! Reading data...');

        try {
          await Nfc.stopScanSession();
          await new Promise(resolve => setTimeout(resolve, 100));

          const techTypes = event.nfcTag.techTypes || [];

          if (Capacitor.getPlatform() === 'android' && techTypes.includes(NfcTagTechType.IsoDep)) {
            await Nfc.connect({ techType: NfcTagTechType.IsoDep });

            // Try to read data from HCE
            const selectResponse = await selectApplication('F0010203040506');
            
            if (selectResponse.response && selectResponse.response.length > 2) {
              const merchantData = await getDataFromResponse(selectResponse);
              
              if (merchantData) {
                setReceivedData(merchantData);
                setConnectionStatus('Data received successfully!');
                setToastMessage('✅ Data received from merchant!');
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

  // Extract data from HCE response
  const getDataFromResponse = async (response: any): Promise<string> => {
    if (response.response && response.response.length > 2) {
      // Remove status bytes (last 2 bytes)
      const dataBytes = response.response.slice(0, -2);
      return new TextDecoder().decode(new Uint8Array(dataBytes));
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
                    border: '1px solid #ddd'
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