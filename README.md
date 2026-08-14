# Personal OS

A native iOS personal operating system for tracking body composition, nutrition, and phase-based fitness goals.

## Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | Expo 51 + Expo Router + React Native (TypeScript) |
| API | Next.js 14 (deployed on Vercel) |
| Database | Supabase (PostgreSQL) |
| Nutrition Data | FatSecret Platform API v2 |
| Health Data | Apple HealthKit via expo-health |

## Architecture

```
personal-os/
  /api         ← Next.js 14 API routes (Vercel)
  /app         ← Expo 51 mobile app (iOS)
  /supabase    ← SQL migrations
```

### Key Features

- **Nutrition Pillar** — Daily macro tracking synced from FatSecret diary
- **Weight Tracking** — Reads from Apple HealthKit; computes 7-day rolling average
- **Phase Engine** — Fat loss → recomp phase transitions based on weight targets (84 kg midpoint)
- **TDEE Projection** — Mifflin-St Jeor BMR × 1.2 (sedentary), weekly recalculation via Vercel cron
- **Points Ledger** — Daily adherence (logged food) + bonus (hit calorie + protein targets) scoring

## Running the API

```bash
cd api
cp .env.example .env.local
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FATSECRET_*, CLAUDE_API_KEY
npm install
npm run dev   # runs on http://localhost:3001
```

## Running the App

```bash
cd app
cp .env.example .env
# set EXPO_PUBLIC_API_URL=http://localhost:3001 for local dev
npm install
npm run start          # Expo Go / dev server
npm run ios            # run on iOS simulator/device
```

## Database Setup

Apply the migration to your Supabase project:

```bash
# via Supabase CLI
supabase db push

# or paste supabase/migrations/001_initial.sql directly into the SQL editor
```

## Vercel Cron

`/api/vercel.json` schedules a weekly recalculation every Monday at 06:00 UTC:

```
GET /api/cron/weekly-recalc
```

Set `CRON_SECRET` in Vercel env vars to secure the endpoint. The cron job:
1. Computes 7-day rolling weight average
2. Recalculates TDEE, deficit, weekly loss rate, ETA to 84 kg
3. Checks for phase transition (fat_loss → recomp) if weight has been in 83–85 kg range for 2 full weeks
