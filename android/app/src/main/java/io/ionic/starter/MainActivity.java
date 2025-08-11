package io.ionic.starter;

import com.getcapacitor.BridgeActivity;

// public class MainActivity extends BridgeActivity {}
// MainActivity.java
import android.nfc.NfcAdapter;
import android.nfc.cardemulation.CardEmulation;
import android.content.ComponentName;

public class MainActivity extends com.getcapacitor.BridgeActivity {
  @Override public void onResume() {
    super.onResume();
    try {
      NfcAdapter a = NfcAdapter.getDefaultAdapter(this);
      if (a != null) {
        CardEmulation ce = CardEmulation.getInstance(a);
        ce.setPreferredService(this, new ComponentName(this, MyHostApduService.class));
      }
    } catch (Exception ignore) {}
  }

  @Override public void onPause() {
    super.onPause();
    try {
      NfcAdapter a = NfcAdapter.getDefaultAdapter(this);
      if (a != null) {
        CardEmulation ce = CardEmulation.getInstance(a);
        ce.unsetPreferredService(this);
      }
    } catch (Exception ignore) {}
  }
}
