import { create } from 'zustand';

/** Whether the server could be reached on the last try. Set by the API client; read by the "no signal" bar. */
export const useNetwork = create<{ online: boolean }>(() => ({ online: true }));
export const setOnline = (online: boolean) => {
  if (useNetwork.getState().online !== online) useNetwork.setState({ online });
};
