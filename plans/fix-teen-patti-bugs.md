Ready for review
Select text to add comments on the plan
Fix Teen Patti UI bugs + sideshow reveal feature
Context
Four bugs and one feature in Teen Patti mode:

Mini hole-card preview shows 2 cards instead of 3. The bottom self-bar (MobileSelfBar) hardcodes indices [0] and [1] of holeCards, so Teen Patti's third card is dropped from the preview at the bottom of the screen. Poker (2 cards) happens to look correct only by coincidence.

Opponents don't see "SEEN" status until the seer takes their next action. When a player executes SEE_CARDS, the server immediately sets hasSeenCards: true and broadcasts state — but tpSeeCards does not advance the turn (intentional). On opponents' screens the OpponentBand.getStatusBadge returns early with "TURN" whenever isActing === true, masking the new SEEN state. Only when the seer eventually CHAALs/RAISEs and the turn moves on does the persistent hasSeenCards fallback finally render "SEEN".

No notification when a sideshow is declined; sideshow can be re-requested. When the target declines a sideshow (server/game-engine.ts:1164-1170), the server sets lastAction = { playerId: responder, action: 'sideshow declined' } and clears pendingSideshow. The requester gets no targeted UI signal — and because nothing is tracked on the player, they can immediately tap Sideshow again (the previous active player hasn't changed). We need (a) an explicit notification to the requester that they were declined, and (b) a server-side block preventing another sideshow request in the same hand once any sideshow against them has been declined.

Sideshow cost ≠ chaal cost. server/game-engine.ts:1131 sets cost = state.currentBet (1× stake), but the requester is always a seen player (enforced at line 1121), so the chaal cost they would otherwise pay is 2 × stake. The user expects sideshow to cost the same as chaal. Client label at TeenPattiActionBar.tsx:229 also displays the wrong (1×) figure.

Feature — asymmetric card reveal on sideshow accept + public announcement. When a sideshow is accepted today, the loser is silently packed and nobody sees any cards (tpRespondSideshow accept branch, lines 1172-1196). The user wants:

The requester to see the responder's three cards (paid for the privilege via the sideshow fee).
The responder does not see the requester's cards (asymmetric — only the requester gets to peek).
The reveal persists for the rest of the hand (so the requester can keep referencing what they saw).
All players (including spectators) see a toast/announcement: "[Winner] won sideshow over [Loser]" — without any cards being revealed to non-participants.
Files to change
client/src/screens/GameScreen.tsx — MobileSelfBar hole-card render at lines 715–719.
client/src/components/OpponentBand.tsx — getStatusBadge (lines 25–50).
server/game-engine.ts — tpRequestSideshow (lines 1116–1153) cost formula and decline-block; tpRespondSideshow (lines 1155–1197) decline branch + accept branch reveal append; filterStateForPlayer (lines 878–904) reveal logic; startTeenPattiHand (around line 953) to reset both new fields.
common/types.ts — add sideshowDeclined?: boolean to Player (after hasSeenCards at line 29); add sideshowReveals?: Array<{ viewerId: string; subjectId: string }> to GameState (after pendingSideshow at line 98).
client/src/components/TeenPattiActionBar.tsx — sideshow button label and eligibility (lines 18–40, 222–230); add a "waiting for sideshow response" placeholder for the requester during SIDESHOW_PENDING.
client/src/screens/GameScreen.tsx — wire Sonner toasts: (a) decline toast to the requester only, (b) public "X won sideshow over Y" toast on accept resolution.
Changes
Bug 1 — MobileSelfBar hole-card preview
client/src/screens/GameScreen.tsx:715-719

Replace the hardcoded two-index render with a .map() over holeCards. The server's holeCards array length already reflects the variant (2 for Poker, 3 for Teen Patti — see common/types.ts:19 holeCards: Card[] | null), so this is variant-agnostic and the right fix for both layouts that mount MobileSelfBar (Poker layout at GameScreen.tsx:606, Teen Patti layout at GameScreen.tsx:952).

{currentPlayer.holeCards && !currentPlayer.isFolded && (
  <div className="flex shrink-0 gap-1">
    {currentPlayer.holeCards.map((card, i) => (
      <Card key={i} card={card} size="md" />
    ))}
  </div>
)}
Bug 2 — OpponentBand.getStatusBadge SEEN visibility
client/src/components/OpponentBand.tsx:25-50

For Teen Patti, the persistent SEEN/BLIND status is the meaningful signal in this badge slot — whose turn it is is already conveyed by the surrounding ring-pulse highlight on the bubble (see OpponentBand.tsx:75-77). For Texas Hold'em there is no such persistent state, so TURN remains useful.

Restructure getStatusBadge to short-circuit to SEEN/BLIND for live Teen Patti players before the isActing check, while preserving transient action labels (CHAAL, RAISE, etc.) when lastAction belongs to that player. Concretely:

Keep the early returns for isFolded and isAllIn.
For gameState.variant === 'teen-patti':
If lastAction.playerId === player.id and the action is one of the transient labels (chaal, raise, bet, see, sideshow), return that label (existing logic, just reordered).
Otherwise return SEEN/BLIND from player.hasSeenCards immediately — do not fall through to the isActing → TURN branch.
For non-Teen-Patti variants, keep the existing flow: isActing → TURN, then lastAction mapping, then null.
This way, the moment the server broadcasts hasSeenCards: true (which happens on SEE_CARDS, see server/game-engine.ts:1025-1038), opponents' OpponentBand re-renders with the SEEN badge — even though it is still the seer's turn.

Bug 3 — Decline notification + once-per-hand sideshow restriction
Server: track a declined-sideshow flag on the requester.

Add sideshowDeclined?: boolean to common/types.ts Player (after hasSeenCards). Default the field to false when a new hand starts (startTeenPattiHand, around line 953 — same place pendingSideshow is cleared). Reuse the existing Player type rather than introducing a new map on GameState so the field flows through filterStateForPlayer automatically.

In tpRequestSideshow add a guard right after the existing !player.hasSeenCards check:

if (player.sideshowDeclined) return state;
In tpRespondSideshow decline branch (lines 1164–1170), set the flag on the requester (not the responder) so they can't re-request this hand:

if (!accept) {
  return {
    ...state,
    pendingSideshow: null,
    phase: 'BETTING',
    players: state.players.map((p, i) =>
      i === requesterIndex ? { ...p, sideshowDeclined: true } : p
    ),
    lastAction: { playerId: responder.id, action: 'sideshow declined' },
  };
}
Scope: once per hand (any decline kills sideshow for that requester for the rest of the hand). This matches the user's "once only" wording and is the simplest reading.

Client: hide the sideshow button when blocked. Extend isSideshowEligible in TeenPattiActionBar.tsx:18-40 to also require !currentPlayer.sideshowDeclined. The server guard is the source of truth; the client check is just to keep the UI consistent.

Client: notify the requester when declined. Two pieces:

While phase === 'SIDESHOW_PENDING' and the local player is the requester, show a "Waiting for [target] to respond to sideshow…" pill in TeenPattiActionBar.tsx — mirror the existing target-side overlay block (lines 68–87) with a sibling else if (pending && pending.requesterId === playerId) branch. Without this, the requester sees the regular action bar during pending, which is misleading.

Fire a Sonner toast when the local player's pending sideshow transitions away without acceptance. The Sonner Toaster is already mounted in App.tsx (client/src/components/ui/sonner.tsx), so this is a one-liner import. In TeenPattiLayout (or a small effect inside TeenPattiActionBar), keep a useRef of the prior pendingSideshow. When it transitions from { requesterId: <me>, targetId: X } to null, look at gameState.lastAction: if action === 'sideshow declined' show toast.info("X declined your sideshow"). (If the action is 'sideshow lost — packs' we don't need a toast — the existing UI already shows the pack and the chip swing.)

