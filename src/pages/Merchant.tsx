import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonAlert,
  IonToast,
  IonSpinner,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  IonText,
  IonBadge,
  IonItem,
  IonLabel
} from '@ionic/react';
import { wifi, checkmarkCircle, alertCircle, informationCircle, storefront } from 'ionicons/icons';
import { Nfc, PollingOption } from '@capawesome-team/capacitor-nfc';
import { Capacitor } from '@capacitor/core';
import { nfcUtils } from '../utils/nfc';

const MerchantPage: React.FC = () => {
  // State management
  const [isNfcEnabled, setIsNfcEnabled] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [receivedData, setReceivedData] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger' | 'warning'>('success');
  const [transferProgress, setTransferProgress] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'waiting' | 'connected' | 'receiving'>('waiting');
  const [lastTransactionTime, setLastTransactionTime] = useState<string>('');
  
  const NFC = Nfc;
  
  // EbioroApplet AID (from Java HCE service)
  const EBIORO_AID = 'F0010203040506';
  
  // APDU Commands (matching Java implementation)
  const APDU_COMMANDS = {
    SELECT: (aid: string) => `00A404${(aid.length / 2).toString(16).padStart(2, '0')}${aid}`,
    GET_PUBLIC_KEY: '00470000', // INS_GET_PUBLIC_KEY (0x47)
    GET_RESPONSE: '00C00000'    // Standard GET RESPONSE for chunked data
  };

  useEffect(() => {
    initializeNFC();
    return () => {
      cleanupNFC();
    };
  }, []);

  const initializeNFC = async () => {
    try {
      if (!Capacitor.isNativePlatform()) {
        showToastMessage('NFC is only available on native platforms', 'warning');
        return;
      }

      // Check if NFC is enabled
      const isEnabled = await NFC.isEnabled();
      setIsNfcEnabled(isEnabled.isEnabled);

      if (!isEnabled.isEnabled) {
        setAlertMessage('Please enable NFC in your device settings to receive payments');
        setShowAlert(true);
      }

    } catch (error) {
      console.error('Error initializing NFC:', error);
      setAlertMessage('Failed to initialize NFC');
      setShowAlert(true);
    }
  };

  const cleanupNFC = async () => {
    try {
      if (isScanning) {
        await NFC.stopScanSession();
        setIsScanning(false);
      }
    } catch (error) {
      console.error('Error cleaning up NFC:', error);
    }
  };

  const showToastMessage = (message: string, color: 'success' | 'danger' | 'warning' = 'success') => {
    setToastMessage(message);
    setToastColor(color);
    setShowToast(true);
  };

  const startReceiving = async () => {
    try {
      if (!isNfcEnabled) {
        setAlertMessage('NFC is not enabled. Please enable NFC in your device settings to receive payments.');
        setShowAlert(true);
        return;
      }

      setIsScanning(true);
      setConnectionStatus('connected');
      setReceivedData('');
      setTransferProgress(0);

      showToastMessage('Ready to receive public key data. Ask customer to tap their card...', 'warning');

      // Start NFC scan session
      await NFC.startScanSession({
        alertMessage: 'Ready to receive public key - ask customer to tap their card',
        pollingOptions: [PollingOption.iso14443]
      });

      // Listen for NFC tags
      const listener = await NFC.addListener('nfcTagScanned', async (event) => {
        try {
          setConnectionStatus('receiving');
          
          // Process the scanned tag and attempt to read public key data
          const receivedDataResult = await processReceivedPaymentData(event);
          
          if (receivedDataResult) {
            setReceivedData(receivedDataResult);
            setTransferProgress(100);
            setLastTransactionTime(new Date().toLocaleString());
            showToastMessage('Public key data received successfully!', 'success');
          }
          
        } catch (error) {
          console.error('Error processing public key data:', error);
          showToastMessage('Failed to receive public key data', 'danger');
        } finally {
          setConnectionStatus('waiting');
          setIsScanning(false);
          await NFC.stopScanSession();
        }
      });

      // Handle scan session errors
      const errorListener = await NFC.addListener('scanSessionError', (error) => {
        console.error('NFC scan session error:', error);
        setIsScanning(false);
        setConnectionStatus('waiting');
        showToastMessage('Failed to connect with customer card', 'danger');
      });

    } catch (error) {
      console.error('Error starting NFC receive:', error);
      setIsScanning(false);
      setConnectionStatus('waiting');
      showToastMessage('Failed to start data receiver', 'danger');
    }
  };

  // Demo public key stored in useState
  

  const processReceivedPaymentData = async (event: any): Promise<string | null> => {
    try {
      console.log('Customer card detected:', event);
      
      // Simulate APDU communication for public key data
      let assembledData = '';
      let totalChunks = 0;
      let receivedChunks = 0;

      // Step 1: Select the EbioroApplet
      const selectCommand = APDU_COMMANDS.SELECT(EBIORO_AID);
      console.log('Sending SELECT command:', selectCommand);
      
      // Step 2: Get public key data (which will be chunked)
      const getDataCommand = APDU_COMMANDS.GET_PUBLIC_KEY;
      console.log('Sending GET_PUBLIC_KEY command:', getDataCommand);
      
      // Use the demo public key stored in useState
      const publicKeyData = {
        type: "RSA_PUBLIC_KEY",
        algorithm: "RSA",
        keySize: 2048,
        publicKey: demoPublicKey,
        timestamp: new Date().toISOString(),
        deviceId: "CARD_DEVICE_" + Math.random().toString(36).substring(2, 8).toUpperCase(),
        transactionId: Math.random().toString(36).substring(2, 15).toUpperCase(),
        metadata: {
          version: "1.0.0",
          issuer: "Demo Card Issuer",
          validFrom: new Date().toISOString(),
          validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // Valid for 1 year
        }
      };
      
      const publicKeyDataString = JSON.stringify(publicKeyData, null, 2);
      const mockChunkedData = nfcUtils.chunkData(publicKeyDataString);
      totalChunks = mockChunkedData.length;
      
      for (let i = 0; i < mockChunkedData.length; i++) {
        receivedChunks++;
        assembledData += mockChunkedData[i];
        
        // Update progress
        const progress = (receivedChunks / totalChunks) * 100;
        setTransferProgress(progress);
        
        // Small delay to simulate real transfer
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      return assembledData;
      
    } catch (error) {
      console.error('Error processing public key data:', error);
      return null;
    }
  };

  const stopReceiving = async () => {
    try {
      if (isScanning) {
        await NFC.stopScanSession();
        setIsScanning(false);
        setConnectionStatus('waiting');
        showToastMessage('Stopped receiving data', 'warning');
      }
    } catch (error) {
      console.error('Error stopping scan:', error);
    }
  };

  const clearTransactionData = () => {
    setReceivedData('');
    setTransferProgress(0);
    setLastTransactionTime('');
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'warning';
      case 'receiving': return 'primary';
      case 'waiting': return 'medium';
      default: return 'medium';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Ready to Receive';
      case 'receiving': return 'Processing Data';
      case 'waiting': return 'Waiting';
      default: return 'Unknown';
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>
            <IonIcon icon={storefront} /> Merchant Payment Terminal
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="merchant-container" style={{ padding: '16px' }}>
          
          {/* Merchant Status Section */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={wifi} /> Terminal Status
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonGrid>
                <IonRow>
                  <IonCol size="6">
                    <IonText>
                      <strong>NFC Status:</strong>
                    </IonText>
                    <br />
                    <IonBadge color={isNfcEnabled ? 'success' : 'danger'}>
                      {isNfcEnabled ? 'Ready' : 'Disabled'}
                    </IonBadge>
                  </IonCol>
                  <IonCol size="6">
                    <IonText>
                      <strong>Terminal:</strong>
                    </IonText>
                    <br />
                    <IonBadge color={getStatusColor()}>
                      {getStatusText()}
                    </IonBadge>
                  </IonCol>
                </IonRow>
              </IonGrid>
              
              {lastTransactionTime && (
                <IonItem lines="none">
                  <IonLabel>
                    <strong>Last Transaction:</strong> {lastTransactionTime}
                  </IonLabel>
                </IonItem>
              )}
              
              {transferProgress > 0 && transferProgress < 100 && (
                <div style={{ marginTop: '16px' }}>
                  <IonText>
                    <small>                Processing Data: {Math.round(transferProgress)}%</small>
                  </IonText>
                  <div style={{ 
                    width: '100%', 
                    backgroundColor: '#e0e0e0', 
                    borderRadius: '4px', 
                    marginTop: '8px',
                    height: '8px'
                  }}>
                    <div style={{ 
                      width: `${transferProgress}%`,
                      backgroundColor: '#3880ff',
                      height: '100%',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* Payment Receiver Section */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={wifi} /> Receive Data
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonGrid>
                <IonRow>
                  <IonCol>
                    <IonButton
                      expand="block"
                      color="success"
                      size="large"
                      onClick={startReceiving}
                      disabled={!isNfcEnabled || isScanning}
                    >
                      {isScanning && <IonSpinner name="crescent" />}
                      {isScanning ? 'Ready for Customer Card...' : 'Start Receiving Data'}
                    </IonButton>
                  </IonCol>
                </IonRow>
                <IonRow>
                  <IonCol>
                    <IonButton
                      expand="block"
                      fill="outline"
                      color="danger"
                      onClick={stopReceiving}
                      disabled={!isScanning}
                    >
                      Stop Terminal
                    </IonButton>
                  </IonCol>
                </IonRow>
              </IonGrid>

              {receivedData && (
                <>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginTop: '20px' 
                  }}>
                    <IonText>
                      <h3><IonIcon icon={checkmarkCircle} color="success" /> Data Received</h3>
                    </IonText>
                    <IonButton
                      size="small"
                      fill="clear"
                      color="danger"
                      onClick={clearTransactionData}
                    >
                      Clear
                    </IonButton>
                  </div>
                  
                  <div style={{ 
                    backgroundColor: '#f8f9fa', 
                    padding: '16px', 
                    borderRadius: '8px',
                    marginTop: '12px',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    <pre style={{ 
                      margin: 0, 
                      fontSize: '12px', 
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {receivedData}
                    </pre>
                  </div>
                  
                  <div style={{ marginTop: '12px' }}>
                    <IonText color="success">
                      <small>
                        <IonIcon icon={informationCircle} /> 
                        Data received - {receivedData.length} bytes received
                      </small>
                    </IonText>
                  </div>
                </>
              )}
            </IonCardContent>
          </IonCard>

          {/* Instructions Card */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={informationCircle} /> How to Use
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <ol style={{ paddingLeft: '20px' }}>
                <li>Ensure NFC is enabled on this device</li>
                <li>Tap "Start Receiving Data" to activate receiver</li>
                <li>Ask customer to tap their card on your device</li>
                <li>Public key data will be automatically received</li>
                <li>Review the received public key in the data section</li>
              </ol>
            </IonCardContent>
          </IonCard>

        </div>

        {/* Alert Dialog */}
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header="Terminal Information"
          message={alertMessage}
          buttons={['OK']}
        />

        {/* Toast Messages */}
        <IonToast
          isOpen={showToast}
          message={toastMessage}
          duration={3000}
          color={toastColor}
          onDidDismiss={() => setShowToast(false)}
        />

      </IonContent>
    </IonPage>
  );
};

export default MerchantPage;