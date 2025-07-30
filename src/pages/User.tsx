// import React, { useState, useEffect } from 'react';
// import {
//   IonPage,
//   IonHeader,
//   IonToolbar,
//   IonTitle,
//   IonContent,
//   IonButton,
//   IonText,
//   IonToast,
//   IonLoading,
//   IonCard,
//   IonCardContent,
//   IonCardHeader,
//   IonCardTitle,
// } from '@ionic/react';
// import { Nfc, NfcTagTechType, PollingOption } from '@capawesome-team/capacitor-nfc';
// import { Capacitor } from '@capacitor/core';

// // User Device - Reads public key from merchant's EbioroApplet HCE
// const User: React.FC = () => {
//   const [receivedKey, setReceivedKey] = useState('');
//   const [toastMessage, setToastMessage] = useState('');
//   const [showToast, setShowToast] = useState(false);
//   const [isScanning, setIsScanning] = useState(false);
//   const [connectionStatus, setConnectionStatus] = useState('');
//   const [dataProgress, setDataProgress] = useState('');

//   useEffect(() => {
//     return () => {
//       if (isScanning) {
//         Nfc.stopScanSession();
//       }
//       Nfc.removeAllListeners();
//     };
//   }, [isScanning]);

//   // Read public key from merchant's EbioroApplet HCE
//   const readPublicKey = async () => {
//     try {
//       setIsScanning(true);
//       setConnectionStatus('Starting NFC scan...');
//       setReceivedKey('');
//       setDataProgress('');

//       await Nfc.removeAllListeners();

//       await Nfc.addListener('nfcTagScanned', async (event) => {
//         setConnectionStatus('Merchant device detected! Connecting...');

//         try {
//           await Nfc.stopScanSession();
//           await new Promise(resolve => setTimeout(resolve, 100));

//           const techTypes = event.nfcTag.techTypes || [];

//           if (Capacitor.getPlatform() === 'android' && techTypes.includes(NfcTagTechType.IsoDep)) {
//             await Nfc.connect({ techType: NfcTagTechType.IsoDep });

//             // 1. Select EbioroApplet
//             setDataProgress('Selecting applet...');
//             const selectResponse = await selectApplication('F0010203040506');
            
//             if (!checkResponse(selectResponse, 'SELECT')) {
//               throw new Error('Failed to select applet');
//             }

//             // 2. Get Public Key directly (no PIN required)
//             setDataProgress('Getting public key...');
//             const keyResponse = await getPublicKey();
            
//             const publicKeyData = await readAllChunks(keyResponse);
            
//             if (publicKeyData) {
//               setReceivedKey(publicKeyData);
//               setConnectionStatus('Public key received successfully!');
//               setToastMessage('✅ Public key received from merchant!');
//             } else {
//               setToastMessage('⚠️ No public key data received');
//               setConnectionStatus('No data found');
//             }

//             await Nfc.close();
//           } else {
//             setToastMessage('❌ Incompatible NFC technology');
//             setConnectionStatus('Technology not supported');
//           }
//         } catch (error: any) {
//           setToastMessage(`❌ Error: ${error.message}`);
//           setConnectionStatus('Operation failed');
//         }

//         setIsScanning(false);
//         setShowToast(true);
//       });

//       await Nfc.startScanSession({
//         pollingOptions: [PollingOption.iso14443]
//       });

//     } catch (err: any) {
//       setIsScanning(false);
//       setToastMessage(`❌ Failed to start scan: ${err.message}`);
//       setConnectionStatus('Scan failed to start');
//       setShowToast(true);
//     }
//   };

//   // Helper function to select EbioroApplet
//   const selectApplication = async (aid: string) => {
//     const aidBytes = hexToArray(aid);
//     const selectCommand = [
//       0x00, 0xA4, 0x04, 0x00, // CLA INS P1 P2
//       aidBytes.length,         // Lc
//       ...aidBytes,            // AID
//       0x00                    // Le
//     ];
//     return await Nfc.transceive({ data: selectCommand });
//   };

//   // Helper function to get public key
//   const getPublicKey = async () => {
//     const getKeyCommand = [
//       0x00, 0x47, 0x00, 0x00, // CLA INS P1 P2
//       0x00                    // Le
//     ];
//     return await Nfc.transceive({ data: getKeyCommand });
//   };

