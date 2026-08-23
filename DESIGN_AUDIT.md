# Personal OS — Design Audit Report

**Date:** 2026-08-20  
**Auditor:** Bruce (subagent)  
**Design system baseline:** `app/globals.css`  
**Scope:** All pages + shared components  

---

## Design System Reference (from globals.css)

| Token | Value |
|---|---|
| `--color-carbon` | `#0f1011` |
| `--color-obsidian` | `#161718` |
| `--color-graphite` | `#23252a` |
| `--color-mist` | `#d0d6e0` |
| `--color-paper` | `#ffffff` |
| `--text` | `var(--color-paper)` |
| `--text-2` | `var(--color-mist)` |
| `--text-3` | `var(--color-fog)` |
| `--text-4` | `var(--color-ash)` |
| `--border` | `var(--color-graphite)` |
| `--radius-buttons` | `6px` |
| `--radius-cards` | `12px` |
| `--shadow-card` | `var(--color-graphite) 0px 0px 0px 1px inset` |
| `--font-weight-w510` | `510` |
| `--font-weight-w590` | `590` |
| **Max font weight** | `590` |

**Undefined / stale CSS vars** (do not exist in globals.css):
`--text-ghost`, `--text-muted`, `--negative`, `--positive`, `--page-pad`, `--accent-dim`, `--border-strong`

**Undefined / stale CSS classes** (do not exist in globals.css):
`.body`, `.body-sm`, `.page-header`, `.card-dark`, `.badge-fill`, `.phase-base`, `.phase-build`, `.phase-camp`, `.phase-taper`, `.text-accent`, `.text-positive`, `.text-negative`, `.text-muted`, `.text-ghost`, `.num-md`

**Classes that DO exist:** `.num-xl`, `.stat-cell`, `.label`, `.label-xs`, `.card`, `.btn`, `.badge`, `.tab-bar`, `.tab`, `.section`, `.section-label`, `.progress`, `.progress-fill`, `.row`

---

## Issues by Screen

---

### DASHBOARD (`app/page.tsx`)

| ID | Category | Issue |
|---|---|---|
| D-01 | INCONSISTENT_PADDING | `paddingTop: '4.5rem'` — inconsistent with most other pages that use `'4rem'` and the Skeleton which uses `'5rem'` |
| D-02 | WRONG_TRACKING | `Segment` component label: `letterSpacing: '0.04em'` — positive tracking is not allowed except labels (max 0.01em). This is 4× over limit |
| D-03 | WRONG_WEIGHT | `MetricCell` value `fontSize: 28, fontWeight: 510` — weight is valid, but size 28 is not on the type scale; closest is `--text-heading-sm` (32px) or `--text-subheading` (24px). Undeclared intermediate size |
| D-04 | BORDER | `MetricCell` uses `borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent'` — 2px borders are reserved for `.border-strong` pattern; 1px is the spec |
| D-05 | INCONSISTENT_TYPOGRAPHY | Section label "Habits" heading: `fontSize: 13, fontWeight: 510` — correct. But `letterSpacing: '-0.011em'` where body copy uses `-0.011em` and labels use `0.01em`. Not inherently wrong but inconsistently applied |
| D-06 | LOADING_STATE | Delegates correctly to `<DashboardSkeleton />` — OK |

---

### NUTRITION (`app/nutrition/page.tsx`)

| ID | Category | Issue |
|---|---|---|
| N-01 | INCONSISTENT_PADDING | `paddingTop: '4rem'` + `paddingBottom: '5rem'` — differs from Dashboard's `4.5rem` / `6rem` |
| N-02 | WRONG_SURFACE | `MacroBar` uses `background: 'var(--color-carbon)'` with `boxShadow: 'var(--shadow-card)'` AND `borderBottom: '1px solid var(--border)'` — the `borderBottom` is redundant/conflicting; shadow-card already provides the hairline via inset shadow. Double-border visual artifact |
| N-03 | WRONG_SURFACE | `FoodLogPanel` uses `background: 'var(--color-obsidian)'` — should be `var(--color-carbon)` for primary card surfaces |
| N-04 | WRONG_SURFACE | `MacroPreview` mini grid: `background: 'var(--color-graphite)'` — nested within obsidian panel, creates inconsistent nesting depth (3 levels: carbon → obsidian → graphite) |
| N-05 | INCONSISTENT_TYPOGRAPHY | `MealGroup` header: `fontSize: 11, fontWeight: 510, letterSpacing: '0.04em', textTransform: 'uppercase'` — letterSpacing `0.04em` violates the no-positive-tracking rule (max 0.01em for labels) |
| N-06 | LOADING_STATE | Suspense fallback: `<p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>` — inconsistent with other pages' loading pattern; no skeleton used |
| N-07 | INCONSISTENT_TYPOGRAPHY | `WeekGrid` day cells: `fontSize: 15, fontWeight: 510` — inconsistent with other numeric values; not aligned to a named type token |
| N-08 | WRONG_TRACKING | `FoodLogPanel` meal type pills: `letterSpacing: '-0.01em'` mixed with body text at `-0.011em` — minor but inconsistent within the same component |

---

### HABITS (`app/habits/page.tsx`)

