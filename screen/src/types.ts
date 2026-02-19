// ============================================
// 타입 정의
// ============================================

export type Flower = 'rose' | 'carnation' | 'sunflower' | 'daisy';

export interface Card {
  id: number;
  flower: Flower;
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

export const FLOWER_IMAGES: Record<Flower, string> = {
  rose: './img/rose.png',
  carnation: './img/carnation.png',
  sunflower: './img/sunflower.png',
  daisy: './img/daisy.png',
};
