// ============================================
// 카드 생성 및 관리
// ============================================

import type { Card, Fruit } from './types';
import { FRUIT_EMOJI } from './types';

// 56장 카드 생성 (각 과일 14장)
export function createDeck(): Card[] {
  const fruits: Fruit[] = ['banana', 'strawberry', 'lime', 'plum'];
  const distribution = [
    { count: 1, quantity: 5 },
    { count: 2, quantity: 3 },
    { count: 3, quantity: 3 },
    { count: 4, quantity: 2 },
    { count: 5, quantity: 1 },
  ];

  const deck: Card[] = [];
  let id = 0;

  for (const fruit of fruits) {
    for (const { count, quantity } of distribution) {
      for (let i = 0; i < quantity; i++) {
        deck.push({ id: id++, fruit, count });
      }
    }
  }

  return deck;
}

// Fisher-Yates 셔플
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 카드 HTML 렌더링
export function renderCard(card: Card, index: number): string {
  const emoji = FRUIT_EMOJI[card.fruit];
  const fruits = new Array(card.count).fill(emoji).join('');

  return `
    <div class="card" data-id="${card.id}" data-index="${index}" data-fruit="${card.fruit}">
      <div class="card-inner">
        <div class="card-front">
          <div class="card-fruits">${fruits}</div>
        </div>
        <div class="card-back"></div>
      </div>
    </div>
  `;
}
