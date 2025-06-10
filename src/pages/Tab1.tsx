// src/pages/NFCWrite.tsx (Tab1.tsx)
import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonToast,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonInput,
  IonText,
} from '@ionic/react';
import { Nfc } from '@capawesome-team/capacitor-nfc';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const Tab1: React.FC = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [messageToSend, setMessageToSend] = useState('hello divya');
  const [isHCEActive, setIsHCEActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('HCE not started');

  useEffect(() => {
    // Set up HCE listeners when component mounts
    if (Capacitor.getPlatform() === 'android') {
      setupHCE();
    }

    return () => {
      // Cleanup listeners
      Nfc.removeAllListeners();
    };
  }, []);

  const setupHCE = async () => {
    try {
      // Store the message in SharedPreferences for HCE service to read
      await Preferences.set({
        key: 'nfc_message',
        value: messageToSend
      });

      // Listen for when a reader connects
      await Nfc.addListener('commandReceived', async (event) => {
        console.log('Command received from reader:', event.data);
        setConnectionStatus('Connected to reader!');
        setToastMessage('📱 Reader connected! Sending data...');
        setShowToast(true);
      });

      // Listen for when connection is lost
      await Nfc.addListener('nfcLinkDeactivated', (event) => {
        console.log('NFC link deactivated:', event.reason);
        setConnectionStatus('Disconnected - Ready for next connection');
        setToastMessage('📴 Connection closed');
        setShowToast(true);
      });

      setIsHCEActive(true);
      setConnectionStatus('HCE Active - Hold phones together');
      setToastMessage('✅ HCE service is ready!');
      setShowToast(true);

    } catch (error: any) {
      console.error('HCE setup error:', error);
      setToastMessage(`❌ HCE setup failed: ${error.message}`);
      setShowToast(true);
    }
  };

  const updateMessage = async () => {
    try {
      // Update the message in SharedPreferences
      await Preferences.set({
        key: 'nfc_message',
        value: messageToSend
      });
      
      setToastMessage('✅ Message updated!');
      setShowToast(true);
    } catch (error: any) {
      setToastMessage(`❌ Failed to update message: ${error.message}`);
      setShowToast(true);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Write NFC (HCE Mode)</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Send Data via NFC</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="floating">Message to send</IonLabel>
              <IonInput
                value={messageToSend}
                onIonChange={e => setMessageToSend(e.detail.value!)}
                placeholder="Enter your message"
              />
            </IonItem>

            <IonButton 
              expand="block" 
              onClick={updateMessage}
              style={{ marginTop: '20px' }}
            >
              Update Message
            </IonButton>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <IonText color={isHCEActive ? 'success' : 'medium'}>
                <p><strong>Status:</strong> {connectionStatus}</p>
              </IonText>
              
              {isHCEActive && (
                <IonText color="primary">
                  <p style={{ fontSize: '14px' }}>
                    📱 HCE is active! Just hold another phone with the reader app close to this device.
                  </p>
                </IonText>
              )}
            </div>
          </IonCardContent>
        </IonCard>

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

export default Tab1;