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
  IonText,
  IonLabel,
  IonTextarea,
} from "@ionic/react";
import { Nfc } from "@capawesome-team/capacitor-nfc";
import { Preferences } from "@capacitor/preferences";

// Merchant Terminal - HCE mode to share public key
const Merchant: React.FC = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [publicKeyData, setPublicKeyData] = useState(
  "049958B8780454498C19AA7094455B2BB0670A90F3221241A52B7A53AFEF28F4C61EAEBCF6599C751D8F19644C4656D4A21CDA0D407C40B2C7B7855A267FAE2456"
  );
  const [isHCEActive, setIsHCEActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Ready to share public key");

  useEffect(() => {
    return () => {
      Nfc.removeAllListeners();
    };
  }, []);

  // Start HCE to share public key
  const startHCE = async () => {
    try {
      if (!publicKeyData.trim()) {
        setToastMessage("⚠️ Please enter the public key data");
        setShowToast(true);
        return;
      }

      // Store public key data for HCE service
      await Preferences.set({
        key: "public_key_data",
        value: publicKeyData,
      });

      // Set up HCE listeners
      await Nfc.addListener("commandReceived", async (event) => {
        setConnectionStatus("User device connected - Sharing public key...");
      });

      await Nfc.addListener("nfcLinkDeactivated", (event) => {
        setConnectionStatus("Public key shared successfully!");
        setToastMessage("✅ Public key transferred!");
        setShowToast(true);
        setTimeout(() => {
          setConnectionStatus("Ready to share public key");
        }, 2000);
      });

      setIsHCEActive(true);
      setConnectionStatus("HCE Active - Ready to share public key");
      setToastMessage("📡 Ready to share public key via NFC");
      setShowToast(true);

    } catch (error: any) {
      setToastMessage(`❌ HCE failed: ${error.message}`);
      setShowToast(true);
      setIsHCEActive(false);
    }
  };

  const stopHCE = async () => {
    try {
      await Nfc.removeAllListeners();
      setIsHCEActive(false);
      setConnectionStatus("Ready to share public key");
      setToastMessage("🛑 HCE stopped");
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
          <IonTitle>Merchant - Public Key Sharing</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Share Public Key via NFC</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="floating">Public Key Data</IonLabel>
              <IonTextarea
                value={publicKeyData}
                onIonChange={(e) => setPublicKeyData(e.detail.value!)}
                placeholder="Enter public key data"
                rows={8}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </IonItem>

            <IonButton 
              expand="block" 
              onClick={isHCEActive ? stopHCE : startHCE}
              color={isHCEActive ? "danger" : "primary"}
              className="ion-margin-top"
            >
              {isHCEActive ? "Stop NFC Sharing" : "Start NFC Sharing"}
            </IonButton>

            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <IonText color={isHCEActive ? "success" : "medium"}>
                <p><strong>Status:</strong> {connectionStatus}</p>
              </IonText>

              {isHCEActive && (
                <IonText color="primary">
                  <p style={{ fontSize: "14px", marginTop: "10px" }}>
                    📱 Hold the user's device near this phone
                  </p>
                  <p style={{ fontSize: "12px", color: "#666" }}>
                    No authentication required - Direct access
                  </p>
                </IonText>
              )}
            </div>

            {publicKeyData && (
              <div style={{ 
                marginTop: "20px", 
                padding: "15px", 
                backgroundColor: "#f0f8ff", 
                borderRadius: "8px" 
              }}>
                <IonText color="primary">
                  <p><strong>Public Key Preview:</strong></p>
                  <pre style={{ 
                    fontSize: "10px", 
                    wordBreak: "break-all",
                    whiteSpace: "pre-wrap",
                    maxHeight: "150px",
                    overflow: "auto",
                    backgroundColor: "white",
                    padding: "10px",
                    borderRadius: "4px",
                    border: "1px solid #ddd"
                  }}>
                    {publicKeyData}
                  </pre>
                  <p style={{ fontSize: "10px", color: "#666", marginTop: "5px" }}>
                    Length: {publicKeyData.length} characters
                  </p>
                </IonText>
              </div>
            )}
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

export default Merchant;