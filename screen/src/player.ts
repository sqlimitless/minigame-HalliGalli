// ============================================
// 플레이어 표시 관리
// ============================================

import { gsap } from 'gsap';
import type { ControllerInfo } from '@smoregg/sdk';

// 반응형 크기 계산 (vmin 기반)
const vmin = (v: number): number => Math.min(window.innerWidth, window.innerHeight) * v / 100;

// 이전 상태 추적 (새 플레이어 감지용)
const previousPlayerState: Map<number, boolean> = new Map();

// 캐릭터 이미지 URL 생성
export function getCharacterImageUrl(
  appearance: { id: string; seed: string; style: string } | null | undefined
): string {
  if (!appearance) {
    return '';
  }
  return `https://smore.gg/api/character/${appearance.id}/image`;
}

// 플레이어 슬롯 렌더링
function renderPlayerSlot(player: ControllerInfo | undefined): string {
  if (player) {
    const imageUrl = getCharacterImageUrl(player.appearance);
    const imageStyle = imageUrl ? `background-image: url('${imageUrl}')` : '';
    const avatarContent = imageUrl ? '' : '👤';

    return `
      <div class="player-avatar" style="${imageStyle}">
        ${avatarContent}
      </div>
      <div class="player-name">${player.nickname}</div>
      <div class="player-status ${player.connected ? 'connected' : 'disconnected'}"></div>
    `;
  }

  return `
    <div class="player-avatar empty">?</div>
    <div class="player-name">대기중...</div>
  `;
}

// 입장 애니메이션 타입
type EntranceAnimation = (slot: HTMLElement) => void;

// 랜덤 입장 애니메이션 선택
function animatePlayerJoin(slot: HTMLElement): void {
  const animations: EntranceAnimation[] = [
    animateEntrance_Explosion,
    animateEntrance_WalkIn,
    animateEntrance_MagicCircle,
    animateEntrance_Ninja,
    animateEntrance_SlotMachine,
    animateEntrance_Balloon,
    animateEntrance_Lightning,
  ];

  const randomIndex = Math.floor(Math.random() * animations.length);
  animations[randomIndex](slot);
}

