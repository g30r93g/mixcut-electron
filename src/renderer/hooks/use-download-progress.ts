import { useState, useEffect, useCallback } from 'react';
import { mixcut } from '../lib/mixcut-api';
import type { DownloadProgress } from '../../shared/types';

export function useDownloadProgress() {
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    const unsubscribe = mixcut.onDownloadProgress(setProgress);
    return unsubscribe;
  }, []);

  const reset = useCallback(() => setProgress(null), []);

  return { progress, reset };
}
