
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type LedgerSettingsState = {
  includeSinkingFunds: boolean;
  setIncludeSinkingFunds: (include: boolean) => void;
  includeGoalSavings: boolean;
  setIncludeGoalSavings: (include: boolean) => void;
};

export const useLedgerSettings = create<LedgerSettingsState>()(
  persist(
    (set) => ({
      includeSinkingFunds: true,
      setIncludeSinkingFunds: (include) => set({ includeSinkingFunds: include }),
      includeGoalSavings: true,
      setIncludeGoalSavings: (include) => set({ includeGoalSavings: include }),
    }),
    {
      name: 'ledger-settings-storage', 
      storage: createJSONStorage(() => localStorage),
    }
  )
);