// ============================================
// 입장 이펙트 1: 🔥 폭발 호들갑 (화면 중앙까지)
// ============================================
function animateEntrance_Explosion(slot: HTMLElement): void {
  // 원래 위치 저장
  const rect = slot.getBoundingClientRect();
  const originalX = rect.left + rect.width / 2;
  const originalY = rect.top + rect.height / 2;

  // 화면 중앙 계산
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  // 중앙으로 이동할 거리
  const toCenterX = centerX - originalX;
  const toCenterY = centerY - originalY;

  // 초기 상태 - 작고 투명하게
  gsap.set(slot, {
    scale: 0,
    rotation: -720,
    opacity: 0,
    zIndex: 9999,
  });

  const tl = gsap.timeline();

  // 1. 화면 중앙으로 쾅!! 날아옴
  tl.to(slot, {
    x: toCenterX,
    y: toCenterY,
    scale: 3,
    rotation: 0,
    opacity: 1,
    duration: 0.4,
    ease: 'power4.out',
  });

  // 2. 중앙에서 폭발적인 글로우!!
  tl.to(slot, {
    scale: 3.5,
    boxShadow: `
      0 0 80px rgba(255, 215, 0, 1),
      0 0 150px rgba(255, 100, 0, 0.9),
      0 0 250px rgba(255, 50, 0, 0.7),
      0 0 400px rgba(255, 0, 100, 0.4),
      inset 0 0 50px rgba(255, 255, 255, 0.8)
    `,
    background: 'rgba(255, 215, 0, 0.4)',
    duration: 0.2,
  });

  // 3. 중앙에서 펄스!! 두근두근!! (화면 전체가 느껴질 정도로)
  for (let i = 0; i < 3; i++) {
    tl.to(slot, {
      scale: 4 - i * 0.3,
      rotation: (i % 2 === 0 ? 10 : -10),
      boxShadow: `
        0 0 ${100 - i * 15}px rgba(255, 215, 0, 1),
        0 0 ${200 - i * 30}px rgba(255, 100, 0, 0.8),
        0 0 ${350 - i * 50}px rgba(255, 50, 0, 0.5)
      `,
      duration: 0.08,
    });
    tl.to(slot, {
      scale: 3.5 - i * 0.3,
      rotation: (i % 2 === 0 ? -10 : 10),
      duration: 0.08,
    });
  }

  // 4. 호들갑 흔들기!! (중앙에서)
  tl.to(slot, { x: toCenterX - vmin(5), rotation: -25, duration: 0.04 });
  tl.to(slot, { x: toCenterX + vmin(5), rotation: 25, duration: 0.04 });
  tl.to(slot, { x: toCenterX - vmin(4), rotation: -20, duration: 0.04 });
  tl.to(slot, { x: toCenterX + vmin(4), rotation: 20, duration: 0.04 });
  tl.to(slot, { x: toCenterX - vmin(2.5), rotation: -12, duration: 0.04 });
  tl.to(slot, { x: toCenterX + vmin(2.5), rotation: 12, duration: 0.04 });
  tl.to(slot, { x: toCenterX, rotation: 0, duration: 0.04 });

  // 5. 잠깐 뽐내기 (중앙에서 포즈)
  tl.to(slot, {
    scale: 2.5,
    boxShadow: `
      0 0 60px rgba(255, 215, 0, 0.8),
      0 0 120px rgba(255, 215, 0, 0.4)
    `,
    duration: 0.3,
    ease: 'power2.out',
  });

  // 6. 원래 자리로 슝~ 돌아감
  tl.to(slot, {
    x: 0,
    y: 0,
    scale: 1.3,
    rotation: 360,
    boxShadow: '0 0 40px rgba(255, 215, 0, 0.6)',
    duration: 0.5,
    ease: 'power3.inOut',
  });

  // 7. 착지! 탁!
  tl.to(slot, {
    scale: 1.1,
    rotation: 0,
    boxShadow: '0 0 20px rgba(255, 215, 0, 0.4)',
    background: 'rgba(255, 255, 255, 0.15)',
    duration: 0.15,
    ease: 'back.out(4)',
  });

  // 8. 여운 (글로우 서서히 사라짐)
  tl.to(slot, {
    scale: 1,
    boxShadow: '0 0 0px rgba(255, 215, 0, 0)',
    zIndex: 1,
    duration: 1,
    ease: 'power2.out',
  });
}

