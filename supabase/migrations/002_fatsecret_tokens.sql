CREATE TABLE IF NOT EXISTS fatsecret_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'default',
  oauth_token text NOT NULL,
  oauth_token_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fatsecret_tokens_user_id_idx ON fatsecret_tokens(user_id);
