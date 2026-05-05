import { GameState, Player, PlayerAction, Phase, Pot, Card, GameMode, GameVariant, HandSummary, HandWinner, TeenPattiVariation } from '../common/types.js';
import { DEFAULT_CONFIG, DEFAULT_TEEN_PATTI_CONFIG, TEEN_PATTI_MAX_PLAYERS } from '../common/constants.js';
import { Dealer } from './deck.js';
import { evaluateHand, compareHands } from './hand-evaluator.js';
import { evaluateTeenPattiHandFor, compareTeenPattiHands } from './teen-patti-evaluator.js';
import { generatePlayerId } from './utils.js';

export function createInitialState(roomCode: string, mode: GameMode, variant: GameVariant = 'poker'): GameState {
  const isTeenPatti = variant === 'teen-patti';
  return {
    roomCode,
    mode,
    variant,
    phase: 'SETUP',
    players: [],
    communityCards: [],
    pots: [{ amount: 0, eligiblePlayerIds: [] }],
    currentBet: 0,
    minRaise: DEFAULT_CONFIG.bigBlind,
    dealerSeatIndex: -1,
    activePlayerIndex: -1,
    smallBlind: DEFAULT_CONFIG.smallBlind,
    bigBlind: DEFAULT_CONFIG.bigBlind,
    handNumber: 0,
    startingChips: DEFAULT_CONFIG.startingChips,
    maxPlayers: isTeenPatti ? TEEN_PATTI_MAX_PLAYERS : DEFAULT_CONFIG.maxPlayers,
    lastAction: null,
    bettingRound: 0,
    actedThisRound: [],
    turnTimer: 0,
    allowPlayersAwardPot: false,
    lastHandSummary: null,
    teenPatti: isTeenPatti ? { ...DEFAULT_TEEN_PATTI_CONFIG } : undefined,
    pendingSideshow: null,
    showCallerId: null,
  };
}

export function addPlayer(state: GameState, name: string, isAdmin: boolean, playerKey?: string): { state: GameState; playerId: string } {
  const playerId = generatePlayerId();
  const player: Player = {
    id: playerId,
    name,
    seatIndex: -1, // unassigned
    chips: state.startingChips,
    currentBet: 0,
    totalBetThisHand: 0,
    holeCards: null,
    isDealer: false,
    isFolded: false,
    isAllIn: false,
    isSittingOut: false,
    isConnected: true,
    isAdmin,
    hasSeenCards: false,
    playerKey,
  };
  return {
    state: { ...state, players: [...state.players, player] },
    playerId,
  };
}

export function removePlayer(state: GameState, playerId: string): GameState {
  return { ...state, players: state.players.filter(p => p.id !== playerId) };
}

export function selectSeat(state: GameState, playerId: string, seatIndex: number): GameState {
  if (seatIndex < 0 || seatIndex >= state.maxPlayers) return state;
  if (state.players.some(p => p.seatIndex === seatIndex && p.id !== playerId)) return state;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId ? { ...p, seatIndex } : p
    ),
  };
}

// Get seated, active (not sitting out) players sorted by seat index
function getActivePlayers(state: GameState): Player[] {
  return state.players
    .filter(p => p.seatIndex >= 0 && !p.isSittingOut && p.chips > 0)
    .sort((a, b) => a.seatIndex - b.seatIndex);
}

function getPlayersInHand(state: GameState): Player[] {
  // Include all-in players (chips=0 but still contesting the pot) — getActivePlayers
  // would exclude them, which would prematurely end a hand at the moment of an all-in.
  return state.players
    .filter(p => p.seatIndex >= 0 && !p.isSittingOut && !p.isFolded && (p.chips > 0 || p.isAllIn))
    .sort((a, b) => a.seatIndex - b.seatIndex);
}

function getNextActivePlayerIndex(state: GameState, fromSeat: number): number {
  const players = getPlayersInHand(state);
  if (players.length === 0) return -1;

  // Find next player after fromSeat who hasn't folded and isn't all-in
  const sorted = players.sort((a, b) => a.seatIndex - b.seatIndex);
  const canAct = sorted.filter(p => !p.isAllIn);
  if (canAct.length === 0) return -1;

  for (const p of canAct) {
    if (p.seatIndex > fromSeat) return state.players.findIndex(pl => pl.id === p.id);
  }
  // Wrap around
  const first = canAct[0];
  return state.players.findIndex(p => p.id === first.id);
}

function getSmallBlindSeat(state: GameState): number {
  const active = getActivePlayers(state);
  if (active.length === 2) {
    // Heads-up: dealer is SB
    return state.dealerSeatIndex;
  }
  // First player after dealer
  const sorted = active.sort((a, b) => a.seatIndex - b.seatIndex);
  for (const p of sorted) {
    if (p.seatIndex > state.dealerSeatIndex) return p.seatIndex;
  }
  return sorted[0].seatIndex;
}

function getBigBlindSeat(state: GameState): number {
  const active = getActivePlayers(state);
  const sbSeat = getSmallBlindSeat(state);
  const sorted = active.sort((a, b) => a.seatIndex - b.seatIndex);
  for (const p of sorted) {
    if (p.seatIndex > sbSeat) return p.seatIndex;
  }
  return sorted[0].seatIndex;
}

function rotateDealerButton(state: GameState): GameState {
  const active = getActivePlayers(state);
  if (active.length === 0) return state;

  const sorted = active.sort((a, b) => a.seatIndex - b.seatIndex);

  let nextDealer: Player;
  if (state.dealerSeatIndex === -1) {
    // First hand: random dealer
    nextDealer = sorted[Math.floor(Math.random() * sorted.length)];
  } else {
    // Next player after current dealer
    const next = sorted.find(p => p.seatIndex > state.dealerSeatIndex);
    nextDealer = next || sorted[0];
  }

  return {
    ...state,
    dealerSeatIndex: nextDealer.seatIndex,
    players: state.players.map(p => ({
      ...p,
      isDealer: p.seatIndex === nextDealer.seatIndex,
    })),
  };
}

