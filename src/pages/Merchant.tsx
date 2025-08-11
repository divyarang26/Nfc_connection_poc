import React, { useState, useEffect } from "react";
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
  IonTextarea
} from "@ionic/react";
import { Nfc } from "@capawesome-team/capacitor-nfc";
import { Preferences } from "@capacitor/preferences";

const Merchant: React.FC = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [publicKeyData, setPublicKeyData] = useState("");
  const [isHCEActive, setIsHCEActive] = useState(false);

  useEffect(() => {
    return () => {
      Nfc.removeAllListeners();
    };
  }, []);

  const startHCE = async () => {
    try {
      if (!publicKeyData.trim()) {
        setToastMessage("⚠️ Please enter public key data to share");
        setShowToast(true);
        return;
      }
      await Preferences.set({
        key: "nfc_message",
        value: publicKeyData,
      });

      await Nfc.addListener("nfcLinkDeactivated", () => {
        setToastMessage("✅ Public key transferred!");
        setShowToast(true);
        setIsHCEActive(false);
      });

      setIsHCEActive(true);
      setToastMessage("📡 Public key sharing started");
      setShowToast(true);

    } catch (error: any) {
      setToastMessage(`❌ Failed to start HCE: ${error.message}`);
      setShowToast(true);
      setIsHCEActive(false);
    }
  };

  const stopHCE = async () => {
    try {
      await Nfc.removeAllListeners();
      setIsHCEActive(false);
      setToastMessage("🛑 Public key sharing stopped");
      setShowToast(true);
    } catch (error: any) {
      setToastMessage(`❌ Error stopping HCE: ${error.message}`);
      setShowToast(true);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Merchant (Public Key HCE)</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Share Public Key</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="floating">Public Key</IonLabel>
              <IonTextarea
                value={publicKeyData}
                onIonChange={e => setPublicKeyData(e.detail.value!)}
                placeholder="Paste your public key here"
                rows={8}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                disabled={isHCEActive}
              />
            </IonItem>
            <IonButton
              expand="block"
              onClick={isHCEActive ? stopHCE : startHCE}
              color={isHCEActive ? "danger" : "primary"}
              className="ion-margin-top"
            >
              {isHCEActive ? "Stop Sharing" : "Start Sharing"}
            </IonButton>
            {publicKeyData && (
              <div style={{
                marginTop: "20px",
                padding: "10px",
                backgroundColor: "#f6fafd",
                borderRadius: "6px",
                fontSize: "11px",
                fontFamily: "monospace",
                color: "#123",
                border: "1px solid #e0e7ef"
              }}>
                <b>Preview:</b>
                <br />
                {publicKeyData.length > 240
                  ? publicKeyData.substring(0, 240) + "..."
                  : publicKeyData}
              </div>
            )}
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

export default Merchant;
