// ============================================
// 진입점 - S'MORE SDK 연결
// ============================================

import { renderGame, startGame, handleCardPlay, handleBellHit } from './game';
import { updatePlayerSlots } from './player';
import { screen } from './sdk';

// ============================================
// 초기화
// ============================================

const appEl = document.getElementById('app')!;
renderGame(appEl, startGame);

// ============================================
// S'MORE SDK 이벤트 핸들러
// ============================================

screen.onAllReady(() => {
  updatePlayerSlots(screen.controllers);
});

screen.onControllerJoin((playerIndex) => {
  updatePlayerSlots(screen.controllers);
});

screen.onControllerLeave((playerIndex) => {
  updatePlayerSlots(screen.controllers);
});

screen.onControllerDisconnect((playerIndex) => {
  updatePlayerSlots(screen.controllers);
});

screen.onControllerReconnect?.((playerIndex) => {
  updatePlayerSlots(screen.controllers);
});

// 게임 이벤트
screen.on('card-play', (playerIndex, data) => {
  handleCardPlay(playerIndex, data.velocity);
});

screen.on('bell-hit', (playerIndex, data) => {
  handleBellHit(playerIndex, data.timestamp);
});
