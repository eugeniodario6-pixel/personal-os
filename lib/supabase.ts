import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  );
}

// Lazy singleton — only instantiated when actually used (avoids SSR prerender errors)
let _supabase: ReturnType<typeof createClient> | null = null;
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    if (!_supabase) _supabase = createClient();
    return (_supabase as any)[prop];
  },
});
