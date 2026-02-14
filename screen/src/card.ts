// ============================================
// 카드 생성 및 관리
// ============================================

import type { Card, Flower } from './types';
import { FLOWER_IMAGES } from './types';

// 56장 카드 생성 (각 꽃 14장)
export function createDeck(): Card[] {
  const flowers: Flower[] = ['rose', 'carnation', 'sunflower', 'daisy'];
  const distribution = [
    { count: 1, quantity: 5 },
    { count: 2, quantity: 3 },
    { count: 3, quantity: 3 },
    { count: 4, quantity: 2 },
    { count: 5, quantity: 1 },
  ];

  const deck: Card[] = [];
  let id = 0;

  for (const flower of flowers) {
    for (const { count, quantity } of distribution) {
      for (let i = 0; i < quantity; i++) {
        deck.push({ id: id++, flower, count });
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
  const imageSrc = FLOWER_IMAGES[card.flower];

  // Generate flowers with position classes for Halli Galli layout
  const flowerElements = [];
  for (let i = 0; i < card.count; i++) {
    flowerElements.push(`<img class="flower-icon flower-pos-${i + 1}" src="${imageSrc}" alt="${card.flower}" />`);
  }
  const flowers = flowerElements.join('');

  return `
    <div class="card" data-id="${card.id}" data-index="${index}" data-flower="${card.flower}">
      <div class="card-inner">
        <div class="card-front">
          <div class="card-fruits" data-count="${card.count}">${flowers}</div>
        </div>
        <div class="card-back"></div>
      </div>
    </div>
  `;
}
