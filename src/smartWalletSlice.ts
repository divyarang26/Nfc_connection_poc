import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_BASE_URL = "https://2074e87f4752.ngrok-free.app";


interface BuildPaymentRequest {
  wallet_address: string;
  from: string;
  amount: string;
}

interface BuildPaymentResponse {
  authTxn: string;
  authHash: string;
  lastLedger: number;
}

export const buildPayment = createAsyncThunk<
  BuildPaymentResponse,
  BuildPaymentRequest,
  { rejectValue: string }
>(
  'smartWallet/buildPayment',
  async (payload: BuildPaymentRequest, thunkAPI: { rejectWithValue: (value: string) => any }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/smart-wallet/build_payment`, payload);
      return response.data.data as BuildPaymentResponse;
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

interface SmartWalletState {
  buildPaymentResult: BuildPaymentResponse | null;
  loading: boolean;
  error: string | null;
}

const initialState: SmartWalletState = {
  buildPaymentResult: null,
  loading: false,
  error: null,
};

const smartWalletSlice = createSlice({
  name: 'smartWallet',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(buildPayment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(buildPayment.fulfilled, (state, action) => {
        state.loading = false;
        state.buildPaymentResult = action.payload;
      })
      .addCase(buildPayment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default smartWalletSlice.reducer;
