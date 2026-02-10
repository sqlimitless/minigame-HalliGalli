// ============================================
// 타입 정의
// ============================================

export type Fruit = 'banana' | 'strawberry' | 'lime' | 'plum';

export interface Card {
  id: number;
  fruit: Fruit;
  count: number;
}

export type GamePhase = 'ready' | 'shuffling' | 'distributing' | 'playing';

// 플레이어별 카드 더미
export interface PlayerDeck {
  playerIndex: number;
  cards: Card[];
}

export interface CardTarget {
  el: HTMLElement;
  targetX: number;
  targetY: number;
}

export const FRUIT_EMOJI: Record<Fruit, string> = {
  banana: '🍌',
  strawberry: '🍓',
  lime: '🍋',
  plum: '🍇',
};