function postBlinds(state: GameState): GameState {
  const sbSeat = getSmallBlindSeat(state);
  const bbSeat = getBigBlindSeat(state);

  let newState = { ...state, players: state.players.map(p => ({ ...p })) };
  const mainPot = { amount: 0, eligiblePlayerIds: getActivePlayers(state).map(p => p.id) };

  for (const player of newState.players) {
    if (player.seatIndex === sbSeat) {
      const amount = Math.min(state.smallBlind, player.chips);
      player.chips -= amount;
      player.currentBet = amount;
      player.totalBetThisHand = amount;
      mainPot.amount += amount;
      if (player.chips === 0) player.isAllIn = true;
    }
    if (player.seatIndex === bbSeat) {
      const amount = Math.min(state.bigBlind, player.chips);
      player.chips -= amount;
      player.currentBet = amount;
      player.totalBetThisHand = amount;
      mainPot.amount += amount;
      if (player.chips === 0) player.isAllIn = true;
    }
  }

  newState.pots = [mainPot];
  newState.currentBet = state.bigBlind;
  newState.minRaise = state.bigBlind;

  return newState;
}

const dealer = new Dealer();

function dealHoleCards(state: GameState): GameState {
  dealer.shuffle();
  const active = getActivePlayers(state);
  const newPlayers = state.players.map(p => {
    if (active.find(a => a.id === p.id)) {
      const cards = dealer.deal(2) as [Card, Card];
      return { ...p, holeCards: cards };
    }
    return { ...p, holeCards: null };
  });
  return { ...state, players: newPlayers };
}

function dealCommunityCards(state: GameState, count: number): GameState {
  dealer.burn();
  const newCards = dealer.deal(count);
  return {
    ...state,
    communityCards: [...state.communityCards, ...newCards],
  };
}

function resetBettingRound(state: GameState): GameState {
  return {
    ...state,
    currentBet: 0,
    minRaise: state.bigBlind,
    actedThisRound: [],
    players: state.players.map(p => ({ ...p, currentBet: 0 })),
  };
}

function setFirstToAct(state: GameState, preflop: boolean): GameState {
  const active = getActivePlayers(state);
  if (active.length === 0) return state;

  let startSeat: number;
  if (preflop) {
    // First to act pre-flop: player after BB
    startSeat = getBigBlindSeat(state);
  } else {
    // First to act post-flop: first active player after dealer
    startSeat = state.dealerSeatIndex;
  }

  const nextIdx = getNextActivePlayerIndex(state, startSeat);
  return { ...state, activePlayerIndex: nextIdx };
}

function isBettingRoundComplete(state: GameState): boolean {
  const inHand = getPlayersInHand(state);
  const canAct = inHand.filter(p => !p.isAllIn);

  // If only one player remains (everyone else folded)
  if (inHand.length <= 1) return true;

  // If no one can act (everyone all-in or folded)
  if (canAct.length === 0) return true;

  // Every active player must have had a chance to act this round.
  // This ensures the BB gets their option on pre-flop even when all bets match.
  if (!canAct.every(p => state.actedThisRound.includes(p.id))) return false;

  // When there is an active bet, everyone must have matched it
  if (state.currentBet > 0) {
    return canAct.every(p => p.currentBet === state.currentBet);
  }

  // currentBet === 0: all have acted (checked), round is complete
  return true;
}

function returnUncalledBets(state: GameState): GameState {
  const inHand = getPlayersInHand(state);
  if (inHand.length < 2) return state;

  // Find the two highest totalBetThisHand among players still in hand
  const bets = inHand.map(p => p.totalBetThisHand).sort((a, b) => b - a);
  const highest = bets[0];
  const secondHighest = bets[1];

  if (highest > secondHighest) {
    const excess = highest - secondHighest;
    const bettor = inHand.find(p => p.totalBetThisHand === highest);
    if (bettor) {
      return {
        ...state,
        players: state.players.map(p =>
          p.id === bettor.id
            ? { ...p, chips: p.chips + excess, totalBetThisHand: p.totalBetThisHand - excess }
            : p
        ),
        pots: state.pots.map((pot, i) =>
          i === 0 ? { ...pot, amount: Math.max(0, pot.amount - excess) } : pot
        ),
      };
    }
  }
  return state;
}

function calculateSidePots(state: GameState): Pot[] {
  const inHand = getPlayersInHand(state);
  if (inHand.length === 0) return [{ amount: 0, eligiblePlayerIds: [] }];

  const allInAmounts = inHand
    .filter(p => p.isAllIn)
    .map(p => p.totalBetThisHand)
    .sort((a, b) => a - b);

  if (allInAmounts.length === 0) {
    // No side pots needed
    const totalPot = inHand.reduce((sum, p) => sum + p.totalBetThisHand, 0);
    return [{ amount: totalPot, eligiblePlayerIds: inHand.map(p => p.id) }];
  }

  const pots: Pot[] = [];
  let processedAmount = 0;

  const levels = [...new Set([...allInAmounts, Math.max(...inHand.map(p => p.totalBetThisHand))])];

  for (const level of levels) {
    const contribution = level - processedAmount;
    if (contribution <= 0) continue;

    const eligible = inHand.filter(p => p.totalBetThisHand >= level);
    const contributors = inHand.filter(p => p.totalBetThisHand > processedAmount);
    const potAmount = contributors.reduce((sum, p) => {
      return sum + Math.min(contribution, p.totalBetThisHand - processedAmount);
    }, 0);

    if (potAmount > 0) {
      pots.push({ amount: potAmount, eligiblePlayerIds: eligible.map(p => p.id) });
    }
    processedAmount = level;
  }

  return pots.length > 0 ? pots : [{ amount: 0, eligiblePlayerIds: [] }];
}

