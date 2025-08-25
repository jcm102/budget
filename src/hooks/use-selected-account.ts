
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type SelectedAccountState = {
  selectedAccountId: string | null;
  setSelectedAccountId: (accountId: string) => void;
};

export const useSelectedAccount = create<SelectedAccountState>()(
  persist(
    (set) => ({
      selectedAccountId: null,
      setSelectedAccountId: (accountId: string) => set({ selectedAccountId: accountId }),
    }),
    {
      name: 'selected-account-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);
