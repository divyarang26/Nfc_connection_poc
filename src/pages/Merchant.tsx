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
  IonSpinner,
} from "@ionic/react";
import { Nfc } from "@capawesome-team/capacitor-nfc";
import { Preferences } from "@capacitor/preferences";

// Merchant Terminal - HCE mode to emulate EbioroApplet (Public Key Only)
const Merchant: React.FC = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [publicKeyData, setPublicKeyData] = useState(`my keyz `);
  const [isHCEActive, setIsHCEActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Ready to share public key");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    return () => {
      Nfc.removeAllListeners();
    };
  }, []);

  // Start HCE to emulate EbioroApplet (Public Key Distribution)
  const startHCE = async () => {
    try {
      if (!publicKeyData.trim()) {
        setToastMessage("⚠️ Please enter public key data to share");
        setShowToast(true);
        return;
      }

      // Store public key data for HCE service
      await Preferences.set({
        key: "nfc_message",
        value: publicKeyData,
      });

      // Set up HCE listeners for UI feedback
      await Nfc.addListener("commandReceived", async (event) => {
        setIsProcessing(true);
        setConnectionStatus("Processing public key request...");
        
        // The actual APDU processing happens in the native HCE service
        // This is just for UI feedback
        setTimeout(() => {
          setConnectionStatus("Public key sent");
          setIsProcessing(false);
        }, 500);
      });

      await Nfc.addListener("nfcLinkDeactivated", (event) => {
        setConnectionStatus("Transfer completed");
        setToastMessage("✅ Public key transferred successfully!");
        setShowToast(true);
        setIsHCEActive(false);
        setIsProcessing(false);
      });

      setIsHCEActive(true);
      setConnectionStatus("HCE Active - Ready to share public key");
      setToastMessage("📡 EbioroApplet ready - No PIN required for public key access");
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

  const generateSampleKey = () => {
    const sampleKeys = [
      `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0vx7agoebGcQSuuPiLJX
ZptN9nndrQmbPFRP1gPd0Ajtxz1E6TRIb1RJ0ZRb0vI8Z8TRtgJ8EWIZhOI2JfUB
b2tONm0ZhF4kstLTQjqMx2Z8EaR0QjqGxOyPdE4mHzYl3k7Qr5F4J8B9mK2L8rN7
wQx1V8z3pBqN4fE2rG5kL6hJ8dM9sT2cW7aH5oP3uQ8iX1nZ4bV9wE6tR2hL0pK3
sF7mA8gD1eO5jP2rH6qL9sT8vU4wX7zY2bM3nK5hR9oF6gJ4eP1dQ8lN7wS2vG8
xT5bE4rF9mK6hL2pO3sW7yX8zV1nA4cD9fH2gJ5kM6pR1sT8vX2bM5oP7qT4wW9
yZEE6gH5kL9oN3sP8rV2wX7bM
-----END PUBLIC KEY-----`,
      `-----BEGIN EC PUBLIC KEY-----
MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE4f2n0LVQMf+aJXc7dOHK0k8hJOCr4VmO
K8WOmxPdE2VQzBkQxOcY9JgLfk4K4rL8uK2N0hJvVmT5gPqR3wEa8zX9yB6mL4oJ
8dM9sT2cW7aH5oP3uQ8iX1nZ4bV9wE6t
-----END EC PUBLIC KEY-----`,
      `{"kty":"RSA","use":"sig","kid":"test-key-1","n":"0vx7agoebGcQSuuPiLJXZptN9nndrQmbPFRP1gPd0Ajtxz1E6TRIb1RJ0ZRb0vI8Z8TRtgJ8EWIZhOI2JfUBb2tONm0Z","e":"AQAB"}`
    ];
    
    const randomKey = sampleKeys[Math.floor(Math.random() * sampleKeys.length)];
    setPublicKeyData(randomKey);
    setToastMessage("🔑 Generated sample public key");
    setShowToast(true);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Merchant Terminal (Public Key Distribution)</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Share Public Key via EbioroApplet HCE</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="floating">Public Key Data</IonLabel>
              <IonTextarea
                value={publicKeyData}
                onIonChange={(e) => setPublicKeyData(e.detail.value!)}
                placeholder="Enter your public key (PEM format, JWK, or raw data)"
                rows={8}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
            </IonItem>

            {/* <IonButton 
              fill="outline" 
              expand="block" 
              onClick={generateSampleKey}
              className="ion-margin-top"
            >
              Generate Sample Key
            </IonButton> */}

            <IonButton 
              expand="block" 
              onClick={isHCEActive ? stopHCE : startHCE}
              color={isHCEActive ? "danger" : "primary"}
              className="ion-margin-top"
              disabled={isProcessing}
            >
              {isHCEActive ? "Stop Public Key Sharing" : "Start Public Key Sharing"}
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
                    The EbioroApplet HCE will handle:
                    <br />• APDU SELECT command
                    <br />• GET PUBLIC KEY command (No PIN required!)
                    <br />• Chunked data transfer for large keys
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
                  <div style={{ 
                    fontSize: "10px", 
                    wordBreak: "break-all", 
                    backgroundColor: "white", 
                    padding: "10px", 
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                    maxHeight: "150px",
                    overflow: "auto",
                    fontFamily: "monospace"
                  }}>
                    {publicKeyData.substring(0, 200)}
                    {publicKeyData.length > 200 && "..."}
                  </div>
                  <p style={{ fontSize: "10px", color: "#666", marginTop: "5px" }}>
                    Length: {publicKeyData.length} characters
                  </p>
                </IonText>
              </div>
            )}

            <div style={{ 
              marginTop: "20px", 
              padding: "15px", 
              backgroundColor: "#e8f5e8", 
              borderRadius: "8px" 
            }}>
              <IonText color="success">
                <p><strong>✨ Simplified Access:</strong></p>
                <p style={{ fontSize: "14px" }}>
                  • No PIN verification required for public key access
                  <br />• Instant key sharing after NFC connection
                  <br />• Supports large keys with automatic chunking
                  <br />• Compatible with PEM, JWK, and raw formats
                </p>
              </IonText>
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

export default Merchant;