function determineWinners(state: GameState): GameState {
  const inHand = getPlayersInHand(state);
  if (inHand.length === 0) return state;

  // Single player remaining (everyone else folded)
  if (inHand.length === 1) {
    const winner = inHand[0];
    const totalPot = state.pots.reduce((sum, p) => sum + p.amount, 0);
    const summary: HandSummary = {
      handNumber: state.handNumber,
      winners: [{ playerId: winner.id, amount: totalPot }],
      totalAwarded: totalPot,
      reason: 'fold',
    };
    return {
      ...state,
      players: state.players.map(p =>
        p.id === winner.id ? { ...p, chips: p.chips + totalPot } : p
      ),
      pots: [{ amount: 0, eligiblePlayerIds: [] }],
      lastAction: { playerId: winner.id, action: `wins ${totalPot}` },
      lastHandSummary: summary,
    };
  }

  // Evaluate hands for full mode
  if (state.mode === 'full' && state.communityCards.length === 5) {
    const pots = calculateSidePots(state);
    let newPlayers = state.players.map(p => ({ ...p }));
    const winnerTotals = new Map<string, HandWinner>();
    let totalAwarded = 0;

    for (const pot of pots) {
      const eligible = pot.eligiblePlayerIds
        .map(id => inHand.find(p => p.id === id)!)
        .filter(p => p && p.holeCards);

      if (eligible.length === 0) continue;

      const results = eligible.map(p => ({
        player: p,
        hand: evaluateHand(p.holeCards as [Card, Card], state.communityCards),
      }));

      results.sort((a, b) => compareHands(b.hand, a.hand));
      const bestHand = results[0].hand;
      const winners = results.filter(r => compareHands(r.hand, bestHand) === 0);
      const share = Math.floor(pot.amount / winners.length);
      const remainder = pot.amount - share * winners.length;

      for (let i = 0; i < winners.length; i++) {
        const w = winners[i];
        const idx = newPlayers.findIndex(p => p.id === w.player.id);
        const award = share + (i === 0 ? remainder : 0);
        newPlayers[idx].chips += award;
        totalAwarded += award;

        const existing = winnerTotals.get(w.player.id);
        if (existing) {
          existing.amount += award;
        } else {
          winnerTotals.set(w.player.id, {
            playerId: w.player.id,
            amount: award,
            handDescription: w.hand.description,
            handRank: w.hand.rank,
          });
        }
      }
    }

    const summary: HandSummary = {
      handNumber: state.handNumber,
      winners: Array.from(winnerTotals.values()),
      totalAwarded,
      reason: 'showdown',
    };

    return {
      ...state,
      players: newPlayers,
      pots: [{ amount: 0, eligiblePlayerIds: [] }],
      lastHandSummary: summary,
    };
  }

  return state;
}

function advancePhase(state: GameState): GameState {
  const inHand = getPlayersInHand(state);

  // Everyone folded
  if (inHand.length <= 1) {
    let s = determineWinners(state);
    return { ...s, phase: 'HAND_COMPLETE' };
  }

  // Check if all remaining players are all-in (run out the board)
  const canAct = inHand.filter(p => !p.isAllIn);

  const nextPhases: Record<string, Phase> = {
    'PRE_FLOP': 'FLOP',
    'FLOP': 'TURN',
    'TURN': 'RIVER',
    'RIVER': 'SHOWDOWN',
  };

  const nextPhase = nextPhases[state.phase];
  if (!nextPhase) {
    return { ...state, phase: 'HAND_COMPLETE' };
  }

  let newState = resetBettingRound(state);
  newState.phase = nextPhase;

  if (state.mode === 'chip-only') {
    // Chip-only: advance through standard phases without dealing cards
    if (nextPhase === 'SHOWDOWN') {
      // After river betting, go to HAND_COMPLETE for manual winner declaration
      newState.phase = 'HAND_COMPLETE';
      newState.activePlayerIndex = -1;
      return newState;
    }

    // If all remaining players are all-in, skip straight to HAND_COMPLETE
    if (canAct.length === 0) {
      newState.phase = 'HAND_COMPLETE';
      newState.activePlayerIndex = -1;
      return newState;
    }

    // Pause for admin to start next street (physical cards need to be dealt)
    newState.activePlayerIndex = -1;
    newState.bettingRound++;
    return newState;
  }

  // Full mode: deal community cards
  if (nextPhase === 'FLOP') {
    newState = dealCommunityCards(newState, 3);
  } else if (nextPhase === 'TURN' || nextPhase === 'RIVER') {
    newState = dealCommunityCards(newState, 1);
  } else if (nextPhase === 'SHOWDOWN') {
    newState = determineWinners(newState);
    newState.phase = 'HAND_COMPLETE';
    return newState;
  }

  // If everyone can't act, skip to next phase
  if (canAct.length <= 1) {
    return advancePhase(newState);
  }

  newState = setFirstToAct(newState, false);
  return newState;
}