// ============================================
// 입장 이펙트 2: 🚶 프로필만 떨어져서 걸어오기
// ============================================
function animateEntrance_WalkIn(slot: HTMLElement): void {
  const slotRect = slot.getBoundingClientRect();
  const gameContainer = document.querySelector('.game-container');
  if (!gameContainer) return;

  const containerRect = gameContainer.getBoundingClientRect();

  // 슬롯 내부 요소들 숨기기
  const avatar = slot.querySelector('.player-avatar') as HTMLElement;
  const name = slot.querySelector('.player-name') as HTMLElement;
  const status = slot.querySelector('.player-status') as HTMLElement;

  if (!avatar || !name) return;

  // 이름과 상태 숨기기 (나중에 등장)
  gsap.set([name, status], { opacity: 0, scale: 0 });
  gsap.set(avatar, { opacity: 0 });

  // 떠다니는 프로필 이미지 생성
  const floatingAvatar = document.createElement('div');
  floatingAvatar.className = 'floating-avatar';
  floatingAvatar.innerHTML = avatar.innerHTML;

  // 시작 위치 (game-container 상단 중앙, 컨테이너 밖)
  const avatarHalfSize = vmin(4);
  const startX = containerRect.left + containerRect.width / 2 - avatarHalfSize;
  const startY = containerRect.top - vmin(12); // 컨테이너 위쪽 (밖)

  // 착지 위치 (game-container 상단 안쪽)
  const landY = containerRect.top + vmin(10);

  // 목표 위치 (슬롯의 아바타 위치)
  const targetX = slotRect.left + slotRect.width / 2 - avatarHalfSize;
  const targetY = slotRect.top + vmin(2);

  floatingAvatar.style.cssText = `
    position: fixed;
    left: ${startX}px;
    top: ${startY}px;
    width: ${vmin(8)}px;
    height: ${vmin(8)}px;
    border-radius: 50%;
    background: ${getComputedStyle(avatar).background};
    background-size: cover;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${vmin(3.6)}px;
    border: ${vmin(0.4)}px solid #ffd700;
    box-shadow: 0 0 ${vmin(2)}px rgba(255, 215, 0, 0.5);
    z-index: 99999;
    pointer-events: none;
    transform: scale(2);
  `;
  document.body.appendChild(floatingAvatar);

  const tl = gsap.timeline();

  // 1. 위에서 뚝! 떨어짐 (game-container 상단으로)
  tl.to(floatingAvatar, {
    top: landY,
    scale: 1.5,
    duration: 0.4,
    ease: 'power2.in',
  });

  // 착지!
  tl.to(floatingAvatar, {
    top: landY + 10,
    scaleY: 0.7,
    scaleX: 1.4,
    duration: 0.1,
  });

  tl.to(floatingAvatar, {
    top: landY,
    scaleY: 1.3,
    scaleX: 0.9,
    duration: 0.15,
  });

  tl.to(floatingAvatar, {
    scale: 1.2,
    duration: 0.1,
  });

  // 2. 터벅터벅 걸어가기 (착지 위치 → 슬롯 위치)
  const steps = 8;
  const walkStartX = startX;
  const walkStartY = landY;
  const deltaX = (targetX - walkStartX) / steps;
  const deltaY = (targetY - walkStartY) / steps;

  for (let i = 0; i < steps; i++) {
    const currentX = walkStartX + deltaX * (i + 1);
    const currentY = walkStartY + deltaY * (i + 1);

    // 걷기 - 위아래로 통통
    tl.to(floatingAvatar, {
      left: currentX,
      top: currentY - vmin(2),
      rotation: i % 2 === 0 ? -15 : 15,
      duration: 0.08,
      ease: 'power1.out',
    });

    tl.to(floatingAvatar, {
      top: currentY,
      rotation: i % 2 === 0 ? 10 : -10,
      duration: 0.08,
      ease: 'power1.in',
    });
  }

  // 3. 슬롯에 착지!
  tl.to(floatingAvatar, {
    left: targetX,
    top: targetY,
    scale: 0.8,
    rotation: 0,
    duration: 0.2,
    ease: 'back.out(2)',
  });

  // 4. 프로필이 슬롯에 쏙! 들어감
  tl.to(floatingAvatar, {
    scale: 0,
    opacity: 0,
    duration: 0.2,
    ease: 'power2.in',
    onComplete: () => {
      floatingAvatar.remove();
    },
  });

  // 동시에 슬롯의 아바타 등장
  tl.to(avatar, {
    opacity: 1,
    duration: 0.2,
  }, '-=0.2');

  // 5. 이름 촤라락~ 등장
  tl.to(name, {
    opacity: 1,
    scale: 1,
    duration: 0.3,
    ease: 'back.out(3)',
  });

  // 글자 반짝이 효과
  tl.to(name, {
    textShadow: '0 0 20px rgba(255, 255, 255, 1), 0 0 40px rgba(255, 215, 0, 0.8)',
    duration: 0.2,
  });

  tl.to(name, {
    textShadow: '0 0 0px rgba(255, 255, 255, 0)',
    duration: 0.4,
  });

  // 6. 상태 표시 등장
  tl.to(status, {
    opacity: 1,
    scale: 1,
    duration: 0.2,
    ease: 'back.out(2)',
  }, '-=0.3');

  // 7. 슬롯 전체 반짝
  tl.to(slot, {
    boxShadow: '0 0 30px rgba(100, 255, 150, 0.6)',
    duration: 0.2,
  });

  tl.to(slot, {
    boxShadow: '0 0 0px rgba(100, 255, 150, 0)',
    duration: 0.5,
  });
}

