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
  IonTextarea,
  IonItem,
  IonLabel
} from '@ionic/react';
import { send, card, wifi, checkmarkCircle, informationCircle } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { nfcUtils } from '../utils/nfc';
import { useEffect, useState } from 'react';

const CardPage: React.FC = () => {
  // State management
  const [isNfcEnabled, setIsNfcEnabled] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger' | 'warning'>('success');
  const [transferProgress, setTransferProgress] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'ready' | 'preparing' | 'sending'>('ready');
  const [lastTransactionTime, setLastTransactionTime] = useState<string>('');

  // Demo public key stored in useState
  const [demoPublicKey] = useState(`MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwqKzZzG9TzqnBUFtGLKR4QjL3QXJB3tGfNjHKLmOJpQd5RNWM3cQhgUNzQqOXqLkYsB8tVFGHJKdCpQrFGdz`);

  const [publicKeyData, setPublicKeyData] = useState(demoPublicKey);

  useEffect(() => {
    initializeNFC();
    // generatePublicKeyData();
  }, []);

  const generatePublicKeyData = () => {
    // Generate public key data structure
    const keyData = {
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
    
    setPublicKeyData(JSON.stringify(keyData, null, 2));
  };

  const initializeNFC = async () => {
    try {
      if (!Capacitor.isNativePlatform()) {
        showToastMessage('NFC is only available on native platforms', 'warning');
        return;
      }

      // For HCE mode, we just need to check if NFC is available
      setIsNfcEnabled(true); // Assume NFC is available for HCE
      showToastMessage('Card ready to send public key', 'success');

    } catch (error) {
      console.error('Error initializing NFC:', error);
      setAlertMessage('Failed to initialize card');
      setShowAlert(true);
    }
  };

  const showToastMessage = (message: string, color: 'success' | 'danger' | 'warning' = 'success') => {
    setToastMessage(message);
    setToastColor(color);
    setShowToast(true);
  };

  const startSending = async () => {
    try {
      if (!publicKeyData.trim()) {
        setAlertMessage('No public key data available to send');
        setShowAlert(true);
        return;
      }

      setIsSending(true);
      setConnectionStatus('preparing');
      setTransferProgress(0);

      // Store public key data in HCE service
      await nfcUtils.storeDataForHCE(publicKeyData);

      showToastMessage('Card activated. Tap to merchant terminal...', 'warning');
      setConnectionStatus('sending');

      // Simulate the HCE preparation process
      const chunks = nfcUtils.chunkData(publicKeyData);
      console.log(`Public key data prepared in ${chunks.length} chunks`);

      // Update progress simulation
      for (let i = 0; i <= 100; i += 25) {
        setTransferProgress(i);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      showToastMessage('Card ready! Tap on merchant terminal to send public key.', 'success');
      setLastTransactionTime(new Date().toLocaleString());

      // Keep the sending state active for transmission window
      setTimeout(() => {
        setIsSending(false);
        setConnectionStatus('ready');
        setTransferProgress(0);
        showToastMessage('Transmission session completed', 'success');
      }, 15000); // 15 seconds transmission window

    } catch (error) {
      console.error('Error preparing public key transmission:', error);
      setIsSending(false);
      setConnectionStatus('ready');
      showToastMessage('Failed to prepare public key', 'danger');
    }
  };

  const cancelSending = () => {
    setIsSending(false);
    setConnectionStatus('ready');
    setTransferProgress(0);
    showToastMessage('Transmission cancelled', 'warning');
  };

  // const regenerateKeyData = () => {
  //   generatePublicKeyData();
  //   showToastMessage('Public key data regenerated', 'success');
  // };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'preparing': return 'warning';
      case 'sending': return 'primary';
      case 'ready': return 'success';
      default: return 'medium';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'preparing': return 'Preparing Data';
      case 'sending': return 'Ready to Send';
      case 'ready': return 'Ready';
      default: return 'Unknown';
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar >
          <IonTitle>
            <IonIcon icon={card} /> NFC Card - Public Key Sender
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="card-container" style={{ padding: '16px' }}>
          
          {/* Card Status Section */}
          {/* <IonCard>
          
            <IonCardContent> */}
              {/* <IonGrid>
                <IonRow>
                 
                  <IonCol size="6">
                    
                    <br />
                    <IonBadge color={getStatusColor()}>
                      {getStatusText()}
                    </IonBadge>
                  </IonCol>
                </IonRow>
              </IonGrid> */}
              
             
              {/* {transferProgress > 0 && transferProgress < 100 && (
                <div style={{ marginTop: '16px' }}>
                  <IonText>
                    <small>Preparing Data: {Math.round(transferProgress)}%</small>
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
                      backgroundColor: '#10dc60',
                      height: '100%',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              )}
            </IonCardContent>
          </IonCard> */}

          {/* Public Key Data Section */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={send} /> Public Key Data
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
            {transferProgress > 0 && transferProgress < 100 && (
                <div style={{ marginTop: '16px' }}>
                  <IonText>
                    <small>Preparing Data: {Math.round(transferProgress)}%</small>
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
                      backgroundColor: '#10dc60',
                      height: '100%',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>
              )}
              <IonItem>
                <IonLabel position="stacked">Public Key Data (Ready to Send)</IonLabel>
                <IonTextarea
                  value={publicKeyData}
                  rows={8}
                  readonly={true}
                  placeholder="Public key data will appear here..."
                />
              </IonItem>
              
              {/* <div style={{ marginTop: '12px' }}>
                <IonText color="medium">
                  <small>{publicKeyData.length} characters ready to transmit</small>
                </IonText>
              </div> */}

              <IonGrid style={{ marginTop: '16px' }}>
                <IonRow>
                  <IonCol>
                    <IonButton
                      expand="block"
                      color="primary"
                      onClick={startSending}
                      disabled={!isNfcEnabled || isSending || !publicKeyData.trim()}
                    >
                      {isSending && <IonSpinner name="crescent" />}
                      {isSending ? 'Preparing to Send...' : 'Activate NFC'}
                    </IonButton>
                  </IonCol>
                </IonRow>
                <IonRow>
                  <IonCol >
                    <IonButton
                      expand="block"
                      fill="outline"
                      color="danger"
                      onClick={cancelSending}
                      disabled={!isSending}
                    >
                      Deactivate NFC
                    </IonButton>
                  </IonCol>
                  {/* <IonCol size="6">
                    <IonButton
                      expand="block"
                      fill="outline"
                      color="secondary"
                      onClick={regenerateKeyData}
                      disabled={isSending}
                    >
                      Regenerate Key
                    </IonButton>
                  </IonCol> */}
                </IonRow>
              </IonGrid>
            </IonCardContent>
          </IonCard>

         

        </div>

        {/* Alert Dialog */}
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header="Card Information"
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

export default CardPage;