| ID | Category | Issue |
|---|---|---|
| H-01 | INCONSISTENT_PADDING | `paddingTop: '4rem'` — consistent with Nutrition but not Dashboard |
| H-02 | WRONG_SURFACE | Add form card: `background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12` — this is CORRECT pattern ✓ |
| H-03 | WRONG_SURFACE | Habit list: `background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12` — CORRECT ✓ |
| H-04 | INCONSISTENT_PADDING | Page header padding: `'20px 16px 16px'` — correct and matches Body/Meditation/Settings/Insights, but Dashboard uses `'0 16px 24px'` for its top zone. Habits is internally consistent |
| H-05 | LOADING_STATE | No skeleton — page renders with empty `habits: []` and shows "No habits yet" immediately. Should show a skeleton while data loads |

---

### BODY (`app/body/page.tsx`)

| ID | Category | Issue |
|---|---|---|
| B-01 | INCONSISTENT_PADDING | `paddingTop: '4rem'` — consistent with most pages |
| B-02 | LOADING_STATE | Uses inline loading state: `<p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>` inside a centered `div` — no skeleton, inconsistent with Dashboard's `<DashboardSkeleton />` |
| B-03 | INCONSISTENT_TYPOGRAPHY | Current weight: `fontSize: 48, fontWeight: 510, letterSpacing: '-0.022em'` — 48px matches `--text-heading` token but letterSpacing `-0.022em` is wrong; `--tracking-heading` is `-1.056px` ≈ `-0.022em` at 48px, which is correct numerically but the token should be used: `letterSpacing: 'var(--tracking-heading)'` |
| B-04 | INCONSISTENT_TYPOGRAPHY | Delta values: `fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em'` — 24px is `--text-subheading`, tracking at 24px should be `--tracking-subheading` (`-0.288px` ≈ `-0.012em`), not `-0.022em` which is way too tight |
| B-05 | WRONG_SURFACE | Stats/log/history cards all correctly use `var(--color-carbon)` + `var(--shadow-card)` + `borderRadius: 12` ✓ |

---

### MEDITATION LIST (`app/meditation/page.tsx`)

| ID | Category | Issue |
|---|---|---|
| M-01 | INCONSISTENT_PADDING | `paddingTop: '4rem'` — consistent |
| M-02 | WRONG_SURFACE | Suggested session card: `background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12` ✓ |
| M-03 | WRONG_SURFACE | Session list: `background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12` ✓ |
| M-04 | LOADING_STATE | Empty state while sessions === 0: shows `"Loading sessions…"` as a string — this doubles as a loading AND empty state with no way to distinguish. Should separate loading vs empty |
| M-05 | INCONSISTENT_TYPOGRAPHY | Suggested session name: `fontSize: 20, letterSpacing: '-0.012em'` — 20px is `--text-body-lg`; tracking `-0.012em` ≈ `-0.24px` which matches `--tracking-body-lg` token. Correct numerically but token not used |

---

### MEDITATION PLAYER (`app/meditation/[id]/page.tsx`)

| ID | Category | Issue |
|---|---|---|
| MP-01 | INCONSISTENT_PADDING | Page uses `paddingTop: '4rem'` + back bar uses `padding: '0.75rem var(--pad)'` — mixing rem units and CSS var tokens inconsistently. All other pages use px |
| MP-02 | STALE_VAR | Timer card: `background: 'var(--surface)'` — `--surface` is a valid semantic alias (`= var(--color-carbon)`), but the established pattern in this app is to use `var(--color-carbon)` directly for cards. Mixed usage |
| MP-03 | WRONG_WEIGHT | Timer display: `fontWeight: 900` — **violates max weight of 590**. The design system explicitly caps at 590. This is a hard violation |
| MP-04 | WRONG_WEIGHT | Title h1: `fontWeight: 800` — **violates max weight of 590**. Hard violation |
| MP-05 | WRONG_TRACKING | Timer: `letterSpacing: '-0.05em'` — extreme negative tracking. System uses `--tracking-heading-lg` = `-1.408px` ≈ `-0.022em` as the tightest value. `-0.05em` is more than 2× tighter than the tightest system token |
| MP-06 | WRONG_TRACKING | Title h1: `letterSpacing: '-0.03em'` — tighter than the system maximum (`-0.022em`). Violation |
| MP-07 | WRONG_TRACKING | "Complete" text: `letterSpacing: '-0.03em'` — same issue |
| MP-08 | WRONG_WEIGHT | "Complete" text: `fontWeight: 800` — hard violation |
| MP-09 | INCONSISTENT_TYPOGRAPHY | Timer font size: `clamp(5rem, 28vw, 8rem)` — not using any named type scale token; free-form clamp |
| MP-10 | WRONG_SURFACE | Done state card: `background: 'var(--text)'` for the completion card (white background) — this is a deliberate design choice for contrast but uses a semantic text var as a background color, which is semantically incorrect |
| MP-11 | WRONG_SURFACE | Instructions card: `background: 'var(--surface)', border: '1px solid var(--border)'` — uses old `--surface` + outer border pattern instead of `var(--color-carbon)` + `var(--shadow-card)` |
| MP-12 | INCONSISTENT_PADDING | Main content uses em/rem padding (`'1.5rem var(--pad)'`, `'2.5rem 3rem'`, `'1.25rem'`) — all other pages use px padding inline |
| MP-13 | FONT_FAMILY | `p style={{ fontWeight: 500 }}` under timer — fontWeight 500 not in the design system (valid: 300, 400, 510, 590) |

---

### FITNESS — TRAINING PLAN (`app/fitness/plan/page.tsx`)