export function processAction(state: GameState, playerId: string, action: PlayerAction): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex];

  // Variant-specific action dispatch. Shared admin actions (ADD_CHIPS,
  // KICK_PLAYER, SET_DEALER, END_GAME, LEAVE_GAME, SHOW_CARDS) fall through
  // to the main switch below regardless of variant.
  if (state.variant === 'teen-patti') {
    switch (action.type) {
      case 'PACK': return tpPack(state, playerIndex);
      case 'CHAAL': return tpChaal(state, playerIndex);
      case 'RAISE_TP': return tpRaise(state, playerIndex, action.amount);
      case 'SEE_CARDS': return tpSeeCards(state, playerIndex);
      case 'REQUEST_SIDESHOW': return tpRequestSideshow(state, playerIndex);
      case 'RESPOND_SIDESHOW': return tpRespondSideshow(state, playerIndex, action.accept);
      case 'CALL_SHOW': return tpCallShow(state, playerIndex);
      case 'SET_NEXT_VARIATION': return tpSetNextVariation(state, playerId, action.variation);
      // Reject poker-only actions in Teen Patti rooms.
      case 'FOLD':
      case 'CHECK':
      case 'CALL':
      case 'RAISE':
      case 'ALL_IN':
        return state;
    }
  } else {
    // Reject Teen Patti actions in poker rooms.
    switch (action.type) {
      case 'PACK':
      case 'CHAAL':
      case 'RAISE_TP':
      case 'SEE_CARDS':
      case 'REQUEST_SIDESHOW':
      case 'RESPOND_SIDESHOW':
      case 'CALL_SHOW':
      case 'SET_NEXT_VARIATION':
        return state;
    }
  }

  switch (action.type) {
    case 'START_HAND': {
      const active = getActivePlayers(state);
      if (active.length < 2) return state;

      if (state.variant === 'teen-patti') {
        // Teen Patti: admin OR the predicted next dealer can deal.
        // Mirrors the client's getNextTeenPattiDealerId in GameScreen.tsx.
        const seated = state.players
          .filter(p => p.seatIndex >= 0 && !p.isSittingOut)
          .sort((a, b) => a.seatIndex - b.seatIndex);
        const nextDealer = state.dealerSeatIndex < 0
          ? seated[0]
          : (seated.find(p => p.seatIndex > state.dealerSeatIndex) ?? seated[0]);
        if (!player.isAdmin && player.id !== nextDealer?.id) return state;
        return startTeenPattiHand(state);
      }

      if (!player.isAdmin) return state;

      // Chip-only: block dealing if pot hasn't been awarded yet
      if (state.mode === 'chip-only') {
        const unawarded = state.pots.reduce((sum, p) => sum + p.amount, 0);
        if (unawarded > 0) return state;
      }

      let s = { ...state, players: state.players.map(p => ({ ...p })) };

      // Reset hand state
      s.handNumber++;
      s.communityCards = [];
      s.lastAction = null;
      s.lastHandSummary = null;
      s.bettingRound = 0;
      s.actedThisRound = [];
      for (const p of s.players) {
        p.currentBet = 0;
        p.totalBetThisHand = 0;
        p.isFolded = false;
        p.isAllIn = false;
        p.holeCards = null;
        p.wantsToShowCards = false;
      }

      s = rotateDealerButton(s);
      s = postBlinds(s);

      if (s.mode === 'full') {
        s = dealHoleCards(s);
      }
      s.phase = 'PRE_FLOP';
      s = setFirstToAct(s, true);

      return s;
    }

    case 'FOLD': {
      if (state.activePlayerIndex !== playerIndex) return state;
      const newPlayers = state.players.map((p, i) =>
        i === playerIndex ? { ...p, isFolded: true } : p
      );
      let s: GameState = {
        ...state,
        players: newPlayers,
        lastAction: { playerId, action: 'fold' },
        actedThisRound: [...state.actedThisRound, playerId],
      };

      const remaining = getPlayersInHand(s);
      if (remaining.length <= 1) {
        return advancePhase(s);
      }

      s.activePlayerIndex = getNextActivePlayerIndex(s, player.seatIndex);
      if (isBettingRoundComplete(s)) {
        return advancePhase(s);
      }
      return s;
    }

    case 'CHECK': {
      if (state.activePlayerIndex !== playerIndex) return state;
      if (player.currentBet < state.currentBet) return state; // Must call instead

      let s: GameState = {
        ...state,
        lastAction: { playerId, action: 'check' },
        actedThisRound: [...state.actedThisRound, playerId],
      };

      s.activePlayerIndex = getNextActivePlayerIndex(s, player.seatIndex);

      if (s.activePlayerIndex === -1 || isBettingRoundComplete(s)) {
        return advancePhase(s);
      }
      return s;
    }

    case 'CALL': {
      if (state.activePlayerIndex !== playerIndex) return state;
      const callAmount = Math.min(state.currentBet - player.currentBet, player.chips);
      const newPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              chips: p.chips - callAmount,
              currentBet: p.currentBet + callAmount,
              totalBetThisHand: p.totalBetThisHand + callAmount,
              isAllIn: p.chips - callAmount === 0,
            }
          : p
      );

      let s: GameState = {
        ...state,
        players: newPlayers,
        pots: state.pots.map((pot, i) =>
          i === 0 ? { ...pot, amount: pot.amount + callAmount } : pot
        ),
        lastAction: { playerId, action: 'call', amount: callAmount },
        actedThisRound: [...state.actedThisRound, playerId],
      };

      s.activePlayerIndex = getNextActivePlayerIndex(s, player.seatIndex);

      if (s.activePlayerIndex === -1 || isBettingRoundComplete(s)) {
        return advancePhase(s);
      }
      return s;
    }

    case 'RAISE': {
      if (state.activePlayerIndex !== playerIndex) return state;
      const raiseTotal = action.amount; // total bet amount
      if (raiseTotal < state.currentBet + state.minRaise && raiseTotal < player.chips + player.currentBet) {
        return state; // Invalid raise
      }
      const additional = Math.min(raiseTotal - player.currentBet, player.chips);

      const newPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              chips: p.chips - additional,
              currentBet: p.currentBet + additional,
              totalBetThisHand: p.totalBetThisHand + additional,
              isAllIn: p.chips - additional === 0,
            }
          : p
      );

      let s: GameState = {
        ...state,
        players: newPlayers,
        currentBet: player.currentBet + additional,
        minRaise: additional - (state.currentBet - player.currentBet) + state.minRaise,
        pots: state.pots.map((pot, i) =>
          i === 0 ? { ...pot, amount: pot.amount + additional } : pot
        ),
        lastAction: { playerId, action: 'raise', amount: raiseTotal },
        actedThisRound: [playerId], // reset — all others must re-act after a raise
      };

      s.activePlayerIndex = getNextActivePlayerIndex(s, player.seatIndex);
      return s;
    }

    case 'ALL_IN': {
      if (state.activePlayerIndex !== playerIndex) return state;
      const allInAmount = player.chips;
      const newBet = player.currentBet + allInAmount;

      const newPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              chips: 0,
              currentBet: newBet,
              totalBetThisHand: p.totalBetThisHand + allInAmount,
              isAllIn: true,
            }
          : p
      );

      let s: GameState = {
        ...state,
        players: newPlayers,
        currentBet: Math.max(state.currentBet, newBet),
        pots: state.pots.map((pot, i) =>
          i === 0 ? { ...pot, amount: pot.amount + allInAmount } : pot
        ),
        lastAction: { playerId, action: 'all-in', amount: allInAmount },
        actedThisRound: newBet > state.currentBet ? [playerId] : [...state.actedThisRound, playerId],
      };

      if (newBet > state.currentBet) {
        s.minRaise = newBet - state.currentBet;
      }

      s.activePlayerIndex = getNextActivePlayerIndex(s, player.seatIndex);

      if (s.activePlayerIndex === -1 || isBettingRoundComplete(s)) {
        return advancePhase(s);
      }
      return s;
    }

    case 'NEXT_ROUND': {
      if (state.mode !== 'chip-only') return state;
      // Any player can advance the street when betting is paused
      if (state.activePlayerIndex !== -1) return state;
      const validStreets: Phase[] = ['FLOP', 'TURN', 'RIVER'];
      if (!validStreets.includes(state.phase)) return state;

      let s = { ...state };
      s = setFirstToAct(s, false); // postflop action order (left of dealer)
      return s;
    }

    case 'DECLARE_WINNER': {
      if (!player.isAdmin && !state.allowPlayersAwardPot) return state;
      const winners = action.winnerIds;
      if (winners.length === 0) return state;

      // Return uncalled bets before calculating side pots
      let preState = returnUncalledBets(state);

      // Calculate proper side pots based on all-in amounts
      const pots = calculateSidePots(preState);
      let newPlayers = preState.players.map(p => ({ ...p }));
      let totalAwarded = 0;
      const winnerTotals = new Map<string, number>();

      for (const pot of pots) {
        // Find selected winners who are eligible for this pot
        const eligibleWinners = winners.filter(id => pot.eligiblePlayerIds.includes(id));

        if (eligibleWinners.length > 0) {
          const share = Math.floor(pot.amount / eligibleWinners.length);
          const remainder = pot.amount - share * eligibleWinners.length;
          for (let i = 0; i < eligibleWinners.length; i++) {
            const wid = eligibleWinners[i];
            const idx = newPlayers.findIndex(p => p.id === wid);
            if (idx >= 0) {
              const award = share + (i === 0 ? remainder : 0);
              newPlayers[idx].chips += award;
              winnerTotals.set(wid, (winnerTotals.get(wid) ?? 0) + award);
            }
          }
          totalAwarded += pot.amount;
        } else {
          // No selected winner is eligible — award to all non-folded eligible players
          const fallback = pot.eligiblePlayerIds.filter(id => {
            const p = preState.players.find(pl => pl.id === id);
            return p && !p.isFolded;
          });
          if (fallback.length > 0) {
            const share = Math.floor(pot.amount / fallback.length);
            const remainder = pot.amount - share * fallback.length;
            for (let i = 0; i < fallback.length; i++) {
              const wid = fallback[i];
              const idx = newPlayers.findIndex(p => p.id === wid);
              if (idx >= 0) {
                const award = share + (i === 0 ? remainder : 0);
                newPlayers[idx].chips += award;
                winnerTotals.set(wid, (winnerTotals.get(wid) ?? 0) + award);
              }
            }
            totalAwarded += pot.amount;
          }
        }
      }

      const winnerNames = winners.map(id => state.players.find(p => p.id === id)?.name || '?').join(', ');

      const summary: HandSummary = {
        handNumber: state.handNumber,
        winners: Array.from(winnerTotals.entries()).map(([playerId, amount]) => ({
          playerId,
          amount,
        })),
        totalAwarded,
        reason: 'declared',
      };

      return {
        ...state,
        players: newPlayers,
        pots: [{ amount: 0, eligiblePlayerIds: [] }],
        phase: 'HAND_COMPLETE',
        lastAction: { playerId, action: `${winnerNames} wins ${totalAwarded}` },
        lastHandSummary: summary,
      };
    }

    case 'ADD_CHIPS': {
      if (!player.isAdmin) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, chips: p.chips + action.amount } : p
        ),
      };
    }

    case 'REMOVE_CHIPS': {
      if (!player.isAdmin) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, chips: Math.max(0, p.chips - action.amount) } : p
        ),
      };
    }

    case 'KICK_PLAYER': {
      if (!player.isAdmin) return state;
      return removePlayer(state, action.playerId);
    }

    case 'SET_DEALER': {
      if (!player.isAdmin) return state;
      return {
        ...state,
        dealerSeatIndex: action.seatIndex,
        players: state.players.map(p => ({ ...p, isDealer: p.seatIndex === action.seatIndex })),
      };
    }

    case 'END_GAME': {
      if (!player.isAdmin) return state;
      return { ...state, phase: 'HAND_COMPLETE' };
    }

    case 'SHOW_CARDS': {
      // Toggle wantsToShowCards for this player (only meaningful at HAND_COMPLETE)
      if (state.phase !== 'HAND_COMPLETE') return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === playerId ? { ...p, wantsToShowCards: !p.wantsToShowCards } : p
        ),
      };
    }

    case 'LEAVE_GAME': {
      return removePlayer(state, playerId);
    }

    default:
      return state;
  }
}

