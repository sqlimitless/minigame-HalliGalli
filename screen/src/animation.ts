// ============================================
// GSAP 애니메이션
// ============================================

import { gsap } from 'gsap';
import type { CardTarget } from './types';

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

// 게임 시작 애니메이션 (뒤집기 → 셔플 → 정렬)
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

  // 3단계: 0.3초 대기 후 정갈하게 정렬
  tl.addLabel('alignStart', '+=0.3');
  animateAlignCards(tl, cardTargets);

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
    const randomRadius = 150 + Math.random() * 250;
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
        const r = rotationDir * 360 * p * randomSpins;

        gsap.set(card, { x, y, rotation: r });
      },
    }, index === 0 ? 'shuffleStart' : '<0.02');
  });
}

// 카드 정렬 애니메이션
function animateAlignCards(
  tl: gsap.core.Timeline,
  cardTargets: CardTarget[]
): void {
  // 모든 카드를 깔끔하게 정렬
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
}

// ============================================
// 카드 분배 애니메이션
// ============================================

export function animateCardDistribution(
  playerCount: number,
  onComplete: () => void
): void {
  const cards = Array.from(document.querySelectorAll('.card')) as HTMLElement[];
  const totalCards = cards.length;

  // 플레이어가 없으면 종료
  if (playerCount === 0) {
    onComplete();
    return;
  }

  // 활성화된 플레이어 슬롯 가져오기
  const playerSlots: HTMLElement[] = [];
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`player-${i}`);
    if (slot && slot.classList.contains('active')) {
      playerSlots.push(slot);
    }
  }

  if (playerSlots.length === 0) {
    onComplete();
    return;
  }

  // 각 플레이어에게 분배할 카드 수
  const cardsPerPlayer = Math.floor(totalCards / playerSlots.length);

  // 카드를 플레이어별로 분배 (라운드 로빈)
  const playerCards: HTMLElement[][] = playerSlots.map(() => []);
  for (let i = 0; i < cardsPerPlayer * playerSlots.length; i++) {
    const playerIdx = i % playerSlots.length;
    playerCards[playerIdx].push(cards[i]);
    cards[i].dataset.owner = String(playerIdx);
  }

  const tl = gsap.timeline({ onComplete });

  // 0.3초 대기 후 분배 시작
  tl.addLabel('distributeStart', '+=0.3');

  // 각 플레이어에게 카드 묶음으로 빠르게 분배
  playerSlots.forEach((slot, playerIdx) => {
    const slotRect = slot.getBoundingClientRect();
    const myCards = playerCards[playerIdx];

    myCards.forEach((card, cardIdx) => {
      const cardRect = card.getBoundingClientRect();

      // 현재 카드 위치에서 슬롯까지의 거리 계산
      const deltaX = slotRect.left + slotRect.width / 2 - (cardRect.left + cardRect.width / 2);
      const deltaY = slotRect.bottom + 20 - (cardRect.top + cardRect.height / 2);

      // 현재 transform 값 가져오기
      const currentX = gsap.getProperty(card, 'x') as number;
      const currentY = gsap.getProperty(card, 'y') as number;

      // 카드 날아가는 애니메이션
      tl.to(card, {
        x: currentX + deltaX,
        y: currentY + deltaY + cardIdx * 0.3,
        rotation: (Math.random() - 0.5) * 8,
        scale: 0.7,
        duration: 0.4,
        ease: 'power2.out',
      }, `distributeStart+=${playerIdx * 0.15 + cardIdx * 0.1}`);
    });
  });

  // 분배 완료 후 정돈
  tl.addLabel('tidyUp', '+=0.2');

  playerSlots.forEach((_, playerIdx) => {
    const myCards = playerCards[playerIdx];
    myCards.forEach((card) => {
      tl.to(card, {
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

    if (!deckRect) return;

    const bellCenterX = deckRect.width / 2;
    const bellCenterY = deckRect.height / 2;

    // 남은 카드를 플레이어 슬롯 방향으로 배치 (뒷면 그대로)
    remainingCards.forEach((card, i) => {
      // 남은 카드 표시
      card.dataset.remaining = 'true';

      // 몇 번째 플레이어 방향인지
      const targetPlayerIdx = i % playerSlots.length;
      const targetSlot = playerSlots[targetPlayerIdx];
      const slotRect = targetSlot.getBoundingClientRect();

      // 슬롯 중앙 위치 (덱 영역 기준)
      const slotCenterX = slotRect.left - deckRect.left + slotRect.width / 2;
      const slotCenterY = slotRect.top - deckRect.top + slotRect.height / 2;

      // 종에서 슬롯 방향으로의 벡터
      const dirX = slotCenterX - bellCenterX;
      const dirY = slotCenterY - bellCenterY;
      const dist = Math.sqrt(dirX * dirX + dirY * dirY);

      // 종에서 슬롯 방향으로 100px 떨어진 위치
      const offsetDist = 100;
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

  const tl = gsap.timeline({ onComplete });

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
  // 덱 영역 중앙 위치 계산
  const deckArea = document.querySelector('.deck-area');
  const deckRect = deckArea?.getBoundingClientRect();
  const targetX = deckRect ? deckRect.left + deckRect.width / 2 : window.innerWidth / 2;
  const targetY = deckRect ? deckRect.top + deckRect.height / 2 - 50 : window.innerHeight / 2 - 50;

  // 컨테이너 생성
  const container = document.createElement('div');
  container.className = 'bell-container';
  container.innerHTML = `
    <div class="divine-light"></div>
    <div class="bell">🔔</div>
    <div class="bell-glow"></div>
  `;
  document.body.appendChild(container);

  const divineLight = container.querySelector('.divine-light') as HTMLElement;
  const bell = container.querySelector('.bell') as HTMLElement;
  const bellGlow = container.querySelector('.bell-glow') as HTMLElement;

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
    sparkle.style.left = `${targetX + (Math.random() - 0.5) * 50}px`;
    sparkle.style.top = `${gsap.getProperty(bell, 'top') as number + 80}px`;
    container.appendChild(sparkle);

    gsap.to(sparkle, {
      y: -50 - Math.random() * 50,
      x: (Math.random() - 0.5) * 100,
      opacity: 0,
      duration: 1 + Math.random() * 0.5,
      ease: 'power2.out',
      onComplete: () => sparkle.remove(),
    });
  };

  const tl = gsap.timeline({ onComplete });

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
    top: targetY + 50,
    left: targetX,
    duration: 0.5,
    ease: 'power2.out',
  }, '-=0.5');

  // 4단계: 빛줄기 펼쳐짐
  tl.to(rays, {
    opacity: 0.8,
    height: 250,
    top: targetY + 50,
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
