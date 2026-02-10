// ============================================
// 게임 상태 및 렌더링
// ============================================

import type { Card, GamePhase } from './types';
import { createDeck, shuffleDeck, renderCard } from './card';
import { animateCardsEntrance, animateGameStart } from './animation';

// 게임 상태
let gamePhase: GamePhase = 'ready';
let deck: Card[] = shuffleDeck(createDeck());

export function getGamePhase(): GamePhase {
  return gamePhase;
}

export function setGamePhase(phase: GamePhase): void {
  gamePhase = phase;
}

export function getDeck(): Card[] {
  return deck;
}

// 게임 화면 렌더링
export function renderGame(container: HTMLElement, onStartGame: () => void): void {
  container.innerHTML = `
    <div class="game-container">
      <!-- 4개 모서리 플레이어 슬롯 -->
      <div class="player-slot top-left" id="player-0"></div>
      <div class="player-slot top-right" id="player-1"></div>
      <div class="player-slot bottom-left" id="player-2"></div>
      <div class="player-slot bottom-right" id="player-3"></div>

      <div class="deck-area">
        <div class="deck-grid" id="deckGrid">
          ${deck.map((card, index) => renderCard(card, index)).join('')}
        </div>
        <div class="center-deck" id="centerDeck"></div>
      </div>
      <button class="start-btn" id="startBtn">게임 시작</button>
    </div>
  `;

  // 시작 버튼 이벤트
  document.getElementById('startBtn')!.addEventListener('click', onStartGame);

  // 초기 애니메이션
  animateCardsEntrance();
}

// 게임 시작 처리
export function startGame(): void {
  if (gamePhase !== 'ready') return;
  gamePhase = 'shuffling';

  const startBtn = document.getElementById('startBtn')!;
  startBtn.style.visibility = 'hidden';

  const deckGrid = document.getElementById('deckGrid')!;

  animateGameStart(deckGrid, () => {
    gamePhase = 'playing';
    console.log('게임 준비 완료! 카드가 섞였습니다.');
  });
}
