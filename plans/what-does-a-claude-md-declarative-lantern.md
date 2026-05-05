# Lazypoker → shadcn/ui + Editorial Casino Noir

## Context

The current Lazypoker UI is hand-rolled Tailwind across ~16 components and 4 screens. It works, but every primitive (button, input, slider, modal, accordion, select) is reimplemented inline with `bg-white/10` glass and rounded-xl, and the type system is the OS default sans-serif. The goal of this branch is twofold:

1. **Replace primitives with shadcn/ui** — get accessible Radix-backed components (focus rings, keyboard nav, ARIA) without giving up Tailwind authoring.
2. **Make it beautiful** — commit to a single, distinctive aesthetic ("Editorial Casino Noir") and execute it cohesively across every screen.

The current branch (`claude/poker-app-planning-LaQAw`) is preserved as-is. All work happens on a new experimental branch — if the direction misses, the user can throw it away.

---

## Aesthetic direction: **Editorial Casino Noir**

Think old-money baccarat room rendered as a Vogue spread. Deep emerald felt, burnished brass, paper-cream typography, the occasional ember-red accent. High-contrast didone display type for headlines and chip totals; a sharp, characterful neo-grotesk for body; tabular mono for room codes and stacks. Refined, not maximalist — every shadow earns its place.

**Type system** (Google Fonts):
- Display — **Bodoni Moda** (high-contrast didone, variable; for wordmark, screen titles, pot total, "Award Pot")
- Body — **Albert Sans** (characterful neo-grotesk; everything else)
- Numerals — **JetBrains Mono** (room codes, chip stacks, blinds, timer)

**Color tokens** (HSL CSS variables, light values shown):
- `--felt`        `160 35% 14%` — primary surface
- `--felt-deep`   `160 42% 9%`  — page background
- `--felt-rim`    `160 28% 19%` — elevated surface
- `--ink`         `170 22% 6%`  — modal/overlay base
- `--bone`        `38 30% 90%`  — primary text (warm cream, never pure white)
- `--bone-dim`    `38 18% 70%`  — secondary text
- `--brass`       `40 55% 62%`  — primary accent (replaces `gold`)
- `--brass-deep`  `38 50% 42%`  — pressed/hover
- `--ember`       `8 62% 52%`   — fold/raise accent (replaces flat red-600)
- `--velvet`      `220 32% 22%` — chip-blue refined
- `--ivy`         `142 32% 36%` — chip-green refined
- `--obsidian`    `220 18% 12%` — chip-black refined
- Mapped to shadcn semantics: `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--accent`, `--destructive`, `--ring`, etc.

**Atmosphere**:
- Subtle SVG noise overlay on felt surfaces (3% opacity) — sells the texture
- Vignette gradient on the page edges
- Brass hairline borders (1px `--brass / 30%`) on elevated cards instead of `border-white/10`
- Multi-layer shadows on chips: tight inner highlight + soft green-tinted drop
- Refined focus ring: 2px `--brass`, offset 2px

---

## Branch & setup

```
git checkout -b claude/shadcn-noir-redesign
```

Single experimental branch. No PR until the user reviews the live result.

---

## Phase 1 — Tooling foundation

Add deps (npm install at repo root, since `package.json` is at repo root, not `client/`):

```
@radix-ui/react-{slider,dialog,alert-dialog,accordion,select,tooltip,toggle-group,label,separator,scroll-area}
class-variance-authority clsx tailwind-merge tailwindcss-animate
lucide-react sonner
```

Files:
- **[components.json](components.json)** (new, repo root) — shadcn config: style="new-york", tailwind config path, alias `@/components` → `client/src/components`, `@/lib` → `client/src/lib`
- **[tsconfig.json](tsconfig.json)** — add `"@/*": ["./client/src/*"]` to paths
- **[vite.config.ts](vite.config.ts)** — add resolve alias `@` → `client/src`
- **[client/src/lib/utils.ts](client/src/lib/utils.ts)** (new) — standard `cn()` helper

---

## Phase 2 — Design system

