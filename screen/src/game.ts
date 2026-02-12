// ============================================
// 게임 상태 및 렌더링
// ============================================

import type { Card, GamePhase } from './types';
import { createDeck, shuffleDeck, renderCard } from './card';
import { animateCardsEntrance, animateGameStart, animateCardDistribution, animateBellDescent, animateFlipRemainingCards, animateCardPlay, animateBellRace, animateCollectCards, animatePenaltyCards, updatePlayerCardStack, animateBellSuccess, animateBellFail } from './animation';
import { hideEmptySlots } from './player';
import {
  sendCardDealt, sendBellDescent, sendGameStart,
  sendTurnChange, sendYourTurn, sendBellResult,
  sendCardCountUpdate, sendCardsCollected, sendPenaltyCardReceived, sendPlayerEliminated, sendGameOver
} from './sdk';
import * as gameLogic from './gameLogic';

// 게임 상태
let gamePhase: GamePhase = 'ready';
let deck: Card[] = shuffleDeck(createDeck());
let activePlayers: number[] = [];

// 종 버튼 레이스 상태
interface BellHitInfo {
  playerIndex: number;
  timestamp: number;
}
let bellHits: BellHitInfo[] = [];
let bellRaceTimeout: ReturnType<typeof setTimeout> | null = null;
const BELL_RACE_WINDOW = 300; // 300ms 내 동시 입력 처리

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
  if (gamePhase !== 'ready') {
    return;
  }
  gamePhase = 'shuffling';

  const startBtn = document.getElementById('startBtn')!;
  startBtn.style.visibility = 'hidden';

  // 접속 안 한 플레이어 슬롯 쓸쓸하게 숨기기
  hideEmptySlots();

  // 활성 플레이어 목록 수집
  activePlayers = [];
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`player-${i}`);
    if (slot && slot.classList.contains('active')) {
      activePlayers.push(i);
    }
  }

  const deckGrid = document.getElementById('deckGrid')!;

  animateGameStart(deckGrid, () => {
    gamePhase = 'distributing';

    const playerCount = activePlayers.length;

    animateCardDistribution(playerCount, deck, sendCardDealt, () => {
      // 종 강림 애니메이션 (컨트롤러에도 동시 전송)
      sendBellDescent();
      animateBellDescent(() => {
        // 남은 카드 뒤집기
        animateFlipRemainingCards(() => {
          gamePhase = 'playing';

          // 게임 로직 초기화
          initGameLogic();

          sendGameStart();

          // 첫 번째 플레이어 턴 알림
          const firstTurn = gameLogic.getCurrentTurn();
          broadcastTurnChange(firstTurn);
        });
      });
    });
  });
}

// 게임 로직 초기화 및 콜백 설정
function initGameLogic(): void {
  // 게임 로직에 콜백 설정
  gameLogic.setCallbacks({
    onTurnChange: (playerIndex) => {
      broadcastTurnChange(playerIndex);
    },
    onPlayerEliminated: (playerIndex) => {
      sendPlayerEliminated(playerIndex);
    },
    onGameOver: (winner) => {
      gamePhase = 'ready';  // or 'ended'
      sendGameOver(winner);
    },
    onBellResult: (success, playerIndex, fruitCount) => {
      sendBellResult(success, playerIndex, fruitCount);

      // 컨트롤러에만 카드 수 업데이트 (DOM 업데이트는 애니메이션 후)
      activePlayers.forEach(pIdx => {
        const count = gameLogic.getPlayerCardCount(pIdx);
        sendCardCountUpdate(pIdx, count);
      });
    },
  });

  // 게임 로직 초기화
  gameLogic.initGame(activePlayers, deck);

  // 남은 카드(중앙 카드) 설정
  const playerCount = activePlayers.length;
  const cardsPerPlayer = Math.floor(deck.length / playerCount);
  const totalDistributed = cardsPerPlayer * playerCount;
  const remainingCards = deck.slice(totalDistributed);
  gameLogic.setCenterCards(remainingCards);
}