// ============================================
// 입장 이펙트 3: 🌀 소환진
// ============================================
function animateEntrance_MagicCircle(slot: HTMLElement): void {
  const slotRect = slot.getBoundingClientRect();

  // 슬롯 숨기기
  gsap.set(slot, { opacity: 0, scale: 0 });

  // 마법진 생성
  const circleSize = vmin(15);
  const circleHalf = circleSize / 2;
  const magicCircle = document.createElement('div');
  magicCircle.innerHTML = `
    <div style="
      width: ${circleSize}px;
      height: ${circleSize}px;
      border: ${vmin(0.4)}px solid #a855f7;
      border-radius: 50%;
      position: relative;
      box-shadow: 0 0 ${vmin(3)}px #a855f7, inset 0 0 ${vmin(3)}px rgba(168, 85, 247, 0.3);
    ">
      <div style="
        position: absolute;
        inset: ${vmin(1)}px;
        border: ${vmin(0.2)}px solid #c084fc;
        border-radius: 50%;
        animation: spin 2s linear infinite;
      "></div>
      <div style="
        position: absolute;
        inset: ${vmin(2.5)}px;
        border: ${vmin(0.2)}px dashed #e879f9;
        border-radius: 50%;
        animation: spin 1.5s linear reverse infinite;
      "></div>
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: ${vmin(3)}px;
      ">✨</div>
    </div>
  `;
  magicCircle.style.cssText = `
    position: fixed;
    left: ${slotRect.left + slotRect.width / 2 - circleHalf}px;
    top: ${slotRect.top + slotRect.height / 2 - circleHalf}px;
    z-index: 99999;
    pointer-events: none;
  `;

  // 스타일 추가
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
  document.body.appendChild(magicCircle);

  const tl = gsap.timeline();

  // 1. 마법진 등장
  gsap.set(magicCircle, { scale: 0, opacity: 0, rotation: 0 });

  tl.to(magicCircle, {
    scale: 1,
    opacity: 1,
    rotation: 180,
    duration: 0.5,
    ease: 'back.out(2)',
  });

  // 2. 마법진 회전 + 빛나기
  tl.to(magicCircle, {
    rotation: 540,
    boxShadow: '0 0 60px #a855f7',
    duration: 0.8,
    ease: 'power2.inOut',
  });

  // 3. 폭발! 슬롯 등장
  tl.to(magicCircle, {
    scale: 2,
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => {
      magicCircle.remove();
      style.remove();
    },
  });

  tl.to(slot, {
    opacity: 1,
    scale: 1.3,
    duration: 0.3,
    ease: 'back.out(3)',
  }, '-=0.3');

  // 4. 슬롯 안착
  tl.to(slot, {
    scale: 1,
    boxShadow: '0 0 40px rgba(168, 85, 247, 0.6)',
    duration: 0.3,
  });

  tl.to(slot, {
    boxShadow: '0 0 0px rgba(168, 85, 247, 0)',
    duration: 0.5,
  });
}

