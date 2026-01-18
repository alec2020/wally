'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ScreenshotModeContextType {
  isScreenshotMode: boolean;
  setScreenshotMode: (enabled: boolean) => void;
}

const ScreenshotModeContext = createContext<ScreenshotModeContextType>({
  isScreenshotMode: false,
  setScreenshotMode: () => {},
});

export function ScreenshotModeProvider({ children }: { children: ReactNode }) {
  const [isScreenshotMode, setIsScreenshotMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('screenshotMode');
    if (stored === 'true') {
      setIsScreenshotMode(true);
    }
  }, []);

  const setScreenshotMode = (enabled: boolean) => {
    setIsScreenshotMode(enabled);
    localStorage.setItem('screenshotMode', enabled ? 'true' : 'false');
  };

  return (
    <ScreenshotModeContext.Provider value={{ isScreenshotMode, setScreenshotMode }}>
      {children}
    </ScreenshotModeContext.Provider>
  );
}

export function useScreenshotMode() {
  return useContext(ScreenshotModeContext);
}
