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
