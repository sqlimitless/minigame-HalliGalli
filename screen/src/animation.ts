// ============================================
// GSAP 애니메이션
// ============================================

import { gsap } from 'gsap';
import type { Card, CardTarget } from './types';

// 반응형 크기 계산 헬퍼 (vmin 기반)
const vmin = (v: number): number => Math.min(window.innerWidth, window.innerHeight) * v / 100;

// 전역 z-index 카운터 (새로 던진 카드가 항상 맨 위에 오도록)
let playedCardZIndex = 500;
const MAX_CARD_ZINDEX = 900;  // Keep below bell and UI elements (z-index 1000+)

// Z-index 리셋 함수 (게임 리셋 시 호출)
export function resetCardZIndex(): void {
  playedCardZIndex = 500;
}

// Sound utilities
let shuffleSound: HTMLAudioElement | null = null;
let shuffleSoundInterval: ReturnType<typeof setInterval> | null = null;

function startShuffleSound(): void {
  shuffleSound = new Audio('./sounds/flipcard.mp3');
  shuffleSound.volume = 1.0;

  // Play immediately
  shuffleSound.play().catch(() => {});

  // Repeat every 300ms for shuffle effect
  shuffleSoundInterval = setInterval(() => {
    const sound = new Audio('./sounds/flipcard.mp3');
    sound.volume = 1.0;
    sound.play().catch(() => {});
  }, 300);
}

function stopShuffleSound(): void {
  if (shuffleSoundInterval) {
    clearInterval(shuffleSoundInterval);
    shuffleSoundInterval = null;
  }
  if (shuffleSound) {
    shuffleSound.pause();
    shuffleSound = null;
  }
}

// 카드 등장 애니메이션
export function animateCardsEntrance(): void {
  gsap.from('.card', {
    duration: 0.3,
    scale: 0,
    opacity: 0,
    stagger: 0.015,
    ease: 'back.out(1.7)',
  });
}

// 게임 시작 애니메이션 (뒤집기 → 셔플)
export function animateGameStart(
  deckGrid: HTMLElement,
  onComplete: () => void
): void {
  const cards = document.querySelectorAll('.card');

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

  // 각 카드의 최종 목표 위치 계산
  const cardTargets = calculateCardTargets(cards, deckGrid, centerX, centerY);

  // 2단계: 각 카드가 랜덤 곡선으로 휘젓다가 가운데로 모임
  const shuffleDuration = 3;
  animateShuffleToCenter(tl, cards, cardTargets, shuffleDuration);

  // 애니메이션 완료 후
  tl.call(onComplete);
}

// 카드 목표 위치 계산
function calculateCardTargets(
  cards: NodeListOf<Element>,
  deckGrid: HTMLElement,
  centerX: number,
  centerY: number
): CardTarget[] {
  const cardTargets: CardTarget[] = [];

  cards.forEach((card, index) => {
    const cardEl = card as HTMLElement;
    const rect = cardEl.getBoundingClientRect();
    const gridRect = deckGrid.getBoundingClientRect();

    const origX = rect.left - gridRect.left + rect.width / 2;
    const origY = rect.top - gridRect.top + rect.height / 2;

    const stackOffsetY = -index * 0.5;

    cardTargets.push({
      el: cardEl,
      targetX: centerX - origX,
      targetY: centerY - origY + stackOffsetY,
    });
  });

  return cardTargets;
}

// 셔플하며 중앙으로 모이는 애니메이션
function animateShuffleToCenter(
  tl: gsap.core.Timeline,
  cards: NodeListOf<Element>,
  cardTargets: CardTarget[],
  duration: number
): void {
  cards.forEach((card, index) => {
    const target = cardTargets[index];

    // 각 카드마다 랜덤한 곡선 경로 파라미터
    const randomAngle = Math.random() * Math.PI * 2;
    const randomRadius = vmin(15) + Math.random() * vmin(25);
    const randomSpins = 1 + Math.random() * 2;
    const rotationDir = Math.random() > 0.5 ? 1 : -1;

    tl.to(card, {
      duration,
      ease: 'power2.inOut',
      zIndex: index,
      onUpdate: function () {
        const p = this.progress();

        // 곡선 강도: 처음 0 → 중간 최대 → 끝 0
        const curveFactor = Math.sin(p * Math.PI);
        const angle = randomAngle + p * Math.PI * 2 * randomSpins;
        const radius = randomRadius * curveFactor;

        const curveX = Math.cos(angle) * radius;
        const curveY = Math.sin(angle) * radius;

        const x = target.targetX * p + curveX;
        const y = target.targetY * p + curveY;
        // 마지막 20%에서 rotation을 0으로 서서히 감소
        const rotationProgress = p < 0.8 ? p / 0.8 : 1 - (p - 0.8) / 0.2;
        const r = rotationDir * 360 * rotationProgress * randomSpins;

        gsap.set(card, { x, y, rotation: r });
      },
    }, index === 0 ? 'shuffleStart' : '<0.02');
  });
}


// ============================================
// 카드 분배 애니메이션
// ============================================

