// ============================================
// 할리갈리 게임 로직
// ============================================

import type { Card, Flower } from './types';

// 게임 상태
interface GameState {
  currentTurn: number;  // 현재 턴인 플레이어 인덱스
  activePlayers: number[];  // 활성 플레이어 목록 (탈락하지 않은)
  playerDecks: Map<number, Card[]>;  // 각 플레이어의 카드 덱
  playedCards: Map<number, Card[]>;  // 각 플레이어가 낸 카드들 (앞면)
  centerCards: Card[];  // 중앙에 뒤집어진 남은 카드들
  isGameOver: boolean;
  winner: number | null;
}

const state: GameState = {
  currentTurn: -1,
  activePlayers: [],
  playerDecks: new Map(),
  playedCards: new Map(),
  centerCards: [],
  isGameOver: false,
  winner: null,
};

// Concurrency protection for ringBell
let bellInProgress = false;

// 콜백 함수들
let onTurnChange: ((playerIndex: number) => void) | null = null;
let onPlayerEliminated: ((playerIndex: number) => void) | null = null;
let onGameOver: ((winner: number) => void) | null = null;
let onBellResult: ((success: boolean, winnerOrLoser: number, flowerCount: Record<Flower, number>) => void) | null = null;

// 콜백 설정
export function setCallbacks(callbacks: {
  onTurnChange?: (playerIndex: number) => void;
  onPlayerEliminated?: (playerIndex: number) => void;
  onGameOver?: (winner: number) => void;
  onBellResult?: (success: boolean, winnerOrLoser: number, flowerCount: Record<Flower, number>) => void;
}): void {
  if (callbacks.onTurnChange) onTurnChange = callbacks.onTurnChange;
  if (callbacks.onPlayerEliminated) onPlayerEliminated = callbacks.onPlayerEliminated;
  if (callbacks.onGameOver) onGameOver = callbacks.onGameOver;
  if (callbacks.onBellResult) onBellResult = callbacks.onBellResult;
}

// 게임 초기화
export function initGame(playerIndices: number[], deck: Card[]): void {
  state.activePlayers = [...playerIndices];
  state.playerDecks = new Map();
  state.playedCards = new Map();
  state.centerCards = [];
  state.isGameOver = false;
  state.winner = null;
  bellInProgress = false;  // Reset bell state on new game

  const playerCount = playerIndices.length;
  const cardsPerPlayer = Math.floor(deck.length / playerCount);
  const totalDistributed = cardsPerPlayer * playerCount;

  // 각 플레이어 덱 초기화
  playerIndices.forEach(playerIdx => {
    state.playerDecks.set(playerIdx, []);
    state.playedCards.set(playerIdx, []);
  });

  // 라운드 로빈 방식으로 카드 분배 (애니메이션과 동일하게)
  for (let i = 0; i < totalDistributed; i++) {
    const playerIdx = playerIndices[i % playerCount];
    const playerDeck = state.playerDecks.get(playerIdx)!;
    playerDeck.push(deck[i]);
  }

  // 첫 번째 플레이어 턴 시작
  state.currentTurn = state.activePlayers[0];
}

// 현재 턴 가져오기
export function getCurrentTurn(): number {
  return state.currentTurn;
}

// 중앙 카드 설정 (deprecated - leftover cards now go to playedCards)
export function setCenterCards(cards: Card[]): void {
  state.centerCards = cards;
}

// 초기 플레이된 카드 설정 (leftover cards)
export function addToPlayedCards(playerIndex: number, card: Card): void {
  const played = state.playedCards.get(playerIndex) || [];
  played.push(card);
  state.playedCards.set(playerIndex, played);
}

// 플레이어가 카드를 낼 수 있는지 확인
export function canPlayCard(playerIndex: number): boolean {
  if (state.isGameOver) return false;
  if (state.currentTurn !== playerIndex) return false;

  const deck = state.playerDecks.get(playerIndex);
  return deck !== undefined && deck.length > 0;
}

// 카드 내기
export function playCard(playerIndex: number): Card | null {
  if (!canPlayCard(playerIndex)) return null;

  const deck = state.playerDecks.get(playerIndex)!;
  const card = deck.pop()!;

  // 낸 카드 더미에 추가
  const played = state.playedCards.get(playerIndex) || [];
  played.push(card);
  state.playedCards.set(playerIndex, played);

  // 덱이 비었는지 확인 (탈락 체크는 카드를 줄 때만)

  // 다음 턴으로
  nextTurn();

  return card;
}

// 다음 턴
function nextTurn(): void {
  const currentIdx = state.activePlayers.indexOf(state.currentTurn);
  const nextIdx = (currentIdx + 1) % state.activePlayers.length;
  state.currentTurn = state.activePlayers[nextIdx];

  if (onTurnChange) {
    onTurnChange(state.currentTurn);
  }
}

// 바닥에 놓인 모든 카드의 꽃 개수 세기
export function countFlowers(): Record<Flower, number> {
  const counts: Record<Flower, number> = {
    rose: 0,
    carnation: 0,
    sunflower: 0,
    daisy: 0,
  };

  // 각 플레이어의 맨 위 카드만 세기 (보이는 카드)
  state.playedCards.forEach((cards, playerIdx) => {
    if (cards.length > 0) {
      const topCard = cards[cards.length - 1];
      counts[topCard.flower] += topCard.count;
    }
  });

  return counts;
}

