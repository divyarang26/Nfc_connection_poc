// import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
// import ExploreContainer from '../components/ExploreContainer';
// import './Tab2.css';

// const Tab2: React.FC = () => {
//   return (
//     <IonPage>
//       <IonHeader>
//         <IonToolbar>
//           <IonTitle>Tab 2</IonTitle>
//         </IonToolbar>
//       </IonHeader>
//       <IonContent fullscreen>
//         <IonHeader collapse="condense">
//           <IonToolbar>
//             <IonTitle size="large">Tab 2</IonTitle>
//           </IonToolbar>
//         </IonHeader>
//         <ExploreContainer name="Tab 2 page" />
//       </IonContent>
//     </IonPage>
//   );
// };

// export default Tab2;

// import React from 'react';
// import { IonApp, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonText } from '@ionic/react';
// import { PasskeyMe } from '@passkeyme/ionic-sdk';
// const passkeyme = new PasskeyMe();
// console.log("🚀 ~ passkeyme:", passkeyme)

// const App: React.FC = () => {
//   const [message, setMessage] = React.useState('');

//   const mockChallenge = 'mock-challenge-string'; // In real app, get this from backend

//   const handleRegister = async () => {
//     try {
//       const result = await passkeyme.passkeyRegister(mockChallenge);
//       setMessage('✅ Registration Success: ' + JSON.stringify(result));
//     } catch (error) {
//       setMessage('❌ Registration Failed: ' + (error as Error).message);
//     }
//   };

//   const handleAuthenticate = async () => {
//     try {
//       const result = await passkeyme.passkeyAuthenticate(mockChallenge);
//       setMessage('✅ Authentication Success: ' + JSON.stringify(result));
//     } catch (error) {
//       setMessage('❌ Authentication Failed: ' + (error as Error).message);
//     }
//   };

//   return (
//     <IonApp>
//       <IonHeader>
//         <IonToolbar>
//           <IonTitle>PasskeyMe Ionic POC</IonTitle>
//         </IonToolbar>
//       </IonHeader>
//       <IonContent className="ion-padding">
//         <IonButton expand="block" onClick={handleRegister}>Register with Passkey</IonButton>
//         <IonButton expand="block" color="secondary" onClick={handleAuthenticate} style={{ marginTop: '1rem' }}>
//           Authenticate with Passkey
//         </IonButton>
//         <IonText style={{ marginTop: '1rem', display: 'block' }}>{message}</IonText>
//       </IonContent>
//     </IonApp>
//   );
// };

// export default App;


import React from 'react';
import { IonApp, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonText } from '@ionic/react';
import PasskeyMe from 'passkeyme-web-sdk'; // ✅ Use this import
console.log("🚀 ~ PasskeyMe:", PasskeyMe)

const passkeyme = new PasskeyMe();

const App: React.FC = () => {
  const [message, setMessage] = React.useState('');

  const mockChallenge = 'mock-challenge-string'; // Replace with real challenge from backend

  const handleRegister = async () => {
    try {
      const result = await passkeyme.passkeyRegister(mockChallenge);
      setMessage('✅ Registration Success: ' + JSON.stringify(result));
    } catch (error: any) {
      setMessage('❌ Registration Failed: ' + error.message);
    }
  };

  const handleAuthenticate = async () => {
    try {
      const result = await passkeyme.passkeyAuthenticate(mockChallenge);
      setMessage('✅ Authentication Success: ' + JSON.stringify(result));
    } catch (error: any) {
      setMessage('❌ Authentication Failed: ' + error.message);
    }
  };

  return (
    <IonApp>
      <IonHeader>
        <IonToolbar>
          <IonTitle>PasskeyMe Ionic POC</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonButton expand="block" onClick={handleRegister}>Register with Passkey</IonButton>
        <IonButton expand="block" color="secondary" onClick={handleAuthenticate} style={{ marginTop: '1rem' }}>
          Authenticate with Passkey
        </IonButton>
        <IonText style={{ marginTop: '1rem', display: 'block' }}>{message}</IonText>
      </IonContent>
    </IonApp>
  );
};

export default App;
