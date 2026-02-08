import { create } from "zustand";

interface VoiceState {
  micMuted: boolean;
  deafened: boolean;
  setMicMuted: (muted: boolean) => void;
  toggleMicMuted: () => void;
  setDeafened: (deafened: boolean) => void;
  toggleDeafened: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  micMuted: false,
  deafened: false,
  setMicMuted: (muted) => set({ micMuted: muted }),
  toggleMicMuted: () => set((s) => ({ micMuted: !s.micMuted })),
  setDeafened: (deafened) => set({ deafened }),
  toggleDeafened: () => set((s) => ({ deafened: !s.deafened })),
}));

