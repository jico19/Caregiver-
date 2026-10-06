import { useState } from 'react';
import { StateContext } from './stateContextDef';
import { VALID_STATES } from '../constants/states';

export { VALID_STATES };

export function StateProvider({ children }) {
  const [currentState, setCurrentState] = useState('florida');

  return (
    <StateContext.Provider value={{ currentState, setCurrentState, VALID_STATES }}>
      {children}
    </StateContext.Provider>
  );
}

export default StateProvider;
