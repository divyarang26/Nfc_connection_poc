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
  // Set the default message here
  const [messageToSend, setMessageToSend] = useState('NFC Data Transferred Successfully!');
  const [isHCEActive, setIsHCEActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('HCE not started');

  // Load initial message from preferences when component mounts
  useEffect(() => {
    const loadInitialMessage = async () => {
      try {
        const { value } = await Preferences.get({ key: 'nfc_message' });
        if (value) {
          // Capacitor Preferences store values as strings, even if they were objects
          // The Android HostApduService expects a JSON string with a "value" key
          // So, when reading back, we also need to parse the JSON if it's there
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed.value === 'string') {
                setMessageToSend(parsed.value);
            } else {
                setMessageToSend(value); // Fallback for direct string storage if not JSON
            }
          } catch (e) {
            // Not a JSON object, treat as plain string
            setMessageToSend(value);
          }
          setToastMessage('📝 Loaded previous message.');
          setShowToast(true);
        }
      } catch (error) {
        console.error('Error loading initial message:', error);
      }
    };

    loadInitialMessage();

    if (Capacitor.getPlatform() === 'android') {
      setupHCE();
    }

    return () => {
      Nfc.removeAllListeners();
    };
  }, []); // Empty dependency array means this runs once on mount

  // This useEffect will run whenever `messageToSend` changes, and automatically update preferences.
  // This ensures the HCE service always has the latest message without needing to click a button.
  useEffect(() => {
    const updatePreferences = async () => {
      try {
        // The Android service expects the value to be a JSON string with a "value" key.
        // So, we stringify it here before saving.
        await Preferences.set({
          key: 'nfc_message',
          value: JSON.stringify({ value: messageToSend })
        });
        console.log('Preferences updated with:', messageToSend);
      } catch (error) {
        console.error('Error updating preferences:', error);
      }
    };
    updatePreferences();
  }, [messageToSend]); // This effect runs whenever messageToSend changes

  const setupHCE = async () => {
    try {
      // We no longer need to call Preferences.set here, as the useEffect above handles it.
      // The Android service will read the latest value when a connection is made.

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
              {/* <IonLabel position="floating">Message to send</IonLabel> */}
              <IonInput
                value={messageToSend}
                onIonChange={e => setMessageToSend(e.detail.value!)}
                placeholder="Enter your message"
              />
            </IonItem>

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