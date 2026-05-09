# Mobile-First Teen Patti Layout Optimization

## Context

On iPhone Safari, the current Teen Patti layout has two compounding mobile problems:

1. **The viewport sizing is wrong for iOS.** [client/src/App.tsx:31](client/src/App.tsx#L31) wraps the app in `h-screen` (= `100vh`) and [client/index.html:5](client/index.html#L5) uses a viewport meta without `viewport-fit=cover`. iOS Safari's `100vh` corresponds to the *largest* viewport (URL bar hidden), so on first paint — when the URL bar is showing — the bottom of the layout is cut off by the bar. There is no `100dvh`/`100svh` fallback, no `--vh` JS shim, no `safe-area-inset` handling, and no `interactive-widget=resizes-content` to deal with the keyboard. (Confirmed by reading [client/src/index.css](client/src/index.css), [client/index.html](client/index.html), [tailwind.config.ts](tailwind.config.ts).)

2. **Too much chrome competes for the small felt area.** The current Teen Patti mobile stack ([client/src/screens/GameScreen.tsx:894-1110](client/src/screens/GameScreen.tsx#L894-L1110)) is: top bar (~40px) → OpponentBand horizontal scroll (~90px including cards) → felt-circle with pot + stake pill + my hole cards (flex-1) → MobileSelfBar (~55px) → TeenPattiActionBar (~120-160px) → plus four floating overlays (AdminPanel button, HandRankings tab, ChatPanel bubble, WinnerBanner). On a small iPhone the felt where the eye actually wants to live ends up squeezed to ~150–200px. Information is also duplicated: "Stake X" appears in the top bar, the center pill, the self-bar badge, and the action-bar header.

The goal is to (a) fix the viewport so nothing is ever clipped by the iOS URL bar and (b) rebuild the Teen Patti mobile layout around what the player actually needs to see and decide on at each phase, without sacrificing any existing capability.

## Scope

In scope:
- iOS Safari viewport fix (applies globally to all game variants).
- Teen Patti mobile **portrait + landscape** layout redesign (≤ 767px wide *and* short-height landscape devices).
- Mobile-relevant overlays (Admin, Hand Rankings, Chat, Winner Banner, Sideshow, Variation picker, Variation info).

Out of scope:
- Desktop / tablet (≥ 768px wide AND ≥ 600px tall) Teen Patti layout — left as-is for now.
- Hold'em (`Full mode`) and Chip-Only mode mobile layouts — only ride the viewport fix.
- Game-rules changes (no engine, no server work).
- Visual / aesthetic overhaul (Casino Noir tokens stay).

## Phase A — iOS viewport fix (small, isolated)

Ship this first. It is mechanical and unlocks whatever Phase B does.

**A1.** [client/index.html:5](client/index.html#L5) — extend the viewport meta to declare safe-area + keyboard intent:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
```
(Keeps zoom locked the way it is today.)

**A2.** [client/index.html:10](client/index.html#L10) — drop `min-h-screen` from the `<body>` (it fights `h-screen`/`dvh` on the root) and instead set `height: 100%`. The root `<div>` already owns layout sizing.

**A3.** [client/src/App.tsx:31](client/src/App.tsx#L31) — replace `h-screen` with a dynamic-viewport class. Add a Tailwind utility (preferred) or a one-liner CSS class:

```tsx
<div className="h-[100dvh] supports-[height:100svh]:h-[100svh] w-screen overflow-hidden …">
```
Rationale: `dvh` tracks the live viewport (URL bar in/out), `svh` is the conservative "small" viewport which still leaves room when the bar is showing — using `svh` as the floor guarantees nothing is *ever* under the URL bar, while `dvh` lets the felt grow when the bar hides. Pick one of these two; recommend `100svh` as the simpler, universally-safe choice (no resize-driven layout thrash). If we choose `100svh`, drop the `supports-` clause.

**A4.** [client/src/index.css](client/src/index.css) — add safe-area padding to the outermost game-shell container so iPhone home-indicator and notch don't overlap controls/headers:
- Top bar: `padding-top: max(0.5rem, env(safe-area-inset-top))`.
- Action bar / control rail bottom: `padding-bottom: max(0.75rem, env(safe-area-inset-bottom))`.

Done as inline Tailwind via `pt-[max(0.5rem,env(safe-area-inset-top))]` etc., applied at the `game-shell` and `control-rail` level. No new component needed.

**A5.** Sanity-check that the four floating overlays (`AdminPanel` button top-right, `HandRankings` right-edge tab, `ChatPanel` bubble, `WinnerBanner`) respect the new safe-area insets — particularly the chat bubble position clamp in [client/src/components/ChatPanel.tsx](client/src/components/ChatPanel.tsx) which uses `window.innerHeight` (which on iOS Safari shrinks/grows with the URL bar). Likely fine after A3, but verify.

**Verification (Phase A):**
- Build, deploy to a Vercel preview, open on iPhone Safari in portrait. URL bar visible: action bar fully tappable, no clipping. Scroll up to dismiss URL bar: felt expands, no white gap. Open keyboard via chat: input scrolls into view, action bar not clipped.
- Repeat in Chrome iOS (which rebroadcasts Safari's viewport behavior).
- Smoke-check Android Chrome: should be unchanged-or-better since `dvh`/`svh` are widely supported.

## Phase B — Teen Patti mobile layout redesign

The redesign is built around three ideas:

1. **Reduce permanent chrome to what the eye must see at all times.** Permanent: pot, stake, whose turn, my chips, my cards, the action bar. Everything else is on-demand or transient.
2. **Scale density to the phase, not the screen.** During betting the action bar is huge; at hand-complete the action bar collapses and the reveal/pot-award area expands.
3. **Two phone layouts** (portrait, landscape) plus the existing desktop layout. Both phone layouts share the same regions and components — only the *arrangement* differs.

### Breakpoint logic (replaces single `min-width: 768px` check)

Today: `useMediaQuery('(min-width: 768px)')` flips between mobile and desktop. This sends a phone in landscape (e.g. 812×375) into the desktop branch, where the elliptical table is unusably squashed.

New breakpoint hook in [client/src/hooks/useMediaQuery.ts](client/src/hooks/useMediaQuery.ts) (or inline `useLayout` helper in `GameScreen.tsx`):
- `desktop`: `(min-width: 768px) and (min-height: 600px)` → existing elliptical layout, untouched.
- `phone-landscape`: NOT desktop AND `(orientation: landscape)` AND `(max-height: 500px)` → new landscape layout (B7).
- `phone-portrait`: otherwise → portrait layout (B1–B6).

This keeps tablets and laptops on desktop, and routes both portrait and landscape phones into purpose-built layouts.

### B1. Portrait — screen regions (top → bottom)

```
┌─────────────────────────────────────────┐  safe-area-top
│  [Hand# + variation chip + ⓘ]   [⏱ 5s] │  STATUS STRIP    ~32px
├─────────────────────────────────────────┤
│   • • • opponents (compact strip) • • • │  OPPONENT STRIP  ~58px
├─────────────────────────────────────────┤
│                                         │
│            POT  ₹ 12,400                │
│            stake 200 · pot-limit ▓▓▓░░  │  TABLE PANE
│                                         │  flex-1
│         [♠ 7]  [♥ K]  [♣ A]             │
│                                         │
│   ▾ Recent: Anita raised to 400         │
├─────────────────────────────────────────┤
│  Your turn — Chaal 400                  │  ACTION DOCK
│  [Pack]  [Chaal]  [Raise ▾]  [⋯ More]   │  ~108px
│                                         │
│                            (sideshow,   │
│                             show, see)  │
└─────────────────────────────────────────┘  safe-area-bottom
```

Floating, unchanged: WinnerBanner (top-center toast), ChatPanel bubble, AdminPanel cog, HandRankings tab — but with a smaller default footprint and respecting safe-area (Phase A).

### B2. STATUS STRIP (replaces current top bar)

Current: 3-column grid with hand#/boot, variation+info, "Stake X". Stake is duplicated downstream so we drop it here.

New, single-row, ~32px tall:
- **Left:** `#142 · Classic ⓘ` (hand number + variation short label + info icon as one tappable group → opens VariationInfoSheet). Boot moves into the variation info sheet (it never changes during a hand).
- **Right:** turn timer badge **only** when it's actually counting down on me; otherwise empty.

Files: [client/src/screens/GameScreen.tsx:897-922](client/src/screens/GameScreen.tsx#L897-L922) (the "Top bar" block in `TeenPattiLayout`).

### B3. OPPONENT STRIP (compress, reorganize)

Current: [client/src/components/OpponentBand.tsx](client/src/components/OpponentBand.tsx) renders each opponent as a pill (avatar + name + chip count + bet + status badge) plus 3 face-down/face-up cards under each — for a 5-opponent game this overflows horizontally on a 360-wide phone.

New, ~78px:
- Single row, centered, horizontally scrollable only as a fallback.
- Per opponent, stacked vertically inside the bubble:
  - **Top:** avatar (28px) with a small status pip overlaid (color-coded: brass = active turn, muted = blind, gold = seen, red dot = packed). No textual badge in the default state.
  - **Middle:** name (truncated to 5 chars) + chip count (k-formatted).
  - **Right of avatar (only when present):** current-hand bet pill `+200`.
  - **Bottom:** 3 cards retained — face-down (`size="sm"`, ~28×40) during betting, face-up at showdown if `holeCards` is present. Folded players show grayed-out face-down placeholders (existing behavior, just smaller).
- Active opponent is the only one with the brass ring-pulse.
- Folded opponents fade to 35% opacity but keep their card row visible (preserves the table feel and lets people see who packed without scrolling).

The bubble width is tighter: avatar + name/chips column ~76px wide, plus the 28px-wide card stack underneath. ~6 opponents fit in a 360-wide strip; beyond that, scroll horizontally (rare for Teen Patti).

Files: [client/src/components/OpponentBand.tsx](client/src/components/OpponentBand.tsx) — likely a focused refactor; if mobile diverges enough from the desktop band, introduce a `compact` variant prop rather than fork the component.

### B4. TABLE PANE (the felt — flex-1, gets the most space)

Replace the current double-ringed felt circle ([GameScreen.tsx:1005-1042](client/src/screens/GameScreen.tsx#L1005-L1042)) with a simpler, taller felt that does three things by phase:

**During BETTING:**
- **Center, top:** big brass-display **POT total** (use `tabular-display`, ~36-40px font).
- **Below pot:** thin line `stake 200 · pot-limit 32% ░░░░▓▓▓░░░` — a compact bar showing current pot vs `boot × potLimitMultiplier` so the player sees the pot-limit creeping in. This replaces the duplicated "Stake X" pill at the center.
- **Below that:** **my 3 hole cards**, larger than today (`size="lg"` instead of `md`), since they're the single most-looked-at element. If still blind, show face-down with a single inline "**See cards**" CTA tucked under them (no separate self-bar duplication).
- **Bottom of pane (small line):** rolling action log — `Anita raised to 400 · 2s ago`. Single line, fades after each new action; replaces the per-seat action chip badges on mobile (which are harder to read in the cramped opponent strip).

**During SIDESHOW_PENDING (target):** the table pane is dimmed to 35% opacity, the action dock takes over with a full Accept/Decline overlay (current logic in [TeenPattiActionBar.tsx:67-87](client/src/components/TeenPattiActionBar.tsx#L67-L87) already does this — keep it).

**During HAND_COMPLETE:** the table pane becomes a "showdown spotlight":
- Pot prize line at top: `Anita wins 12,400 · Trail of Aces`.
- Winning hand front and center, larger than usual (`size="lg"`), with hand-rank caption.
- Opponent cards in the strip (B3) auto-flip face-up — that's where the eye already is, so no duplicate horizontal row. My own three cards stay where they are in the table pane.

### B5. ACTION DOCK (the new TeenPattiActionBar)

The current action bar is a 2-column grid with up to 6 buttons (Pack, See/Blind, Chaal, Raise, Sideshow, Show). On a phone with the keyboard hidden this is fine, but the equal-weight grid hides what matters.

New dock layout, mobile only:

**Top half — primary row (always 3 buttons, full-width):**
- `Pack` (red, fold variant)
- `Chaal 400` *or* `Blind 200` (ivy/call variant) — the name swaps based on `hasSeenCards`
- `Raise` (brass, opens slider sheet)

**Bottom half — context row (only what's available):**
- Before seeing: `See cards` (outline) — full-width single button.
- 3+ active and prev-seen and not declined: `Sideshow 400` (outline). Disabled state shows the reason inline (`Need to see cards first` / `Already declined this hand`).
- Heads-up and rules allow: `Show 400` (allin variant).
- Hand complete and I'm next dealer: `Deal next hand` (brass, full width) + a thin variation picker chip strip above it.
- Hand complete and not next dealer: `Waiting for Vikram…` pill.

**Raise slider:** stays a sheet/drawer (not a modal grid). Slide up from the dock; backdrop dims the table pane. Same min/max/preset logic as today.

Files: [client/src/components/TeenPattiActionBar.tsx](client/src/components/TeenPattiActionBar.tsx) and the inline `MobileSelfBar` ([client/src/screens/GameScreen.tsx:676 onward](client/src/screens/GameScreen.tsx#L676)). The MobileSelfBar can be deleted on Teen Patti mobile — its info (chips, position, chip-color) folds into the table pane (chips on the hole-cards line) and the action dock (cost embedded in button labels). Keep `MobileSelfBar` for Hold'em/chip-only since those layouts don't redistribute the same way.

### B7. Landscape phone layout (NEW)

Triggered by the `phone-landscape` breakpoint (≤ 500px tall, `orientation: landscape`). Same regions as portrait, rearranged into three vertical columns to use horizontal real estate.

```
┌──────────────────────────────────────────────────────────────────┐ safe-top
│ #142 · Classic ⓘ                                          [⏱ 5s] │  STATUS  ~28px
├────────────┬───────────────────────────────────┬─────────────────┤
│ OPPONENTS  │            TABLE PANE             │   ACTION DOCK   │
│ (vertical) │                                   │   (vertical)    │
│            │           POT  ₹12,400            │                 │
│  ◯ Anita   │           stake 200               │   Your turn     │
│  +200 SEEN │                                   │   Chaal 400     │
│            │       [♠ 7] [♥ K] [♣ A]           │                 │
│  ◯ Vikram  │                                   │   ┌─[Pack]─┐    │
│  BLIND     │   ▾ Anita raised to 400 · 2s      │   ├[Chaal]─┤    │
│            │                                   │   └[Raise]─┘    │
│  ◯ Priya   │                                   │   See cards     │
│  PACK      │                                   │                 │
└────────────┴───────────────────────────────────┴─────────────────┘ safe-bot
```

Specifics:

- **Status strip (top, full width):** unchanged from portrait B2. ~28px.
- **Left column (opponents, vertical scroll):** ~120px wide. Same bubble content as B3 but stacked vertically and per-row (no more horizontal scroll). Avatar on the left of each row, name + chips + bet stacked to its right, status pip on avatar, 3 cards as a thin row below name/chips. Scrolls vertically if > 4 opponents.
- **Center column (table pane):** the felt — flex-1. Same content as B4 portrait (pot, stake, my 3 cards, action log, showdown). My cards drop to `size="md"` to fit in the shorter height; pot uses tabular-display at ~28px.
- **Right column (action dock, vertical):** ~150px wide. Same buttons as B5 but stacked vertically full-height instead of in a 3-column row: `Pack` / `Chaal 400` / `Raise ▾` as the top three; `See` / `Sideshow` / `Show` flow below as available. Raise sheet still slides up from the bottom (preserves muscle memory across orientations); covers the whole screen since landscape is short.
- **Sideshow accept/decline target overlay:** in landscape, takes over the right column (replaces action dock buttons) so the table pane and opponents stay visible. Same behavior in `SIDESHOW_PENDING` requester case (waiting pill in the dock column).
- **Hand complete:** action dock column shows the `Deal next hand` flow + variation picker; left + center columns show showdown.

Implementation: the new mobile branches in `TeenPattiLayout` should select via the `phone-landscape` flag and render either a vertical-stack (portrait) or 3-column-grid (landscape) wrapper around the same region components. Keep components reusable between orientations — only the parent layout differs.

### B6. Floating overlays — small fixes

- **AdminPanel button:** move from `top-right` to `top-left` to free up the timer badge area; keep z-index.
- **HandRankings tab:** keep on right edge, but make the closed-state tab thinner (8px wide) and set its top to `top-1/4` so it doesn't fight the opponent strip.
- **ChatPanel bubble:** default-position to bottom-left above safe-area-inset-bottom, not top-right (which collides with the variation info icon).
- **WinnerBanner:** unchanged but verify it sits below the status strip with safe-area-top respected.

These are 1–2 line tweaks each.

## Critical files to modify

| File | Change |
|------|--------|
| [client/index.html](client/index.html) | viewport meta + body height (A1, A2) |
| [client/src/App.tsx](client/src/App.tsx) | root `h-[100svh]` (A3) |
| [client/src/index.css](client/src/index.css) | safe-area utility on `game-shell` / `control-rail` (A4) |
| [client/src/hooks/useMediaQuery.ts](client/src/hooks/useMediaQuery.ts) | add `useLayoutMode()` returning `'desktop' \| 'phone-portrait' \| 'phone-landscape'` |
| [client/src/screens/GameScreen.tsx](client/src/screens/GameScreen.tsx) | rewrite mobile branches of `TeenPattiLayout` for portrait + landscape (B2, B4, B6, B7); remove mobile MobileSelfBar on Teen Patti (B5) |
| [client/src/components/OpponentBand.tsx](client/src/components/OpponentBand.tsx) | compact variant + vertical-stack mode for landscape (B3, B7) |
| [client/src/components/TeenPattiActionBar.tsx](client/src/components/TeenPattiActionBar.tsx) | reorganize buttons into primary/context rows; vertical-stack mode for landscape; convert raise to bottom sheet (B5, B7) |
| [client/src/components/AdminPanel.tsx](client/src/components/AdminPanel.tsx) | move trigger to top-left on mobile (B6) |
| [client/src/components/HandRankings.tsx](client/src/components/HandRankings.tsx) | thinner mobile tab (B6) |
| [client/src/components/ChatPanel.tsx](client/src/components/ChatPanel.tsx) | default bubble position bottom-left (B6) |

## Existing utilities to reuse (don't reinvent)

- `surface-pill`, `surface-panel`, `surface-panel-soft`, `control-rail`, `table-felt`, `brass-hairline-*` classes — already defined in [index.css](client/src/index.css). The redesign reskins composition only; no new design tokens.
- `Card`, `ChipStack`, `Badge`, `Button`, `Slider`, `ToggleGroup`, `Sheet` (from `@/components/ui/*`) all exist and are used.
- The blind/seen/sideshow eligibility math in [TeenPattiActionBar.tsx:18-58](client/src/components/TeenPattiActionBar.tsx#L18-L58) is correct and stays put — only the button rendering changes.
- Action chip / `recentActorId` logic in [GameScreen.tsx:824-833](client/src/screens/GameScreen.tsx#L824-L833) is reused for the new "rolling action log" line in B4 (we read the same `gameState.lastAction` and clear after 2.5s, but render it as one centered line instead of per-seat chips on mobile).

## Verification (end-to-end)

Local manual checks before merge:

1. **iOS Safari portrait, iPhone 13 mini (375×692):**
   - Page never scrolls. Action dock fully tappable on first paint. URL bar dismissal expands felt smoothly.
   - During my turn: Pack/Chaal/Raise visible without scroll. Open raise sheet → slider visible above keyboard if any.
   - Sideshow request: target sees Accept/Decline overlay; both fully visible.
   - Hand complete: showdown row of all hands visible without scroll. Deal-next-hand button reachable.
   - Chat: bubble opens, panel does not clip URL bar; input is reachable when keyboard opens (`interactive-widget=resizes-content`).

2. **iOS Chrome portrait** — same checks (uses Safari viewport under the hood).

3. **iPhone landscape (e.g. iPhone 13 mini 692×320):** routes into `phone-landscape`. Three-column layout, no scroll, action dock fully reachable on the right, opponent column scrolls vertically when many players, raise sheet slides up over the whole screen.

4. **Rotation:** rotate device portrait → landscape → portrait mid-hand. Layout switches without losing local UI state (raise slider value, sideshow pending overlay if I'm the target).

5. **Android Chrome portrait, Pixel 6 (412×915):** sanity check that `100svh` plus safe-area still produces a tight, scroll-free layout.

6. **Tablet portrait (e.g., iPad Mini 768×1024):** lands on the desktop branch — confirm no regressions vs `claude/poker-app-planning-LaQAw` baseline.

7. **Desktop ≥ 1280px:** Hold'em and chip-only modes unchanged; Teen Patti desktop branch unchanged.

8. **Tests:** `npm test` (or whatever the repo uses — verify in Phase A); no new tests required since this is a layout refactor with no behavior change. The Teen Patti engine tests under [server/](server/) and [tests/](tests/) should still all pass.

9. **Repo convention:** copy this final plan from `~/.claude/plans/i-want-to-optimize-sequential-yeti.md` to `plans/mobile-teen-patti-optimization.md` per [CLAUDE.md](CLAUDE.md).

## Decisions confirmed with user

- **Orientation:** portrait + landscape both supported (B7 added).
- **Chrome cuts approved:** drop duplicated `Stake X`, drop per-seat action chips on mobile (replaced by central rolling log line), drop `MobileSelfBar` on Teen Patti mobile only (kept on Hold'em / chip-only).
- **Opponent cards retained** in the strip — face-down during betting, face-up at showdown.
