import { create } from 'zustand';
import type { Room } from '../types/app';

interface RoomState {
  currentRoom: Room | null;
  partnerJoined: boolean;
  setRoom: (room: Room | null) => void;
  setPartnerJoined: (joined: boolean) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  currentRoom: null,
  partnerJoined: false,
  setRoom: (room) => set({ currentRoom: room }),
  setPartnerJoined: (joined) => set({ partnerJoined: joined }),
  reset: () => set({ currentRoom: null, partnerJoined: false }),
}));