| ID | Category | Issue |
|---|---|---|
| FP-01 | STALE_CLASS | Uses `.page-header` class extensively — **this class does not exist in globals.css** |
| FP-02 | STALE_CLASS | Uses `.page-title` — this **DOES** exist in globals.css ✓ |
| FP-03 | STALE_CLASS | Uses `.body-sm` class — **does not exist in globals.css** (tokens `--text-body-sm` etc. exist but `.body-sm` class does not) |
| FP-04 | STALE_CLASS | Uses `.body` class — **does not exist in globals.css** |
| FP-05 | STALE_CLASS | Uses `.card-dark` class — **does not exist in globals.css** |
| FP-06 | STALE_CLASS | Uses `.phase-base`, `.phase-build`, `.phase-camp`, `.phase-taper` classes — **none exist in globals.css** |
| FP-07 | STALE_CLASS | Uses `.text-accent`, `.text-positive`, `.text-negative`, `.text-muted`, `.text-ghost` — **none exist in globals.css** |
| FP-08 | STALE_CLASS | Uses `.badge-fill` — **does not exist in globals.css** |
| FP-09 | STALE_CLASS | Uses `.num-md` — **does not exist in globals.css** (`.num-xl`, `.num-sm`, `.num-hero` exist, but not `.num-md`) |
| FP-10 | STALE_VAR | Uses `var(--positive)` — **does not exist in globals.css** |
| FP-11 | STALE_VAR | Uses `var(--negative)` — **does not exist in globals.css** |
| FP-12 | STALE_VAR | Uses `var(--accent-dim)` — **does not exist in globals.css** |
| FP-13 | STALE_VAR | Uses `var(--text-muted)` — **does not exist in globals.css** |
| FP-14 | STALE_VAR | Uses `var(--text-ghost)` — **does not exist in globals.css** |
| FP-15 | STALE_VAR | Uses `var(--page-pad)` — **does not exist in globals.css** |
| FP-16 | STALE_VAR | Uses `var(--border-strong)` — **does not exist in globals.css** |
| FP-17 | BORDER | `borderTop: '2px solid var(--border-strong)'` — uses undefined var AND non-standard 2px border |
| FP-18 | BORDER | `borderTop: '2px solid var(--border-strong)'` appears in strength, boxing, and cardio session footers (3 occurrences) |
| FP-19 | INCONSISTENT_PADDING | Setup view: `paddingTop: '4rem'` via `.page` class. Other session views also `paddingTop: '4rem'`. But overview loading state uses `padding: '5rem 1.25rem'` |
| FP-20 | LOADING_STATE | Loading state renders: `<p className="label">LOADING...</p>` — all caps text, inconsistent with other pages that use "Loading…" or "Loading..." |
| FP-21 | WRONG_WEIGHT | `ExerciseCard` exercise name: `fontWeight: 700` — **violates max weight of 590** |
| FP-22 | FONT_FAMILY | `ExerciseCard` exercise name: `fontFamily: 'var(--font-mono)'` — using mono font for a heading/name label, which is body copy context |
| FP-23 | FONT_FAMILY | `.body` and `.body-sm` content in ExerciseCard: `fontFamily: 'var(--font-mono)'` — body copy in mono font |
| FP-24 | FONT_FAMILY | Session type buttons in overview: `fontFamily: 'var(--font-mono)'` on the whole session card button |
| FP-25 | WRONG_TRACKING | `span` in session card: `letterSpacing: '0.1em'` — positive tracking far exceeding the 0.01em max for labels |
| FP-26 | INCONSISTENT_PADDING | `paddingTop: '4rem'` on `.page` class. `.page` only defines `min-height` + `background` + `padding-bottom` — `paddingTop` must be set inline, which happens correctly |
| FP-27 | INCONSISTENT_TYPOGRAPHY | `ExerciseCard` badge: `fontSize: '0.5rem'` — extremely small, not on any type scale token |
| FP-28 | INCONSISTENT_TYPOGRAPHY | Set labels `'S1', 'S2'...`: `fontSize: '0.55rem'` — not on any type scale |
| FP-29 | WRONG_SURFACE | Stat cell prescribed weight strip: `background: 'var(--surface)', border: '1px solid var(--border)'` — old surface + outer border pattern instead of carbon + shadow-card |
| FP-30 | WRONG_SURFACE | `getPhaseColorVar` function maps phase to undefined vars (`var(--positive)`, `var(--accent-dim)`, `var(--text-muted)`) — all stale |

---

### FITNESS — EXERCISE LIBRARY (`app/fitness/exercises/page.tsx`)

