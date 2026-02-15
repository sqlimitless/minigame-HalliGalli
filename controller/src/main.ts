import { createController } from '@smoregg/sdk';
import { gsap } from 'gsap';

type Flower = 'rose' | 'carnation' | 'sunflower' | 'daisy';

interface CardData {
  id: number;
  flower: Flower;
  count: number;
}

interface GameEvents {
  'card-dealt': { card: CardData };
  'game-start': Record<string, never>;
  'bell-descent': Record<string, never>;
  'card-play': { card: CardData; velocity: number };
  'turn-change': { currentTurn: number };
  'your-turn': { isYourTurn: boolean };
  'bell-result': { success: boolean; playerIndex: number; fruitCount: Record<string, number> };
  'card-count-update': { count: number };
  'cards-collected': { cards: CardData[] };
  'player-eliminated': { playerIndex: number };
  'game-over': { winner: number };
  'bell-hit': { timestamp: number };
  'bell-race-joined': Record<string, never>;
  [key: string]: Record<string, unknown>;
}

const FLOWER_IMAGES: Record<Flower, string> = {
  rose: '/img/rose.png',
  carnation: '/img/carnation.png',
  sunflower: '/img/sunflower.png',
  daisy: '/img/daisy.png',
};

// Sound utilities
function playCardDropSound(): void {
  const sound = new Audio('/sounds/carddrop.mp3');
  sound.volume = 1.0;
  sound.play().catch(() => {});
}

function playBellSound(): void {
  const sound = new Audio('/sounds/bellSound.mp3');
  sound.volume = 1.0;
  sound.play().catch(() => {});
}

// 반응형 크기 계산 헬퍼
const vmin = (v: number) => Math.min(window.innerWidth, window.innerHeight) * v / 100;
const vh = (v: number) => window.innerHeight * v / 100;

// 내 카드 덱
const myCards: CardData[] = [];

// 턴 상태
let isMyTurn = false;
let gameStarted = false;
let bellCooldown = false;

// DOM 요소
const profileAreaEl = document.getElementById('profile-area')!;
const profileAvatarEl = document.getElementById('profile-avatar')!;
const profileNameEl = document.getElementById('profile-name')!;
const cardDeckEl = document.getElementById('card-deck')!;
const cardCountEl = document.getElementById('card-count')!;
const bellAreaEl = document.getElementById('bell-area')!;
const bellBtn = document.getElementById('bell-btn')! as HTMLButtonElement;

const controller = createController<GameEvents>({ debug: true });

// 프로필 정보 업데이트
controller.onAllReady(() => {
  const myInfo = controller.getController(controller.myPlayerIndex ?? 0);
  if (myInfo) {
    profileNameEl.textContent = myInfo.nickname || `Player ${(controller.myPlayerIndex ?? 0) + 1}`;
    // 아바타 이미지가 있으면 설정
    if (myInfo.appearance) {
      profileAvatarEl.textContent = '';
      profileAvatarEl.style.backgroundImage = `url(https://api.dicebear.com/7.x/avataaars/svg?seed=${myInfo.appearance.seed})`;
    }
  } else {
    profileNameEl.textContent = `Player ${(controller.myPlayerIndex ?? 0) + 1}`;
  }
});

// 카드 받았을 때
controller.on('card-dealt', (data) => {
  myCards.push(data.card);

  // 첫 카드를 받으면 UI 전환
  if (myCards.length === 1) {
    // 프로필을 우상단으로 이동
    profileAreaEl.classList.add('corner');
    // 카드 덱 표시
    cardDeckEl.style.display = 'block';
    cardCountEl.style.display = 'block';
  }

  renderCardDeck();
});

// 종 강림 이벤트
controller.on('bell-descent', () => {
  animateBellDescent(() => {
    // 애니메이션 완료 후 종 버튼 표시
    bellBtn.style.pointerEvents = 'auto';
    bellBtn.style.opacity = '1';
  });
});

// 게임 시작
controller.on('game-start', () => {
  gameStarted = true;
  // 버튼 표시는 bell-descent 완료 후에 처리됨
});

// 내 턴 알림
controller.on('your-turn', (data) => {
  isMyTurn = data.isYourTurn;
  updateTurnIndicator();
});

// 종 결과
controller.on('bell-result', (data) => {
  const myIndex = controller.myPlayerIndex ?? 0;
  if (data.playerIndex === myIndex) {
    if (data.success) {
      showNotification('🎉 카드 획득!', 'success');
    } else {
      showNotification('❌ 실패! 카드 잃음', 'fail');
    }
  }
});

