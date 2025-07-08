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
  IonSpinner,
} from "@ionic/react";
import { Nfc } from "@capawesome-team/capacitor-nfc";
import { Preferences } from "@capacitor/preferences";

// Merchant Terminal - HCE mode to emulate EbioroApplet
const Merchant: React.FC = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [dataToSend, setDataToSend] = useState("Hello from Merchant!");
  const [isHCEActive, setIsHCEActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Ready to send data");
  const [pin, setPin] = useState("123456");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    return () => {
      Nfc.removeAllListeners();
    };
  }, []);

  // Start HCE to emulate EbioroApplet
  const startHCE = async () => {
    try {
      if (!dataToSend.trim()) {
        setToastMessage("⚠️ Please enter some data to send");
        setShowToast(true);
        return;
      }

      if (pin.length !== 6) {
        setToastMessage("⚠️ PIN must be exactly 6 digits");
        setShowToast(true);
        return;
      }

      // Store data and PIN for HCE service
      await Preferences.set({
        key: "nfc_message",
        value: dataToSend,
      });

      await Preferences.set({
        key: "nfc_pin",
        value: pin,
      });

      // Set up HCE listeners
      await Nfc.addListener("commandReceived", async (event) => {
        setIsProcessing(true);
        setConnectionStatus("Processing command from user device...");
        
        // The actual APDU processing happens in the native HCE service
        // This is just for UI feedback
        setTimeout(() => {
          setConnectionStatus("Command processed");
          setIsProcessing(false);
        }, 500);
      });

      await Nfc.addListener("nfcLinkDeactivated", (event) => {
        setConnectionStatus("Session completed");
        setToastMessage("✅ Data transfer completed!");
        setShowToast(true);
        setIsHCEActive(false);
        setIsProcessing(false);
      });

      setIsHCEActive(true);
      setConnectionStatus("HCE Active - Emulating EbioroApplet");
      setToastMessage("📡 Ready to receive APDU commands");
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
          <IonTitle>Merchant Terminal (EbioroApplet HCE)</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Emulate EbioroApplet via HCE</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="floating">PIN (6 digits)</IonLabel>
              <IonInput
                value={pin}
                onIonChange={(e) => setPin(e.detail.value!)}
                placeholder="123456"
                maxlength={6}
                type="number"
              />
            </IonItem>

            <IonItem>
              <IonLabel position="floating">Data to Send</IonLabel>
              <IonTextarea
                value={dataToSend}
                onIonChange={(e) => setDataToSend(e.detail.value!)}
                placeholder="Enter data to send when authenticated"
                rows={3}
              />
            </IonItem>

            <IonButton 
              expand="block" 
              onClick={isHCEActive ? stopHCE : startHCE}
              color={isHCEActive ? "danger" : "primary"}
              className="ion-margin-top"
              disabled={isProcessing}
            >
              {isHCEActive ? "Stop HCE Emulation" : "Start HCE Emulation"}
            </IonButton>

            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <IonText color={isHCEActive ? "success" : "medium"}>
                <p><strong>Status:</strong> {connectionStatus}</p>
              </IonText>

              {isProcessing && (
                <div style={{ marginTop: "10px" }}>
                  <IonSpinner name="crescent" />
                </div>
              )}

              {isHCEActive && !isProcessing && (
                <IonText color="primary">
                  <p style={{ fontSize: "14px" }}>
                    📱 Hold the user's device near this phone
                  </p>
                  <p style={{ fontSize: "12px", color: "#666" }}>
                    The HCE service will handle:
                    <br />• APDU SELECT command
                    <br />• PIN verification (VERIFY)
                    <br />• Security operations (SIGN/GET KEY)
                  </p>
                </IonText>
              )}
            </div>

            {dataToSend && (
              <div style={{ 
                marginTop: "20px", 
                padding: "15px", 
                backgroundColor: "#f0f8ff", 
                borderRadius: "8px" 
              }}>
                <IonText color="primary">
                  <p><strong>Configuration:</strong></p>
                  <p style={{ fontSize: "12px" }}>
                    <strong>PIN:</strong> {pin}
                  </p>
                  <p style={{ fontSize: "12px", wordBreak: "break-all" }}>
                    <strong>Data:</strong> {dataToSend}
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