export function filterStateForPlayer(state: GameState, playerId: string): GameState {
  const isShowdown = state.phase === 'SHOWDOWN' || state.phase === 'HAND_COMPLETE';
  const isTeenPatti = state.variant === 'teen-patti';
  return {
    ...state,
    players: state.players.map(p => {
      // Strip playerKey from broadcasts — it's a server-only analytics id.
      const { playerKey: _omit, ...rest } = p;
      void _omit;

      // Reveal own cards always except in Teen Patti while still blind (FR-14).
      // Reveal opponents' cards only at showdown when they didn't pack, or
      // when they explicitly toggled wantsToShowCards. Teen Patti also
      // grants per-hand sideshow peeks: the requester sees the responder's
      // cards (asymmetric) for the rest of the hand once a sideshow accepts.
      const isOwn = p.id === playerId;
      const ownCanSee = !isTeenPatti || !!p.hasSeenCards;
      const grantedReveal = (state.sideshowReveals ?? []).some(
        r => r.viewerId === playerId && r.subjectId === p.id
      );
      const visible =
        (isOwn && ownCanSee) ||
        (isShowdown && !p.isFolded) ||
        p.wantsToShowCards ||
        grantedReveal;

      return {
        ...rest,
        holeCards: visible ? p.holeCards : null,
      };
    }),
  };
}

