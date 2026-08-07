import { create } from 'zustand';

interface FloatingCalculatorState {
  isOpen: boolean;
  isMinimized: boolean;
  onUseResult: ((result: string) => void) | null;
  setIsOpen: (isOpen: boolean) => void;
  setIsMinimized: (isMinimized: boolean) => void;
  setOnUseResult: (cb: ((result: string) => void) | null) => void;
  toggle: () => void;
}

export const useFloatingCalculator = create<FloatingCalculatorState>((set) => ({
  isOpen: false,
  isMinimized: false,
  onUseResult: null,
  setIsOpen: (isOpen) => set({ isOpen, isMinimized: false }), // default to maximized on open
  setIsMinimized: (isMinimized) => set({ isMinimized }),
  setOnUseResult: (onUseResult) => set({ onUseResult }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen, isMinimized: false })),
}));


