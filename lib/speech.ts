// lib/speech.ts
// Native speech recognition via iOS SFSpeechRecognizer
// Falls back to webkitSpeechRecognition in browser

import { registerPlugin } from '@capacitor/core';

interface SpeechPlugin {
  requestPermissions(): Promise<{ speech: boolean; microphone: boolean }>;
  start(): Promise<{ transcript: string }>;
  stop(): Promise<void>;
}

const SpeechNative = registerPlugin<SpeechPlugin>('Speech', {
  web: {
    requestPermissions: async () => ({ speech: false, microphone: false }),
    start: async () => ({ transcript: '' }),
    stop: async () => {},
  },
});

function isNative(): boolean {
  return typeof (window as any)?.Capacitor?.isNativePlatform === 'function'
    && (window as any).Capacitor.isNativePlatform();
}

export interface SpeechResult {
  transcript: string;
  error?: string;
}

export async function startSpeechRecognition(): Promise<SpeechResult> {
  if (isNative()) {
    try {
      // Request permissions first
      const perms = await SpeechNative.requestPermissions();
      if (!perms.speech || !perms.microphone) {
        return { transcript: '', error: 'Permission denied' };
      }
      const result = await SpeechNative.start();
      return { transcript: result.transcript };
    } catch (e: any) {
      return { transcript: '', error: e?.message ?? 'Speech recognition failed' };
    }
  }

  // Browser fallback — webkitSpeechRecognition
  return new Promise((resolve) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { resolve({ transcript: '', error: 'Not supported' }); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => resolve({ transcript: e.results[0][0].transcript });
    rec.onerror = (e: any) => resolve({ transcript: '', error: e.error });
    rec.onend = () => resolve({ transcript: '', error: 'No result' });
    rec.start();
  });
}

export async function stopSpeechRecognition(): Promise<void> {
  if (isNative()) {
    await SpeechNative.stop();
  }
}