// ============================================================
// Teen Patti engine
// ============================================================

function getTeenPattiActivePlayers(state: GameState): Player[] {
  return state.players
    .filter(p => p.seatIndex >= 0 && !p.isFolded && !p.isSittingOut)
    .sort((a, b) => a.seatIndex - b.seatIndex);
}

function nextTeenPattiActiveIndex(state: GameState, fromSeat: number): number {
  const active = getTeenPattiActivePlayers(state);
  if (active.length === 0) return -1;
  for (const p of active) {
    if (p.seatIndex > fromSeat) return state.players.findIndex(pl => pl.id === p.id);
  }
  return state.players.findIndex(p => p.id === active[0].id);
}

function previousTeenPattiActivePlayer(state: GameState, fromSeat: number): Player | null {
  const others = getTeenPattiActivePlayers(state).filter(p => p.seatIndex !== fromSeat);
  if (others.length === 0) return null;
  // Highest seat below fromSeat, else wrap to highest seat overall.
  let prev: Player | null = null;
  for (const p of others) {
    if (p.seatIndex < fromSeat) prev = p;
    else break;
  }
  return prev || others[others.length - 1];
}

function teenPattiPotLimitReached(state: GameState): boolean {
  if (!state.teenPatti) return false;
  const limit = state.teenPatti.boot * state.teenPatti.potLimitMultiplier;
  const pot = state.pots.reduce((sum, p) => sum + p.amount, 0);
  return pot >= limit;
}

function getNextTeenPattiDealerId(state: GameState): string | null {
  // Mirrors the client's getNextTeenPattiDealerId in GameScreen.tsx.
  const seated = state.players
    .filter(p => p.seatIndex >= 0 && !p.isSittingOut)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  if (seated.length === 0) return null;
  if (state.dealerSeatIndex < 0) return seated[0].id;
  return (seated.find(p => p.seatIndex > state.dealerSeatIndex) ?? seated[0]).id;
}

const VALID_TEEN_PATTI_VARIATIONS: ReadonlySet<TeenPattiVariation> = new Set([
  'classic', 'muflis', 'ak47', '999',
]);

function tpSetNextVariation(state: GameState, playerId: string, variation: TeenPattiVariation): GameState {
  if (state.variant !== 'teen-patti') return state;
  if (state.phase !== 'HAND_COMPLETE' && state.phase !== 'WAITING') return state;
  if (!VALID_TEEN_PATTI_VARIATIONS.has(variation)) return state;
  if (playerId !== getNextTeenPattiDealerId(state)) return state;
  return { ...state, nextHandVariation: variation };
}

function startTeenPattiHand(state: GameState): GameState {
  let s: GameState = { ...state, players: state.players.map(p => ({ ...p })) };

  s.handNumber++;
  s.communityCards = [];
  s.lastAction = null;
  s.lastHandSummary = null;
  s.bettingRound = 0;
  s.actedThisRound = [];
  s.pendingSideshow = null;
  s.sideshowReveals = [];
  s.showCallerId = null;
  s.currentVariation = s.nextHandVariation ?? 'classic';
  s.nextHandVariation = undefined;
  for (const p of s.players) {
    p.currentBet = 0;
    p.totalBetThisHand = 0;
    p.isFolded = false;
    p.isAllIn = false;
    p.holeCards = null;
    p.wantsToShowCards = false;
    p.hasSeenCards = false;
    p.sideshowDeclined = false;
    p.blindActionCount = 0;
  }

  s = rotateDealerButton(s);

  const boot = s.teenPatti?.boot ?? 10;
  const active = getActivePlayers(s);
  const eligibleIds = active.map(p => p.id);

  // Charge boot from each active player; seed main pot.
  let bootTotal = 0;
  s.players = s.players.map(p => {
    if (active.find(a => a.id === p.id)) {
      const amount = Math.min(boot, p.chips);
      bootTotal += amount;
      return {
        ...p,
        chips: p.chips - amount,
        totalBetThisHand: amount,
        isAllIn: p.chips - amount === 0,
      };
    }
    return p;
  });
  s.pots = [{ amount: bootTotal, eligiblePlayerIds: eligibleIds }];
  s.currentBet = boot; // stake reference (1× value)
  s.minRaise = boot;

  // Deal 3 cards each.
  dealer.shuffle();
  s.players = s.players.map(p => {
    if (active.find(a => a.id === p.id)) {
      return { ...p, holeCards: dealer.deal(3) };
    }
    return { ...p, holeCards: null };
  });

  s.phase = 'BETTING';
  s.activePlayerIndex = nextTeenPattiActiveIndex(s, s.dealerSeatIndex);

  return s;
}

function tpPack(state: GameState, playerIndex: number): GameState {
  if (state.activePlayerIndex !== playerIndex) return state;
  if (state.phase !== 'BETTING') return state;
  const player = state.players[playerIndex];

  let s: GameState = {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIndex ? { ...p, isFolded: true } : p
    ),
    lastAction: { playerId: player.id, action: 'pack' },
  };

  if (getTeenPattiActivePlayers(s).length === 1) {
    return resolveTeenPattiSingleSurvivor(s);
  }
  s.activePlayerIndex = nextTeenPattiActiveIndex(s, player.seatIndex);
  return s;
}

