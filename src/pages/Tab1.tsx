import React, { useState, useEffect, useMemo } from "react";
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
} from "@ionic/react";
import { Nfc } from "@capawesome-team/capacitor-nfc";
import { Preferences } from "@capacitor/preferences";
import axios from "axios";
import {
  WebAuthnCompressor,WebAuthnData
} from "../utils/utils";

const Tab1: React.FC = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [messageToSend, setMessageToSend] = useState(
    "NFC Data Transferred Successfully!"
  );
  const [isHCEActive, setIsHCEActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("HCE not started");
  const API_URL = "https://passkeyme.com";
  const APP_UUID = "cad7760b-3ee4-4df8-b7b4-73cdeaff0774";
  const API_KEY = "36LP0Z0frQaYgqduOXl6fjW0llIhQNXr";
  // Single useEffect to load saved message and cleanup listeners
  useEffect(() => {
    const init = async () => {
      try {
        const { value } = await Preferences.get({ key: "nfc_message" });
        if (value) {
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed.value === "string") {
              setMessageToSend(parsed.value);
            } else {
              setMessageToSend(value);
            }
          } catch {
            setMessageToSend(value);
          }
          setToastMessage("📝 Loaded previous message.");
          setShowToast(true);
        }
      } catch (error) {
        console.error("Error loading message:", error);
      }
    };

    init();

    return () => {
      Nfc.removeAllListeners();
    };
  }, []);

  const client = useMemo(() => {
    return axios.create({
      baseURL: `${API_URL}/webauthn/${APP_UUID}`,
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
      },
    });
  }, []);
  const saveMessage = async () => {
    try {
    
      const startRes = await client.post("/start_authentication", {
        username: "divya",
      });
      console.log("🚀 ~ saveMessage ~ startRes:", startRes);
      console.log(
        "🚀 ~ saveMessage ~ startRes challenge:",
        JSON.stringify(startRes)
      );
      console.log(
        "🚀 ~ saveMessage ~ startRes challenge---kkkk:",
        startRes.data.challenge
      );

      const challengeObj = startRes.data.challenge; // this is full WebAuthnData
      console.log("✅ WebAuthnData object:", challengeObj);

      const webAuthnData: WebAuthnData = {
        publicKey: {
          challenge: startRes.data.challenge,
          timeout: 300000,
          rpId: "localhost",
          allowCredentials: startRes.data.allowCredentials ?? [], // ensure array
          userVerification: "required",
        },
      };

      console.log("✅ WebAuthnData object:", JSON.stringify(webAuthnData));
      // 👇 Fix: parse stringified challenge back to proper object
      const parsedChallenge: WebAuthnData = JSON.parse(startRes.data.challenge);

      // Compress using UltraCompressor
      // const compressed = WebAuthnCompressor.encodeWithHashing(parsedChallenge);
      // console.log("📦 Compressed base64:", compressed.encoded);
      // console.log("📊 Compression stats:", compressed.stats);
      setMessageToSend(startRes.data.challenge);
      // setMessageToSend(startRes.data.challenge);
      await Preferences.set({
        key: "nfc_message",
        value: JSON.stringify({ value: startRes.data.challenge }),
      });
      console.log("Saved message:", messageToSend);



    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  const setupHCE = async () => {
    try {
      // await saveMessage(); // Save before starting HCE

      await Nfc.addListener("commandReceived", async (event) => {
        console.log("Command received from reader:", event.data);
        setConnectionStatus("Connected to reader!");
        setToastMessage("📱 Reader connected! Sending data...");
        setShowToast(true);
      });

      await Nfc.addListener("nfcLinkDeactivated", (event) => {
        console.log("NFC link deactivated:", event.reason);
        setConnectionStatus("Disconnected - Ready for next connection");
        setToastMessage("📴 Connection closed");
        setShowToast(true);
      });

      setIsHCEActive(true);
      setConnectionStatus("HCE Active - Hold phones together");
      setToastMessage("✅ HCE service is ready!");
      setShowToast(true);
    } catch (error: any) {
      console.error("HCE setup error:", error);
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
              <IonInput
                value={messageToSend}
                onIonChange={(e) => setMessageToSend(e.detail.value!)}
                placeholder="Enter your message"
              />
            </IonItem>
            <IonButton expand="block" onClick={saveMessage}>
              create challenge
            </IonButton>
            <IonButton expand="block" onClick={setupHCE} disabled={isHCEActive}>
              {isHCEActive ? "HCE Active" : "Save Message & Start HCE"}
            </IonButton>

            {/* <IonButton
              expand="block"
              onClick={() => {
                console.log("Running test compression...");
                testUltraCompression();
              }}
            >
              Run WebAuthn Compression Test
            </IonButton> */}

            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <IonText color={isHCEActive ? "success" : "medium"}>
                <p>
                  <strong>Status:</strong> {connectionStatus}
                </p>
              </IonText>

              {isHCEActive && (
                <IonText color="primary">
                  <p style={{ fontSize: "14px" }}>
                    📱 HCE is active! Hold another phone with the reader app
                    near this device.
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
