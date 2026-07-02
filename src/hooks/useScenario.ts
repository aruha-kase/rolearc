import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useScenario(roomId: string) {
  const [scenario, setScenario] = useState<object | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!roomId) return;
    supabase
      .from('rooms')
      .select('scenario')
      .eq('id', roomId)
      .single()
      .then(({ data }) => {
        if (data?.scenario) setScenario(data.scenario as object);
      });
  }, [roomId]);

  const saveScenario = useCallback((content: object) => {
    setScenario(content);
    setSaving(true);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      await supabase
        .from('rooms')
        .update({ scenario: content as never })
        .eq('id', roomId);
      setSaving(false);
    }, 1000);
  }, [roomId]);

  return { scenario, saving, saveScenario };
}