// ============================================
// 입장 이펙트 4: 💨 닌자 (연기 순간이동)
// ============================================
function animateEntrance_Ninja(slot: HTMLElement): void {
  const slotRect = slot.getBoundingClientRect();

  // 슬롯 숨기기
  gsap.set(slot, { opacity: 0, scale: 0 });

  // 연기 생성
  const smokeSize = vmin(12);
  const smokeHalf = smokeSize / 2;
  const smoke = document.createElement('div');
  smoke.style.cssText = `
    position: fixed;
    left: ${slotRect.left + slotRect.width / 2 - smokeHalf}px;
    top: ${slotRect.top + slotRect.height / 2 - smokeHalf}px;
    width: ${smokeSize}px;
    height: ${smokeSize}px;
    z-index: 99999;
    pointer-events: none;
    font-size: ${vmin(8)}px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  smoke.textContent = '💨';
  document.body.appendChild(smoke);

  const tl = gsap.timeline();

  // 1. 연기 뿜!
  gsap.set(smoke, { scale: 0, opacity: 0, rotation: 0 });

  tl.to(smoke, {
    scale: 1.5,
    opacity: 1,
    rotation: 30,
    duration: 0.2,
    ease: 'power2.out',
  });

  // 2. 연기 퍼짐
  tl.to(smoke, {
    scale: 2,
    opacity: 0.5,
    rotation: -20,
    duration: 0.2,
  });

  // 3. 연기 사라지면서 슬롯 등장
  tl.to(smoke, {
    scale: 3,
    opacity: 0,
    duration: 0.3,
    onComplete: () => smoke.remove(),
  });

  tl.to(slot, {
    opacity: 1,
    scale: 1,
    duration: 0.1,
  }, '-=0.2');

  // 4. 닌자 포즈 (좌우 빠르게)
  tl.to(slot, { x: -20, duration: 0.05 });
  tl.to(slot, { x: 20, duration: 0.05 });
  tl.to(slot, { x: 0, duration: 0.05 });

  // 5. 손 모양 이펙트
  tl.to(slot, {
    boxShadow: '0 0 30px rgba(100, 100, 100, 0.8)',
    duration: 0.1,
  });

  tl.to(slot, {
    boxShadow: '0 0 0px rgba(100, 100, 100, 0)',
    duration: 0.4,
  });
}

// ============================================
// 입장 이펙트 5: 🎰 슬롯머신
// ============================================
function animateEntrance_SlotMachine(slot: HTMLElement): void {
  const slotRect = slot.getBoundingClientRect();

  // 슬롯 내부 요소들
  const avatar = slot.querySelector('.player-avatar') as HTMLElement;
  const name = slot.querySelector('.player-name') as HTMLElement;
  const status = slot.querySelector('.player-status') as HTMLElement;

  if (!avatar || !name) return;

  // 슬롯 내부 숨기기
  gsap.set(slot, { opacity: 0 });

  // 별도 오버레이로 슬롯머신 생성 (다른 요소에 영향 X)
  const slotMachine = document.createElement('div');
  slotMachine.style.cssText = `
    position: fixed;
    left: ${slotRect.left - 10}px;
    top: ${slotRect.top - 10}px;
    width: ${slotRect.width + 20}px;
    height: ${slotRect.height + 20}px;
    border: 4px solid #ffd700;
    border-radius: 16px;
    background: linear-gradient(180deg, #333 0%, #111 100%);
    z-index: 99999;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    overflow: hidden;
  `;

  // 릴 표시 영역
  const reel = document.createElement('div');
  reel.style.cssText = `
    width: ${vmin(6)}px;
    height: ${vmin(6)}px;
    background: #222;
    border-radius: ${vmin(0.8)}px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${vmin(3.6)}px;
    border: ${vmin(0.2)}px solid #555;
  `;
  reel.textContent = '🎰';
  slotMachine.appendChild(reel);

  document.body.appendChild(slotMachine);

  const tl = gsap.timeline();

  // 1. 슬롯머신 등장
  gsap.set(slotMachine, { scale: 0, opacity: 0 });
  tl.to(slotMachine, {
    scale: 1,
    opacity: 1,
    duration: 0.3,
    ease: 'back.out(2)',
  });

  // 2. 릴 돌아가는 효과
  const symbols = ['🍒', '🍋', '🍊', '⭐', '💎', '7️⃣', '🔔', '🍇'];
  let spinCount = 0;
  const maxSpins = 15;

  const spinInterval = setInterval(() => {
    reel.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    spinCount++;
    if (spinCount >= maxSpins) {
      clearInterval(spinInterval);
      reel.textContent = '👤';
    }
  }, 80);

  tl.to({}, { duration: 1.3 }); // 스핀 대기

  // 3. 잭팟!
  tl.to(slotMachine, {
    boxShadow: '0 0 50px rgba(255, 215, 0, 1), 0 0 100px rgba(255, 215, 0, 0.5)',
    duration: 0.2,
  });

  tl.to(reel, {
    scale: 1.3,
    duration: 0.1,
  });

  tl.to(reel, {
    scale: 1,
    duration: 0.2,
    ease: 'bounce.out',
  });

  // 4. 슬롯머신 사라지고 실제 슬롯 등장
  tl.to(slotMachine, {
    scale: 0,
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => slotMachine.remove(),
  });

  tl.to(slot, {
    opacity: 1,
    duration: 0.1,
  }, '-=0.2');

  tl.from(slot, {
    scale: 1.3,
    duration: 0.3,
    ease: 'back.out(2)',
  }, '-=0.1');

  // 5. 반짝이고 마무리
  tl.to(slot, {
    boxShadow: '0 0 40px rgba(255, 215, 0, 0.8)',
    duration: 0.2,
  });

  tl.to(slot, {
    boxShadow: '0 0 0px rgba(255, 215, 0, 0)',
    duration: 0.5,
  });
}

// ============================================
// 입장 이펙트 6: 🎈 풍선
// ============================================
function animateEntrance_Balloon(slot: HTMLElement): void {
  const slotRect = slot.getBoundingClientRect();
  const gameContainer = document.querySelector('.game-container');
  if (!gameContainer) return;

  const containerRect = gameContainer.getBoundingClientRect();

  // 슬롯 내부 요소들
  const avatar = slot.querySelector('.player-avatar') as HTMLElement;
  const name = slot.querySelector('.player-name') as HTMLElement;
  const status = slot.querySelector('.player-status') as HTMLElement;

  if (!avatar) return;

  gsap.set([name, status], { opacity: 0, scale: 0 });
  gsap.set(avatar, { opacity: 0 });

  // 풍선 + 캐릭터 생성
  const balloon = document.createElement('div');
  balloon.innerHTML = `
    <div style="font-size: ${vmin(6)}px; text-align: center;">🎈</div>
    <div style="
      width: ${vmin(6)}px;
      height: ${vmin(6)}px;
      background: rgba(255,255,255,0.9);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${vmin(3)}px;
      margin: ${-vmin(1)}px auto 0;
      border: ${vmin(0.3)}px solid #ffd700;
    ">👤</div>
  `;

  const balloonHalfSize = vmin(4);
  const startX = containerRect.left + containerRect.width / 2 - balloonHalfSize;
  const startY = containerRect.top - vmin(15);

  balloon.style.cssText = `
    position: fixed;
    left: ${startX}px;
    top: ${startY}px;
    z-index: 99999;
    pointer-events: none;
  `;
  document.body.appendChild(balloon);

  const targetX = slotRect.left + slotRect.width / 2 - balloonHalfSize;
  const targetY = slotRect.top;

  const tl = gsap.timeline();

  // 1. 둥실둥실 내려오기
  const floatDuration = 2;
  const steps = 20;

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const currentY = startY + (targetY - startY) * progress;
    const wobbleX = Math.sin(progress * Math.PI * 4) * vmin(3);
    const wobbleRotation = Math.sin(progress * Math.PI * 3) * 15;

    tl.to(balloon, {
      left: startX + (targetX - startX) * progress + wobbleX,
      top: currentY,
      rotation: wobbleRotation,
      duration: floatDuration / steps,
      ease: 'none',
    });
  }

  // 2. 풍선 펑! 터짐
  tl.to(balloon, {
    scale: 1.5,
    duration: 0.1,
  });

  tl.to(balloon, {
    scale: 0,
    opacity: 0,
    duration: 0.15,
    ease: 'power2.in',
    onComplete: () => balloon.remove(),
  });

  // 3. 슬롯에 캐릭터 등장
  tl.to(avatar, {
    opacity: 1,
    duration: 0.1,
  }, '-=0.1');

  tl.from(avatar, {
    y: -vmin(3),
    duration: 0.3,
    ease: 'bounce.out',
  }, '-=0.1');

  // 4. 이름 등장
  tl.to(name, {
    opacity: 1,
    scale: 1,
    duration: 0.3,
    ease: 'back.out(2)',
  });

  tl.to(status, {
    opacity: 1,
    scale: 1,
    duration: 0.2,
  }, '-=0.2');

  // 5. 반짝
  tl.to(slot, {
    boxShadow: '0 0 30px rgba(255, 100, 150, 0.6)',
    duration: 0.2,
  });

  tl.to(slot, {
    boxShadow: '0 0 0px rgba(255, 100, 150, 0)',
    duration: 0.5,
  });
}

// ============================================
// 입장 이펙트 7: ⚡ 번개
// ============================================
function animateEntrance_Lightning(slot: HTMLElement): void {
  const slotRect = slot.getBoundingClientRect();

  // 슬롯 숨기기
  gsap.set(slot, { opacity: 0, scale: 0 });

  // 번개 이펙트 생성
  const lightningWidth = vmin(8);
  const lightningHalfWidth = lightningWidth / 2;
  const lightning = document.createElement('div');
  lightning.style.cssText = `
    position: fixed;
    left: ${slotRect.left + slotRect.width / 2 - lightningHalfWidth}px;
    top: 0;
    width: ${lightningWidth}px;
    height: ${slotRect.top + slotRect.height / 2}px;
    z-index: 99999;
    pointer-events: none;
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(255, 255, 0, 0.3) 40%,
      rgba(255, 255, 0, 0.8) 50%,
      rgba(255, 255, 0, 0.3) 60%,
      transparent 100%
    );
    filter: blur(${vmin(0.3)}px);
  `;
  document.body.appendChild(lightning);

  // 화면 플래시
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed;
    inset: 0;
    background: white;
    z-index: 99998;
    pointer-events: none;
    opacity: 0;
  `;
  document.body.appendChild(flash);

  const tl = gsap.timeline();

  // 1. 번개 내려침!
  gsap.set(lightning, { scaleY: 0, transformOrigin: 'top center' });

  tl.to(lightning, {
    scaleY: 1,
    duration: 0.1,
    ease: 'power4.in',
  });

  // 2. 번쩍! 화면 플래시
  tl.to(flash, {
    opacity: 0.8,
    duration: 0.05,
  });

  tl.to(flash, {
    opacity: 0,
    duration: 0.1,
  });

  // 3. 번개 사라짐
  tl.to(lightning, {
    opacity: 0,
    duration: 0.2,
    onComplete: () => {
      lightning.remove();
      flash.remove();
    },
  });

  // 4. 슬롯 충격적 등장!
  tl.to(slot, {
    opacity: 1,
    scale: 1.5,
    duration: 0.1,
  }, '-=0.15');

  // 전기 파직 효과
  tl.to(slot, {
    boxShadow: '0 0 50px rgba(255, 255, 0, 1), 0 0 100px rgba(255, 200, 0, 0.5)',
    duration: 0.1,
  });

  // 지지직
  for (let i = 0; i < 4; i++) {
    tl.to(slot, {
      x: (i % 2 === 0 ? 5 : -5),
      boxShadow: `0 0 ${30 + i * 10}px rgba(255, 255, 0, ${0.8 - i * 0.15})`,
      duration: 0.05,
    });
  }

  // 5. 안정화
  tl.to(slot, {
    scale: 1,
    x: 0,
    boxShadow: '0 0 20px rgba(255, 255, 0, 0.4)',
    duration: 0.3,
    ease: 'elastic.out(1, 0.5)',
  });

  tl.to(slot, {
    boxShadow: '0 0 0px rgba(255, 255, 0, 0)',
    duration: 0.5,
  });
}

