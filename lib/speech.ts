// lib/speech.ts
// Native speech recognition — uses CustomEvent bridge (same as HealthKit)
// Swift fires speech-result event, JS listens

function isNative(): boolean {
  return typeof (window as any)?.Capacitor?.isNativePlatform === 'function'
    && (window as any).Capacitor.isNativePlatform();
}

export interface SpeechResult {
  transcript: string;
  error?: string;
}

export function startSpeechRecognition(): Promise<SpeechResult> {
  if (isNative()) {
    return new Promise((resolve) => {
      // Tell Swift to start listening via a global function
      const timeout = setTimeout(() => {
        cleanup();
        resolve({ transcript: '', error: 'Timeout' });
      }, 15000);

      function onResult(e: Event) {
        cleanup();
        const detail = (e as CustomEvent).detail;
        resolve({ transcript: detail.transcript ?? '', error: detail.error });
      }

      function cleanup() {
        clearTimeout(timeout);
        window.removeEventListener('speech-result', onResult);
      }

      window.addEventListener('speech-result', onResult, { once: true });

      // Trigger native speech via webkit message handler
      console.log('[Speech] Sending startSpeech to native...');
      const handler = (window as any).webkit?.messageHandlers?.startSpeech;
      if (handler) {
        console.log('[Speech] Handler found, posting message');
        handler.postMessage({});
      } else {
        console.warn('[Speech] webkit.messageHandlers.startSpeech not found');
        resolve({ transcript: '', error: 'Handler not registered' });
      }
    });
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
    rec.onend   = () => {};
    rec.start();
  });
}

export function stopSpeechRecognition(): Promise<void> {
  try {
    (window as any).webkit?.messageHandlers?.stopSpeech?.postMessage({});
  } catch {}
  return Promise.resolve();
}
