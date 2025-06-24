import { IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent, IonHeader, IonInput, IonItem, IonList, IonMenuButton, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router';
import ExploreContainer from '../components/ExploreContainer';
import { PasskeymeSDK } from 'passkeyme-ionic-cap-plugin';

import axios from "axios";
import { useState } from 'react';

const API_URL = "https://passkeyme.com";
const APP_UUID = "cad7760b-3ee4-4df8-b7b4-73cdeaff0774";
const API_KEY = "36LP0Z0frQaYgqduOXl6fjW0llIhQNXr";

const client = axios.create({
   baseURL: `${API_URL}/webauthn/${APP_UUID}`, 
   headers: {
     'x-api-key': API_KEY,
     'Content-Type': 'application/json'
   }});

const Page: React.FC = () => {

  const [result, setResult] = useState<any>("");
  const [username, setUsername] = useState<any>("");
  const [displayName, setDisplayName] = useState<any>("");

  const appuuid = APP_UUID;
  const apikey = API_KEY;

  async function registerPasskey() {
    try {

      const response = await client.post(`/start_registration`, {username, displayName});

      const { credential } = await PasskeymeSDK.passkeyRegister({ challenge: response.data.challenge });

      let completionresponse = await client.post(`/complete_registration`, { username, credential });

      setResult(JSON.stringify(completionresponse.data));
    } catch (error) {
      console.log('passkeyme: reg: error:', JSON.stringify(error))
      setResult(JSON.stringify(error));
    }
  };

  async function authenticatePasskey() {
    try {

      console.log("log ~ :50 ~ authenticatePasskey ~ username:", username)
      
      let response = await client.post(`/start_authentication`, { username });
      console.log("log ~ :53 ~ authenticatePasskey ~ response.data.challenge:", response.data.challenge)
      const { credential } = await PasskeymeSDK.passkeyAuthenticate({ challenge: response.data.challenge });
      let completionresponse = await client.post(`/complete_authentication`, { credential });

      setResult(JSON.stringify(completionresponse.data));

    } catch (error) {
      console.log('passkeyme: error:', JSON.stringify(error))
      setResult(JSON.stringify(error));
    }
  }

  const { name } = useParams<{ name: string; }>();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>{name}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{name}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <ExploreContainer name={name} />
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>
            <IonList>
              <IonItem>
                <IonInput label="username" placeholder="Enter a username" value={username}
                  onIonChange={(e: any) => setUsername(e.target.value)}               
                  ></IonInput>
              </IonItem>

              <IonItem>
                <IonInput label="displayName" placeholder="Enter a display name" value={displayName}
                onIonChange={(e: any) => setDisplayName(e.target.value)}
                ></IonInput>
              </IonItem>
            </IonList>
                
            <IonButton 
                onClick={() => {
                  registerPasskey()
                }}
            >Register Passkey
            </IonButton>
            <IonButton 
                onClick={() => {
                  authenticatePasskey()
                }}
            >Login Passkey
            </IonButton>

            </IonCardTitle>
          </IonCardHeader>

          <IonCardContent>{result}</IonCardContent>
        </IonCard>

      </IonContent>
    </IonPage>
  );
};

export default Page;