export const runtime = 'edge';
export const maxDuration = 30;

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/text-to-speech';

// Voice presets — all male, all solid for Jarvis
export const VOICES = {
  daniel: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', desc: 'British · Formal' },
  george: { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', desc: 'British · Warm' },
  brian:  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian',  desc: 'American · Deep' },
  eric:   { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric',   desc: 'American · Smooth' },
  adam:   { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',   desc: 'American · Dominant' },
} as const;

export type VoiceKey = keyof typeof VOICES;

export async function POST(req: Request) {
  const { text, voice = 'daniel' } = await req.json();

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response('ElevenLabs API key not configured', { status: 500 });
  }

  if (!text?.trim()) {
    return new Response('No text provided', { status: 400 });
  }

  const voiceConfig = VOICES[voice as VoiceKey] ?? VOICES.daniel;

  const elRes = await fetch(`${ELEVENLABS_API}/${voiceConfig.id}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text.slice(0, 1000), // cap to avoid runaway costs
      model_id: 'eleven_flash_v2_5', // fast + cheap
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!elRes.ok) {
    const err = await elRes.text();
    console.error('ElevenLabs error:', err);
    return new Response('TTS failed', { status: 502 });
  }

  const audio = await elRes.arrayBuffer();
  return new Response(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}