export function animateCardDistribution(
  playerCount: number,
  deck: Card[],
  onCardDealt: (playerIndex: number, card: Card) => void,
  onComplete: () => void
): void {
  const cards = Array.from(document.querySelectorAll('.card')) as HTMLElement[];
  const totalCards = cards.length;

  // Start shuffle sound
  startShuffleSound();

  // 플레이어가 없으면 종료
  if (playerCount === 0) {
    onComplete();
    return;
  }

  // 모든 카드를 그리드에서 분리하여 absolute 포지셔닝으로 변경
  // 현재 화면상 위치(중앙 겹쳐진 상태)를 유지
  const deckGrid = document.getElementById('deckGrid');
  if (deckGrid) {
    const gridRect = deckGrid.getBoundingClientRect();

    // 1단계: 모든 카드 위치 먼저 캡처 (스타일 변경 전)
    const cardPositions = cards.map(card => {
      const rect = card.getBoundingClientRect();
      return {
        card,
        left: rect.left - gridRect.left,
        top: rect.top - gridRect.top,
      };
    });

    // 2단계: 모든 위치 캡처 후 스타일 일괄 적용
    cardPositions.forEach(({ card, left, top }) => {
      card.style.position = 'absolute';
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
      card.style.margin = '0';
      gsap.set(card, { clearProps: 'x,y,transform' });
    });
  }

  // 활성화된 플레이어 슬롯 가져오기 (실제 playerIndex 저장)
  const playerSlots: { el: HTMLElement; playerIndex: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`player-${i}`);
    if (slot && slot.classList.contains('active')) {
      playerSlots.push({ el: slot, playerIndex: i });
    }
  }

  if (playerSlots.length === 0) {
    onComplete();
    return;
  }

  // 각 플레이어에게 분배할 카드 수
  const cardsPerPlayer = Math.floor(totalCards / playerSlots.length);

  // 카드를 플레이어별로 분배 (라운드 로빈)
  const playerCards: { el: HTMLElement; card: Card }[][] = playerSlots.map(() => []);
  for (let i = 0; i < cardsPerPlayer * playerSlots.length; i++) {
    const playerIdx = i % playerSlots.length;
    playerCards[playerIdx].push({ el: cards[i], card: deck[i] });
    cards[i].dataset.owner = String(playerSlots[playerIdx].playerIndex);
  }

  const tl = gsap.timeline({
    onComplete: () => {
      stopShuffleSound();
      onComplete();
    }
  });

  // 0.3초 대기 후 분배 시작
  tl.addLabel('distributeStart', '+=0.3');

  // 각 플레이어에게 카드 묶음으로 빠르게 분배
  playerSlots.forEach((slotInfo, idx) => {
    const slotRect = slotInfo.el.getBoundingClientRect();
    const myCards = playerCards[idx];

    myCards.forEach((cardInfo, cardIdx) => {
      if (!cardInfo.el) {
        return;
      }

      const cardRect = cardInfo.el.getBoundingClientRect();

      // 현재 카드 위치에서 슬롯까지의 거리 계산
      const deltaX = slotRect.left + slotRect.width / 2 - (cardRect.left + cardRect.width / 2);
      const deltaY = slotRect.bottom + vmin(2) - (cardRect.top + cardRect.height / 2);

      // 현재 transform 값 가져오기
      const currentX = gsap.getProperty(cardInfo.el, 'x') as number;
      const currentY = gsap.getProperty(cardInfo.el, 'y') as number;

      // 카드 날아가는 애니메이션
      tl.to(cardInfo.el, {
        x: currentX + deltaX,
        y: currentY + deltaY + cardIdx * 0.3,
        rotation: (Math.random() - 0.5) * 8,
        scale: 0.7,
        duration: 0.4,
        ease: 'power2.out',
        onComplete: () => {
          // 컨트롤러에 카드 분배 이벤트 전송
          onCardDealt(slotInfo.playerIndex, cardInfo.card);
        },
      }, `distributeStart+=${idx * 0.15 + cardIdx * 0.1}`);
    });
  });

  // 분배 완료 후 정돈
  tl.addLabel('tidyUp', '+=0.2');

  playerSlots.forEach((_, idx) => {
    const myCards = playerCards[idx];
    myCards.forEach((cardInfo) => {
      if (!cardInfo.el) return;
      tl.to(cardInfo.el, {
        rotation: 0,
        duration: 0.15,
        ease: 'power2.out',
      }, 'tidyUp');
    });
  });

  // 남은 카드 처리 (분배되지 않은 카드) - 위치만 배치, 뒤집기는 종 강림 후
  const distributedCount = cardsPerPlayer * playerSlots.length;
  const remainingCards = cards.slice(distributedCount);

  if (remainingCards.length > 0) {
    tl.addLabel('placeRemaining', '+=0.3');

    // 덱 영역 중앙 (종 위치)
    const deckArea = document.querySelector('.deck-area');
    const deckRect = deckArea?.getBoundingClientRect();

    if (!deckRect) {
      return;
    }

    const bellCenterX = deckRect.width / 2;
    const bellCenterY = deckRect.height / 2;

    // 남은 카드를 플레이어 슬롯 방향으로 배치 (뒷면 그대로)
    remainingCards.forEach((card, i) => {
      // 남은 카드 표시
      card.dataset.remaining = 'true';

      // 몇 번째 플레이어 방향인지
      const targetPlayerIdx = i % playerSlots.length;
      const targetSlot = playerSlots[targetPlayerIdx].el;
      const slotRect = targetSlot.getBoundingClientRect();

      // 슬롯 중앙 위치 (덱 영역 기준)
      const slotCenterX = slotRect.left - deckRect.left + slotRect.width / 2;
      const slotCenterY = slotRect.top - deckRect.top + slotRect.height / 2;

      // 종에서 슬롯 방향으로의 벡터
      const dirX = slotCenterX - bellCenterX;
      const dirY = slotCenterY - bellCenterY;
      const dist = Math.sqrt(dirX * dirX + dirY * dirY);

      // 종에서 슬롯 방향으로 떨어진 위치
      const offsetDist = vmin(10);
      const targetX = bellCenterX + (dirX / dist) * offsetDist;
      const targetY = bellCenterY + (dirY / dist) * offsetDist;

      // 현재 카드 위치
      const cardRect = card.getBoundingClientRect();
      const cardOrigX = cardRect.left - deckRect.left + cardRect.width / 2;
      const cardOrigY = cardRect.top - deckRect.top + cardRect.height / 2;

      // 현재 transform 값
      const currentX = gsap.getProperty(card, 'x') as number;
      const currentY = gsap.getProperty(card, 'y') as number;

      // 이동량 계산
      const moveX = targetX - cardOrigX + currentX;
      const moveY = targetY - cardOrigY + currentY;

      // 슬롯 방향에 따른 회전 각도
      const rotationAngle = Math.atan2(dirY, dirX) * (180 / Math.PI) + 90;

      // 카드 이동 (뒷면 그대로)
      tl.to(card, {
        x: moveX,
        y: moveY,
        rotation: rotationAngle,
        scale: 0.85,
        duration: 0.4,
        ease: 'power2.out',
      }, `placeRemaining+=${i * 0.1}`);
    });
  }
}

// 남은 카드 뒤집기 애니메이션
export function animateFlipRemainingCards(onComplete: () => void): void {
  const remainingCards = document.querySelectorAll('.card[data-remaining="true"]');

  if (remainingCards.length === 0) {
    onComplete();
    return;
  }

  const tl = gsap.timeline({
    onComplete: () => {
      onComplete();
    }
  });

  remainingCards.forEach((card, i) => {
    const cardInner = card.querySelector('.card-inner') as HTMLElement;
    if (cardInner) {
      tl.to(cardInner, {
        rotateY: 0,
        duration: 0.4,
        ease: 'power2.out',
      }, i * 0.15);
    }
  });
}

// ============================================
// 성스러운 종 강림 애니메이션
// ============================================

export function animateBellDescent(onComplete: () => void): void {
  // Play holy spell cast sound for bell descent
  const holySound = new Audio('./sounds/holy-spell-cast.mp3');
  holySound.volume = 1.0;
  holySound.play().catch(() => {});

  // 덱 영역 중앙 위치 계산
  const deckArea = document.querySelector('.deck-area');
  const deckRect = deckArea?.getBoundingClientRect();
  const targetX = deckRect ? deckRect.left + deckRect.width / 2 : window.innerWidth / 2;
  const targetY = deckRect ? deckRect.top + deckRect.height / 2 - vmin(5) : window.innerHeight / 2 - vmin(5);

  // 컨테이너 생성
  const container = document.createElement('div');
  container.className = 'bell-container';
  container.innerHTML = `
    <div class="divine-light"></div>
    <div class="bell"><img src="./img/Bell.png" alt="Bell" /></div>
    <div class="bell-glow"></div>
  `;
  document.body.appendChild(container);

  const divineLight = container.querySelector('.divine-light') as HTMLElement;
  const bell = container.querySelector('.bell') as HTMLElement;
  const bellGlow = container.querySelector('.bell-glow') as HTMLElement;

  if (!divineLight || !bell || !bellGlow) {
    return;
  }

  // 빛과 종의 X 위치 설정
  divineLight.style.left = `${targetX}px`;
  divineLight.style.transform = 'translateX(-50%)';
  bell.style.left = `${targetX}px`;

  // 빛줄기 생성
  for (let i = 0; i < 12; i++) {
    const ray = document.createElement('div');
    ray.className = 'light-ray';
    ray.style.transform = `rotate(${i * 30}deg)`;
    container.appendChild(ray);
  }
  const rays = container.querySelectorAll('.light-ray');

  // 반짝이 파티클 생성 함수
  const createSparkle = () => {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    sparkle.style.left = `${targetX + (Math.random() - 0.5) * vmin(5)}px`;
    sparkle.style.top = `${gsap.getProperty(bell, 'top') as number + vmin(8)}px`;
    container.appendChild(sparkle);

    gsap.to(sparkle, {
      y: -vmin(5) - Math.random() * vmin(5),
      x: (Math.random() - 0.5) * vmin(10),
      opacity: 0,
      duration: 1 + Math.random() * 0.5,
      ease: 'power2.out',
      onComplete: () => sparkle.remove(),
    });
  };

  const tl = gsap.timeline({
    onComplete: () => {
      onComplete();
    }
  });

  // 1단계: 신성한 빛 내려옴
  tl.to(divineLight, {
    opacity: 1,
    duration: 0.8,
    ease: 'power2.out',
  });

  // 2단계: 종이 천천히 하강
  tl.to(bell, {
    top: targetY,
    duration: 2.5,
    ease: 'power1.inOut',
    onUpdate: function() {
      // 하강 중 반짝이 생성
      if (Math.random() > 0.85) {
        createSparkle();
      }
    },
  }, '-=0.3');

  // 3단계: 도착 시 글로우 효과
  tl.to(bellGlow, {
    opacity: 1,
    scale: 1.5,
    top: targetY + vmin(5),
    left: targetX,
    duration: 0.5,
    ease: 'power2.out',
  }, '-=0.5');

  // 4단계: 빛줄기 펼쳐짐
  tl.to(rays, {
    opacity: 0.8,
    height: vmin(25),
    top: targetY + vmin(5),
    left: targetX,
    duration: 0.6,
    stagger: 0.03,
    ease: 'power2.out',
  }, '-=0.3');

  // 5단계: 종 흔들림 + 펄스
  tl.to(bell, {
    keyframes: [
      { rotation: 15, duration: 0.15 },
      { rotation: -12, duration: 0.15 },
      { rotation: 8, duration: 0.12 },
      { rotation: -5, duration: 0.1 },
      { rotation: 0, duration: 0.1 },
    ],
    ease: 'power2.inOut',
  });

  // 글로우 펄스
  tl.to(bellGlow, {
    scale: 2,
    opacity: 0.3,
    duration: 0.4,
    ease: 'power2.out',
  }, '<');

  tl.to(bellGlow, {
    scale: 1.2,
    opacity: 0.8,
    duration: 0.3,
    ease: 'power2.inOut',
  });

  // 6단계: 신성한 빛 서서히 사라짐
  tl.to(divineLight, {
    opacity: 0,
    duration: 1,
    ease: 'power2.inOut',
  }, '-=0.2');

  tl.to(rays, {
    opacity: 0,
    duration: 0.8,
    ease: 'power2.inOut',
  }, '<');

  // 7단계: 종과 글로우 유지 (게임 중 계속 보임)
  tl.to(bellGlow, {
    opacity: 0.5,
    scale: 1,
    duration: 0.5,
  });

  // 종을 클릭 가능하게 설정 (위치 유지)
  tl.call(() => {
    // 불필요한 요소 제거
    divineLight.remove();
    bellGlow.remove();
    rays.forEach(ray => ray.remove());

    // 종 클릭 가능하게
    bell.style.cursor = 'pointer';
    bell.style.pointerEvents = 'auto';
    bell.style.transform = 'translateX(-50%)';
    container.style.pointerEvents = 'none';
  });
}

