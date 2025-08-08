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
  IonItem,
  IonLabel,
  IonTextarea,
  IonAlert,
  IonToast,
  IonSpinner,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  IonText,
  IonBadge
} from '@ionic/react';
import { send, wifi, checkmarkCircle, alertCircle, informationCircle } from 'ionicons/icons';
import { Nfc, PollingOption } from '@capawesome-team/capacitor-nfc';
import { Capacitor } from '@capacitor/core';
import { nfcUtils } from '../utils/nfc';
// import './SendReceivePage.css';

const SendReceivePage: React.FC = () => {
  // State management
  const [isNfcEnabled, setIsNfcEnabled] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [dataToSend, setDataToSend] = useState('');
  const [receivedData, setReceivedData] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger' | 'warning'>('success');
  const [transferProgress, setTransferProgress] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'transferring'>('disconnected');
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
    
    // Generate sample data for testing (up to 2000 bytes)
    const sampleData = generateSampleData();
    setDataToSend(sampleData);

    return () => {
      cleanupNFC();
    };
  }, []);

  const generateSampleData = (): string => {
    // Create a sample public key structure for testing
    const publicKeyData = {
      algorithm: "RSA",
      keySize: 2048,
      publicKey: "-----BEGIN PUBLIC KEY-----\n" +
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + 
        "x".repeat(300) + // Simulate large key data
        "\n-----END PUBLIC KEY-----",
      timestamp: new Date().toISOString(),
      metadata: {
        appVersion: "1.0.0",
        deviceId: "test-device-123",
        sessionId: Math.random().toString(36).substring(7)
      }
    };
    
    return JSON.stringify(publicKeyData, null, 2);
  };

  const initializeNFC = async () => {
    try {
      if (!Capacitor.isNativePlatform()) {
        showToastMessage('NFC is only available on native platforms', 'warning');
        return;
      }

      // Check if NFC is available
    //   const isAvailable = await NFC.isSupported();
    //   if (!isAvailable.available) {
    //     setAlertMessage('NFC is not available on this device');
    //     setShowAlert(true);
    //     return;
    //   }

      // Check if NFC is enabled
      const isEnabled = await NFC.isEnabled();
      setIsNfcEnabled(isEnabled.isEnabled);

      if (!isEnabled.isEnabled) {
        setAlertMessage('Please enable NFC in your device settings');
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
        setAlertMessage('NFC is not enabled. Please enable NFC in your device settings.');
        setShowAlert(true);
        return;
      }

      setIsScanning(true);
      setConnectionStatus('connected');
      setReceivedData('');
      setTransferProgress(0);

      showToastMessage('Tap your phone to another NFC device to receive data...', 'warning');

      // Start NFC scan session
      await NFC.startScanSession({
        alertMessage: 'Hold your phone near an NFC tag or device',
        pollingOptions: [PollingOption.iso14443]
      });

      // Listen for NFC tags
      const listener = await NFC.addListener('nfcTagScanned', async (event) => {
        try {
          setConnectionStatus('transferring');
          
          // Process the scanned tag and attempt to read data
          const receivedDataResult = await processReceivedNfcData(event);
          console.log("log ~ :165 ~ startReceiving ~ receivedDataResult:", receivedDataResult)
          
          if (receivedDataResult) {
            setReceivedData(receivedDataResult);
            setTransferProgress(100);
            showToastMessage('Data received successfully!', 'success');
          }
          
        } catch (error) {
          console.error('Error processing received data:', error);
          showToastMessage('Failed to receive data', 'danger');
        } finally {
          setConnectionStatus('disconnected');
          setIsScanning(false);
          await NFC.stopScanSession();
        }
      });

      // Handle scan session errors
      const errorListener = await NFC.addListener('scanSessionError', (error) => {
        console.error('NFC scan session error:', error);
        setIsScanning(false);
        setConnectionStatus('disconnected');
        showToastMessage('NFC scan session failed', 'danger');
      });

    } catch (error) {
      console.error('Error starting NFC receive:', error);
      setIsScanning(false);
      setConnectionStatus('disconnected');
      showToastMessage('Failed to start NFC receiving', 'danger');
    }
  };

  const processReceivedNfcData = async (event: any): Promise<string | null> => {
    try {
      // In a real HCE scenario, we would communicate with the remote card
      // Here we simulate the APDU communication process
      
      console.log('NFC Tag detected:', event);
      
      // Simulate APDU communication
      let assembledData = '';
      let totalChunks = 0;
      let receivedChunks = 0;

      // Step 1: Select the EbioroApplet
      const selectCommand = APDU_COMMANDS.SELECT(EBIORO_AID);
      console.log('Sending SELECT command:', selectCommand);
      
      // Step 2: Get public key data (which will be chunked)
      const getKeyCommand = APDU_COMMANDS.GET_PUBLIC_KEY;
      console.log('Sending GET_PUBLIC_KEY command:', getKeyCommand);
      
      // Step 3: Process chunked response
      // In real implementation, this would be actual APDU communication
      // For demo, we'll simulate receiving the data that was stored in the HCE service
      
      // Simulate chunked data reception
      const mockChunkedData = nfcUtils.chunkData(dataToSend); // Using sent data as mock
      totalChunks = mockChunkedData.length;
      
      for (let i = 0; i < mockChunkedData.length; i++) {
        receivedChunks++;
        assembledData += mockChunkedData[i];
        
        // Update progress
        const progress = (receivedChunks / totalChunks) * 100;
        setTransferProgress(progress);
        
        // Small delay to simulate real transfer
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return assembledData;
      
    } catch (error) {
      console.error('Error processing NFC data:', error);
      return null;
    }
  };

  const startSending = async () => {
    try {
      if (!isNfcEnabled) {
        setAlertMessage('NFC is not enabled. Please enable NFC in your device settings.');
        setShowAlert(true);
        return;
      }

      if (!dataToSend.trim()) {
        setAlertMessage('Please enter some data to send');
        setShowAlert(true);
        return;
      }

      setIsSending(true);
      setConnectionStatus('connected');
      setTransferProgress(0);

      // Store data in the HCE service via Capacitor preferences
      // This data will be served when another device connects
      await nfcUtils.storeDataForHCE(dataToSend);

      showToastMessage('Data prepared for sending. Bring another NFC device close...', 'warning');

      // In HCE mode, we don't actively send - we wait for another device to connect
      // The Java HCE service will handle the APDU commands and serve the data
      
      // Simulate the preparation process
      const chunks = nfcUtils.chunkData(dataToSend);
      console.log(`Data prepared in ${chunks.length} chunks`);

      // Update progress
      for (let i = 0; i <= 100; i += 20) {
        setTransferProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      showToastMessage('Data ready to be sent via HCE. Waiting for connection...', 'success');
      setConnectionStatus('transferring');

      // Keep the sending state active for a while
      setTimeout(() => {
        setIsSending(false);
        setConnectionStatus('disconnected');
        setTransferProgress(0);
        showToastMessage('Send session completed', 'success');
      }, 10000);

    } catch (error) {
      console.error('Error preparing data for sending:', error);
      setIsSending(false);
      setConnectionStatus('disconnected');
      showToastMessage('Failed to prepare data for sending', 'danger');
    }
  };

  const stopScanning = async () => {
    try {
      if (isScanning) {
        await NFC.stopScanSession();
        setIsScanning(false);
        setConnectionStatus('disconnected');
        showToastMessage('Stopped receiving', 'warning');
      }
    } catch (error) {
      console.error('Error stopping scan:', error);
    }
  };

  const clearReceivedData = () => {
    setReceivedData('');
    setTransferProgress(0);
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'warning';
      case 'transferring': return 'primary';
      case 'disconnected': return 'medium';
      default: return 'medium';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'transferring': return 'Transferring';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>NFC Data Transfer</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="nfc-container">
          
          {/* Status Section */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={wifi} /> Connection Status
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
                      {isNfcEnabled ? 'Enabled' : 'Disabled'}
                    </IonBadge>
                  </IonCol>
                  <IonCol size="6">
                    <IonText>
                      <strong>Connection:</strong>
                    </IonText>
                    <br />
                    <IonBadge color={getStatusColor()}>
                      {getStatusText()}
                    </IonBadge>
                  </IonCol>
                </IonRow>
              </IonGrid>
              
              {transferProgress > 0 && (
                <div className="progress-container">
                  <IonText>
                    <small>Transfer Progress: {Math.round(transferProgress)}%</small>
                  </IonText>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${transferProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* Send Data Section */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={send} /> Send Data
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem>
                <IonLabel position="stacked">Data to Send (max 2000 bytes)</IonLabel>
                <IonTextarea
                  value={dataToSend}
                  placeholder="Enter data to send via NFC..."
                  rows={6}
                  maxlength={2000}
                  onIonInput={(e) => setDataToSend(e.detail.value!)}
                />
              </IonItem>
              <div className="data-info">
                <IonText color="medium">
                  <small>{dataToSend.length} / 2000 characters</small>
                </IonText>
              </div>
              
              <IonButton
                expand="block"
                color="primary"
                onClick={startSending}
                disabled={!isNfcEnabled || isSending || !dataToSend.trim()}
              >
                {isSending && <IonSpinner name="crescent" />}
                {isSending ? 'Preparing to Send...' : 'Prepare Data for Sending'}
              </IonButton>
            </IonCardContent>
          </IonCard>

          {/* Receive Data Section */}
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
                      color="secondary"
                      onClick={startReceiving}
                      disabled={!isNfcEnabled || isScanning}
                    >
                      {isScanning && <IonSpinner name="crescent" />}
                      {isScanning ? 'Scanning for NFC...' : 'Start Receiving'}
                    </IonButton>
                  </IonCol>
                  <IonCol>
                    <IonButton
                      expand="block"
                      fill="outline"
                      color="danger"
                      onClick={stopScanning}
                      disabled={!isScanning}
                    >
                      Stop Scanning
                    </IonButton>
                  </IonCol>
                </IonRow>
              </IonGrid>

              {receivedData && (
                <>
                  <div className="received-data-header">
                    <IonText>
                      <h3><IonIcon icon={checkmarkCircle} color="success" /> Received Data</h3>
                    </IonText>
                    <IonButton
                      size="small"
                      fill="clear"
                      color="danger"
                      onClick={clearReceivedData}
                    >
                      Clear
                    </IonButton>
                  </div>
                  
                  <div className="received-data-container">
                    <pre className="received-data-content">{receivedData}</pre>
                  </div>
                  
                  <div className="data-info">
                    <IonText color="success">
                      <small><IonIcon icon={informationCircle} /> Received {receivedData.length} characters</small>
                    </IonText>
                  </div>
                </>
              )}
            </IonCardContent>
          </IonCard>

        </div>

        {/* Alert Dialog */}
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header="NFC Information"
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

export default SendReceivePage;