function tpSeeCards(state: GameState, playerIndex: number): GameState {
  if (state.activePlayerIndex !== playerIndex) return state;
  if (state.phase !== 'BETTING') return state;
  const player = state.players[playerIndex];
  if (player.hasSeenCards || player.isFolded) return state;

  return {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIndex ? { ...p, hasSeenCards: true } : p
    ),
    lastAction: { playerId: player.id, action: 'see' },
  };
}

function tpChaal(state: GameState, playerIndex: number): GameState {
  if (state.activePlayerIndex !== playerIndex) return state;
  if (state.phase !== 'BETTING') return state;
  const player = state.players[playerIndex];
  if (player.isFolded) return state;

  const cost = (player.hasSeenCards ? 2 : 1) * state.currentBet;
  if (cost > player.chips) return state;

  // Track blind plays so we can force a player into seen mode once they
  // hit the configured blindLimit. Boot is excluded — only chaal/raise
  // count. The flip happens after the action that hits the limit, so
  // their NEXT turn proceeds in seen mode (2× cost).
  const isBlind = !player.hasSeenCards;
  const blindLimit = state.teenPatti?.blindLimit ?? 0;
  const newBlindCount = isBlind ? (player.blindActionCount ?? 0) + 1 : (player.blindActionCount ?? 0);
  const forceSeen = isBlind && blindLimit > 0 && newBlindCount >= blindLimit;

  let s: GameState = {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIndex
        ? {
            ...p,
            chips: p.chips - cost,
            totalBetThisHand: p.totalBetThisHand + cost,
            isAllIn: p.chips - cost === 0,
            blindActionCount: newBlindCount,
            hasSeenCards: forceSeen ? true : p.hasSeenCards,
          }
        : p
    ),
    pots: state.pots.map((pot, i) =>
      i === 0 ? { ...pot, amount: pot.amount + cost } : pot
    ),
    lastAction: { playerId: player.id, action: isBlind ? 'blind' : 'chaal', amount: cost },
  };

  if (teenPattiPotLimitReached(s)) {
    return resolveTeenPattiShowdown(s, 'pot-limit', null);
  }
  s.activePlayerIndex = nextTeenPattiActiveIndex(s, player.seatIndex);
  return s;
}

function tpRaise(state: GameState, playerIndex: number, newStake: number): GameState {
  if (state.activePlayerIndex !== playerIndex) return state;
  if (state.phase !== 'BETTING') return state;
  if (!state.teenPatti) return state;
  const player = state.players[playerIndex];
  if (player.isFolded) return state;

  // newStake = the post-raise stake (1× value). Cost = 1× or 2× of newStake
  // depending on blind/seen. The chaalLimit caps total chips paid this turn.
  if (newStake <= state.currentBet) return state;
  const chaalLimit = state.teenPatti.chaalLimitMultiplier * state.currentBet;
  const cost = (player.hasSeenCards ? 2 : 1) * newStake;
  if (cost > chaalLimit) return state;
  if (cost > player.chips) return state;

  // Same blind-limit accounting as tpChaal — raises also count as blind plays.
  const isBlind = !player.hasSeenCards;
  const blindLimit = state.teenPatti.blindLimit ?? 0;
  const newBlindCount = isBlind ? (player.blindActionCount ?? 0) + 1 : (player.blindActionCount ?? 0);
  const forceSeen = isBlind && blindLimit > 0 && newBlindCount >= blindLimit;

  let s: GameState = {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIndex
        ? {
            ...p,
            chips: p.chips - cost,
            totalBetThisHand: p.totalBetThisHand + cost,
            isAllIn: p.chips - cost === 0,
            blindActionCount: newBlindCount,
            hasSeenCards: forceSeen ? true : p.hasSeenCards,
          }
        : p
    ),
    currentBet: newStake,
    minRaise: newStake,
    pots: state.pots.map((pot, i) =>
      i === 0 ? { ...pot, amount: pot.amount + cost } : pot
    ),
    lastAction: { playerId: player.id, action: 'raise', amount: cost },
  };

  if (teenPattiPotLimitReached(s)) {
    return resolveTeenPattiShowdown(s, 'pot-limit', null);
  }
  s.activePlayerIndex = nextTeenPattiActiveIndex(s, player.seatIndex);
  return s;
}

function tpRequestSideshow(state: GameState, playerIndex: number): GameState {
  if (state.activePlayerIndex !== playerIndex) return state;
  if (state.phase !== 'BETTING') return state;
  const player = state.players[playerIndex];
  if (player.isFolded) return state;
  if (!player.hasSeenCards) return state;
  if (player.sideshowDeclined) return state;

  const active = getTeenPattiActivePlayers(state);
  if (active.length < 3) return state; // sideshow disabled in heads-up

  const target = previousTeenPattiActivePlayer(state, player.seatIndex);
  if (!target) return state;
  if (!target.hasSeenCards) return state;

  // Sideshow fee matches chaal cost — keeps the two in lockstep if the
  // seen-only restriction is ever lifted (currently always 2× stake).
  const cost = (player.hasSeenCards ? 2 : 1) * state.currentBet;
  if (cost > player.chips) return state;

  return {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIndex
        ? {
            ...p,
            chips: p.chips - cost,
            totalBetThisHand: p.totalBetThisHand + cost,
            isAllIn: p.chips - cost === 0,
          }
        : p
    ),
    pots: state.pots.map((pot, i) =>
      i === 0 ? { ...pot, amount: pot.amount + cost } : pot
    ),
    pendingSideshow: { requesterId: player.id, targetId: target.id },
    phase: 'SIDESHOW_PENDING',
    lastAction: { playerId: player.id, action: 'sideshow request' },
  };
}

