import { createContext, useContext, useState } from 'react';

export const VALID_STATES = ['florida', 'indiana', 'georgia'];

const StateContext = createContext(null);

export function StateProvider({ children }) {
  const [currentState, setCurrentState] = useState('florida');

  return (
    <StateContext.Provider value={{ currentState, setCurrentState, VALID_STATES }}>
      {children}
    </StateContext.Provider>
  );
}

export function useStateContext() {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useStateContext must be used within StateProvider');
  return ctx;
}