**[tailwind.config.ts](tailwind.config.ts)** — full rewrite:
- Replace flat colors (`felt`, `gold`, `chip-*`) with HSL-variable tokens (`background`, `foreground`, `primary`, `brass`, `ember`, `felt`, `felt-deep`, `felt-rim`, `bone`, `velvet`, `ivy`, `obsidian`). Keep semantic shadcn names AND poker-specific names side-by-side.
- Add `fontFamily.display = ['"Bodoni Moda"', 'serif']`, `fontFamily.sans = ['"Albert Sans"', 'sans-serif']`, `fontFamily.mono = ['"JetBrains Mono"', 'monospace']`
- Add `borderRadius` mapping to `--radius` (shadcn convention)
- Keep all existing keyframes (chipAdd, potGrow, ringPulse, scalePop, breathe) — they're good
- Add new keyframes: `brassShimmer`, `feltDrift` (slow background gradient), `cardLift`
- Plugin: `tailwindcss-animate`

**[client/src/index.css](client/src/index.css)** — full rewrite:
- `@import` Google Fonts (Bodoni Moda variable, Albert Sans, JetBrains Mono) at top
- `:root` block with all HSL variables (Phase 1 token list)
- `body` font: Albert Sans, color `--bone`, background `--felt-deep`
- New utility classes: `.felt-noise` (SVG data-uri noise overlay), `.brass-hairline`, `.brass-shimmer-text`, `.vignette`, `.tabular-display` (Bodoni with `font-feature-settings: "tnum"`)
- Refined card-flip / chip-toss / pot-grow keyframes preserved verbatim
- Custom scrollbar (thin brass) for `.scrollbar-brass`

---

## Phase 3 — shadcn primitives

Generate via `npx shadcn@latest add` into `client/src/components/ui/`:

`button` `input` `label` `slider` `dialog` `alert-dialog` `accordion` `select` `sheet` `tooltip` `separator` `badge` `scroll-area` `toggle-group` `card` `sonner`

Then **customize**:
- **[client/src/components/ui/button.tsx](client/src/components/ui/button.tsx)** — extend default variants with poker-specific ones via cva: `fold` (ember outline), `check` (ivy fill), `call` (ivy fill), `raise` (brass fill, black text, slight letter-spacing), `allin` (brass→ember gradient with shimmer), `host` (brass outline ghost). Sizes: `sm`, `md`, `lg`, `xl` (xl is the primary action button — `py-4 text-base tracking-[0.02em]`).
- **[client/src/components/ui/input.tsx](client/src/components/ui/input.tsx)** — restyle: brass-tinted bottom border (no full box), focus animates the border to full width, `font-mono` variant for room code via prop.
- **[client/src/components/ui/slider.tsx](client/src/components/ui/slider.tsx)** — brass thumb with subtle inner ring; track is felt-rim; filled portion is brass with shimmer keyframe.

---

## Phase 4 — Component refactors

For each file: replace inline buttons/inputs/modals with shadcn primitives, apply the new design tokens, refine typography. Target file-by-file:

**Buttons & forms:**
- **[client/src/screens/JoinScreen.tsx](client/src/screens/JoinScreen.tsx)** — wrap content in shadcn `Card`; replace 6+ inline buttons with `<Button variant="raise" size="xl">`; replace 4 inputs with `<Input>` (room code uses `variant="mono"`); replace mode selector with `ToggleGroup`. Wordmark renders in `font-display` with italic on "Poker". Add subtle decorative suit-glyph row above the wordmark in `--brass / 30%`.
- **[client/src/screens/LobbyScreen.tsx](client/src/screens/LobbyScreen.tsx)** — settings panel becomes `<Card>` with `<Separator>` between rows; the four native `<select>` (mode, starting chips, timer, blinds) become shadcn `<Select>` with brass-tinted triggers; "Deal Cards" button uses `<Button variant="raise" size="xl">`; seat grid keeps custom layout but seat tiles get refined typography (display font for seat number, mono for chip count) and brass occupied-seat ring.
- **[client/src/components/ActionBar.tsx](client/src/components/ActionBar.tsx)** — Fold/Check/Call/Raise/All-In become `<Button variant="fold|check|call|raise|allin">`; bet-sizing chips (½ Pot / ¾ Pot / Pot / Min / Max) become `<ToggleGroup>` (single-select, briefly snaps the slider); raise slider uses shadcn `<Slider>`; raise readout is `font-display tabular-display text-3xl text-brass`.

