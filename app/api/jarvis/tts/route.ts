export const runtime = 'edge';
export const maxDuration = 30;

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/text-to-speech';

// Female voice presets for Veronica
export const VOICES = {
  charlotte: { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', desc: 'British · Warm' },
  sarah:     { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',     desc: 'American · Soft' },
  alice:     { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice',     desc: 'British · Confident' },
  matilda:   { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda',   desc: 'American · Warm' },
  rachel:    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel',    desc: 'American · Calm' },
  browser:   { id: '',                      name: 'Browser',   desc: 'Built-in · Free' },
} as const;

export type VoiceKey = keyof typeof VOICES;

export async function POST(req: Request) {
  const { text, voice = 'charlotte' } = await req.json();

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return new Response('ElevenLabs API key not configured', { status: 500 });
  if (!text?.trim()) return new Response('No text provided', { status: 400 });

  const voiceConfig = VOICES[voice as VoiceKey] ?? VOICES.charlotte;
  if (!voiceConfig.id) return new Response('Browser voice — no TTS', { status: 400 });

  const elRes = await fetch(`${ELEVENLABS_API}/${voiceConfig.id}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text.slice(0, 1000),
      model_id: 'eleven_flash_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.35,
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
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  });
}
