'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSelectedLogo } from '../hooks/useAdminSettings';

interface LogoContextValue {
  selectedLogo: string | null | undefined;
  isLoading: boolean;
}

const LogoContext = createContext<LogoContextValue | undefined>(undefined);

export function LogoProvider({ children }: { children: ReactNode }) {
  const { data: selectedLogo, isLoading } = useSelectedLogo();

  return (
    <LogoContext.Provider value={{ selectedLogo, isLoading }}>
      {children}
    </LogoContext.Provider>
  );
}

export function useLogo() {
  const context = useContext(LogoContext);
  if (context === undefined) {
    throw new Error('useLogo must be used within a LogoProvider');
  }
  return context;
}