// ============================================
// 카드 플레이 애니메이션
// ============================================

export function animateCardPlay(
  playerIndex: number,
  card: Card,
  velocity: number
): void {
  // 플레이어의 카드 덱에서 맨 위 카드 찾기
  const playerCards = document.querySelectorAll(`.card[data-owner="${playerIndex}"]`);
  if (playerCards.length === 0) return;

  const cardEl = playerCards[playerCards.length - 1] as HTMLElement;
  const cardInner = cardEl.querySelector('.card-inner') as HTMLElement;

  // 덱 영역과 종 위치 가져오기
  const deckArea = document.querySelector('.deck-area');
  const bellEl = document.querySelector('.bell-container .bell, .bell');
  const deckRect = deckArea?.getBoundingClientRect();

  if (!deckRect) return;

  // 중앙 위치 (종 주변)
  const centerX = deckRect.width / 2;
  const centerY = deckRect.height / 2;

  // 플레이어 슬롯 방향 계산
  const playerSlot = document.getElementById(`player-${playerIndex}`);
  const slotRect = playerSlot?.getBoundingClientRect();

  let offsetX = 0;
  let offsetY = 0;

  if (slotRect && deckRect) {
    // 종에서 플레이어 방향으로 약간 떨어진 위치
    const slotCenterX = slotRect.left - deckRect.left + slotRect.width / 2;
    const slotCenterY = slotRect.top - deckRect.top + slotRect.height / 2;

    const dirX = slotCenterX - centerX;
    const dirY = slotCenterY - centerY;
    const dist = Math.sqrt(dirX * dirX + dirY * dirY);

    offsetX = (dirX / dist) * vmin(15);
    offsetY = (dirY / dist) * vmin(15);
  }

  // 현재 카드 위치
  const cardRect = cardEl.getBoundingClientRect();
  const cardOrigX = cardRect.left - deckRect.left + cardRect.width / 2;
  const cardOrigY = cardRect.top - deckRect.top + cardRect.height / 2;

  // 현재 transform 값
  const currentX = gsap.getProperty(cardEl, 'x') as number;
  const currentY = gsap.getProperty(cardEl, 'y') as number;

  // 목표 위치 (중앙 + 플레이어 방향 오프셋)
  const targetX = centerX + offsetX - cardOrigX + currentX;
  const targetY = centerY + offsetY - cardOrigY + currentY;

  // 빠른 스와이프는 목표를 넘어갔다 돌아오는 효과 - 더 극단적
  const overshootFactor = Math.min(velocity * 0.5, 2.5); // 속도에 비례, 최대 2.5
  const overshootX = offsetX * overshootFactor;
  const overshootY = offsetY * overshootFactor;

  // 속도에 따른 애니메이션 시간 - 더 극단적인 범위
  // 빠른 스와이프: 0.08초 (매우 빠름)
  // 느린 스와이프: 1.2초 (매우 느림)
  const baseDuration = Math.max(0.08, 1.2 / velocity);

  // 카드를 제일 위로 올리기 (매번 증가하는 z-index)
  // Reset if getting too high to prevent conflicts with UI elements
  if (playedCardZIndex >= MAX_CARD_ZINDEX) {
    playedCardZIndex = 500;
  }
  cardEl.style.zIndex = String(++playedCardZIndex);

  // 카드 애니메이션
  const tl = gsap.timeline();

  // 카드 뒤집기 + 이동 동시에
  tl.to(cardInner, {
    rotateY: 0,
    duration: baseDuration * 0.5,
    ease: velocity > 1.5 ? 'power3.out' : 'power2.out',  // 빠르면 더 날카로운 easing
  }, 0);

  // 빠른 스와이프면 오버슈트 효과
  if (velocity > 1.5) {
    // 먼저 오버슈트 위치로
    tl.to(cardEl, {
      x: targetX + overshootX,
      y: targetY + overshootY,
      scale: 1.05,
      rotation: (Math.random() - 0.5) * (10 + velocity * 20),  // 더 큰 회전
      duration: baseDuration * 0.7,
      ease: 'power2.out',
    }, 0);

    // 다시 원위치로 (바운스)
    tl.to(cardEl, {
      x: targetX,
      y: targetY,
      scale: 1,
      duration: baseDuration * 0.4,
      ease: 'back.out(1.7)',
    });
  } else {
    // 느린 스와이프는 기존처럼
    tl.to(cardEl, {
      x: targetX,
      y: targetY,
      scale: 1,
      rotation: (Math.random() - 0.5) * (10 + velocity * 20),  // 더 큰 회전
      duration: baseDuration,
      ease: 'power2.out',
    }, 0);
  }

  // 도착 효과
  tl.to(cardEl, {
    boxShadow: '0 0 20px rgba(255, 215, 0, 0.6)',
    duration: 0.1,
  });

  tl.to(cardEl, {
    boxShadow: '0 0 0px rgba(255, 215, 0, 0)',
    duration: 0.2,
  });

  // 카드 소유자 변경 (중앙 카드로)
  cardEl.dataset.owner = 'center';
  cardEl.dataset.played = 'true';
}

// ============================================
// 종 결과 애니메이션
// ============================================

// ============================================
// 종 레이스 애니메이션
// ============================================