//   // Check APDU response status
//   const checkResponse = (response: any, operation: string): boolean => {
//     if (!response || !response.response || response.response.length < 2) {
//       console.error(`${operation}: No response`);
//       return false;
//     }
    
//     const sw1 = response.response[response.response.length - 2];
//     const sw2 = response.response[response.response.length - 1];
    
//     if (sw1 === 0x90 && sw2 === 0x00) {
//       console.log(`${operation}: Success`);
//       return true;
//     }
    
//     console.error(`${operation}: Error SW1=${sw1.toString(16)} SW2=${sw2.toString(16)}`);
//     return false;
//   };

//   // Read all chunks of data (handles status 61XX)
//   const readAllChunks = async (initialResponse: any): Promise<string> => {
//     let allData: number[] = [];
//     let currentResponse = initialResponse;
//     let chunkCount = 0;
    
//     try {
//       while (currentResponse && currentResponse.response && currentResponse.response.length > 2) {
//         const response = currentResponse.response;
//         const sw1 = response[response.length - 2];
//         const sw2 = response[response.length - 1];
        
//         // Extract data (excluding status bytes)
//         const chunkData = response.slice(0, -2);
//         allData = allData.concat(chunkData);
//         chunkCount++;
        
//         // Update progress
//         setDataProgress(`Reading chunk ${chunkCount}... (${allData.length} bytes)`);
        
//         // Check if more data is available (status 61XX)
//         if (sw1 === 0x61) {
//           // More data available, send GET RESPONSE command
//           const getResponseCommand = [0x00, 0xC0, 0x00, 0x00, sw2 || 0x00];
//           currentResponse = await Nfc.transceive({ data: getResponseCommand });
//         } else if (sw1 === 0x90 && sw2 === 0x00) {
//           // Success, no more data
//           break;
//         } else {
//           // Error or unexpected status
//           console.error(`Unexpected status: ${sw1.toString(16)} ${sw2.toString(16)}`);
//           break;
//         }
//       }
      
//       // Convert accumulated data to string
//       if (allData.length > 0) {
//         const uint8Array = new Uint8Array(allData);
//         const decodedData = new TextDecoder().decode(uint8Array);
//         setDataProgress(`Complete! ${chunkCount} chunks, ${allData.length} bytes total`);
//         return decodedData;
//       }
      
//     } catch (error) {
//       console.error('Error reading chunks:', error);
//       setDataProgress(`Error after ${chunkCount} chunks`);
//     }
    
//     return '';
//   };

//   const hexToArray = (hex: string): number[] => {
//     const result = [];
//     for (let i = 0; i < hex.length; i += 2) {
//       result.push(parseInt(hex.substr(i, 2), 16));
//     }
//     return result;
//   };

//   const stopReading = async () => {
//     try {
//       await Nfc.stopScanSession();
//       await Nfc.removeAllListeners();
//       setIsScanning(false);
//       setConnectionStatus('');
//       setDataProgress('');
//       setToastMessage('🛑 NFC scan stopped');
//       setShowToast(true);
//     } catch (error: any) {
//       setToastMessage(`❌ Error stopping scan: ${error.message}`);
//       setShowToast(true);
//     }
//   };

//   return (
//     <IonPage>
//       <IonHeader>
//         <IonToolbar>
//           <IonTitle>User - Read Public Key</IonTitle>
//         </IonToolbar>
//       </IonHeader>
//       <IonContent className="ion-padding">
//         <IonCard>
//           <IonCardHeader>
//             <IonCardTitle>Read Public Key via NFC</IonCardTitle>
//           </IonCardHeader>
//           <IonCardContent>
//             <IonButton 
//               expand="block" 
//               onClick={isScanning ? stopReading : readPublicKey}
//               color={isScanning ? 'danger' : 'primary'}
//             >
//               {isScanning ? 'Stop Reading' : 'Read Public Key'}
//             </IonButton>

//             {connectionStatus && (
//               <IonText color="medium" style={{ display: 'block', marginTop: '20px', textAlign: 'center' }}>
//                 <p><strong>Status:</strong> {connectionStatus}</p>
//               </IonText>
//             )}

//             {dataProgress && (
//               <IonText color="secondary" style={{ display: 'block', marginTop: '10px', textAlign: 'center' }}>
//                 <p style={{ fontSize: '12px' }}>{dataProgress}</p>
//               </IonText>
//             )}