// 쓸쓸한 퇴장 애니메이션
export function animatePlayerHide(slot: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        slot.style.display = 'none';
        resolve();
      },
    });

    // 살짝 떨림 (망설임)
    tl.to(slot, {
      x: -3,
      duration: 0.05,
    });
    tl.to(slot, {
      x: 3,
      duration: 0.05,
    });
    tl.to(slot, {
      x: 0,
      duration: 0.05,
    });

    // 서서히 작아지며 회색으로
    tl.to(slot, {
      scale: 0.8,
      opacity: 0.5,
      filter: 'grayscale(100%)',
      duration: 0.3,
      ease: 'power2.in',
    });

    // 아래로 떨어지듯 사라짐
    tl.to(slot, {
      y: vmin(3),
      scale: 0.5,
      opacity: 0,
      duration: 0.4,
      ease: 'power2.in',
    });
  });
}

// 모든 플레이어 슬롯 업데이트
export function updatePlayerSlots(controllers: readonly ControllerInfo[]): void {
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`player-${i}`);
    if (!slot) continue;

    const player = controllers[i];
    const wasActive = previousPlayerState.get(i) || false;
    const isActive = !!player;

    slot.innerHTML = renderPlayerSlot(player);

    if (player) {
      slot.classList.add('active');

      // 새로 참가한 플레이어면 화려한 애니메이션
      if (!wasActive && isActive) {
        animatePlayerJoin(slot);
      }
    } else {
      slot.classList.remove('active');
    }

    previousPlayerState.set(i, isActive);
  }
}

// 빈 슬롯들 숨기기 (게임 시작 시)
export function hideEmptySlots(): Promise<void[]> {
  const promises: Promise<void>[] = [];

  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`player-${i}`);
    if (slot && !slot.classList.contains('active')) {
      promises.push(animatePlayerHide(slot));
    }
  }

  return Promise.all(promises);
}
