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
      selectedAccountId: 'all',
      setSelectedAccountId: (accountId) => set({ selectedAccountId: accountId }),
    }),
    {
      name: 'selected-account-storage', 
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version < 1 || !persistedState || !persistedState.selectedAccountId || persistedState.selectedAccountId === 'null') {
          return { selectedAccountId: 'all' };
        }
        return persistedState as SelectedAccountState;
      },
    }
  )
);