export function animateBellRace(
  winnerIndex: number,
  competitorIndices: number[],
  onComplete: () => void
): void {
  const bell = document.querySelector('.bell-container .bell, .bell') as HTMLElement;
  if (!bell) {
    onComplete();
    return;
  }

  const bellRect = bell.getBoundingClientRect();
  const bellCenterX = bellRect.left + bellRect.width / 2;
  const bellCenterY = bellRect.top + bellRect.height / 2;

  // ALL participants array - treat winner as just another participant until reveal
  const allParticipantIndices = [winnerIndex, ...competitorIndices];
  const allSlots = allParticipantIndices
    .map(idx => ({ index: idx, el: document.getElementById(`player-${idx}`) }))
    .filter((item): item is { index: number; el: HTMLElement } => item.el !== null);

  if (allSlots.length === 0) {
    onComplete();
    return;
  }

  const totalPlayers = allSlots.length;

  const tl = gsap.timeline({
    onComplete: () => {
      onComplete();
    }
  });

  // Create ghosts for ALL participants (no distinction yet)
  const allGhosts = allSlots.map(({ el }) => {
    const avatar = el.querySelector('.player-avatar') as HTMLElement;
    const ghost = createRaceGhost(el, avatar);
    document.body.appendChild(ghost);
    return ghost;
  });

  // Set starting positions for all ghosts
  allSlots.forEach(({ el }, i) => {
    const rect = el.getBoundingClientRect();
    gsap.set(allGhosts[i], {
      left: rect.left + rect.width / 2,
      top: rect.top + rect.height / 2,
    });
  });

  // 1단계: 준비 이펙트 (ALL slots highlighted equally - neutral color)
  allSlots.forEach(({ el }) => {
    tl.to(el, {
      boxShadow: '0 0 18px rgba(100, 200, 255, 0.7)',
      duration: 0.1,
    }, 0);
  });

  // 2단계: VS 대결 연출 (Fighting Game Style) - ALL participants shown equally
  if (totalPlayers > 1) {
    // Phase 1: Dramatic Entry with Flash
    tl.addLabel('flash', '+=0.2');

    // White screen flash
    const flashOverlay = document.createElement('div');
    flashOverlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: white;
      z-index: 2100;
      pointer-events: none;
    `;
    document.body.appendChild(flashOverlay);

    tl.to(flashOverlay, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => flashOverlay.remove(),
    }, 'flash');

    // VS 대결 컨테이너 생성 (ALL participants shown equally in split screen)
    const vsContainer = createEqualVSDisplay(allSlots, totalPlayers, winnerIndex);
    document.body.appendChild(vsContainer);

    // Phase 2: Face-off Setup - ALL characters enter their sections
    tl.addLabel('slideIn', 'flash+=0.1');

    const allChars = vsContainer.querySelectorAll('.vs-participant') as NodeListOf<HTMLElement>;
    const vsText = vsContainer.querySelector('.vs-text') as HTMLElement;
    const sectionBgs = vsContainer.querySelectorAll('.vs-section-bg') as NodeListOf<HTMLElement>;

    // Section backgrounds fade in (or conic background for 3 players)
    if (totalPlayers === 3) {
      const conicBg = vsContainer.querySelector('.vs-conic-background') as HTMLElement;
      if (conicBg) {
        tl.to(conicBg, {
          opacity: 1,
          duration: 0.3,
        }, 'slideIn');
      }
    } else {
      sectionBgs.forEach((bg) => {
        tl.to(bg, {
          opacity: 1,
          duration: 0.3,
        }, 'slideIn');
      });
    }

    // ALL characters slide into their equal sections
    allChars.forEach((char, i) => {
      const section = Math.floor(i);
      const slideDirection = getSectionSlideDirection(section, totalPlayers);

      tl.fromTo(char, {
        x: slideDirection.x * vmin(50),
        y: slideDirection.y * vmin(30),
        opacity: 0,
      }, {
        x: 0,
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: 'power3.out',
      }, `slideIn+=${i * 0.1}`);
    });

    // VS text appears with scale
    tl.fromTo(vsText, {
      scale: 0,
      rotation: -10,
      opacity: 0,
    }, {
      scale: 1,
      rotation: 0,
      opacity: 1,
      duration: 0.3,
      ease: 'back.out(1.7)',
    }, 'slideIn+=0.3');

    // Phase 3: 투닥투닥 Fighting - ALL push toward center equally
    tl.addLabel('fight', '+=0.3');

    // 5 rounds of fighting with increasing intensity - NO ONE dominates yet
    for (let i = 0; i < 5; i++) {
      const pushLabel = `push${i}`;
      const intensity = 1 + i * 0.3;
      tl.addLabel(pushLabel, i === 0 ? 'fight' : `+=${0.35 - i * 0.02}`);

      // ALL participants push toward center equally
      allChars.forEach((char, idx) => {
        const pushDir = getCharacterPushDirection(idx, totalPlayers);
        tl.to(char, {
          x: pushDir.x * vmin(4) * intensity,
          y: pushDir.y * vmin(2) * intensity,
          rotation: pushDir.rotation * 5 * intensity,
          duration: 0.08,
          ease: 'power2.out',
        }, pushLabel);
      });

      // Screen shake during collision
      tl.to(vsContainer, {
        x: `random(-${vmin(0.8) * intensity}, ${vmin(0.8) * intensity})`,
        y: `random(-${vmin(0.5) * intensity}, ${vmin(0.5) * intensity})`,
        duration: 0.05,
        repeat: 2,
        yoyo: true,
      }, `${pushLabel}+=0.08`);

      // Impact spark at collision point
      tl.call(() => {
        createFightingSpark(vsContainer, intensity);
      }, [], `${pushLabel}+=0.08`);

      // Pull back to starting positions
      tl.to(allChars, {
        x: 0,
        y: 0,
        rotation: 0,
        duration: 0.12,
        ease: 'power1.inOut',
      }, `${pushLabel}+=0.18`);

      // Reset container position
      tl.to(vsContainer, {
        x: 0,
        y: 0,
        duration: 0.05,
      }, `${pushLabel}+=0.18`);
    }

    // Phase 4: Winner Reveal with Burst - THIS IS WHERE WE REVEAL!
    tl.addLabel('reveal', '+=0.2');

    // Brief freeze
    tl.to({}, { duration: 0.15 }, 'reveal');

    // Winner BURSTS with gold glow (first participant is the winner)
    const winnerChar = allChars[0];
    const loserChars = Array.from(allChars).slice(1);

    tl.to(winnerChar, {
      scale: 1.5,
      filter: 'drop-shadow(0 0 30px rgba(255, 215, 0, 1)) brightness(1.5) saturate(1.3)',
      duration: 0.5,
      ease: 'back.out(2)',
    }, 'reveal+=0.15');

    // Starburst effect behind winner
    tl.call(() => {
      createStarburstEffect(winnerChar);
    }, [], 'reveal+=0.15');

    // All losers darken and shrink
    loserChars.forEach((char, idx) => {
      const pushDir = getCharacterPushDirection(idx + 1, totalPlayers);
      tl.to(char, {
        x: pushDir.x * vmin(15),
        y: pushDir.y * vmin(10),
        scale: 0.6,
        filter: 'grayscale(1) brightness(0.5)',
        opacity: 0.5,
        duration: 0.5,
        ease: 'power2.in',
      }, 'reveal+=0.15');
    });

    // VS text fades out
    tl.to(vsText, {
      opacity: 0,
      scale: 0.8,
      duration: 0.3,
    }, 'reveal+=0.25');

    // Phase 5: Cleanup
    tl.addLabel('cleanup', '+=0.6');

    tl.to(vsContainer, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => vsContainer.remove(),
    }, 'cleanup');

    // 종으로 돌진 (빠르게) - winner first, then losers
    tl.addLabel('race', '-=0.2');

    // Winner ghost
    tl.to(allGhosts[0], {
      left: bellCenterX,
      top: bellCenterY,
      scale: 1.5,
      duration: 0.2,
      ease: 'power4.in',
    }, 'race');

    // Loser ghosts
    allGhosts.slice(1).forEach((ghost, i) => {
      tl.to(ghost, {
        left: bellCenterX + (Math.random() - 0.5) * vmin(3),
        top: bellCenterY + (Math.random() - 0.5) * vmin(3),
        scale: 1.4,
        duration: 0.25 + i * 0.02,
        ease: 'power4.in',
      }, 'race');
    });

    // 3단계: 충돌!
    tl.addLabel('impact', '-=0.05');

    tl.to(bell, {
      scale: 1.4,
      duration: 0.08,
    }, 'impact');

    tl.call(() => {
      createImpactEffect(bellCenterX, bellCenterY);
    }, [], 'impact');

    // 경쟁자들 튕겨나감
    allGhosts.slice(1).forEach((ghost, i) => {
      const angle = (i + 1) * (360 / allGhosts.length) * (Math.PI / 180);
      const distance = vmin(15) + Math.random() * vmin(5);

      tl.to(ghost, {
        left: bellCenterX + Math.cos(angle) * distance,
        top: bellCenterY + Math.sin(angle) * distance,
        scaleX: 0.3,
        scaleY: 1.5,
        rotation: (Math.random() - 0.5) * 180,
        opacity: 0,
        duration: 0.4,
        ease: 'power2.out',
        onComplete: () => ghost.remove(),
      }, 'impact');
    });

    tl.to(allGhosts[0], {
      scale: 2.5,
      duration: 0.2,
    }, 'impact');

    // 승자 주변 빛 효과
    tl.call(() => {
      const glow = document.createElement('div');
      glow.style.cssText = `
        position: fixed;
        left: ${bellCenterX}px;
        top: ${bellCenterY}px;
        width: ${vmin(30)}px;
        height: ${vmin(30)}px;
        background: radial-gradient(circle, rgba(255,215,0,0.6) 0%, transparent 70%);
        transform: translate(-50%, -50%);
        z-index: 1998;
        pointer-events: none;
      `;
      document.body.appendChild(glow);
      gsap.to(glow, {
        scale: 2,
        opacity: 0,
        duration: 0.5,
        onComplete: () => glow.remove(),
      });
    });

    tl.to(allGhosts[0], {
      scale: 1.5,
      duration: 0.15,
    });

  } else {
    // 경쟁 없이 혼자 - 빠르게 도착
    tl.to(allGhosts[0], {
      left: bellCenterX,
      top: bellCenterY,
      scale: 1.8,
      duration: 0.2,
      ease: 'power4.in',
    });

    tl.to(bell, {
      scale: 1.3,
      duration: 0.08,
    }, '-=0.05');
  }

  // 4단계: 종 울림 + 결과
  tl.to(bell, {
    scale: 1,
    duration: 0.15,
  });

  tl.to(bell, {
    keyframes: [
      { rotation: 15, duration: 0.08 },
      { rotation: -12, duration: 0.08 },
      { rotation: 8, duration: 0.06 },
      { rotation: -5, duration: 0.06 },
      { rotation: 0, duration: 0.05 },
    ],
  });

  // 슬롯 원래대로 (인라인 스타일 완전 제거)
  const allSlotEls = allSlots.map(s => s.el);
  tl.to(allSlotEls, {
    boxShadow: 'none',
    duration: 0.2,
  }, '-=0.2');

  // 애니메이션 종료 시 모든 슬롯의 GSAP 속성 제거
  tl.call(() => {
    gsap.set(allSlotEls, { clearProps: 'all' });
  });

  // 승자 고스트 제거
  tl.to(allGhosts[0], {
    opacity: 0,
    scale: 0,
    duration: 0.2,
    onComplete: () => allGhosts[0].remove(),
  }, '-=0.1');

  // 승자 슬롯 하이라이트
  tl.call(() => {
    showWinnerHighlight(winnerIndex);
  });
}

// Equal VS Display - ALL participants shown in split screen layout
function createEqualVSDisplay(
  allSlots: Array<{ index: number; el: HTMLElement }>,
  totalPlayers: number,
  winnerIndex: number
): HTMLElement {
  // Main VS container
  const container = document.createElement('div');
  container.className = 'vs-display-container equal-split-style';
  container.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2050;
    pointer-events: none;
    display: ${getSplitLayoutDisplay(totalPlayers)};
  `;

  if (totalPlayers === 3) {
    // For 3 players: use conic-gradient background instead of individual section divs
    const conicBg = document.createElement('div');
    conicBg.className = 'vs-conic-background';
    conicBg.style.cssText = `
      position: absolute;
      inset: 0;
      background: conic-gradient(
        from 300deg,
        #ff4444 0deg 120deg,
        #ffdd44 120deg 240deg,
        #44dd44 240deg 360deg
      );
      opacity: 0;
    `;
    container.appendChild(conicBg);

    // Create characters positioned absolutely at their section centers
    allSlots.forEach((slotInfo, index) => {
      const slot = slotInfo.el;
      const avatar = slot.querySelector('.player-avatar') as HTMLElement;
      const name = slot.querySelector('.player-name') as HTMLElement;
      const avatarStyle = avatar?.style.backgroundImage || '';
      const text = avatar?.textContent || '👤';
      const nickname = name?.textContent || 'Player';

      const char = createEqualSplitCharacter(
        avatarStyle,
        text,
        nickname,
        index,
        totalPlayers,
        false // Don't reveal winner status yet
      );
      container.appendChild(char);
    });
  } else {
    // For 2 or 4 players: use individual colored section backgrounds
    const colors = ['#ff4444', '#ffdd44', '#44dd44', '#4444ff'];
    allSlots.forEach((slotInfo, index) => {
      const sectionBg = document.createElement('div');
      sectionBg.className = `vs-section-bg section-${index}`;
      sectionBg.style.cssText = `
        position: relative;
        background: ${colors[index]};
        opacity: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        ${getSectionStyle(index, totalPlayers)}
      `;

      // Create character inside this section
      const slot = slotInfo.el;
      const avatar = slot.querySelector('.player-avatar') as HTMLElement;
      const name = slot.querySelector('.player-name') as HTMLElement;
      const avatarStyle = avatar?.style.backgroundImage || '';
      const text = avatar?.textContent || '👤';
      const nickname = name?.textContent || 'Player';

      const char = createEqualSplitCharacter(
        avatarStyle,
        text,
        nickname,
        index,
        totalPlayers,
        false // Don't reveal winner status yet
      );
      sectionBg.appendChild(char);
      container.appendChild(sectionBg);
    });
  }

  // VS Text in center with neutral glow
  const vsText = document.createElement('div');
  vsText.className = 'vs-text';
  vsText.textContent = totalPlayers === 2 ? 'VS' : 'BATTLE';
  vsText.style.cssText = `
    position: absolute;
    ${getCenterTextPosition(totalPlayers)}
    font-size: ${vmin(totalPlayers === 2 ? 12 : 10)}px;
    font-weight: 900;
    color: #fff;
    text-shadow:
      0 0 ${vmin(2)}px rgba(100, 200, 255, 1),
      0 0 ${vmin(4)}px rgba(100, 200, 255, 0.8),
      0 0 ${vmin(6)}px rgba(100, 200, 255, 0.6),
      ${vmin(0.4)} ${vmin(0.4)} ${vmin(0.8)} rgba(0, 0, 0, 0.8);
    letter-spacing: ${vmin(1)}px;
    z-index: 100;
    filter: drop-shadow(0 0 ${vmin(3)}px rgba(255, 255, 255, 0.5));
    font-family: 'Arial Black', sans-serif;
    -webkit-text-stroke: ${vmin(0.3)}px #000;
    transform: translate(-50%, -50%);
  `;
  container.appendChild(vsText);

  return container;
}

// Helper: Get split screen layout display property
function getSplitLayoutDisplay(totalPlayers: number): string {
  if (totalPlayers === 2) {
    return 'grid; grid-template-columns: 1fr 1fr';
  } else if (totalPlayers === 3) {
    return 'block'; // Use absolute positioning for 3 players with conic-gradient
  } else if (totalPlayers === 4) {
    return 'grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr';
  }
  return 'flex; align-items: center; justify-content: center';
}

// Helper: Get split background (player colors)
function getSplitBackground(totalPlayers: number): string {
  const colors = ['#ff4444', '#ffdd44', '#44dd44', '#4444ff']; // red, yellow, green, blue

  if (totalPlayers === 2) {
    return `linear-gradient(90deg, ${colors[0]} 0%, ${colors[0]} 50%, ${colors[1]} 50%, ${colors[1]} 100%)`;
  } else if (totalPlayers === 3) {
    return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[0]} 33%, ${colors[1]} 33%, ${colors[1]} 66%, ${colors[2]} 66%, ${colors[2]} 100%)`;
  } else if (totalPlayers === 4) {
    return `linear-gradient(135deg, ${colors[0]} 25%, ${colors[1]} 25%, ${colors[1]} 50%, ${colors[2]} 50%, ${colors[2]} 75%, ${colors[3]} 75%)`;
  }
  return '#2d3748';
}

// Helper: Get center text position based on layout
function getCenterTextPosition(totalPlayers: number): string {
  return 'left: 50%; top: 50%;';
}

// Create character in equal split section
function createEqualSplitCharacter(
  avatarStyle: string,
  avatarText: string,
  nickname: string,
  sectionIndex: number,
  totalPlayers: number,
  isWinner: boolean
): HTMLElement {
  const char = document.createElement('div');
  char.className = `vs-participant section-${sectionIndex}`;

  const avatarSize = vmin(18);
  const neutralBorder = 'rgba(100, 200, 255, 0.8)';

  const sectionStyle = getSectionStyle(sectionIndex, totalPlayers);

  char.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${vmin(1.5)}px;
    ${sectionStyle}
    filter: drop-shadow(0 ${vmin(1)}px ${vmin(2)}px rgba(0, 0, 0, 0.7));
    z-index: 2051;
  `;

  // Character avatar
  const avatar = document.createElement('div');
  avatar.className = 'vs-avatar';
  avatar.style.cssText = `
    width: ${avatarSize}px;
    height: ${avatarSize}px;
    border-radius: 50%;
    background-size: cover;
    background-position: center;
    background-color: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${vmin(9)}px;
    border: ${vmin(0.6)}px solid ${neutralBorder};
    box-shadow:
      0 0 ${vmin(2)}px ${neutralBorder},
      inset 0 0 ${vmin(1)}px rgba(255, 255, 255, 0.3);
    ${avatarStyle ? `background-image: ${avatarStyle};` : ''}
  `;
  avatar.textContent = avatarStyle ? '' : avatarText;
  char.appendChild(avatar);

  // Nickname bar
  const nameBar = document.createElement('div');
  nameBar.className = 'vs-nickname';
  nameBar.textContent = nickname;
  nameBar.style.cssText = `
    font-size: ${vmin(3)}px;
    font-weight: bold;
    color: #fff;
    text-shadow:
      ${vmin(0.2)} ${vmin(0.2)} ${vmin(0.4)} rgba(0, 0, 0, 1),
      0 0 ${vmin(1)}px rgba(100, 200, 255, 0.8);
    white-space: nowrap;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(74, 85, 104, 0.8) 20%,
      rgba(74, 85, 104, 0.8) 80%,
      transparent 100%
    );
    padding: ${vmin(0.5)}px ${vmin(2)}px;
    border-radius: ${vmin(0.5)}px;
    font-family: 'Arial Black', sans-serif;
    letter-spacing: ${vmin(0.1)}px;
    border: ${vmin(0.2)}px solid rgba(255, 255, 255, 0.3);
  `;
  char.appendChild(nameBar);

  return char;
}

