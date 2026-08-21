# iOS Native App Setup — Personal OS
## TestFlight + Capacitor + HealthKit + Push Notifications

Everything in this folder is pre-built and ready.
When Xcode and your Apple Developer account are both active, run through this in order.

---

## Prerequisites checklist

- [ ] Xcode installed (App Store → search "Xcode" → ~7GB download)
- [ ] Apple Developer account active (developer.apple.com → status = Active)
- [ ] Run `sudo xcode-select -s /Applications/Xcode.app` after install

---

## Step 1 — Create App ID + Capabilities (10 min)

1. Go to **developer.apple.com → Certificates, Identifiers & Profiles**
2. **Identifiers → +** → App ID → App
3. Bundle ID: `com.batman.personalos` (explicit)
4. Enable these capabilities:
   - ✅ Push Notifications
   - ✅ HealthKit
   - ✅ Background Modes (check: Remote notifications, Background fetch, Background processing)
5. Save

---

## Step 2 — Create APNs Auth Key (5 min)

1. **Keys → +** → name: "Personal OS Push"
2. Enable **Apple Push Notifications service (APNs)**
3. Download the `.p8` file → **save it, you can only download once**
4. Note your **Key ID** and **Team ID** (top right of developer portal)
5. Add to Supabase secrets:

```bash
supabase secrets set APNS_KEY_ID=your_key_id
supabase secrets set APNS_TEAM_ID=your_team_id
supabase secrets set APNS_PRIVATE_KEY="$(cat AuthKey_XXXX.p8 | tr '\n' '\\n')"
```

---

## Step 3 — Run Supabase migration (2 min)

In Supabase SQL editor (project: tcheylkmqjprpwvtbexw):

```sql
-- paste contents of: ios-setup/supabase/migrations/device_tokens.sql
```

---

## Step 4 — Deploy push notification edge function (2 min)

```bash
cd /Users/GARCIA/.openclaw/workspace/personal-os
supabase functions deploy push-notify --project-ref tcheylkmqjprpwvtbexw
```

---

## Step 5 — Add Capacitor iOS platform (5 min)

```bash
cd /Users/GARCIA/.openclaw/workspace/personal-os
npx cap add ios
```

This generates the `ios/` folder with the Xcode project.

---

## Step 6 — Copy native bridge files (2 min)

```bash
cp ios-setup/HealthKitBridge.swift ios/App/App/
cp ios-setup/HealthKitBridge.m     ios/App/App/
```

---

## Step 7 — Update Info.plist (5 min)

Open `ios/App/App/Info.plist` and add the keys from:
`ios-setup/Info.plist.additions`

(Just paste the contents inside the root `<dict>`)

---

## Step 8 — Apply entitlements (3 min)

1. Open Xcode: `npx cap open ios`
2. Select the **App** target → **Signing & Capabilities**
3. Add capability: **HealthKit**
4. Add capability: **Push Notifications**
5. Add capability: **Background Modes** → check Remote notifications + Background fetch + Background processing
6. Set Team to your Apple Developer account
7. Bundle ID: `com.batman.personalos`

---

## Step 9 — Sync + build (5 min)

```bash
npx cap sync ios
```

Then in Xcode: **Product → Build** (⌘B)

---

## Step 10 — TestFlight distribution (10 min)

1. In Xcode: **Product → Archive**
2. Organizer → **Distribute App → TestFlight Internal**
3. Sign in with your Apple Developer account
4. Upload — Apple processes it (~5-10 min)
5. In App Store Connect → TestFlight → add your Apple ID as internal tester
6. Install TestFlight on your iPhone → accept invite → install Personal OS

---

## What you get after this

| Feature | How it works |
|---|---|
| Push notifications | APNs via Supabase edge function |
| Garmin workouts | Garmin → Apple Health → HealthKit bridge → Personal OS DB |
| Weight sync | Garmin scale → Apple Health → auto-synced on app open |
| Heart rate / HRV | Garmin → Apple Health → visible in Progress page |
| Sleep data | Garmin → Apple Health → available for Jarvis context |
| Background sync | App refreshes HealthKit data in background every 30min |

---

## Notification types already configured

1. **Daily score ready** — "Score at 78. Protein is the gap."
2. **Habit streak at risk** — "Cold shower streak at 12 days — don't break it."
3. **Jarvis nudge** — "You haven't logged lunch. What did you eat?"
4. **Workout reminder** — "Training day. Session 3 of 4 this week."
5. **HealthKit sync** — "Garmin workout synced — 45min strength added."
6. **Weight milestone** — "Down 2kg since you started."

---

## Files already built

```
ios-setup/
  SETUP.md                          ← this file
  HealthKitBridge.swift             ← native HealthKit plugin
  HealthKitBridge.m                 ← Capacitor bridge registration
  Info.plist.additions              ← privacy strings + background modes
  entitlements/PersonalOS.entitlements
  supabase/
    migrations/device_tokens.sql   ← APNs token storage
    functions/push-notify/index.ts ← edge function for sending pushes

lib/
  healthkit.ts                      ← JS interface to native bridge
  notifications.ts                  ← push notification setup

capacitor.config.ts                 ← Capacitor configuration
```

---

## When you're ready

Just ping Bruce (me) when:
1. Xcode is installed (`xcodebuild -version` returns something)
2. Developer account is active (developer.apple.com shows Active)

I'll run Steps 5–10 with you in real time. Estimated time to TestFlight: **~45 minutes.**
