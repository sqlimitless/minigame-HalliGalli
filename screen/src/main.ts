import { createScreen } from '@smoregg/sdk';
import { gsap } from 'gsap';

// ============================================
// 카드 데이터 구조
// ============================================

type Fruit = 'banana' | 'strawberry' | 'lime' | 'plum';

interface Card {
  id: number;
  fruit: Fruit;
  count: number;
}

const FRUIT_EMOJI: Record<Fruit, string> = {
  banana: '🍌',
  strawberry: '🍓',
  lime: '🍋',
  plum: '🍇',
};

// 카드 배경은 나중에 이미지로 교체 예정

// ============================================
// 56장 카드 생성
// ============================================

function createDeck(): Card[] {
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

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================
// 게임 상태
// ============================================

type GamePhase = 'ready' | 'shuffling' | 'playing';

let gamePhase: GamePhase = 'ready';
let deck = shuffleDeck(createDeck());

const appEl = document.getElementById('app')!;

// ============================================
// 카드 렌더링
// ============================================

function renderGame() {
  appEl.innerHTML = `
    <div class="game-container">
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
  document.getElementById('startBtn')!.addEventListener('click', startGame);

  // 초기 애니메이션: 카드가 순차적으로 나타남
  gsap.from('.card', {
    duration: 0.3,
    scale: 0,
    opacity: 0,
    stagger: 0.015,
    ease: 'back.out(1.7)',
  });
}

function renderCard(card: Card, index: number): string {
  const emoji = FRUIT_EMOJI[card.fruit];
  const fruits = new Array(card.count).fill(emoji).join('');

  return `
    <div class="card" data-id="${card.id}" data-index="${index}" data-fruit="${card.fruit}">
      <div class="card-inner">
        <div class="card-front">
          <div class="card-fruits">${fruits}</div>
          <div class="card-count">${card.count}</div>
        </div>
        <div class="card-back"></div>
      </div>
    </div>
  `;
}

// ============================================
// 게임 시작 애니메이션
// ============================================

async function startGame() {
  if (gamePhase !== 'ready') return;
  gamePhase = 'shuffling';

  const startBtn = document.getElementById('startBtn')!;
  startBtn.style.visibility = 'hidden';

  const cards = document.querySelectorAll('.card');
  const deckGrid = document.getElementById('deckGrid')!;

  // 화면 중앙 좌표 계산
  const containerRect = deckGrid.getBoundingClientRect();
  const centerX = containerRect.width / 2;
  const centerY = containerRect.height / 2;

  // 타임라인 생성
  const tl = gsap.timeline();

  // 1단계: 모든 카드 동시에 뒤집기
  tl.to('.card-inner', {
    rotateY: 180,
    duration: 0.5,
    ease: 'power2.inOut',
  });

  // 뒤집기 완료 후 0.5초 대기
  tl.addLabel('shuffleStart', '+=0.5');

  // 2단계 + 3단계: 각 카드가 랜덤 곡선으로 휘젓다가 가운데로 모임
  const shuffleDuration = 3;

  // 각 카드의 최종 목표 위치 미리 계산
  const cardTargets: { el: HTMLElement; targetX: number; targetY: number }[] = [];

  cards.forEach((card, index) => {
    const cardEl = card as HTMLElement;
    const rect = cardEl.getBoundingClientRect();
    const gridRect = deckGrid.getBoundingClientRect();

    const origX = rect.left - gridRect.left + rect.width / 2;
    const origY = rect.top - gridRect.top + rect.height / 2;

    // 최종 위치 (층층이 쌓임)
    const stackOffsetY = -index * 0.5;

    cardTargets.push({
      el: cardEl,
      targetX: centerX - origX,
      targetY: centerY - origY + stackOffsetY,
    });
  });

  // 각 카드마다 개별적으로 휘젓는 애니메이션
  cards.forEach((card, index) => {
    const target = cardTargets[index];

    // 각 카드마다 랜덤한 곡선 경로 파라미터
    const randomAngle = Math.random() * Math.PI * 2;
    const randomRadius = 150 + Math.random() * 250;
    const randomSpins = 1 + Math.random() * 2; // 몇 바퀴 돌지
    const rotationDir = Math.random() > 0.5 ? 1 : -1;

    tl.to(card, {
      duration: shuffleDuration,
      ease: 'power2.inOut',
      zIndex: index,
      onUpdate: function() {
        const p = this.progress();

        // 곡선 강도: 처음 0 → 중간 최대 → 끝 0 (기존 위치에서 부드럽게 시작)
        const curveFactor = Math.sin(p * Math.PI);
        const angle = randomAngle + p * Math.PI * 2 * randomSpins;
        const radius = randomRadius * curveFactor;

        const curveX = Math.cos(angle) * radius;
        const curveY = Math.sin(angle) * radius;

        // 기존 위치(0,0) → 곡선으로 휘젓기 → 목표 위치
        const x = target.targetX * p + curveX;
        const y = target.targetY * p + curveY;
        const r = rotationDir * 360 * p * randomSpins;

        gsap.set(card, { x, y, rotation: r });
      },
    }, index === 0 ? 'shuffleStart' : '<0.02'); // 첫 카드는 라벨에서 시작, 나머지는 살짝 시차
  });

  // 4단계: 0.3초 대기 후 정갈하게 정렬
  tl.addLabel('alignStart', '+=0.3');

  // 모든 카드를 깔끔하게 정렬 (회전 0, 정확한 위치)
  tl.to('.card', {
    x: (i) => cardTargets[i].targetX,
    y: (i) => cardTargets[i].targetY,
    rotation: 0,
    duration: 0.25,
    ease: 'power2.out',
    stagger: 0.01,
  }, 'alignStart');

  // 톡 치듯이 정돈 효과
  tl.to('.card', {
    y: (i) => cardTargets[i].targetY - 3,
    duration: 0.08,
    ease: 'power2.out',
  });

  tl.to('.card', {
    y: (i) => cardTargets[i].targetY,
    duration: 0.12,
    ease: 'bounce.out',
  });

  // 애니메이션 완료 후
  tl.call(() => {
    gamePhase = 'playing';
    console.log('게임 준비 완료! 카드가 섞였습니다.');
  });
}

// ============================================
// 초기화
// ============================================

renderGame();

// ============================================
// S'MORE SDK 연결
// ============================================

interface GameEvents {
  'bell-hit': { timestamp: number };
  [key: string]: Record<string, unknown>;
}

const screen = createScreen<GameEvents>({ debug: true });

screen.onAllReady(() => {
  console.log('Room ready:', screen.roomCode);
});

screen.onControllerJoin((playerIndex) => {
  console.log('Player joined:', playerIndex);
});

screen.on('bell-hit', (playerIndex, data) => {
  console.log(`Player ${playerIndex} hit the bell at ${data.timestamp}`);
});