// Helper: Get section-specific positioning
function getSectionStyle(sectionIndex: number, totalPlayers: number): string {
  if (totalPlayers === 2) {
    // Left/Right split
    return '';
  } else if (totalPlayers === 3) {
    // 3 equal pizza slices - position characters at section centers
    const positions = [
      'position: absolute; left: 50%; top: 25%; transform: translate(-50%, -50%);', // Section 0: top center
      'position: absolute; left: 75%; top: 70%; transform: translate(-50%, -50%);', // Section 1: bottom-right
      'position: absolute; left: 25%; top: 70%; transform: translate(-50%, -50%);', // Section 2: bottom-left
    ];
    return positions[sectionIndex] || '';
  } else if (totalPlayers === 4) {
    // 2x2 grid
    return '';
  }
  return '';
}

// Helper: Get slide direction for each section
function getSectionSlideDirection(sectionIndex: number, totalPlayers: number): { x: number; y: number } {
  if (totalPlayers === 2) {
    return sectionIndex === 0 ? { x: -1, y: 0 } : { x: 1, y: 0 };
  } else if (totalPlayers === 3) {
    const dirs = [
      { x: 0, y: -1 },  // Section 0: top (comes from above)
      { x: 1, y: 1 },   // Section 1: bottom-right
      { x: -1, y: 1 }   // Section 2: bottom-left
    ];
    return dirs[sectionIndex] || { x: 0, y: 0 };
  } else if (totalPlayers === 4) {
    const dirs = [
      { x: -1, y: -1 }, // Top-left
      { x: 1, y: -1 },  // Top-right
      { x: -1, y: 1 },  // Bottom-left
      { x: 1, y: 1 }    // Bottom-right
    ];
    return dirs[sectionIndex] || { x: 0, y: 0 };
  }
  return { x: 0, y: 0 };
}