//             {receivedKey && (
//               <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
//                 <IonText color="success">
//                   <h4>Public Key Received</h4>
//                   <pre style={{ 
//                     fontSize: '12px', 
//                     wordBreak: 'break-all', 
//                     backgroundColor: 'white', 
//                     padding: '10px', 
//                     borderRadius: '4px',
//                     border: '1px solid #ddd',
//                     maxHeight: '300px',
//                     overflow: 'auto',
//                     fontFamily: 'monospace',
//                     whiteSpace: 'pre-wrap'
//                   }}>
//                     {receivedKey}
//                   </pre>
//                   <p style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>
//                     Length: {receivedKey.length} characters
//                   </p>
//                 </IonText>
//               </div>
//             )}

//             <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
//               <IonText color="primary" style={{ fontSize: '14px' }}>
//                 <p><strong>Instructions:</strong></p>
//                 <p>1. Make sure the merchant device has NFC sharing activated</p>
//                 <p>2. Hold phones back-to-back to connect</p>
//                 <p>3. The public key will be transferred automatically</p>
//                 <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
//                   No authentication required - Direct access
//                 </p>
//               </IonText>
//             </div>
//           </IonCardContent>
//         </IonCard>

//         <IonLoading 
//           isOpen={isScanning} 
//           message="Hold phones back-to-back to read public key..." 
//         />
        
//         <IonToast
//           isOpen={showToast}
//           message={toastMessage}
//           duration={3000}
//           onDidDismiss={() => setShowToast(false)}
//         />
//       </IonContent>
//     </IonPage>
//   );
// };

// export default User;

import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonButton, IonToast, IonCard, IonCardContent, IonText } from '@ionic/react';
import { Nfc, NfcTagTechType, PollingOption, NfcTagScannedEvent } from '@capawesome-team/capacitor-nfc';
import { Capacitor } from '@capacitor/core';

const UserCardActivation: React.FC = () => {
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    return () => {
      Nfc.stopScanSession();
      Nfc.removeAllListeners();
    };
  }, []);

  const activateCard = async () => {
    setScanning(true);
    try {
      await Nfc.removeAllListeners();

      await Nfc.addListener('nfcTagScanned', async (event: NfcTagScannedEvent) => {
        try {
          await Nfc.stopScanSession();
          const techTypes = event.nfcTag.techTypes || [];

          if (Capacitor.getPlatform() === 'android' && techTypes.includes(NfcTagTechType.IsoDep)) {
            await Nfc.connect({ techType: NfcTagTechType.IsoDep });

            const selectResponse = await transceive('00A4040007F001020304050600');
            if (!selectResponse.endsWith('9000')) throw new Error('Applet selection failed');

            let publicKey = '';
            let response = await transceive('0047000000');

            while (response.slice(-4, -2) === '61') {
              publicKey += response.slice(0, -4);
              response = await transceive(`00C00000${response.slice(-2)}`);
            }

            publicKey += response.slice(0, -4);

            const publicKeyString = hexToString(publicKey);
            if (publicKeyString) {
              console.log('Public Key:', publicKeyString);
              setToastMessage('✅ Public key logged successfully!');
            } else {
              throw new Error('Public key data invalid or empty');
            }
            await Nfc.close();
          } else {
            throw new Error('Unsupported NFC type');
          }
        } catch (err: any) {
          setToastMessage(`❌ ${err.message}`);
        }
        setShowToast(true);
        setScanning(false);
      });

      await Nfc.startScanSession({ pollingOptions: [PollingOption.iso14443] });
      setToastMessage('📱 Hold the card or device to the back of your phone...');
      setShowToast(true);
    } catch (err: any) {
      setToastMessage(`❌ ${err.message}`);
      setShowToast(true);
      setScanning(false);
    }
  };

  const transceive = async (hexCmd: string) => {
    const cmd = hexCmd.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
    const response = await Nfc.transceive({ data: cmd });
    return response.response.map(byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const hexToString = (hex: string) => {
    return decodeURIComponent(hex.match(/.{1,2}/g)?.map(byte => '%' + byte).join('') || '');
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <IonCard className="ion-padding ion-text-center">
          <IonCardContent>
            <IonButton expand="block" onClick={activateCard} disabled={scanning}>
              {scanning ? 'Scanning...' : 'Activate Physical Card'}
            </IonButton>

            <IonText color="medium" className="ion-margin-top">
              Tap the button and hold your card or merchant device against the back of your phone.
            </IonText>
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

export default UserCardActivation;
