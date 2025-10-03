'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type SelectedAccountState = {
  selectedAccountId: string | null;
  setSelectedAccountId: (accountId: string | null) => void;
};

export const useSelectedAccount = create<SelectedAccountState>()(
  persist(
    (set) => ({
      selectedAccountId: null,
      setSelectedAccountId: (accountId) => set({ selectedAccountId: accountId }),
    }),
    {
      name: 'selected-account-storage', 
      storage: createJSONStorage(() => localStorage),
    }
  )
);