// Helper: Get push direction for fighting animation
function getCharacterPushDirection(charIndex: number, totalPlayers: number): { x: number; y: number; rotation: number } {
  if (totalPlayers === 2) {
    return charIndex === 0
      ? { x: 1, y: 0, rotation: 5 }
      : { x: -1, y: 0, rotation: -5 };
  } else if (totalPlayers === 3) {
    const dirs = [
      { x: 0, y: 1, rotation: 0 },   // Section 0: top pushes down toward center
      { x: -1, y: -1, rotation: -5 }, // Section 1: bottom-right pushes toward center
      { x: 1, y: -1, rotation: 5 }   // Section 2: bottom-left pushes toward center
    ];
    return dirs[charIndex] || { x: 0, y: 0, rotation: 0 };
  } else if (totalPlayers === 4) {
    const dirs = [
      { x: 1, y: 1, rotation: 5 },    // Top-left
      { x: -1, y: 1, rotation: -5 },  // Top-right
      { x: 1, y: -1, rotation: 5 },   // Bottom-left
      { x: -1, y: -1, rotation: -5 }  // Bottom-right
    ];
    return dirs[charIndex] || { x: 0, y: 0, rotation: 0 };
  }
  return { x: 0, y: 0, rotation: 0 };
}

// Deprecated: Old fighting character function (replaced by createEqualSplitCharacter)
// Kept for reference but not used in the new equal-display animation

// Fighting game collision spark (💥 style)
function createFightingSpark(container: HTMLElement, intensity: number): void {
  const rect = container.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Main impact emoji 💥
  const impact = document.createElement('div');
  impact.textContent = '💥';
  impact.style.cssText = `
    position: fixed;
    left: ${centerX}px;
    top: ${centerY}px;
    font-size: ${vmin(4 + intensity * 0.5)}px;
    z-index: 2101;
    pointer-events: none;
    transform: translate(-50%, -50%);
    filter: drop-shadow(0 0 ${vmin(1)}px rgba(255, 255, 255, 1));
  `;
  document.body.appendChild(impact);

  gsap.fromTo(impact, {
    scale: 0.5,
    opacity: 1,
  }, {
    scale: 1.5,
    opacity: 0,
    rotation: (Math.random() - 0.5) * 30,
    duration: 0.3,
    ease: 'power2.out',
    onComplete: () => impact.remove(),
  });

  // Speed lines/impact lines radiating outward
  for (let i = 0; i < 8; i++) {
    const line = document.createElement('div');
    const angle = (i / 8) * Math.PI * 2;
    line.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      width: ${vmin(0.4)}px;
      height: ${vmin(3)}px;
      background: linear-gradient(to bottom,
        rgba(255, 255, 255, 1),
        rgba(255, 215, 0, 0.8),
        transparent
      );
      transform-origin: top center;
      transform: translate(-50%, 0) rotate(${angle * 180 / Math.PI}deg);
      z-index: 2100;
      pointer-events: none;
    `;
    document.body.appendChild(line);

    gsap.to(line, {
      height: vmin(6 + intensity),
      opacity: 0,
      duration: 0.2,
      ease: 'power2.out',
      onComplete: () => line.remove(),
    });
  }

  // Small spark particles
  for (let i = 0; i < 5; i++) {
    const spark = document.createElement('div');
    spark.textContent = '✦';
    spark.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      font-size: ${vmin(1.5 + Math.random())}px;
      color: ${Math.random() > 0.5 ? '#ffd700' : '#fff'};
      z-index: 2100;
      pointer-events: none;
      transform: translate(-50%, -50%);
    `;
    document.body.appendChild(spark);

    const angle = Math.random() * Math.PI * 2;
    const distance = vmin(3 + Math.random() * 3);

    gsap.to(spark, {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      opacity: 0,
      rotation: Math.random() * 360,
      duration: 0.3 + Math.random() * 0.2,
      ease: 'power2.out',
      onComplete: () => spark.remove(),
    });
  }
}