// 카드 수 업데이트
controller.on('card-count-update', (data) => {
  // 카드 수 동기화 (서버 기준)
  while (myCards.length > data.count) {
    myCards.pop();
  }
  renderCardDeck();
});

// 카드 수집 (성공 시)
controller.on('cards-collected', (data) => {
  // 수집한 카드를 덱에 추가 (뒷면으로)
  data.cards.forEach(card => {
    myCards.push(card);
  });
  renderCardDeck();
});

// 플레이어 탈락
controller.on('player-eliminated', (data) => {
  const myIndex = controller.myPlayerIndex ?? 0;
  if (data.playerIndex === myIndex) {
    showNotification('💀 탈락!', 'fail');
    cardDeckEl.style.display = 'none';
    bellAreaEl.style.display = 'none';
  }
});

// 게임 종료
controller.on('game-over', (data) => {
  const myIndex = controller.myPlayerIndex ?? 0;
  if (data.winner === myIndex) {
    showNotification('🏆 승리!', 'success');
  } else {
    showNotification(`Player ${data.winner + 1} 승리!`, 'info');
  }
  gameStarted = false;
});

// 종 레이스 참가 확인
controller.on('bell-race-joined', () => {
  const app = document.getElementById('app');
  if (app) {
    // 즉각적인 시각적 피드백 - 황금색 테두리 효과
    app.style.borderColor = '#ffd700';
    app.style.boxShadow = 'inset 0 0 5vmin rgba(255, 215, 0, 0.5)';

    // 짧은 시간 후 테두리 효과 제거 (결과는 별도로 옴)
    setTimeout(() => {
      app.style.borderColor = '';
      app.style.boxShadow = '';
    }, 500);
  }
});

// 종 버튼
bellBtn.addEventListener('pointerdown', () => {
  if (!gameStarted || bellCooldown) return;

  // 종 사운드 재생
  playBellSound();

  // 진동 피드백 (모바일)
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }

  bellCooldown = true;
  bellBtn.style.opacity = '0.6';

  controller.send('bell-hit', { timestamp: Date.now() });

  // 버튼 누르는 효과 (GSAP로 일관되게 처리)
  gsap.to(bellBtn, {
    scale: 0.85,
    duration: 0.1,
    yoyo: true,
    repeat: 1,
    onComplete: () => {
      // 1초 후 쿨다운 해제
      setTimeout(() => {
        bellCooldown = false;
        bellBtn.style.opacity = '1';
        // GSAP로 원래 크기로 복원
        gsap.to(bellBtn, {
          scale: 1,
          duration: 0.2,
          ease: 'power2.out',
          clearProps: 'transform',
        });
      }, 1000);
    },
  });
});

// 스와이프 상태
let touchStartY = 0;
let touchStartTime = 0;
let isSwiping = false;
let currentSwipeCard: HTMLElement | null = null;

// 카드 덱 스와이프 감지
function setupSwipeDetection(): void {
  cardDeckEl.addEventListener('touchstart', handleTouchStart, { passive: false });
  cardDeckEl.addEventListener('touchmove', handleTouchMove, { passive: false });
  cardDeckEl.addEventListener('touchend', handleTouchEnd);
}

function handleTouchStart(e: TouchEvent): void {
  if (myCards.length === 0) return;

  const touch = e.touches[0];
  touchStartY = touch.clientY;
  touchStartTime = Date.now();
  isSwiping = true;

  // 최상단 카드 선택
  const cards = cardDeckEl.querySelectorAll('.controller-card');
  currentSwipeCard = cards[cards.length - 1] as HTMLElement;
}

function handleTouchMove(e: TouchEvent): void {
  if (!isSwiping || !currentSwipeCard) return;

  const touch = e.touches[0];
  const deltaY = touchStartY - touch.clientY;

  // 위로 스와이프만 허용
  if (deltaY > 0) {
    e.preventDefault();
    gsap.set(currentSwipeCard, {
      y: -deltaY,
      opacity: Math.max(0.3, 1 - deltaY / 200),
    });
  }
}