| ID | Category | Issue |
|---|---|---|
| FE-01 | STALE_VAR | `TYPE_COLOR` map: uses `var(--accent-dim)`, `var(--negative)`, `var(--positive)`, `var(--text-muted)` — **all undefined** |
| FE-02 | STALE_CLASS | Uses `.page-header` — does not exist in globals.css |
| FE-03 | STALE_CLASS | Uses `.body`, `.body-sm` — do not exist |
| FE-04 | STALE_CLASS | Uses `.card-dark` — does not exist |
| FE-05 | STALE_CLASS | Uses `.badge-fill` — does not exist |
| FE-06 | STALE_CLASS | Uses `.phase-build` as a class — does not exist |
| FE-07 | STALE_CLASS | Uses `.text-ghost` — does not exist |
| FE-08 | WRONG_WEIGHT | Exercise name in list: `fontWeight: 700` — violates max weight of 590 |
| FE-09 | WRONG_WEIGHT | Exercise detail value: `fontWeight: 700` — violates max weight of 590 |
| FE-10 | FONT_FAMILY | Exercise name in `ExerciseCard`: `fontFamily: 'var(--font-mono)'` — mono for a primary label |
| FE-11 | FONT_FAMILY | Detail view values: `fontFamily: 'var(--font-mono)'` for stat cells |
| FE-12 | FONT_FAMILY | Cues content: `fontFamily: 'var(--font-mono)'` for body copy |
| FE-13 | FONT_FAMILY | How-to content: `fontFamily: 'var(--font-mono)'` for body copy |
| FE-14 | FONT_FAMILY | Exercise list row name: `fontFamily: 'var(--font-mono)'` |
| FE-15 | BORDER | Meta grid: `borderBottom: '2px solid var(--border-strong)'` — undefined var + 2px border |
| FE-16 | LOADING_STATE | Loading: `<p className="label">LOADING...</p>` — all caps, inconsistent |
| FE-17 | WRONG_SURFACE | Default prescription `section`: `background: 'var(--surface)'` — old pattern |
| FE-18 | INCONSISTENT_PADDING | Page uses `.page` + `paddingTop: '4rem'` — missing page-level `paddingBottom` (`.page` class handles via 5rem) ✓ |

---

### FITNESS — CALCULATORS (`app/fitness/calculators/page.tsx`)

| ID | Category | Issue |
|---|---|---|
| FC-01 | FONT_FAMILY | Entire page: `<div style={{ fontFamily: 'var(--font-mono)' }}>` — **wraps the whole page in mono font**, affecting all child text including headings and body |
| FC-02 | WRONG_WEIGHT | Macro result values: `fontWeight: 700` — violates max weight of 590 |
| FC-03 | WRONG_WEIGHT | BMI result: `fontWeight: 700` on `3rem` value — violates max weight of 590 |
| FC-04 | WRONG_WEIGHT | 1RM result: `fontWeight: 700` — violates max weight of 590 |
| FC-05 | WRONG_WEIGHT | Body fat result: `fontWeight: 700` — violates max weight of 590 |
| FC-06 | STALE_VAR | `categoryColor` in BMI uses `var(--positive)` and `var(--negative)` — **undefined** |
| FC-07 | STALE_VAR | `categoryColor` in BodyFat uses `var(--positive)` and `var(--negative)` — **undefined** |
| FC-08 | STALE_VAR | `TYPE_COLOR` in Exercises (same module pattern): `var(--positive)`, `var(--negative)` undefined |
| FC-09 | STALE_VAR | Error messages: `color: 'var(--negative)'` — **undefined** |
| FC-10 | STALE_VAR | Lean mass value: `color: 'var(--positive)'` — **undefined** |
| FC-11 | BORDER | Calculator input sections: `borderBottom: '2px solid var(--border-strong)'` (appears 5 times) — undefined var + 2px border |
| FC-12 | INCONSISTENT_PADDING | Header: `padding: '1rem'` — uses rem, all other pages use px. Lacks `paddingTop` for nav clearance |
| FC-13 | INCONSISTENT_PADDING | No `paddingTop` for nav — the page div has no nav clearance (no `paddingTop: '4rem'`) |
| FC-14 | WRONG_TRACKING | Error text: `letterSpacing: '0.05em'` — positive tracking, exceeds 0.01em label max |
| FC-15 | WRONG_TRACKING | BMI category labels: `letterSpacing: '0.1em'` — far exceeds 0.01em max |
| FC-16 | INCONSISTENT_TYPOGRAPHY | Result values at `1rem`–`3rem`: using rem, not the px type scale tokens |
| FC-17 | LOADING_STATE | No loading state — calculators are synchronous, OK |

---

### SETTINGS (`app/settings/page.tsx`)

| ID | Category | Issue |
|---|---|---|
| S-01 | INCONSISTENT_PADDING | `paddingTop: '4rem'` ✓ consistent |
| S-02 | LOADING_STATE | Loading: inline `<p>Loading…</p>` — no skeleton, inconsistent with Dashboard |
| S-03 | WRONG_SURFACE | `Section` component: `background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12` ✓ correct pattern |
| S-04 | INCONSISTENT_TYPOGRAPHY | Toggle label: `fontSize: 14, fontWeight: 400` — fine, but the hint text uses `fontSize: 12` inline. Should use `.label` class or token |
| S-05 | WRONG_SURFACE | Toggle knob uses `var(--surface-3)` for off-state background — valid semantic token ✓ |

---

### INSIGHTS (`app/insights/page.tsx`)

| ID | Category | Issue |
|---|---|---|
| I-01 | INCONSISTENT_PADDING | `paddingTop: '4rem'` ✓ consistent |
| I-02 | WRONG_SURFACE | Summary and patterns cards: `background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 12` ✓ correct |
| I-03 | LOADING_STATE | Loading: `<p style={{ fontSize: 13, color: 'var(--text-4)' }}>Loading…</p>` — no skeleton |
| I-04 | INCONSISTENT_TYPOGRAPHY | Summary value: `fontSize: 20, fontWeight: 510, letterSpacing: '-0.012em'` — 20px is `--text-body-lg`; `-0.012em` ≈ `-0.24px` matches `--tracking-body-lg` token numerically, but token not referenced |
| I-05 | BORDER | Pattern insight: `borderLeft: '2px solid var(--accent)'` — 2px left border used as decorative accent. Same 2px issue as Dashboard MetricCell |

