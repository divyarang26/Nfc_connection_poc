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
  IonInput,
  IonText,
  IonLabel,
  IonTextarea,
} from "@ionic/react";
import { Nfc } from "@capawesome-team/capacitor-nfc";
import { Preferences } from "@capacitor/preferences";

// Merchant Terminal - Sends data via NFC
const Merchant: React.FC = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [dataToSend, setDataToSend] = useState("Hello from Merchant!");
  const [isHCEActive, setIsHCEActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Ready to send data");

  useEffect(() => {
    return () => {
      Nfc.removeAllListeners();
    };
  }, []);

  // Start HCE to send data
  const startHCE = async () => {
    try {
      if (!dataToSend.trim()) {
        setToastMessage("⚠️ Please enter some data to send");
        setShowToast(true);
        return;
      }

      // Store data for HCE to send
      await Preferences.set({
        key: "nfc_message",
        value: dataToSend,
      });

      await Nfc.addListener("commandReceived", async (event) => {
        setConnectionStatus("Connected to user device!");
        setToastMessage("📱 User device connected - Sending data...");
        setShowToast(true);
        
        // Here you would typically handle the APDU command and send response
        // The actual data transmission happens in the HCE service
      });

      await Nfc.addListener("nfcLinkDeactivated", (event) => {
        setConnectionStatus("Disconnected - Data sent");
        setToastMessage("✅ Data sent successfully!");
        setShowToast(true);
        setIsHCEActive(false);
      });

      setIsHCEActive(true);
      setConnectionStatus("HCE Active - Hold user device near");
      setToastMessage("📡 Ready to send data via NFC");
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
      setConnectionStatus("Ready to send data");
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
          <IonTitle>Merchant Terminal</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Send Data via NFC</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="floating">Data to Send</IonLabel>
              <IonTextarea
                value={dataToSend}
                onIonChange={(e) => setDataToSend(e.detail.value!)}
                placeholder="Enter data to send to user device"
                rows={3}
              />
            </IonItem>

            <IonButton 
              expand="block" 
              onClick={isHCEActive ? stopHCE : startHCE}
              color={isHCEActive ? "danger" : "primary"}
              className="ion-margin-top"
            >
              {isHCEActive ? "Stop NFC" : "Activate NFC"}
            </IonButton>

            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <IonText color={isHCEActive ? "success" : "medium"}>
                <p><strong>Status:</strong> {connectionStatus}</p>
              </IonText>

              {isHCEActive && (
                <IonText color="primary">
                  <p style={{ fontSize: "14px" }}>
                    📱 Hold the user's device near this phone to send data
                  </p>
                </IonText>
              )}
            </div>

            {dataToSend && (
              <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#f0f8ff", borderRadius: "8px" }}>
                <IonText color="primary">
                  <p><strong>Data Ready:</strong></p>
                  <p style={{ fontSize: "12px", wordBreak: "break-all" }}>
                    {dataToSend}
                  </p>
                  <p style={{ fontSize: "10px", color: "#666" }}>
                    Length: {dataToSend.length} characters
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