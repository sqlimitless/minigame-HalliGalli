// ============================================
// 진입점 - S'MORE SDK 연결
// ============================================

import { createScreen } from '@smoregg/sdk';
import { renderGame, startGame } from './game';
import { updatePlayerSlots } from './player';

// ============================================
// 초기화
// ============================================

const appEl = document.getElementById('app')!;
renderGame(appEl, startGame);

// ============================================
// S'MORE SDK 연결
// ============================================

interface GameEvents {
  'bell-hit': { timestamp: number };
  [key: string]: Record<string, unknown>;
}

const screen = createScreen<GameEvents>({ debug: true });

// SDK 이벤트 핸들러
screen.onAllReady(() => {
  console.log('Room ready:', screen.roomCode);
  updatePlayerSlots(screen.controllers);
});

screen.onControllerJoin((playerIndex) => {
  console.log('Player joined:', playerIndex);
  updatePlayerSlots(screen.controllers);
});

screen.onControllerLeave((playerIndex) => {
  console.log('Player left:', playerIndex);
  updatePlayerSlots(screen.controllers);
});

screen.onControllerDisconnect((playerIndex) => {
  console.log('Player disconnected:', playerIndex);
  updatePlayerSlots(screen.controllers);
});

screen.onControllerReconnect?.((playerIndex) => {
  console.log('Player reconnected:', playerIndex);
  updatePlayerSlots(screen.controllers);
});

// 게임 이벤트
screen.on('bell-hit', (playerIndex, data) => {
  console.log(`Player ${playerIndex} hit the bell at ${data.timestamp}`);
});