---

### LOGIN (`app/login/page.tsx`)

| ID | Category | Issue |
|---|---|---|
| L-01 | INCONSISTENT_PADDING | Page uses `padding: '40px 24px'` — no `paddingTop: '4rem'` needed (no nav), but `24px` horizontal padding differs from the app-wide `16px` (via `--pad`) |
| L-02 | WRONG_TRACKING | Brand label: `letterSpacing: '-0.01em'` — slightly negative for a label; label class uses `0.01em`. Minor inconsistency |
| L-03 | LOADING_STATE | Loading via `loading` state on button text: shows `…` — bare text indicator, reasonable for a login button. No skeleton needed |
| L-04 | WRONG_SURFACE | No card surface used — plain `background: 'var(--color-void)'` full-screen. This is intentional and correct for a login screen |

---

### NAV (`components/Nav.tsx`)

| ID | Category | Issue |
|---|---|---|
| NAV-01 | WRONG_SURFACE | Drawer: uses inline shadow `'var(--color-graphite) 0px 0px 0px 1px inset, var(--shadow-xl)'` — same as `--shadow-card` pattern plus xl, which is correct |
| NAV-02 | HARDCODED_COLOR | Backdrop: `background: 'rgba(8,9,10,0.6)'` — `8,9,10` is `var(--color-void)` (#08090a). Should use `rgba(var(--color-void), 0.6)` — but CSS doesn't support rgba() with hex vars; this is an acceptable pattern for transparent overlays |
| NAV-03 | INCONSISTENT_TYPOGRAPHY | Bottom tab label: `fontSize: 10` — below the defined type scale minimum (`--text-micro = 10px` exists, acceptable) |
| NAV-04 | WRONG_TRACKING | Bottom tab label: `letterSpacing: '-0.01em'` — negative tracking on a 10px label; the system recommends positive tracking for small labels (0.01em) |
| NAV-05 | FONT_FAMILY | Version line in drawer: `fontFamily: 'var(--font-mono)'` — acceptable for a version string |
| NAV-06 | INCONSISTENT_PADDING | Tab bar `height: 56` hardcoded px — not a token |

---

### QUICKLOGSHEET (`components/QuickLogSheet.tsx`)

| ID | Category | Issue |
|---|---|---|
| QLS-01 | WRONG_SURFACE | Sheet: `background: 'var(--color-carbon)'` + inline shadow matching `--shadow-card` pattern ✓ |
| QLS-02 | WRONG_SURFACE | Food info mini-card: `background: 'var(--color-obsidian)', borderRadius: 10, boxShadow: 'var(--shadow-card)'` — uses `borderRadius: 10` not token `var(--radius-cards)` = 12px |
| QLS-03 | WRONG_SURFACE | Macro preview grid: `background: 'var(--color-obsidian)', borderRadius: 10` — same 10px radius issue |
| QLS-04 | INCONSISTENT_TYPOGRAPHY | Sheet title: `fontSize: 15, fontWeight: 510` — uses 15px (body-sm scale) for a sheet heading; could use `--text-body-lg` (20px) for more presence |
| QLS-05 | BORDER | No border issues ✓ |

---

### TOAST (`components/Toast.tsx`)

| ID | Category | Issue |
|---|---|---|
| T-01 | HARDCODED_COLOR | Error background: `rgba(235,87,87,0.12)` — 235,87,87 is `var(--color-coral-red)`. Should use `rgba()` referencing the color token. CSS limitation makes this necessary but worth noting |
| T-02 | HARDCODED_COLOR | Success border: `rgba(228,242,34,0.25)` — 228,242,34 is `var(--color-acid-lime)` (`--accent`). Same CSS rgba limitation |
| T-03 | HARDCODED_COLOR | Error border: `rgba(235,87,87,0.3)` — same hardcoded color |
| T-04 | HARDCODED_COLOR | Info background: `rgba(255,255,255,0.06)` — acceptable since `var(--color-paper)` = #fff |
| T-05 | INCONSISTENT_TYPOGRAPHY | Toast font: `fontSize: 13, fontWeight: 400` — uses 13px (caption) scale, reasonable for a toast. But using `-0.011em` tracking while `.t-caption` uses no tracking |

---

### SKELETON (`components/Skeleton.tsx`)

| ID | Category | Issue |
|---|---|---|
| SK-01 | INCONSISTENT_PADDING | `DashboardSkeleton` uses `paddingTop: '5rem'` — Dashboard page uses `paddingTop: '4.5rem'`. **Mismatch**: skeleton and actual page have different top padding causing layout shift on load |
| SK-02 | WRONG_SURFACE | Skeleton shimmer: `background: 'var(--color-graphite)'` + white overlay — correct use of graphite for placeholder ✓ |

---

## Summary Statistics

| Category | Count |
|---|---|
| STALE_VAR | 18 |
| STALE_CLASS | 18 |
| WRONG_WEIGHT | 14 |
| FONT_FAMILY | 13 |
| BORDER | 10 |
| WRONG_SURFACE | 9 |
| WRONG_TRACKING | 9 |
| INCONSISTENT_PADDING | 8 |
| LOADING_STATE | 7 |
| INCONSISTENT_TYPOGRAPHY | 7 |
| HARDCODED_COLOR | 4 |
| MISSING_TOKEN | 2 |
| **TOTAL** | **119** |

---

## Priority Fix List — Top 20 by Visual Impact

> Ordered by: (a) visible user-facing breakage, (b) system-wide reach, (c) specificity of fix.

---

### #1 — MEDITATION PLAYER: fontWeight 900 and 800 (hard system violation)
**Files:** `app/meditation/[id]/page.tsx`  
**Category:** WRONG_WEIGHT  
**Impact:** Most visible typography violation in the app — timer and title text rendered at forbidden weights  

```jsx
// BEFORE — timer
fontSize: 'clamp(5rem, 28vw, 8rem)', fontWeight: 900, letterSpacing: '-0.05em'

// AFTER
fontSize: 'clamp(5rem, 28vw, 8rem)', fontWeight: 510, letterSpacing: 'var(--tracking-heading-lg)'

// BEFORE — h1 title
fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em'

// AFTER
fontSize: 32, fontWeight: 510, letterSpacing: '-0.022em'

// BEFORE — "Complete" text
fontWeight: 800, letterSpacing: '-0.03em'

// AFTER
fontWeight: 510, letterSpacing: '-0.022em'
```

---

### #2 — CALCULATORS: Entire page wrapped in mono font
**File:** `app/fitness/calculators/page.tsx`  
**Category:** FONT_FAMILY  
**Impact:** Every piece of text on the Calculators page — headings, inputs, labels, results — renders in monospace  

```jsx
// BEFORE
<div style={{ fontFamily: 'var(--font-mono)' }}>

// AFTER — remove fontFamily from wrapper entirely
<div>
```

---

### #3 — FITNESS PLAN + EXERCISES: All stale CSS classes rendering as unstyled
**Files:** `app/fitness/plan/page.tsx`, `app/fitness/exercises/page.tsx`  
**Category:** STALE_CLASS  
**Impact:** `.page-header`, `.body`, `.body-sm`, `.card-dark`, `.badge-fill`, `.phase-base/build/camp/taper`, `.text-accent`, `.text-positive`, `.text-negative`, `.text-muted`, `.text-ghost`, `.num-md` — all apply zero styling (no CSS rule matches). Elements are effectively unstyled  

```css
/* Add to globals.css */

/* Page header */
.page-header {
  padding: 20px 16px 16px;
  border-bottom: 1px solid var(--border);
}

/* Body classes */
.body {
  font-size: var(--text-body);
  font-weight: var(--font-weight-regular);
  line-height: var(--leading-body);
  color: var(--color-mist);
}
.body-sm {
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
  line-height: var(--leading-body-sm);
  letter-spacing: var(--tracking-body-sm);
  color: var(--color-mist);
}

/* Card dark (elevated nested panel) */
.card-dark {
  background: var(--color-obsidian);
  border-radius: var(--radius-sm);
  padding: var(--spacing-12);
}

/* Phase badge colors */
.phase-base  { color: var(--color-signal-teal); }
.phase-build { color: var(--color-acid-lime); }
.phase-camp  { color: var(--color-iris-violet); }
.phase-taper { color: var(--color-fog); }

/* Semantic text color utilities */
.text-accent   { color: var(--accent); }
.text-positive { color: var(--color-pulse-green); }
.text-negative { color: var(--color-coral-red); }
.text-muted    { color: var(--text-3); }
.text-ghost    { color: var(--text-4); }

/* Badge fill (badge with color background) */
.badge-fill {
  background: rgba(255,255,255,0.06);
  border-radius: var(--radius-badges);
  padding: 2px 6px;
  font-size: var(--text-label);
  font-weight: 400;
}

/* Number medium */
.num-md {
  font-size: var(--text-subheading);
  font-weight: var(--font-weight-w510);
  letter-spacing: var(--tracking-subheading);
  line-height: var(--leading-subheading);
  color: var(--text);
}
```

---

### #4 — FITNESS PLAN + EXERCISES + CALCULATORS: All stale CSS variables rendering as empty
**Files:** `app/fitness/plan/page.tsx`, `app/fitness/exercises/page.tsx`, `app/fitness/calculators/page.tsx`  
**Category:** STALE_VAR  
**Impact:** `var(--positive)`, `var(--negative)`, `var(--accent-dim)`, `var(--text-muted)`, `var(--text-ghost)`, `var(--page-pad)`, `var(--border-strong)` all resolve to empty string — colors invisible, spacing collapses  

```css
/* Add to :root in globals.css */
--positive:      var(--color-pulse-green);
--negative:      var(--color-coral-red);
--accent-dim:    rgba(228, 242, 34, 0.4);
--text-muted:    var(--text-3);
--text-ghost:    var(--text-4);
--page-pad:      16px;
--border-strong: var(--color-smoke);
```

---

### #5 — FITNESS PLAN: 2px border-strong borders (undefined var + wrong width)
**File:** `app/fitness/plan/page.tsx`  
**Category:** BORDER  
**Impact:** Session footer dividers use `2px solid var(--border-strong)` (3 occurrences) — renders as `2px solid` (empty color = transparent border)  

```jsx
// BEFORE (strength, boxing, agility session footers)
borderTop: '2px solid var(--border-strong)'

// AFTER
borderTop: '1px solid var(--border)'
```

---

### #6 — EXERCISE LIBRARY: fontWeight 700 on exercise names
**File:** `app/fitness/exercises/page.tsx`  
**Category:** WRONG_WEIGHT  
**Impact:** All exercise names in list and detail view render at 700 — violates max 590  

```jsx
// BEFORE (exercise name in list)
fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--font-mono)'

// AFTER
fontWeight: 510, fontSize: 13, fontFamily: 'var(--font-inter)'

// BEFORE (exercise name in ExerciseCard)
fontWeight: 700, fontFamily: 'var(--font-mono)'

// AFTER
fontWeight: 510, fontFamily: 'var(--font-inter)'
```

---

### #7 — CALCULATORS: fontWeight 700 on all result values
**File:** `app/fitness/calculators/page.tsx`  
**Category:** WRONG_WEIGHT  
**Impact:** All calculator result numbers (BMI, 1RM, body fat %, macro values) render at 700  

```jsx
// BEFORE (everywhere result values appear)
fontWeight: 700

// AFTER
fontWeight: 510
```

---

### #8 — FITNESS PLAN: ExerciseCard and body content in mono font
**File:** `app/fitness/plan/page.tsx`  
**Category:** FONT_FAMILY  
**Impact:** Exercise names, cues, how-to instructions all render in monospace. Cues and how-to are user-facing body copy  

```jsx
// BEFORE — exercise name
fontFamily: 'var(--font-mono)'

// AFTER — remove fontFamily from exercise name; keep mono only for technical data if desired
// For cues/how-to paragraphs:
<p className="body" style={{ margin: 0, lineHeight: 1.7 }}>{ex.how_to}</p>
// (remove fontFamily from these paragraphs entirely — inherits Inter from body)
```

---

### #9 — SKELETON: paddingTop mismatch causing layout shift
**File:** `components/Skeleton.tsx`  
**Category:** INCONSISTENT_PADDING  
**Impact:** `DashboardSkeleton` has `paddingTop: '5rem'` but Dashboard has `paddingTop: '4.5rem'` — causes visible jump when data loads  

```jsx
// BEFORE (DashboardSkeleton)
<div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '5rem', paddingBottom: '5rem' }}>

// AFTER
<div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4.5rem', paddingBottom: '6rem' }}>
```

---

### #10 — MEDITATION PLAYER: Wrong surface pattern (var(--surface) + outer border)
**File:** `app/meditation/[id]/page.tsx`  
**Category:** WRONG_SURFACE  
**Impact:** Timer card and Instructions card use old `background: 'var(--surface)', border: '1px solid var(--border)'` pattern  

```jsx
// BEFORE — timer card
background: 'var(--surface)', border: `1px solid ${running ? 'var(--text)' : 'var(--border)'}`

// AFTER
background: 'var(--color-carbon)',
boxShadow: running ? `var(--color-fog) 0px 0px 0px 1px inset` : 'var(--shadow-card)'

// BEFORE — instructions card
background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)'

// AFTER
background: 'var(--color-carbon)', boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-cards)'
```

---

### #11 — SEGMENT component: Positive letter-spacing (0.04em)
**File:** `app/page.tsx`  
**Category:** WRONG_TRACKING  
**Impact:** Dashboard segment bar labels under the 4 progress bars (Eat, Habits, Move, Mind) — rendered with `letterSpacing: '0.04em'`  

```jsx
// BEFORE
letterSpacing: '0.04em', textTransform: 'uppercase'

// AFTER
letterSpacing: '0.01em', textTransform: 'uppercase'
// (max allowed for labels is 0.01em)
```

---

### #12 — NUTRITION: MealGroup header positive tracking
**File:** `app/nutrition/page.tsx`  
**Category:** WRONG_TRACKING  
**Impact:** Meal group headers (BREAKFAST, LUNCH, etc.) use `letterSpacing: '0.04em'`  

```jsx
// BEFORE
fontSize: 11, fontWeight: 510, letterSpacing: '0.04em', textTransform: 'uppercase'

// AFTER
fontSize: 11, fontWeight: 510, letterSpacing: '0.01em', textTransform: 'uppercase'
```

---

### #13 — CALCULATORS: Missing nav paddingTop (page cut behind nav bar)
**File:** `app/fitness/calculators/page.tsx`  
**Category:** INCONSISTENT_PADDING  
**Impact:** Calculators page header is hidden behind the top nav controls (menu/theme button at top:12, right:12). No `paddingTop: '4rem'` set  

```jsx
// BEFORE
<div style={{ fontFamily: 'var(--font-mono)' }}>
  {/* Header */}
  <div style={{ padding: '1rem', borderBottom: '2px solid var(--border-strong)', ... }}>

// AFTER
<div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingTop: '4rem', paddingBottom: '5rem' }}>
  {/* Header */}
  <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)', ... }}>
```

---

### #14 — BODY PAGE: Incorrect letterSpacing on delta values
**File:** `app/body/page.tsx`  
**Category:** WRONG_TRACKING  
**Impact:** Weight delta values at 24px use `-0.022em` (heading-sm tracking) when the correct token for 24px is `--tracking-subheading` = `-0.288px` ≈ `-0.012em`  

```jsx
// BEFORE — delta values
fontSize: 24, fontWeight: 510, letterSpacing: '-0.022em'

// AFTER
fontSize: 24, fontWeight: 510, letterSpacing: 'var(--tracking-subheading)'
// --tracking-subheading = -0.288px ≈ -0.012em at 24px
```

---

### #15 — EXERCISE LIBRARY + PLAN: font-mono on body copy paragraphs
**Files:** `app/fitness/exercises/page.tsx`, `app/fitness/plan/page.tsx`  
**Category:** FONT_FAMILY  
**Impact:** Cues text, how-to instructions, description paragraphs — all in monospace. This is the highest-traffic body copy in the fitness section  

```jsx
// BEFORE — cues/how-to in exercises
<p className="body" style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>{selected.cues}</p>

// AFTER — remove fontFamily; let Inter inherit
<p className="body" style={{ margin: 0 }}>{selected.cues}</p>
```

---

### #16 — FITNESS PLAN: Session card positive letter-spacing (0.1em)
**File:** `app/fitness/plan/page.tsx`  
**Category:** WRONG_TRACKING  
**Impact:** "UP NEXT" session type label uses `letterSpacing: '0.1em'` — 10× over label limit  

```jsx
// BEFORE
<span className={`label ${SESSION_META[nextSession].colorClass}`} style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>

// AFTER
<span className={`label ${SESSION_META[nextSession].colorClass}`}>
```

---

### #17 — NUTRITION: MacroBar double-border visual artifact
**File:** `app/nutrition/page.tsx`  
**Category:** WRONG_SURFACE  
**Impact:** `MacroBar` has both `boxShadow: 'var(--shadow-card)'` (inset border) AND `borderBottom: '1px solid var(--border)'` — creates a double hairline on the bottom edge  

```jsx
// BEFORE
background: 'var(--color-carbon)',
boxShadow: 'var(--shadow-card)',
borderBottom: '1px solid var(--border)',

// AFTER — remove borderBottom; shadow-card provides the hairline
background: 'var(--color-carbon)',
boxShadow: 'var(--shadow-card)',
```

---

### #18 — MEDITATION PLAYER: rem/string padding inconsistency
**File:** `app/meditation/[id]/page.tsx`  
**Category:** INCONSISTENT_PADDING  
**Impact:** All padding values in this page use rem strings (`'0.75rem'`, `'1.5rem'`, `'2.5rem 3rem'`, `'1.25rem'`) while the entire rest of the app uses px integers  

```jsx
// BEFORE — back bar
padding: '0.75rem var(--pad)'

// AFTER
padding: '12px 16px'

// BEFORE — main content area
padding: '1.5rem var(--pad)'

// AFTER
padding: '24px 16px'

// BEFORE — timer/done card
padding: '2.5rem 3rem'

// AFTER
padding: '40px 48px'
```

---

### #19 — DASHBOARD: MetricCell 2px border accent
**File:** `app/page.tsx`  
**Category:** BORDER  
**Impact:** Active metric cells use `borderLeft: '2px solid var(--accent)'` — non-standard 2px width. The Insights page has the same pattern on insight rows  

```jsx
// BEFORE
borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent'

// AFTER
borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent'
// (use 3px for strong left accent bars — this is the pattern in plan/page.tsx session cards,
//  OR standardize to 1px and use background-color change for active state)
```

---

### #20 — MEDITATION LIST: Overloaded empty/loading state
**File:** `app/meditation/page.tsx`  
**Category:** LOADING_STATE  
**Impact:** `sessions.length === 0` renders "Loading sessions…" — users who have no sessions see a misleading loading message permanently  

```jsx
// BEFORE
{sessions.length === 0 ? (
  <div style={{ ... }}>Loading sessions…</div>
) : (

// AFTER — separate loading from empty
const [loading, setLoading] = useState(true);
// ... set loading = false after load() completes

{loading ? (
  <div style={{ padding: '40px 16px', textAlign: 'center' }}>
    <p style={{ fontSize: 13, color: 'var(--text-4)', letterSpacing: '-0.011em' }}>Loading…</p>
  </div>
) : sessions.length === 0 ? (
  <div style={{ padding: '40px 16px', textAlign: 'center' }}>
    <p style={{ fontSize: 13, color: 'var(--text-4)', letterSpacing: '-0.011em' }}>No sessions yet.</p>
  </div>
) : (
  // session list
)}
```

---

## Quick Reference: Files by Severity

### 🔴 Critical (hard violations, visually broken)
- `app/meditation/[id]/page.tsx` — fontWeight 900/800, extreme tracking, rem padding, stale surface
- `app/fitness/plan/page.tsx` — all stale classes/vars, fontWeight 700, positive tracking, border issues
- `app/fitness/exercises/page.tsx` — stale classes/vars, fontWeight 700, mono everywhere
- `app/fitness/calculators/page.tsx` — whole page in mono, fontWeight 700, missing nav padding, stale vars

### 🟡 High (visible inconsistencies, wrong tokens)
- `app/page.tsx` — positive tracking on segments, 2px border, padding inconsistency
- `app/nutrition/page.tsx` — positive tracking on meal headers, double border, padding mismatch
- `app/body/page.tsx` — wrong tracking on delta values, inline loading state
- `components/Skeleton.tsx` — padding mismatch with Dashboard

### 🟢 Low (polish, minor consistency)
- `app/habits/page.tsx` — no skeleton loading state
- `app/meditation/page.tsx` — overloaded loading/empty state
- `app/settings/page.tsx` — inline loading state
- `app/insights/page.tsx` — inline loading state, 2px accent border
- `app/login/page.tsx` — horizontal padding 24px vs system 16px
- `components/Nav.tsx` — negative tracking on tab labels
- `components/QuickLogSheet.tsx` — borderRadius 10 instead of 12
- `components/Toast.tsx` — hardcoded rgba colors (CSS limitation, low priority)

---

*End of audit — 119 issues found across 16 files.*
