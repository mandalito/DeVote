import { atom } from 'jotai';

export interface UserState {
  loggedIn: boolean;
  name?: string;
  email?: string;
  provider?: string;
  university?: string;
  studentId?: string;
}

export const userAtom = atom<UserState | null>(null);
