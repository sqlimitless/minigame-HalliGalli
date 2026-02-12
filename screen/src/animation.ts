// ============================================
// GSAP 애니메이션
// ============================================

import { gsap } from 'gsap';
import type { Card, CardTarget } from './types';

// 반응형 크기 계산 헬퍼 (vmin 기반)
const vmin = (v: number): number => Math.min(window.innerWidth, window.innerHeight) * v / 100;

// 전역 z-index 카운터 (새로 던진 카드가 항상 맨 위에 오도록)
let playedCardZIndex = 500;

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
    <div class="bell">🔔</div>
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

    offsetX = (dirX / dist) * vmin(8);
    offsetY = (dirY / dist) * vmin(8);
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

  // 승자 슬롯
  const winnerSlot = document.getElementById(`player-${winnerIndex}`);
  if (!winnerSlot) {
    onComplete();
    return;
  }

  // 경쟁자들
  const competitors = competitorIndices
    .map(idx => document.getElementById(`player-${idx}`))
    .filter((el): el is HTMLElement => el !== null);

  const tl = gsap.timeline({
    onComplete: () => {
      onComplete();
    }
  });

  // 승자 아바타 복제 (원본은 그대로 두고)
  const winnerAvatar = winnerSlot.querySelector('.player-avatar') as HTMLElement;
  const winnerGhost = createRaceGhost(winnerSlot, winnerAvatar);
  document.body.appendChild(winnerGhost);

  // 경쟁자 고스트들 생성
  const competitorGhosts = competitors.map(slot => {
    const avatar = slot.querySelector('.player-avatar') as HTMLElement;
    const ghost = createRaceGhost(slot, avatar);
    document.body.appendChild(ghost);
    return ghost;
  });

  // 모든 고스트의 시작 위치 설정
  const winnerSlotRect = winnerSlot.getBoundingClientRect();
  gsap.set(winnerGhost, {
    left: winnerSlotRect.left + winnerSlotRect.width / 2,
    top: winnerSlotRect.top + winnerSlotRect.height / 2,
  });

  competitorGhosts.forEach((ghost, i) => {
    const slot = competitors[i];
    const rect = slot.getBoundingClientRect();
    gsap.set(ghost, {
      left: rect.left + rect.width / 2,
      top: rect.top + rect.height / 2,
    });
  });

  // 1단계: 준비 이펙트 (슬롯 하이라이트)
  tl.to(winnerSlot, {
    boxShadow: '0 0 20px rgba(255, 215, 0, 0.8)',
    duration: 0.1,
  }, 0);

  competitors.forEach((slot, i) => {
    tl.to(slot, {
      boxShadow: '0 0 15px rgba(255, 100, 100, 0.6)',
      duration: 0.1,
    }, 0);
  });

  // 2단계: 레이스! 모두 종을 향해 돌진
  if (competitorGhosts.length > 0) {
    // 경쟁이 있을 때 - 긴장감 연출
    tl.addLabel('race', '+=0.1');

    // 승자가 조금 더 빨리 도착
    tl.to(winnerGhost, {
      left: bellCenterX,
      top: bellCenterY,
      scale: 1.5,
      duration: 0.25,
      ease: 'power3.in',
    }, 'race');

    // 경쟁자들은 약간 늦게
    competitorGhosts.forEach((ghost, i) => {
      tl.to(ghost, {
        left: bellCenterX + (Math.random() - 0.5) * vmin(4),
        top: bellCenterY + (Math.random() - 0.5) * vmin(4),
        scale: 1.3,
        duration: 0.28 + i * 0.02,
        ease: 'power3.in',
      }, 'race');
    });

    // 3단계: 충돌! 승자가 경쟁자들 찌그러뜨림
    tl.addLabel('impact', '-=0.05');

    // 종 흔들림
    tl.to(bell, {
      scale: 1.4,
      duration: 0.08,
    }, 'impact');

    // 충돌 이펙트
    tl.call(() => {
      createImpactEffect(bellCenterX, bellCenterY);
    }, [], 'impact');

    // 경쟁자들 찌그러지며 튕겨나감
    competitorGhosts.forEach((ghost, i) => {
      const angle = (i + 1) * (360 / (competitorGhosts.length + 1)) * (Math.PI / 180);
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

    // 승자 승리 포즈
    tl.to(winnerGhost, {
      scale: 2,
      duration: 0.15,
    }, 'impact');

    tl.to(winnerGhost, {
      scale: 1.5,
      duration: 0.1,
    });

  } else {
    // 경쟁 없이 혼자 - 빠르게 도착
    tl.to(winnerGhost, {
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
  tl.to([winnerSlot, ...competitors], {
    boxShadow: 'none',
    duration: 0.2,
  }, '-=0.2');

  // 애니메이션 종료 시 모든 슬롯의 GSAP 속성 제거
  tl.call(() => {
    gsap.set([winnerSlot, ...competitors], { clearProps: 'all' });
  });

  // 승자 고스트 제거
  tl.to(winnerGhost, {
    opacity: 0,
    scale: 0,
    duration: 0.2,
    onComplete: () => winnerGhost.remove(),
  }, '-=0.1');

  // 승자 슬롯 하이라이트
  tl.call(() => {
    showWinnerHighlight(winnerIndex);
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
export function animateCollectCards(winnerIndex: number): void {
  // 플레이된 카드와 중앙 남은 카드 모두 수집
  const playedCards = document.querySelectorAll('.card[data-played="true"]');
  const centerCards = document.querySelectorAll('.card[data-remaining="true"]');
  const allCards = [...playedCards, ...centerCards];
  const winnerSlot = document.getElementById(`player-${winnerIndex}`);

  if (!winnerSlot || allCards.length === 0) return;

  const slotRect = winnerSlot.getBoundingClientRect();
  const targetX = slotRect.left + slotRect.width / 2;
  const targetY = slotRect.bottom + vmin(3);

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
