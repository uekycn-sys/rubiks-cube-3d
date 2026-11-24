import { useEffect, useState } from 'react';
import { store, AppState } from './cubeStore';

export function useCubeStore(): AppState {
  const [state, setState] = useState<AppState>(store.getState());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setState(store.getState());
    });
    return unsubscribe;
  }, []);

  return state;
}