This keeps server changes surgical and uses lastAction (which is already broadcast) as the trigger source. No new fields on lastAction needed.

Bug 4 — Sideshow cost = chaal cost
Server: in tpRequestSideshow replace:

const cost = state.currentBet;
with the seen-multiplier formula used by chaal (server/game-engine.ts:1046):

const cost = (player.hasSeenCards ? 2 : 1) * state.currentBet;
Since the function already enforces hasSeenCards at line 1121, this resolves to 2 * state.currentBet in practice — but matching the chaal formula keeps the two costs in lockstep if the seen-only restriction is ever lifted.

Update the // Sideshow fee = 1× current stake comment on the line above accordingly.

Client: in TeenPattiActionBar.tsx:229 change the button label from {stake.toLocaleString()} to {chaalCost.toLocaleString()} (chaalCost is already computed at line 106). Done.

Feature 5 — Asymmetric reveal + public sideshow announcement
Server: persist who is allowed to see whose cards. Add a small per-hand registry on GameState:

// common/types.ts, inside GameState (after pendingSideshow)
sideshowReveals?: Array<{ viewerId: string; subjectId: string }>;
Initialize to [] in startTeenPattiHand (alongside the pendingSideshow: null reset). The list grows over the course of a hand — multiple sideshows can each grant a reveal — and is wiped at the next deal.

In the tpRespondSideshow accept branch, append exactly one entry granting the requester the right to see the responder's cards (regardless of who won the comparison — the requester paid the fee for the peek):

sideshowReveals: [
  ...(state.sideshowReveals ?? []),
  { viewerId: requester.id, subjectId: responder.id },
],
Note: we deliberately do not add the symmetric entry. The responder never gets to see the requester's cards — that's the asymmetry the user wants.

Server: extend the card visibility filter. In filterStateForPlayer, broaden the visible predicate so a player keeps their own cards visible AND any cards they're explicitly granted via sideshowReveals:

const grantedReveal = (state.sideshowReveals ?? []).some(
  r => r.viewerId === playerId && r.subjectId === p.id
);
const visible =
  (isOwn && ownCanSee) ||
  (isShowdown && !p.isFolded) ||
  p.wantsToShowCards ||
  grantedReveal;
This means: when player A's filtered state is computed, if A has a reveal entry for player B, A keeps B.holeCards. Everyone else (including B themselves looking at A's filtered state) is unaffected. The reveal lasts until the next hand reset (when sideshowReveals is cleared).

Edge case: when the sideshow loser is the responder, they get packed (isFolded: true). At showdown, folded players' cards are normally hidden — this is fine; the requester already keeps the reveal via grantedReveal. When the loser is the requester, they pack but keep seeing the responder's cards (good — they paid for the peek).

Client: render the revealed cards in the requester's UI. No render-side changes are strictly required if we already render player.holeCards whenever they're non-null. Verify in PlayerSeat and Teen Patti's seat rendering (client/src/screens/GameScreen.tsx:852-872) that opponents' cards are rendered when player.holeCards is present (not gated by isShowdown on the client). If the client gates on showdown, lift that gate so server-supplied cards always render.

Client: public announcement toast on accept. In TeenPattiLayout, keep a useRef of the previous gameState.pendingSideshow. On every render where the previous was { requesterId: R, targetId: T } and the current is null, inspect gameState.lastAction:

action === 'sideshow declined' → toast only on R's screen: "<T's name> declined your sideshow" (Bug 3a).
action === 'sideshow lost — packs' → toast on all screens: "<winner> won sideshow over <loser>". Loser id = lastAction.playerId; winner id = the other of {R, T}. Resolve names via gameState.players.
Both branches use the existing Sonner toast API (no new dependencies). Use toast.info(...) or a neutral variant — no card content is included in the toast (privacy preserved for non-participants).

Verification
Bugs 1 & 2 — three-tab Teen Patti. Open the game in three browser windows (A, B, C). With A as the active player:

Confirm A's bottom MobileSelfBar shows 3 hole cards after pressing "See cards" (Bug 1).
On B and C's screens, confirm A's bubble in the top OpponentBand flips from BLIND to SEEN immediately on A's "See cards" tap — without A taking any further action (Bug 2).
Bugs 3 & 4 — sideshow decline + cost. With three seen players A, B, C in the same hand:

On A's turn, tap Sideshow. Confirm the button label shows 2× stake (matching chaal cost), and that exactly that many chips are deducted from A and added to the pot (Bug 4).
On A's screen during pending, confirm A sees a "Waiting for [target] to respond to sideshow…" pill instead of the normal action bar.
On the target's screen, tap Decline.
On A's screen, confirm a toast appears: "[target] declined your sideshow" (Bug 3a).
On B's and C's screens, confirm no decline toast appears (only the requester is notified).
On A's screen, confirm the Sideshow button is no longer shown for the rest of the hand, and that the server rejects a manual REQUEST_SIDESHOW if dispatched via devtools (Bug 3b).
Start the next hand and confirm A can request sideshow again (the sideshowDeclined flag is reset).
Feature 5 — sideshow accept reveal + announcement. Same three-player setup:

A requests sideshow against B. B taps Accept.
On A's screen, confirm A now sees B's three hole cards (rendered face-up in B's seat). Reveal persists for the rest of the hand.
On B's screen, confirm B does not see A's cards (A's seat still face-down or hidden as before).
On C's screen, confirm C sees neither A's nor B's cards — only the toast.
On all three screens (A, B, C), confirm a toast appears: "[winner] won sideshow over [loser]". Toast contains no card content.
Verify both win directions: (a) requester wins → responder packs and is revealed to requester; (b) responder wins → requester packs and still sees responder's cards.
On the next hand, confirm sideshowReveals is cleared (no carry-over reveal in the new deal).
Regression — Poker. Confirm MobileSelfBar still shows 2 cards (array length naturally enforces this), and Texas Hold'em opponents still show the TURN badge for the active player.

Regression — Teen Patti. After A CHAALs, confirm opponents briefly see CHAAL on A's bubble (transient lastAction label) before it settles back to SEEN. Confirm sideshow ACCEPT path still works end-to-end (loser packs, turn continues from requester) and that no decline toast fires when the response was an accept. Confirm the existing showdown card-reveal still works (no leakage between sideshowReveals and showdown rendering).

Tests. No existing sideshow tests in tests/scenarios/teen-patti.ts — consider adding scenarios: (a) decline blocks subsequent sideshow request in same hand; (b) sideshow cost equals chaal cost for seen requester; (c) on accept, filterStateForPlayer reveals responder's cards to requester only. Optional but worth it.

Run npm run build (and any test command) before merging to catch type errors from the new Player.sideshowDeclined and GameState.sideshowReveals fields.