import { createController } from '@smoregg/sdk';
import { gsap } from 'gsap';

type Fruit = 'banana' | 'strawberry' | 'lime' | 'plum';

interface CardData {
  id: number;
  fruit: Fruit;
  count: number;
}

interface GameEvents {
  'card-dealt': { card: CardData };
  'game-start': Record<string, never>;
  'bell-descent': Record<string, never>;
  'tap': { timestamp: number };
  [key: string]: Record<string, unknown>;
}

const FRUIT_EMOJI: Record<Fruit, string> = {
  banana: '🍌',
  strawberry: '🍓',
  lime: '🍋',
  plum: '🍇',
};

// 내 카드 덱
const myCards: CardData[] = [];

// DOM 요소
const profileAreaEl = document.getElementById('profile-area')!;
const profileAvatarEl = document.getElementById('profile-avatar')!;
const profileNameEl = document.getElementById('profile-name')!;
const cardDeckEl = document.getElementById('card-deck')!;
const cardCountEl = document.getElementById('card-count')!;
const waitingMessageEl = document.getElementById('waiting-message')!;
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
    // 대기 메시지 숨기기
    waitingMessageEl.style.display = 'none';
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
  animateBellDescent();
});

// 게임 시작
controller.on('game-start', () => {
  // 종 버튼 활성화
  bellBtn.style.pointerEvents = 'auto';
  bellBtn.style.opacity = '1';
});

// 종 버튼
bellBtn.addEventListener('pointerdown', () => {
  controller.send('tap', { timestamp: Date.now() });

  // 버튼 누르는 효과
  gsap.to(bellBtn, {
    scale: 0.85,
    duration: 0.1,
    yoyo: true,
    repeat: 1,
  });
});

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

    const emoji = FRUIT_EMOJI[card.fruit];
    const fruits = new Array(card.count).fill(emoji).join('');

    cardEl.innerHTML = `
      <div class="controller-card-inner" style="transform: rotateY(180deg);">
        <div class="controller-card-front">
          <div class="controller-card-fruits">${fruits}</div>
        </div>
        <div class="controller-card-back"></div>
      </div>
    `;

    cardDeckEl.appendChild(cardEl);
  });

  cardCountEl.textContent = `${myCards.length}장`;
}

// 성스러운 종 강림 애니메이션
function animateBellDescent(): void {
  // 타겟 위치 (화면 하단)
  const targetY = window.innerHeight - 150;

  // 컨테이너 생성
  const container = document.createElement('div');
  container.className = 'bell-container';
  container.innerHTML = `
    <div class="divine-light"></div>
    <div class="descending-bell">🔔</div>
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
    gsap.from(bellBtn, {
      scale: 0,
      duration: 0.4,
      ease: 'back.out(1.7)',
    });
  });
}