**Modals & overlays:**
- **[client/src/components/AdminPanel.tsx](client/src/components/AdminPanel.tsx)** — replace custom panel/modal with `<Sheet side="right">` (desktop) / `<Sheet side="bottom">` (mobile via `useMediaQuery`); host actions become labelled `<Button variant="host">`; "Add Chips" uses `<Input type="number">` with `+/−` step buttons.
- **[client/src/components/AwardPotButton.tsx](client/src/components/AwardPotButton.tsx)** — `<AlertDialog>` for confirmation; trigger button is `<Button variant="raise">` with brass shimmer when pot > 0.
- **[client/src/components/HandRankings.tsx](client/src/components/HandRankings.tsx)** — replace floating panel with `<Sheet side="right">` triggered by a fixed `<Button variant="ghost" size="icon">` showing `♥♠` in brass. Inside the sheet: each ranking row uses `font-display` for the rank number and the hand name, mono for the example. Keep the "hide" persistence behavior.
- Toasts — add `<Toaster>` from `sonner` to **[client/src/App.tsx](client/src/App.tsx)**; emit toasts on connection drop/restore, room code copy, action errors.

**Poker visuals (custom — refine, don't replace):**
- **[client/src/components/Card.tsx](client/src/components/Card.tsx)** — proper poker proportion (5:7), face uses subtle radial gradient `bone → bone/95`, rank uses `font-display` (Bodoni shines here — high contrast like a real card), suit glyph in matching `--ember` (hearts/diamonds) or `--ink` (spades/clubs), tiny corner index repeating top-left and bottom-right (rotated), thin brass hairline border. Card back: navy felt with a faint embossed brass diamond pattern (SVG) instead of single `♠`.
- **[client/src/components/ChipStack.tsx](client/src/components/ChipStack.tsx)** — chips become real-feeling discs: radial gradient from chip color to 15% darker at edge, embossed denomination character via inset text-shadow, edge highlight ring (`shadow: inset 0 1px 0 rgba(255,255,255,0.25)`), drop shadow with green tint to match felt. Stack offset uses `transform: translate3d` for crisp edges. Mono font for the amount label.
- **[client/src/components/ChipPotDisplay.tsx](client/src/components/ChipPotDisplay.tsx)** — pot amount renders in `font-display` Bodoni, brass color, with a subtle `brass-shimmer-text` keyframe; "POT" label in tiny tracking-widest Albert Sans Caps; dividers between player breakdowns become brass hairlines.
- **[client/src/components/PotDisplay.tsx](client/src/components/PotDisplay.tsx)** — same Bodoni treatment.
- **[client/src/components/PlayerSeat.tsx](client/src/components/PlayerSeat.tsx)** — avatar circle gets brass border when active (replaces gold ring-pulse), name in Albert Sans, stack in mono, position pill (D/SB/BB) becomes a `<Badge variant="brass">`.
- **[client/src/components/OpponentBand.tsx](client/src/components/OpponentBand.tsx)** — brass hairline dividers between opponents; subtle felt-noise background; active opponent gets brass ring + subtle outward glow.
- **[client/src/components/CommunityCards.tsx](client/src/components/CommunityCards.tsx)** — gap tightens to 6px, cards lift (1px translate, soft shadow) with stagger as they're revealed (use existing `cardLift` keyframe with `animation-delay: calc(var(--i) * 80ms)`).

**Screens:**
- **[client/src/screens/GameScreen.tsx](client/src/screens/GameScreen.tsx)** — top header phase indicator becomes a horizontal stepper (Pre-Flop · Flop · Turn · River · Showdown) — five tiny dots with the current one expanded into a brass pill showing the label; phase pill ("Chip Only" / "Full Game") becomes `<Badge>`. Both `ChipOnlyLayout` and `FullModeLayout` get the felt-noise overlay + edge vignette. The full-mode oval table border switches from `border-amber-900/60` to `border-brass-deep` with an inner `inset 0 0 60px rgba(0,0,0,0.4)` shadow for depth.
- **[client/src/screens/ResultScreen.tsx](client/src/screens/ResultScreen.tsx)** — winner name in big Bodoni italic; pot amount in display tabular numerals; brass shimmer keyframe across the "Winner" label; subtle confetti-like brass particles (CSS only, 6 spans with random `animation-delay`).

---

## Phase 5 — Polish pass

Once the above lands, do a single review-and-refine pass:
- Verify every `bg-white/10` and `border-white/10` is replaced with token-based equivalents
- Verify no `rounded-xl` is used where `rounded-md` (mapped to `--radius`) is now correct
- Verify focus rings are brass everywhere
- Verify mobile (`<sm`) layouts still hold — chip-only is mobile-first
- Verify dark-mode is the only mode (this app has no light mode and shouldn't pretend to — set `:root.dark` semantics or just bake the dark values into `:root`)

---

## Critical files

**New:**
- [components.json](components.json)
- [client/src/lib/utils.ts](client/src/lib/utils.ts)
- [client/src/components/ui/](client/src/components/ui/) — ~16 generated shadcn files

**Heavy edits:**
- [tailwind.config.ts](tailwind.config.ts)
- [client/src/index.css](client/src/index.css)
- [tsconfig.json](tsconfig.json), [vite.config.ts](vite.config.ts), [package.json](package.json)
- [client/src/screens/JoinScreen.tsx](client/src/screens/JoinScreen.tsx)
- [client/src/screens/LobbyScreen.tsx](client/src/screens/LobbyScreen.tsx)
- [client/src/screens/GameScreen.tsx](client/src/screens/GameScreen.tsx)
- [client/src/screens/ResultScreen.tsx](client/src/screens/ResultScreen.tsx)
- [client/src/components/ActionBar.tsx](client/src/components/ActionBar.tsx)
- [client/src/components/AdminPanel.tsx](client/src/components/AdminPanel.tsx)
- [client/src/components/AwardPotButton.tsx](client/src/components/AwardPotButton.tsx)
- [client/src/components/HandRankings.tsx](client/src/components/HandRankings.tsx)
- [client/src/components/Card.tsx](client/src/components/Card.tsx)
- [client/src/components/ChipStack.tsx](client/src/components/ChipStack.tsx)
- [client/src/components/ChipPotDisplay.tsx](client/src/components/ChipPotDisplay.tsx)
- [client/src/components/PlayerSeat.tsx](client/src/components/PlayerSeat.tsx)
- [client/src/components/OpponentBand.tsx](client/src/components/OpponentBand.tsx)
- [client/src/components/CommunityCards.tsx](client/src/components/CommunityCards.tsx)
- [client/src/components/PotDisplay.tsx](client/src/components/PotDisplay.tsx)
- [client/src/App.tsx](client/src/App.tsx) — Toaster mount

**Light edits / unchanged:**
- [client/src/components/ChipOnlyActionZone.tsx](client/src/components/ChipOnlyActionZone.tsx), [ChipRail.tsx](client/src/components/ChipRail.tsx), [PendingWager.tsx](client/src/components/PendingWager.tsx), [CommitButton.tsx](client/src/components/CommitButton.tsx), [ActionHelpers.tsx](client/src/components/ActionHelpers.tsx) — token swap only (no Radix primitives needed; these are domain-specific)

---

## What we're NOT doing

- Not migrating to a different framework (still React 18 + Vite + Tailwind 3)
- Not adding a light theme — this is a dark-only app and should commit
- Not changing any server-side, socket, or game-logic code
- Not introducing form libraries (react-hook-form/zod) — the existing useState pattern is fine for these tiny forms
- Not adding a state-management library — Context is fine

---

## Verification

After implementation, run end-to-end on the experimental branch:

1. `npm run dev` → server on :3000, client on :5173
2. Open two browser windows; create a room in window A, join with the room code in window B
3. **JoinScreen** — type display fonts render correctly, server-URL flow still works, mode toggle is a real ToggleGroup
4. **LobbyScreen** — host can change all four settings via shadcn Selects; Deal Cards button kicks off a hand
5. **GameScreen (chip-only)** — opponent band, chip-only action zone with chip rail and commit, pot grows, award-pot AlertDialog confirms; phase stepper updates Pre-Flop → Flop → Turn → River → Showdown
6. **GameScreen (full)** — oval table renders with brass rim, player seats around it, hole cards at bottom, ActionBar with shadcn Slider for raises, all five action variants (Fold/Check/Call/Raise/AllIn) trigger
7. **HandRankings Sheet** — opens from right, scrolls, dismiss persists "hidden" state via localStorage
8. **AdminPanel Sheet** — host can add chips, declare winner, start hand
9. **Mobile** (resize to 375×812) — chip-only mode still fits, sheets slide from bottom
10. `npm run typecheck` clean
11. Visual diff against `claude/poker-app-planning-LaQAw` — screenshot a side-by-side of LobbyScreen and GameScreen on both branches; the new branch should look like a different, more refined product

The user reviews live in browser; if any single screen misses the mark, iterate on that screen only without restarting the migration.
