import React, { useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonInput, IonItem, IonLabel, IonToast
} from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { Nfc, NfcTagTechType, PollingOption } from '@capawesome-team/capacitor-nfc';
import { useDispatch, useSelector } from 'react-redux';
import { buildPayment } from '../smartWalletSlice';
import type { AppDispatch, RootState } from '../store';

const Merchant: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { buildPaymentResult, loading, error } = useSelector((state: RootState) => state.smartWallet);
  const [walletAddress, setWalletAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [scanning, setScanning] = useState(false);

  const readCard = async () => {
    setScanning(true);
    setWalletAddress('');

    try {
      await Nfc.removeAllListeners();

      await Nfc.addListener('nfcTagScanned', async (event: any) => {
        try {
          await Nfc.stopScanSession();
          const techTypes = event.nfcTag.techTypes || [];

          if (Capacitor.getPlatform() === 'android' && techTypes.includes(NfcTagTechType.IsoDep)) {
            await Nfc.connect({ techType: NfcTagTechType.IsoDep });

            const selectResponse = await transceive('00A4040007F001020304050600');
            if (!selectResponse.endsWith('9000')) throw new Error('Card selection failed');

            let walletHex = '';
            let response = await transceive('0047000000');

            while (response.slice(-4, -2) === '61') {
              walletHex += response.slice(0, -4);
              response = await transceive(`00C00000${response.slice(-2)}`);
            }

            walletHex += response.slice(0, -4);
            const wallet = hexToString(walletHex);

            if (wallet) {
              setWalletAddress(wallet);
              console.log("log ~ :50 ~ readCard ~ wallet:", wallet)
              setToastMessage('✅ Wallet address received!');
              const saltId = 'TcFgFve06VR3ghSLZMrOOhPNi7ncF2BHAx8KFilzmIg';
              // await dispatch(fetchSmartWalletFee({ saltId, publicKey: wallet }));
            } else {
              throw new Error('No wallet address data');
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
    } catch (err: any) {
      setToastMessage(`❌ ${err.message}`);
      setShowToast(true);
      setScanning(false);
    }
  };

  const transceive = async (hexCmd: string) => {
    const cmd = hexCmd.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
    const response = await Nfc.transceive({ data: cmd });
    return response.response.map((byte: number) => byte.toString(16).padStart(2, '0')).join('');
  };

  const hexToString = (hex: string) => {
    try {
      return decodeURIComponent(hex.match(/.{1,2}/g)?.map(byte => '%' + byte).join('') || '');
    } catch {
      return '';
    }
  };

  const handleSubmit = async () => {
    if (!walletAddress || !amount) {
      setToastMessage('❗ Please scan card and enter amount');
      setShowToast(true);
      return;
    }

    try {
      await dispatch(buildPayment({
        wallet_address: walletAddress,
        from: walletAddress, // Adjust 'from' as needed
        amount: amount,
      }) as any);
      setToastMessage('✅ Payment request sent!');
    } catch (err: any) {
      setToastMessage(`❌ ${err.message || 'Payment failed'}`);
    }
    setShowToast(true);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Merchant</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonButton expand="block" onClick={readCard} disabled={scanning}>
          {scanning ? 'Scanning...' : 'Scan Wallet via NFC'}
        </IonButton>

        {walletAddress && (
          <p><strong>Wallet Address:</strong> {walletAddress}</p>
        )}

        <IonItem>
          <IonLabel position="floating">Enter Amount</IonLabel>
          <IonInput
            type="number"
            value={amount}
            onIonChange={(e) => setAmount(e.detail.value!)}
          />
        </IonItem>

        <IonButton expand="block" color="success" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Processing...' : 'Submit'}
        </IonButton>

        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        {buildPaymentResult && (
          <div style={{ marginTop: '1em', background: '#e3ffe3', padding: '1em', borderRadius: '8px' }}>
            <p><strong>AuthTxn:</strong> {buildPaymentResult.authTxn}</p>
            <p><strong>AuthHash:</strong> {buildPaymentResult.authHash}</p>
            <p><strong>LastLedger:</strong> {buildPaymentResult.lastLedger}</p>
          </div>
        )}

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={3000}
        />
      </IonContent>
    </IonPage>
  );
};

export default Merchant;
