import React, { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonToast, IonCard, IonCardContent,
  IonCardHeader, IonCardTitle, IonIcon, IonText
} from '@ionic/react';
import { cardOutline, refreshOutline } from 'ionicons/icons';
import { Preferences } from '@capacitor/preferences';

const PocDisplay: React.FC = () => {
  const [receivedData, setReceivedData] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Check stored data on component mount
  useEffect(() => {
    checkStoredData();
  }, []);

  const checkStoredData = async () => {
    try {
      // Access the same Preferences that Java HCE service uses
      const result = await Preferences.get({ key: 'nfc_message' });
      
      if (result.value) {
        try {
          const json = JSON.parse(result.value);
          const data = json.value || result.value;
          setReceivedData(data);
          setToastMessage('📡 Data found in Preferences');
        } catch {
          setReceivedData(result.value);
          setToastMessage('📡 Raw data found');
        }
      } else {
        setReceivedData('No data received yet');
        setToastMessage('📭 No data in Preferences');
      }
      setShowToast(true);
    } catch (error) {
      console.error('Error checking Preferences:', error);
      setToastMessage('❌ Error accessing Preferences');
      setShowToast(true);
    }
  };

  const clearData = async () => {
    try {
      await Preferences.remove({ key: 'nfc_message' });
      setReceivedData('No data received yet');
      setToastMessage('🗑️ Data cleared');
      setShowToast(true);
    } catch (error) {
      console.error('Error clearing Preferences:', error);
      setToastMessage('❌ Error clearing Preferences');
      setShowToast(true);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>PoC - NFC Card</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
              <IonIcon icon={cardOutline} style={{ marginRight: 8 }} />
              NFC Card Status
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonText>
              <p style={{ marginBottom: 16, color: '#666' }}>
                This device acts as an NFC card. Tap with Ebioro to send/receive data.
              </p>
            </IonText>

            <div style={{
              padding: 16,
              backgroundColor: receivedData === 'No data received yet' ? '#f5f5f5' : '#e8f5e8',
              borderRadius: 8,
              border: '1px solid #ddd',
              marginBottom: 16,
              minHeight: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}>
              <strong>Received Data:</strong>
              <br />
              {receivedData || 'Waiting for data...'}
            </div>

            <IonButton 
              expand="block" 
              fill="outline" 
              onClick={checkStoredData}
            >
              <IonIcon icon={refreshOutline} slot="start" />
              Refresh Data
            </IonButton>

            <IonButton 
              expand="block" 
              fill="clear" 
              color="danger"
              onClick={clearData}
              disabled={receivedData === 'No data received yet'}
            >
              Clear Data
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardContent>
            <IonText color="medium">
              <p style={{ textAlign: 'center', fontSize: 14 }}>
                💡 To receive data, hold this device near an NFC reader (like Ebioro)
              </p>
            </IonText>
          </IonCardContent>
        </IonCard>

        <IonToast 
          isOpen={showToast} 
          message={toastMessage} 
          duration={2500} 
          onDidDismiss={() => setShowToast(false)} 
        />
      </IonContent>
    </IonPage>
  );
};

export default PocDisplay;