function handleTouchEnd(e: TouchEvent): void {
  if (!isSwiping || !currentSwipeCard) return;

  const touch = e.changedTouches[0];
  const deltaY = touchStartY - touch.clientY;
  const deltaTime = Date.now() - touchStartTime;

  // 속도 계산 (px/ms)
  const velocity = deltaY / deltaTime;

  // 스와이프 임계값: 50px 이상 또는 빠른 스와이프
  if (deltaY > 50 || velocity > 0.5) {
    playCard(velocity);
  } else {
    // 원위치로 복귀
    gsap.to(currentSwipeCard, {
      y: 0,
      opacity: 1,
      duration: 0.2,
      ease: 'power2.out',
    });
  }

  isSwiping = false;
  currentSwipeCard = null;
}

// 카드 플레이
function playCard(velocity: number): void {
  if (myCards.length === 0 || !currentSwipeCard) return;

  // 턴 체크
  if (!isMyTurn) {
    showNotification('내 턴이 아닙니다!', 'warning');
    // 카드 원위치
    gsap.to(currentSwipeCard, {
      y: 0,
      opacity: 1,
      duration: 0.2,
      ease: 'power2.out',
    });
    return;
  }

  // Play card drop sound immediately
  playCardDropSound();

  const playedCard = myCards.pop()!;
  const cardEl = currentSwipeCard;

  // 클램핑 없이 원본 velocity 사용 (0.01 ~ 5 범위 허용)
  const normalizedVelocity = Math.max(velocity, 0.01);
  const duration = 0.5 / normalizedVelocity;

  console.log(`🎮 [Controller] 스와이프 속도: ${normalizedVelocity.toFixed(2)} (원본: ${velocity.toFixed(2)})`);

  // 카드가 위로 날아가는 애니메이션
  gsap.to(cardEl, {
    y: -vh(40),
    opacity: 0,
    scale: 0.8,
    duration: duration,
    ease: 'power2.out',
    onComplete: () => {
      renderCardDeck();
    },
  });

  // 스크린에 카드 플레이 이벤트 전송
  controller.send('card-play', {
    card: playedCard,
    velocity: normalizedVelocity,
  });

  // 턴 종료
  isMyTurn = false;
  updateTurnIndicator();
}

// 카드 덱 렌더링
function renderCardDeck(): void {
  cardDeckEl.innerHTML = '';

  // 최대 5장까지만 시각적으로 쌓기
  const visibleCards = myCards.slice(-5);

  visibleCards.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'controller-card';
    cardEl.style.bottom = `${index * 3}px`;
    cardEl.style.zIndex = String(index);

    const imageSrc = FLOWER_IMAGES[card.flower];

    // Generate flowers with position classes
    const flowerElements = [];
    for (let i = 0; i < card.count; i++) {
      flowerElements.push(`<img class="controller-flower-icon flower-pos-${i + 1}" src="${imageSrc}" alt="${card.flower}" />`);
    }
    const flowers = flowerElements.join('');

    cardEl.innerHTML = `
      <div class="controller-card-inner" style="transform: rotateY(180deg);">
        <div class="controller-card-front">
          <div class="controller-card-fruits" data-count="${card.count}">${flowers}</div>
        </div>
        <div class="controller-card-back"></div>
      </div>
    `;

    cardDeckEl.appendChild(cardEl);
  });

  cardCountEl.textContent = `${myCards.length}장`;
}

// 스와이프 감지 초기화
setupSwipeDetection();

