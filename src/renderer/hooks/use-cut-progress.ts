import { useState, useEffect } from 'react';
import { mixcut } from '../lib/mixcut-api';
import type { CutProgress } from '../../shared/types';

export function useCutProgress() {
  const [progress, setProgress] = useState<CutProgress | null>(null);

  useEffect(() => {
    const unsubscribe = mixcut.onCutProgress(setProgress);
    return unsubscribe;
  }, []);

  return progress;
}
