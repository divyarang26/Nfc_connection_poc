import { configureStore } from '@reduxjs/toolkit';
import smartWalletReducer from './smartWalletSlice';

export const store = configureStore({
  reducer: {
    smartWallet: smartWalletReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