// 성스러운 종 강림 애니메이션
function animateBellDescent(onComplete?: () => void): void {
  // 타겟 위치 (화면 하단)
  const targetY = window.innerHeight - vh(20);

  // 컨테이너 생성
  const container = document.createElement('div');
  container.className = 'bell-container';
  container.innerHTML = `
    <div class="divine-light"></div>
    <div class="descending-bell"><img src="/img/Bell.png" alt="Bell" /></div>
    <div class="bell-glow"></div>
  `;
  document.body.appendChild(container);

  const divineLight = container.querySelector('.divine-light') as HTMLElement;
  const bell = container.querySelector('.descending-bell') as HTMLElement;
  const bellGlow = container.querySelector('.bell-glow') as HTMLElement;

  // 빛줄기 생성
  for (let i = 0; i < 8; i++) {
    const ray = document.createElement('div');
    ray.className = 'light-ray';
    ray.style.transform = `rotate(${i * 45}deg)`;
    container.appendChild(ray);
  }
  const rays = container.querySelectorAll('.light-ray');

  // 반짝이 파티클 생성 함수
  const createSparkle = () => {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    sparkle.style.left = `${45 + Math.random() * 10}%`;
    sparkle.style.top = `${(gsap.getProperty(bell, 'top') as number) + 60}px`;
    container.appendChild(sparkle);

    gsap.to(sparkle, {
      y: -40 - Math.random() * 40,
      x: (Math.random() - 0.5) * 80,
      opacity: 0,
      duration: 0.8 + Math.random() * 0.4,
      ease: 'power2.out',
      onComplete: () => sparkle.remove(),
    });
  };

  const tl = gsap.timeline();

  // 1단계: 신성한 빛 내려옴
  tl.to(divineLight, {
    opacity: 1,
    duration: 0.6,
    ease: 'power2.out',
  });

  // 2단계: 종이 천천히 하강 (화면 하단으로)
  tl.to(bell, {
    top: targetY,
    duration: 2,
    ease: 'power1.inOut',
    onUpdate: function() {
      if (Math.random() > 0.88) {
        createSparkle();
      }
    },
  }, '-=0.2');

  // 3단계: 도착 시 글로우 효과
  tl.to(bellGlow, {
    opacity: 1,
    scale: 1.3,
    top: targetY + 40,
    left: '50%',
    xPercent: -50,
    duration: 0.4,
    ease: 'power2.out',
  }, '-=0.4');

  // 4단계: 빛줄기 펼쳐짐
  tl.to(rays, {
    opacity: 0.7,
    height: 150,
    top: targetY + 40,
    left: '50%',
    duration: 0.5,
    stagger: 0.02,
    ease: 'power2.out',
  }, '-=0.2');

  // 5단계: 종 흔들림
  tl.to(bell, {
    keyframes: [
      { rotation: 12, duration: 0.12 },
      { rotation: -10, duration: 0.12 },
      { rotation: 6, duration: 0.1 },
      { rotation: -4, duration: 0.08 },
      { rotation: 0, duration: 0.08 },
    ],
    ease: 'power2.inOut',
  });

  // 글로우 펄스
  tl.to(bellGlow, {
    scale: 1.8,
    opacity: 0.2,
    duration: 0.3,
    ease: 'power2.out',
  }, '<');

  tl.to(bellGlow, {
    scale: 1,
    opacity: 0.6,
    duration: 0.2,
  });

  // 6단계: 빛 서서히 사라짐
  tl.to(divineLight, {
    opacity: 0,
    duration: 0.8,
    ease: 'power2.inOut',
  }, '-=0.1');

  tl.to(rays, {
    opacity: 0,
    duration: 0.6,
    ease: 'power2.inOut',
  }, '<');

  tl.to(bellGlow, {
    opacity: 0,
    duration: 0.4,
  });

  // 7단계: 종이 버튼 위치로 이동하고 버튼 표시
  tl.call(() => {
    container.remove();
    bellAreaEl.style.display = 'block';

    // 버튼 등장 애니메이션
    gsap.fromTo(bellBtn,
      { scale: 0 },
      {
        scale: 1,
        duration: 0.4,
        ease: 'back.out(1.7)',
        clearProps: 'transform',
      }
    );

    // 애니메이션 완료 후 콜백 호출
    if (onComplete) onComplete();
  });
}

// ============================================
// UI 헬퍼 함수들
// ============================================

// 턴 표시 업데이트
function updateTurnIndicator(): void {
  const app = document.getElementById('app');
  if (!app) return;

  if (isMyTurn) {
    app.classList.add('my-turn');
  } else {
    app.classList.remove('my-turn');
  }
}

// 알림 표시
function showNotification(text: string, type: 'success' | 'fail' | 'warning' | 'info'): void {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;

  const colors = {
    success: { bg: 'rgba(34, 197, 94, 0.9)', border: '#22c55e' },
    fail: { bg: 'rgba(239, 68, 68, 0.9)', border: '#ef4444' },
    warning: { bg: 'rgba(251, 191, 36, 0.9)', border: '#fbbf24' },
    info: { bg: 'rgba(59, 130, 246, 0.9)', border: '#3b82f6' },
  };

  notification.textContent = text;
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 16px 24px;
    border-radius: 12px;
    font-size: 18px;
    font-weight: bold;
    color: #fff;
    background: ${colors[type].bg};
    border: 2px solid ${colors[type].border};
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 2000;
    pointer-events: none;
  `;

  document.body.appendChild(notification);

  gsap.from(notification, {
    scale: 0,
    duration: 0.3,
    ease: 'back.out(1.7)',
  });

  gsap.to(notification, {
    opacity: 0,
    y: -30,
    duration: 0.3,
    delay: 1.5,
    onComplete: () => notification.remove(),
  });
}