function tpRespondSideshow(state: GameState, playerIndex: number, accept: boolean): GameState {
  if (state.phase !== 'SIDESHOW_PENDING' || !state.pendingSideshow) return state;
  const responder = state.players[playerIndex];
  if (responder.id !== state.pendingSideshow.targetId) return state;

  const requesterIndex = state.players.findIndex(p => p.id === state.pendingSideshow!.requesterId);
  if (requesterIndex < 0) return state;
  const requester = state.players[requesterIndex];

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

  // Compare hands; the lower-ranked player packs. On tie, requester loses
  // (challenger needs strictly better hand).
  const variation = state.currentVariation ?? 'classic';
  const reqHand = evaluateTeenPattiHandFor(requester.holeCards as [Card, Card, Card], variation);
  const respHand = evaluateTeenPattiHandFor(responder.holeCards as [Card, Card, Card], variation);
  const cmp = compareTeenPattiHands(reqHand, respHand);
  const loserIndex = cmp >= 0 ? playerIndex : requesterIndex;
  const loser = state.players[loserIndex];

  let s: GameState = {
    ...state,
    pendingSideshow: null,
    phase: 'BETTING',
    players: state.players.map((p, i) =>
      i === loserIndex ? { ...p, isFolded: true } : p
    ),
    // The requester paid for the peek and gets to see the responder's cards
    // for the rest of the hand, regardless of who won the comparison.
    sideshowReveals: [
      ...(state.sideshowReveals ?? []),
      { viewerId: requester.id, subjectId: responder.id },
    ],
    lastAction: { playerId: loser.id, action: 'sideshow lost — packs' },
  };

  if (getTeenPattiActivePlayers(s).length === 1) {
    return resolveTeenPattiSingleSurvivor(s);
  }
  // Continue from the player after requester regardless of who packed.
  s.activePlayerIndex = nextTeenPattiActiveIndex(s, requester.seatIndex);
  return s;
}

function tpCallShow(state: GameState, playerIndex: number): GameState {
  if (state.activePlayerIndex !== playerIndex) return state;
  if (state.phase !== 'BETTING') return state;
  const caller = state.players[playerIndex];
  if (caller.isFolded) return state;

  const active = getTeenPattiActivePlayers(state);
  if (active.length !== 2) return state;

  const opponent = active.find(p => p.id !== caller.id);
  if (!opponent) return state;

  // PRD §6.4: a seen player cannot force a blind opponent to show.
  if (caller.hasSeenCards && !opponent.hasSeenCards) return state;

  // Cost matrix: blind/* = 1× stake, seen/seen = 2× stake.
  const costMultiplier = caller.hasSeenCards ? 2 : 1;
  const cost = costMultiplier * state.currentBet;
  if (cost > caller.chips) return state;

  let s: GameState = {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIndex
        ? {
            ...p,
            chips: p.chips - cost,
            totalBetThisHand: p.totalBetThisHand + cost,
            isAllIn: p.chips - cost === 0,
          }
        : p
    ),
    pots: state.pots.map((pot, i) =>
      i === 0 ? { ...pot, amount: pot.amount + cost } : pot
    ),
    showCallerId: caller.id,
    lastAction: { playerId: caller.id, action: 'show', amount: cost },
  };

  return resolveTeenPattiShowdown(s, 'show', caller.id);
}

function resolveTeenPattiSingleSurvivor(state: GameState): GameState {
  const remaining = getTeenPattiActivePlayers(state);
  if (remaining.length !== 1) return state;
  const winner = remaining[0];
  const totalPot = state.pots.reduce((sum, p) => sum + p.amount, 0);
  const summary: HandSummary = {
    handNumber: state.handNumber,
    winners: [{ playerId: winner.id, amount: totalPot }],
    totalAwarded: totalPot,
    reason: 'pack',
  };
  return {
    ...state,
    players: state.players.map(p =>
      p.id === winner.id ? { ...p, chips: p.chips + totalPot } : p
    ),
    pots: [{ amount: 0, eligiblePlayerIds: [] }],
    phase: 'HAND_COMPLETE',
    activePlayerIndex: -1,
    pendingSideshow: null,
    showCallerId: null,
    lastAction: { playerId: winner.id, action: `wins ${totalPot}` },
    lastHandSummary: summary,
  };
}

function resolveTeenPattiShowdown(
  state: GameState,
  reason: 'show' | 'sideshow' | 'pot-limit',
  callerId: string | null,
): GameState {
  const eligible = getTeenPattiActivePlayers(state);
  if (eligible.length === 0) return state;

  const variation = state.currentVariation ?? 'classic';
  const results = eligible.map(p => ({
    player: p,
    hand: evaluateTeenPattiHandFor(p.holeCards as [Card, Card, Card], variation),
  }));
  results.sort((a, b) => compareTeenPattiHands(b.hand, a.hand));

  const bestHand = results[0].hand;
  let winnerResults = results.filter(r => compareTeenPattiHands(r.hand, bestHand) === 0);

  // PRD D1: identical hands → show-caller loses (caller needs strictly better).
  if (callerId && reason === 'show' && winnerResults.length > 1) {
    const filtered = winnerResults.filter(w => w.player.id !== callerId);
    if (filtered.length > 0) winnerResults = filtered;
  }

  const totalPot = state.pots.reduce((sum, p) => sum + p.amount, 0);
  const share = Math.floor(totalPot / winnerResults.length);
  const remainder = totalPot - share * winnerResults.length;

  const newPlayers = state.players.map(p => ({ ...p }));
  const winnerSummaries: HandWinner[] = [];
  for (let i = 0; i < winnerResults.length; i++) {
    const w = winnerResults[i];
    const idx = newPlayers.findIndex(p => p.id === w.player.id);
    const award = share + (i === 0 ? remainder : 0);
    newPlayers[idx].chips += award;
    winnerSummaries.push({
      playerId: w.player.id,
      amount: award,
      handDescription: w.hand.description,
      handRank: w.hand.rank,
    });
  }

  return {
    ...state,
    players: newPlayers,
    pots: [{ amount: 0, eligiblePlayerIds: [] }],
    phase: 'HAND_COMPLETE',
    activePlayerIndex: -1,
    pendingSideshow: null,
    showCallerId: null,
    lastHandSummary: {
      handNumber: state.handNumber,
      winners: winnerSummaries,
      totalAwarded: totalPot,
      reason,
    },
  };
}