// 턴 변경 브로드캐스트
function broadcastTurnChange(currentTurn: number): void {
  sendTurnChange(currentTurn);

  // 각 플레이어에게 자신의 턴인지 알림
  activePlayers.forEach(playerIdx => {
    sendYourTurn(playerIdx, playerIdx === currentTurn);
  });

  // 화면에 현재 턴 표시
  highlightCurrentTurn(currentTurn);
}

// 현재 턴 플레이어 하이라이트
function highlightCurrentTurn(playerIndex: number): void {
  // 모든 슬롯에서 turn-active 제거
  document.querySelectorAll('.player-slot').forEach(slot => {
    slot.classList.remove('turn-active');
  });

  // 현재 턴 플레이어에 turn-active 추가
  const currentSlot = document.getElementById(`player-${playerIndex}`);
  if (currentSlot) {
    currentSlot.classList.add('turn-active');
  }
}

// 카드 플레이 처리 (main.ts에서 호출)
export function handleCardPlay(playerIndex: number, velocity: number): boolean {
  // 턴 체크
  if (!gameLogic.canPlayCard(playerIndex)) {
    return false;
  }

  // 카드 내기
  const card = gameLogic.playCard(playerIndex);
  if (!card) return false;

  // 화면에서 카드 애니메이션
  animateCardPlay(playerIndex, card, velocity);

  return true;
}

// 종 치기 처리 (main.ts에서 호출)
export function handleBellHit(playerIndex: number, timestamp: number): void {
  if (gamePhase !== 'playing') return;

  // 종 히트 수집
  bellHits.push({ playerIndex, timestamp });

  // 첫 번째 히트면 타임아웃 시작
  if (bellHits.length === 1) {
    bellRaceTimeout = setTimeout(() => {
      processBellRace();
    }, BELL_RACE_WINDOW);
  }
}

// 종 레이스 처리
function processBellRace(): void {
  if (bellHits.length === 0) return;

  // 타임스탬프 순으로 정렬
  bellHits.sort((a, b) => a.timestamp - b.timestamp);

  const winner = bellHits[0];
  const competitors = bellHits.slice(1);

  // 카드 스택 동기화 헬퍼 함수
  const syncCardStacks = () => {
    activePlayers.forEach(pIdx => {
      const count = gameLogic.getPlayerCardCount(pIdx);
      updatePlayerCardStack(pIdx, count);
    });
  };

  // 레이스 애니메이션 실행 후 결과 처리
  animateBellRace(winner.playerIndex, competitors.map(c => c.playerIndex), () => {
    // 게임 로직 처리
    const result = gameLogic.ringBell(winner.playerIndex);

    // 결과에 따른 애니메이션 처리
    if (result.success) {
      // 성공 애니메이션
      animateBellSuccess(winner.playerIndex);
      // 카드 수집 애니메이션
      animateCollectCards(winner.playerIndex);
      // 수집한 카드를 컨트롤러에 전송
      if (result.collectedCards) {
        sendCardsCollected(winner.playerIndex, result.collectedCards);
      }
      setTimeout(syncCardStacks, 600);
    } else {
      // 실패 애니메이션
      animateBellFail(winner.playerIndex);
      // 패널티 카드를 받은 플레이어들의 컨트롤러에 카드 전송
      if (result.penaltyCards) {
        result.penaltyCards.forEach((card, playerIdx) => {
          sendPenaltyCardReceived(playerIdx, card);
        });
      }
      // 페널티 카드 분배 애니메이션 완료 후 카드 스택 동기화
      const otherPlayers = activePlayers.filter(p => p !== winner.playerIndex);
      animatePenaltyCards(winner.playerIndex, otherPlayers, () => {
        syncCardStacks();
      });
    }
  });

  // 상태 초기화
  bellHits = [];
  bellRaceTimeout = null;
}