// Starburst effect behind winner
function createStarburstEffect(winnerElement: HTMLElement): void {
  const rect = winnerElement.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Starburst rays container
  const burstContainer = document.createElement('div');
  burstContainer.style.cssText = `
    position: fixed;
    left: ${centerX}px;
    top: ${centerY}px;
    width: ${vmin(40)}px;
    height: ${vmin(40)}px;
    transform: translate(-50%, -50%);
    z-index: 2048;
    pointer-events: none;
  `;
  document.body.appendChild(burstContainer);

  // Create rotating starburst rays
  for (let i = 0; i < 16; i++) {
    const ray = document.createElement('div');
    ray.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      width: ${vmin(1)}px;
      height: ${vmin(20)}px;
      background: linear-gradient(to bottom,
        rgba(255, 215, 0, 1),
        rgba(255, 215, 0, 0.5),
        transparent
      );
      transform-origin: center top;
      transform: translate(-50%, 0) rotate(${i * 22.5}deg);
    `;
    burstContainer.appendChild(ray);
  }

  // Animate starburst
  gsap.fromTo(burstContainer, {
    scale: 0,
    rotation: 0,
    opacity: 0,
  }, {
    scale: 1,
    rotation: 45,
    opacity: 1,
    duration: 0.4,
    ease: 'power2.out',
  });

  gsap.to(burstContainer, {
    rotation: 90,
    opacity: 0,
    scale: 1.2,
    duration: 0.6,
    delay: 0.4,
    ease: 'power2.in',
    onComplete: () => burstContainer.remove(),
  });

  // Golden glow pulse
  const glow = document.createElement('div');
  glow.style.cssText = `
    position: fixed;
    left: ${centerX}px;
    top: ${centerY}px;
    width: ${vmin(25)}px;
    height: ${vmin(25)}px;
    background: radial-gradient(circle,
      rgba(255, 215, 0, 0.6) 0%,
      rgba(255, 215, 0, 0.3) 40%,
      transparent 70%
    );
    transform: translate(-50%, -50%);
    z-index: 2047;
    pointer-events: none;
    border-radius: 50%;
  `;
  document.body.appendChild(glow);

  gsap.fromTo(glow, {
    scale: 0.5,
    opacity: 0,
  }, {
    scale: 2,
    opacity: 1,
    duration: 0.3,
    ease: 'power2.out',
  });

  gsap.to(glow, {
    scale: 2.5,
    opacity: 0,
    duration: 0.5,
    delay: 0.3,
    ease: 'power2.in',
    onComplete: () => glow.remove(),
  });
}

// 축하 이펙트
function createCelebrationEffect(winnerElement: HTMLElement): void {
  const rect = winnerElement.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // 반짝이는 별들
  for (let i = 0; i < 12; i++) {
    const star = document.createElement('div');
    star.textContent = ['✦', '★', '✨'][Math.floor(Math.random() * 3)];
    star.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      font-size: ${vmin(1.5 + Math.random() * 1.5)}px;
      color: #ffd700;
      z-index: 2002;
      pointer-events: none;
      transform: translate(-50%, -50%);
    `;
    document.body.appendChild(star);

    const angle = (i / 12) * Math.PI * 2;
    const distance = vmin(8) + Math.random() * vmin(4);

    gsap.to(star, {
      left: centerX + Math.cos(angle) * distance,
      top: centerY + Math.sin(angle) * distance,
      opacity: 0,
      rotation: Math.random() * 720 - 360,
      scale: 0.5 + Math.random() * 0.5,
      duration: 0.6 + Math.random() * 0.4,
      ease: 'power2.out',
      onComplete: () => star.remove(),
    });
  }

  // 골든 링
  const ring = document.createElement('div');
  ring.style.cssText = `
    position: fixed;
    left: ${centerX}px;
    top: ${centerY}px;
    width: ${vmin(12)}px;
    height: ${vmin(12)}px;
    border: ${vmin(0.5)}px solid rgba(255, 215, 0, 0.8);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 2001;
    pointer-events: none;
  `;
  document.body.appendChild(ring);

  gsap.to(ring, {
    width: vmin(20),
    height: vmin(20),
    opacity: 0,
    duration: 0.5,
    ease: 'power2.out',
    onComplete: () => ring.remove(),
  });
}

// 레이스 고스트 생성
function createRaceGhost(slot: HTMLElement, avatar: HTMLElement): HTMLElement {
  const ghost = document.createElement('div');
  ghost.className = 'race-ghost';

  // 아바타 복제
  const avatarClone = avatar.cloneNode(true) as HTMLElement;
  const ghostSize = vmin(6);
  avatarClone.style.width = `${ghostSize}px`;
  avatarClone.style.height = `${ghostSize}px`;
  avatarClone.style.margin = '0';

  ghost.appendChild(avatarClone);
  ghost.style.cssText = `
    position: fixed;
    width: ${ghostSize}px;
    height: ${ghostSize}px;
    transform: translate(-50%, -50%);
    z-index: 2000;
    pointer-events: none;
    filter: drop-shadow(0 0 ${vmin(1)}px rgba(255, 215, 0, 0.8));
  `;

  return ghost;
}

// 충돌 이펙트
function createImpactEffect(x: number, y: number): void {
  // 충격파
  const shockwave = document.createElement('div');
  const initialSize = vmin(2);
  const finalSize = vmin(20);
  shockwave.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    width: ${initialSize}px;
    height: ${initialSize}px;
    border: ${vmin(0.4)}px solid #ffd700;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 1999;
    pointer-events: none;
  `;
  document.body.appendChild(shockwave);

  gsap.to(shockwave, {
    width: finalSize,
    height: finalSize,
    borderWidth: vmin(0.1),
    opacity: 0,
    duration: 0.4,
    ease: 'power2.out',
    onComplete: () => shockwave.remove(),
  });

  // 별 파티클
  for (let i = 0; i < 8; i++) {
    const star = document.createElement('div');
    star.textContent = '✦';
    star.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      font-size: ${vmin(2)}px;
      color: #ffd700;
      z-index: 1999;
      pointer-events: none;
      transform: translate(-50%, -50%);
    `;
    document.body.appendChild(star);

    const angle = (i / 8) * Math.PI * 2;
    gsap.to(star, {
      left: x + Math.cos(angle) * vmin(10),
      top: y + Math.sin(angle) * vmin(10),
      opacity: 0,
      rotation: 360,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => star.remove(),
    });
  }
}

// 승자 하이라이트
function showWinnerHighlight(playerIndex: number): void {
  const slot = document.getElementById(`player-${playerIndex}`);
  if (!slot) return;

  slot.classList.add('bell-winner');

  // 잠시 후 제거
  setTimeout(() => {
    slot.classList.remove('bell-winner');
  }, 2000);
}

// 종 성공 애니메이션 (레이스 후 호출됨)
export function animateBellSuccess(playerIndex: number): void {
  const bell = document.querySelector('.bell-container .bell, .bell');
  if (!bell) return;

  // 종 흔들림 + 황금빛 효과
  const tl = gsap.timeline();

  tl.to(bell, {
    scale: 1.3,
    duration: 0.1,
  });

  tl.to(bell, {
    keyframes: [
      { rotation: 20, duration: 0.08 },
      { rotation: -18, duration: 0.08 },
      { rotation: 15, duration: 0.06 },
      { rotation: -12, duration: 0.06 },
      { rotation: 8, duration: 0.05 },
      { rotation: -5, duration: 0.05 },
      { rotation: 0, duration: 0.05 },
    ],
  });

  tl.to(bell, {
    scale: 1,
    duration: 0.2,
  }, '-=0.2');

  // 성공 메시지 표시
  showResultMessage('🎉 정답!', 'success');
}

// 종 실패 애니메이션
export function animateBellFail(playerIndex: number): void {
  const bell = document.querySelector('.bell-container .bell, .bell');
  if (!bell) return;

  // 종 흔들림 (약하게) + 붉은빛 효과
  const tl = gsap.timeline();

  tl.to(bell, {
    filter: 'drop-shadow(0 0 20px rgba(255, 0, 0, 0.8)) grayscale(0.5)',
    duration: 0.1,
  });

  tl.to(bell, {
    rotation: -8,
    duration: 0.05,
    yoyo: true,
    repeat: 5,
  });

  tl.to(bell, {
    filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.6))',
    rotation: 0,
    duration: 0.3,
  });

  // 실패 메시지 표시
  showResultMessage('❌ 실패!', 'fail');
}

