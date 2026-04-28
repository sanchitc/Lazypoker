import { GameState, Player, PlayerAction, Phase, Pot, Card, GameMode, HandSummary, HandWinner } from '../common/types.js';
import { DEFAULT_CONFIG } from '../common/constants.js';
import { Dealer } from './deck.js';
import { evaluateHand, compareHands } from './hand-evaluator.js';
import { generatePlayerId } from './utils.js';

export function createInitialState(roomCode: string, mode: GameMode): GameState {
  return {
    roomCode,
    mode,
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
    maxPlayers: DEFAULT_CONFIG.maxPlayers,
    lastAction: null,
    bettingRound: 0,
    actedThisRound: [],
    turnTimer: 0,
    allowPlayersAwardPot: false,
    lastHandSummary: null,
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
        hand: evaluateHand(p.holeCards!, state.communityCards),
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

  switch (action.type) {
    case 'START_HAND': {
      if (!player.isAdmin) return state;
      const active = getActivePlayers(state);
      if (active.length < 2) return state;

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
  return {
    ...state,
    players: state.players.map(p => {
      // Strip playerKey from broadcasts — it's a server-only analytics id.
      const { playerKey: _omit, ...rest } = p;
      void _omit;
      return {
        ...rest,
        holeCards:
          p.id === playerId ||
          (isShowdown && !p.isFolded) ||
          p.wantsToShowCards
            ? p.holeCards
            : null,
      };
    }),
  };
}
