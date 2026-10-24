import { RefObject, useEffect } from 'react';
import { VOICE_VALUE_EVENT, VoiceValue } from '../../domain/voice/VoiceControl';

export function useVoiceValue(ref: RefObject<HTMLElement>, update: (value: VoiceValue) => void) {
  useEffect(() => {
    const element = ref.current;
    const listener = (event: Event) => update((event as CustomEvent<VoiceValue>).detail);
    element?.addEventListener(VOICE_VALUE_EVENT, listener);
    return () => element?.removeEventListener(VOICE_VALUE_EVENT, listener);
  }, [ref, update]);
}