// 결과 메시지 표시
function showResultMessage(text: string, type: 'success' | 'fail'): void {
  const message = document.createElement('div');
  message.className = `result-message ${type}`;
  message.textContent = text;
  message.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: ${vmin(4.8)}px;
    font-weight: bold;
    color: ${type === 'success' ? '#ffd700' : '#ff4444'};
    text-shadow: 0 0 ${vmin(2)}px ${type === 'success' ? 'rgba(255, 215, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)'};
    z-index: 2000;
    pointer-events: none;
  `;
  document.body.appendChild(message);

  gsap.from(message, {
    scale: 0,
    duration: 0.3,
    ease: 'back.out(1.7)',
  });

  gsap.to(message, {
    opacity: 0,
    y: -vmin(5),
    duration: 0.5,
    delay: 1,
    onComplete: () => message.remove(),
  });
}

// 카드 수집 애니메이션
export function animateCollectCards(winnerIndex: number, onComplete?: () => void): void {
  // 플레이된 카드와 중앙 남은 카드 모두 수집
  const playedCards = document.querySelectorAll('.card[data-played="true"]');
  const centerCards = document.querySelectorAll('.card[data-remaining="true"]');
  const allCards = [...playedCards, ...centerCards];
  const winnerSlot = document.getElementById(`player-${winnerIndex}`);

  if (!winnerSlot || allCards.length === 0) {
    onComplete?.();
    return;
  }

  const slotRect = winnerSlot.getBoundingClientRect();
  const targetX = slotRect.left + slotRect.width / 2;
  const targetY = slotRect.bottom + vmin(3);

  let completedCount = 0;
  const totalCards = allCards.length;

  allCards.forEach((card, i) => {
    const cardEl = card as HTMLElement;
    const cardRect = cardEl.getBoundingClientRect();

    gsap.to(cardEl, {
      x: targetX - cardRect.left - cardRect.width / 2,
      y: targetY - cardRect.top - cardRect.height / 2,
      scale: 0.5,
      opacity: 0,
      rotation: (Math.random() - 0.5) * 30,
      duration: 0.4,
      delay: i * 0.03,
      ease: 'power2.in',
      onComplete: () => {
        cardEl.remove();
        completedCount++;

        // Call onComplete after the last card finishes
        if (completedCount === totalCards && onComplete) {
          onComplete();
        }
      },
    });
  });
}

// 패널티 카드 분배 애니메이션
export function animatePenaltyCards(
  loserIndex: number,
  targetPlayers: number[],
  onComplete?: () => void
): void {
  const loserSlot = document.getElementById(`player-${loserIndex}`);
  if (!loserSlot || targetPlayers.length === 0) {
    onComplete?.();
    return;
  }

  const loserRect = loserSlot.getBoundingClientRect();
  const loserX = loserRect.left + loserRect.width / 2;

  // loser 위치 계산 (상단 슬롯: 아래에 쌓임, 하단 슬롯: 위에 쌓임)
  const isLoserTop = loserSlot.classList.contains('top-left') || loserSlot.classList.contains('top-right');
  const loserY = isLoserTop
    ? loserRect.bottom + vmin(3)
    : loserRect.top - vmin(3);

  // 패널티 카드 컨테이너 생성 (레이아웃 영향 방지)
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1500;
    overflow: hidden;
  `;
  document.body.appendChild(container);

  const tl = gsap.timeline({
    onComplete: () => {
      container.remove();
      onComplete?.();
    }
  });

  // 각 타겟 플레이어에게 패널티 카드 분배
  targetPlayers.forEach((targetIndex, i) => {
    const targetSlot = document.getElementById(`player-${targetIndex}`);
    if (!targetSlot) {
      return;
    }

    const targetRect = targetSlot.getBoundingClientRect();
    const targetX = targetRect.left + targetRect.width / 2;

    // target 위치 계산 (상단 슬롯: 아래에 쌓임, 하단 슬롯: 위에 쌓임)
    const isTargetTop = targetSlot.classList.contains('top-left') || targetSlot.classList.contains('top-right');
    const targetY = isTargetTop
      ? targetRect.bottom + vmin(8)
      : targetRect.top - vmin(8);

    // 패널티 카드 요소 생성 (새로운 카드 크기에 맞춤)
    const penaltyCard = document.createElement('div');
    penaltyCard.className = 'penalty-card';
    penaltyCard.style.cssText = `
      position: absolute;
      left: ${loserX}px;
      top: ${loserY}px;
      width: ${vmin(8)}px;
      height: ${vmin(11.2)}px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: ${vmin(0.3)}px solid rgba(255, 255, 255, 0.2);
      border-radius: ${vmin(1)}px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      box-shadow: 0 ${vmin(0.4)}px ${vmin(1)}px rgba(0, 0, 0, 0.3);
    `;

    // 내부 테두리 추가 (card-back::after 효과)
    const innerBorder = document.createElement('div');
    innerBorder.style.cssText = `
      position: absolute;
      inset: ${vmin(0.8)}px;
      border: ${vmin(0.25)}px solid rgba(255, 255, 255, 0.3);
      border-radius: ${vmin(0.6)}px;
      pointer-events: none;
    `;
    penaltyCard.appendChild(innerBorder);
    container.appendChild(penaltyCard);

    // 카드 날아가는 애니메이션
    tl.to(penaltyCard, {
      left: targetX,
      top: targetY,
      rotation: (Math.random() - 0.5) * 20,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => {
        // 도착 시 카드가 쌓이는 효과
        gsap.to(penaltyCard, {
          scale: 1.1,
          duration: 0.1,
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            // 카드가 쌓인 후 잠시 보여주다가 페이드아웃
            gsap.to(penaltyCard, {
              opacity: 0,
              duration: 0.5,
              delay: 0.3,
            });
          },
        });
      },
    }, i * 0.15);
  });
}

// ============================================
// 플레이어 카드 스택 업데이트
// ============================================

// 플레이어의 카드 스택을 시각적으로 업데이트
export function updatePlayerCardStack(playerIndex: number, newCount: number): void {
  const playerCards = Array.from(
    document.querySelectorAll(`.card[data-owner="${playerIndex}"]:not([data-played="true"])`)
  ) as HTMLElement[];

  const currentCount = playerCards.length;

  // 현재 DOM 카드 수가 목표보다 많으면 초과분 제거
  if (currentCount > newCount) {
    const excessCount = currentCount - newCount;
    const cardsToRemove = playerCards.slice(-excessCount); // 맨 위부터 제거

    cardsToRemove.forEach((card, i) => {
      // 레이아웃 영향 방지: 먼저 position을 fixed로 변경
      const rect = card.getBoundingClientRect();

      gsap.set(card, {
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        margin: 0,
      });

      gsap.to(card, {
        scale: 0,
        opacity: 0,
        duration: 0.2,
        delay: i * 0.05,
        ease: 'power2.in',
        onComplete: () => {
          card.remove();
        },
      });
    });
  }
}

// ============================================
// Victory celebration animation
// ============================================

export function animateVictory(winnerIndex: number, onPlayAgain: () => void): void {
  const winnerSlot = document.getElementById(`player-${winnerIndex}`);
  if (!winnerSlot) return;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'victory-overlay';
  overlay.innerHTML = `
    <div class="confetti-container"></div>
    <div class="victory-profile-container"></div>
    <button class="play-again-btn">다시하기</button>
  `;
  document.body.appendChild(overlay);

  // Clone winner profile and move to center
  const profileClone = winnerSlot.cloneNode(true) as HTMLElement;
  profileClone.className = 'victory-profile';
  profileClone.removeAttribute('id');
  const profileContainer = overlay.querySelector('.victory-profile-container')!;
  profileContainer.appendChild(profileClone);

  // Start confetti
  const confettiContainer = overlay.querySelector('.confetti-container')!;
  createConfetti(confettiContainer as HTMLElement);

  // Animate profile to center
  gsap.fromTo(profileClone,
    { scale: 1, y: 50, opacity: 0 },
    { scale: 1.5, y: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' }
  );

  // Show play again button
  const playAgainBtn = overlay.querySelector('.play-again-btn') as HTMLButtonElement;
  gsap.fromTo(playAgainBtn,
    { y: 50, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.5, delay: 1, ease: 'power2.out' }
  );

  playAgainBtn.addEventListener('click', () => {
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        overlay.remove();
        onPlayAgain();
      }
    });
  });
}

function createConfetti(container: HTMLElement): void {
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];

  // Initial confetti burst
  for (let i = 0; i < 150; i++) {
    spawnConfettiPiece(container, colors);
  }

  // Keep spawning confetti until container is removed
  const spawnInterval = setInterval(() => {
    if (!container.isConnected) {
      clearInterval(spawnInterval);
      return;
    }
    // Spawn a few more pieces periodically
    for (let i = 0; i < 5; i++) {
      spawnConfettiPiece(container, colors);
    }
  }, 200);
}

function spawnConfettiPiece(container: HTMLElement, colors: string[]): void {
  const confetti = document.createElement('div');
  confetti.className = 'confetti-piece';
  confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
  confetti.style.left = `${Math.random() * 100}%`;
  confetti.style.animationDuration = `${3 + Math.random() * 2}s`;
  container.appendChild(confetti);

  // Remove after animation completes to prevent DOM bloat
  setTimeout(() => {
    if (confetti.parentNode) {
      confetti.remove();
    }
  }, 6000);
}