// 5개인 꽃이 있는지 확인
export function hasFiveOfAny(): boolean {
  const counts = countFlowers();
  const result = Object.values(counts).some(count => count === 5);
  return result;
}

// 종 치기
export function ringBell(playerIndex: number): { success: boolean; flowerCount: Record<Flower, number>; collectedCards?: Card[]; penaltyCards?: Map<number, Card> } {
  // Prevent concurrent bell processing
  if (bellInProgress) {
    console.log('🔔 ringBell blocked - already in progress');
    return { success: false, flowerCount: countFlowers() };
  }
  bellInProgress = true;

  const flowerCount = countFlowers();
  const success = hasFiveOfAny();
  let collectedCards: Card[] | undefined;
  let penaltyCards: Map<number, Card> | undefined;

  // 디버깅 로그
  const fiveOfAnyFlower = Object.entries(flowerCount)
    .filter(([_, count]) => count === 5)
    .map(([flower, _]) => flower);

  if (success) {
    // 성공: 바닥의 모든 카드를 가져감
    collectedCards = collectAllCards(playerIndex);
    // 성공한 플레이어에게 턴 넘기기
    state.currentTurn = playerIndex;
    if (onTurnChange) {
      onTurnChange(playerIndex);
    }
  } else {
    // 실패: 다른 플레이어들에게 카드 한 장씩 주기
    penaltyCards = penalizePlayer(playerIndex);
  }

  if (onBellResult) {
    onBellResult(success, playerIndex, flowerCount);
  }

  // 게임 종료 체크
  checkGameOver();

  bellInProgress = false;  // Reset flag after processing

  return { success, flowerCount, collectedCards, penaltyCards };
}

// 바닥의 모든 카드 수집
function collectAllCards(winnerIndex: number): Card[] {
  const winnerDeck = state.playerDecks.get(winnerIndex) || [];
  const collectedCards: Card[] = [];

  // 모든 플레이어의 낸 카드 수집
  state.playedCards.forEach((cards, playerIdx) => {
    collectedCards.push(...cards);
    state.playedCards.set(playerIdx, []);
  });

  // 섞어서 덱 맨 아래에 추가
  shuffleArray(collectedCards);
  state.playerDecks.set(winnerIndex, [...collectedCards, ...winnerDeck]);

  return collectedCards;
}

// 패널티: 다른 플레이어에게 카드 주기
function penalizePlayer(loserIndex: number): Map<number, Card> {
  const penaltyCards = new Map<number, Card>();
  const loserDeck = state.playerDecks.get(loserIndex);
  if (!loserDeck || loserDeck.length === 0) return penaltyCards;

  // 다른 활성 플레이어들에게 한 장씩 주기
  state.activePlayers.forEach(playerIdx => {
    if (playerIdx !== loserIndex && loserDeck.length > 0) {
      const card = loserDeck.pop()!;
      const targetDeck = state.playerDecks.get(playerIdx) || [];
      targetDeck.unshift(card);  // 맨 아래에 추가
      state.playerDecks.set(playerIdx, targetDeck);
      penaltyCards.set(playerIdx, card);
    }
  });

  // 탈락 체크
  if (loserDeck.length === 0) {
    eliminatePlayer(loserIndex);
  }

  return penaltyCards;
}

// 플레이어 탈락
function eliminatePlayer(playerIndex: number): void {
  const idx = state.activePlayers.indexOf(playerIndex);
  if (idx !== -1) {
    state.activePlayers.splice(idx, 1);

    // 탈락한 플레이어가 현재 턴이었다면 다음 턴으로
    if (state.currentTurn === playerIndex && state.activePlayers.length > 0) {
      const newIdx = Math.min(idx, state.activePlayers.length - 1);
      state.currentTurn = state.activePlayers[newIdx];

      // 턴 변경 콜백 호출 (UI/컨트롤러에 알림)
      if (onTurnChange) {
        onTurnChange(state.currentTurn);
      }
    }

    if (onPlayerEliminated) {
      onPlayerEliminated(playerIndex);
    }
  }
}

// 게임 종료 체크
function checkGameOver(): void {
  if (state.activePlayers.length === 1) {
    state.isGameOver = true;
    state.winner = state.activePlayers[0];

    if (onGameOver) {
      onGameOver(state.winner);
    }
  }
}

// 배열 섞기
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// 게터 함수들
export function getPlayerDeck(playerIndex: number): Card[] {
  return state.playerDecks.get(playerIndex) || [];
}

export function getPlayedCards(playerIndex: number): Card[] {
  return state.playedCards.get(playerIndex) || [];
}

export function getActivePlayers(): number[] {
  return [...state.activePlayers];
}

export function isGameOver(): boolean {
  return state.isGameOver;
}

export function getWinner(): number | null {
  return state.winner;
}

export function getPlayerCardCount(playerIndex: number): number {
  return (state.playerDecks.get(playerIndex)?.length || 0);
}

// Reset bell state (useful for game reset)
export function resetBellState(): void {
  bellInProgress = false;
}
