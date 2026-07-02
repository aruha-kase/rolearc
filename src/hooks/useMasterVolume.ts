import { useState, useCallback } from 'react';

const STORAGE_KEY = 'trpg-master-volume';

function getStoredVolume(): number {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v !== null) {
      const n = parseFloat(v);
      if (!isNaN(n) && n >= 0 && n <= 1) return n;
    }
  } catch {
    /* sessionStorage 利用不可(プライベートモード等)は既定値にフォールバック */
  }
  return 0.7;
}

export function useMasterVolume() {
  const [masterVolume, setMasterVolumeState] = useState(getStoredVolume);

  const setMasterVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setMasterVolumeState(clamped);
    try { sessionStorage.setItem(STORAGE_KEY, String(clamped)); } catch {
      /* 保存失敗は無視(音量はstateで保持済み) */
    }
  }, []);

  return { masterVolume, setMasterVolume };
}
