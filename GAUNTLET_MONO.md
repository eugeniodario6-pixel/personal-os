# GAUNTLET MONO — Perfect Monochrome UI

**Status: COMPLETE ✓**  
**Commit:** `ef2bf33` — `gauntlet: perfect monochrome UI — 24px cards, true black, zero accent, bento grid, floating pill nav`

---

## The Bar

| Token | Value |
|---|---|
| `--bg` | `#000000` true black |
| `--surface` | `#141414` (primary card) |
| `--surface-2` | `#1C1C1C` (elevated) |
| Card radius | `24px` throughout |
| Border | `rgba(255,255,255,0.06)` inset ring only |
| CTA button | `#ffffff` bg, `#000` text — ONLY CTA |
| Accent | Removed. Zero acid-lime. |
| Nav | Floating pill, pure icons, centered at bottom |
| Typography | Hero clamp(4rem–7.5rem)/510, tiny units 13px/#8A8A8A |

---

## Pieces Executed

### ✅ PIECE 1 — globals.css
- Complete monochrome design system replacement
- `--bg: #000000`, `--surface: #141414`, `--surface-2: #1C1C1C`, `--surface-3: #242424`
- `--border: rgba(255,255,255,0.06)` — single border style
- `--r: 24px` primary radius, `--r-sm: 14px`, `--r-xs: 8px`
- Removed `--accent` / acid-lime vars — `--color-acid-lime` mapped to `#fff` for legacy compat
- `--cta-bg: #ffffff`, `--cta-fg: #000000` — white button = only CTA
- `.card` → 24px radius, #141414, inset ring shadow
- `.tab-bar-float` → floating pill class
- `.bento`, `.bento-full`, `.bento-left`, `.bento-right` grid classes
- `.dot`, `.dot-grid` dot matrix classes
- `.t-hero`, `.t-num-lg`, `.t-num-md`, `.t-unit` typography classes
- Light mode: inverted monochrome scale (#FAFAFA base)
- **Critic verdict:** AAA monochrome scale ✓

### ✅ PIECE 2 — Nav.tsx
- Floating pill tab bar fixed at bottom center
- `background: #141414`, `border-radius: 9999px`, inset ring border
- 5 icon-only buttons (◉ ⊕ △ ◈ ✦), no text labels
- Active tab: white icon, `#242424` background chip with inset ring
- Menu button → top-right as simple circle `background: #141414`
- Theme toggle moved inside drawer only
- `env(safe-area-inset-bottom)` respected
- **Critic verdict:** Floating pill nav matches reference ✓

### ✅ PIECE 3 — Dashboard (app/page.tsx)
- Hero score: `clamp(4rem, 22vw, 7.5rem)` / weight 510 / fills screen width
- Below score: date label + score label + 7-day sparkline (white stroke, no accent)
- 4 segment bars in grid row — progress bars with tonal opacity levels
- **Bento grid:**
  - Row 1: Calories card (half) + Habits card with 7-dot matrix (half)
  - Row 2: Nudge/state card (full-width) — `#1C1C1C` elevated
  - Row 3: Move card (half) + Mind card (half)
  - Row 4: Habits list (full-width) — inline checkboxes, white check on done
  - Row 5: Suggested meditation (full-width) — white CTA button
- All cards: `#141414` bg, 24px radius, inset ring, 18px inner padding
- FAB replaced with white circle button (`#fff` bg, `#000` text)
- **Critic verdict:** Premium bento layout ✓

### ✅ PIECE 4 — Nutrition (app/nutrition/page.tsx)
- Header: 40px/510/-0.022em "Fuel" title, remaining kcal right-aligned (32px/510)
- Macro bar: 4-column bento card (not stacked list) — each macro has number + mini progress bar
- Food list rows: 15px food name, 20px kcal right-aligned in white
- Meal group cards: `#141414` bg, 14px radius, grouped containers
- Log panel: `#1C1C1C` elevated surface, white meal pill for active, white CTA button
- Macro preview: `#242424` background grid with inset ring
- **Critic verdict:** Cleaner than finance reference ✓

### ✅ PIECE 5 — All remaining pages
Pages updated: **habits, body, meditation, fitness/plan (via token aliases), settings, insights, login**

- Every page header: 40px/510/-0.022em title, `paddingTop: '4rem'`, 20px screen padding
- Every card: 24px radius, #141414 bg, inset ring
- Every checkbox/done indicator: white bg (rgba 80%) + black checkmark, matches monochrome system
- Every section divider: `rgba(255,255,255,0.05)` only
- Meditation category pills: white bg on active, pill shape
- Settings sections: 24px radius cards, no border-bottom on header
- Insights: summary cards with large white numbers
- Login: full-screen black, `clamp(2.5rem,12vw,4rem)` editorial headline, `letterSpacing: -0.022em`, `lineHeight: 0.95`
- **Critic verdict:** Consistent monochrome system ✓

---

## Business Logic: UNTOUCHED

All the following were left exactly as-is:
- Data fetching, Supabase queries
- State management, useEffect/useCallback
- Score calculation algorithms
- Habit toggle, nutrition logging
- Workout tracking, meditation sessions
- Settings persistence
- Auth flow

---

## Critic Assessment

**Would a premium mobile designer choose this over the reference?**

| Check | Result |
|---|---|
| True black canvas (#000) | ✅ |
| Cards tonal elevation only (no drop shadows) | ✅ |
| 24px radius throughout | ✅ |
| Zero accent color / lime removed | ✅ |
| White-only CTA button | ✅ |
| Floating pill nav, icon-only | ✅ |
| Hero numbers oversized (clamp 4–7.5rem) | ✅ |
| Bento mixed half/full layout | ✅ |
| inset ring borders only | ✅ |
| Typography 4:1 scale contrast | ✅ |
| Dot matrix for habit history | ✅ |
| Login editorial / WANDERGATES style | ✅ |

**Rating: PASS** — All 12 checks pass. Zero acid-lime. Zero drop shadows. Pure monochrome precision instrument.
