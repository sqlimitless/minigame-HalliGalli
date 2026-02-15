// ============================================
// S'MORE SDK 관리
// ============================================

import { createScreen } from '@smoregg/sdk';
import type { Card } from './types';

interface GameEvents {
  'card-dealt': { card: Card };
  'game-start': Record<string, never>;
  'bell-descent': Record<string, never>;
  'card-play': { card: Card; velocity: number };
  'turn-change': { currentTurn: number };
  'your-turn': { isYourTurn: boolean };
  'bell-result': { success: boolean; playerIndex: number; flowerCount: Record<string, number> };
  'card-count-update': { count: number };
  'cards-collected': { cards: Card[] };
  'player-eliminated': { playerIndex: number };
  'game-over': { winner: number };
  'bell-hit': { timestamp: number };
  'bell-race-joined': Record<string, never>;
  'game-reset': Record<string, never>;
  [key: string]: Record<string, unknown>;
}

export const screen = createScreen<GameEvents>({ debug: true });

// 특정 플레이어에게 카드 분배 이벤트 전송
export function sendCardDealt(playerIndex: number, card: Card): void {
  screen.sendToController(playerIndex, 'card-dealt', { card });
}

// 모든 플레이어에게 종 강림 이벤트 전송
export function sendBellDescent(): void {
  screen.broadcast('bell-descent', {});
}

// 모든 플레이어에게 게임 시작 이벤트 전송
export function sendGameStart(): void {
  screen.broadcast('game-start', {});
}

// 턴 변경 브로드캐스트
export function sendTurnChange(currentTurn: number): void {
  screen.broadcast('turn-change', { currentTurn });
}

// 특정 플레이어에게 턴 알림
export function sendYourTurn(playerIndex: number, isYourTurn: boolean): void {
  screen.sendToController(playerIndex, 'your-turn', { isYourTurn });
}

// 종 결과 브로드캐스트
export function sendBellResult(success: boolean, playerIndex: number, flowerCount: Record<string, number>): void {
  screen.broadcast('bell-result', { success, playerIndex, flowerCount });
}

// 카드 수 업데이트
export function sendCardCountUpdate(playerIndex: number, count: number): void {
  screen.sendToController(playerIndex, 'card-count-update', { count });
}

// 수집한 카드 전송 (성공 시)
export function sendCardsCollected(playerIndex: number, cards: Card[]): void {
  screen.sendToController(playerIndex, 'cards-collected', { cards });
}

// 패널티 카드 수신 (실패 시 다른 플레이어들이 받음)
export function sendPenaltyCardReceived(playerIndex: number, card: Card): void {
  screen.sendToController(playerIndex, 'card-dealt', { card });
}

// 플레이어 탈락 브로드캐스트
export function sendPlayerEliminated(playerIndex: number): void {
  screen.broadcast('player-eliminated', { playerIndex });
}

// 게임 종료 브로드캐스트
export function sendGameOver(winner: number): void {
  screen.broadcast('game-over', { winner });
}

// 종 레이스 참가 알림 (개별 플레이어)
export function sendBellRaceJoined(playerIndex: number): void {
  screen.sendToController(playerIndex, 'bell-race-joined', {});
}

// 게임 리셋 브로드캐스트
export function sendGameReset(): void {
  screen.broadcast('game-reset', {});
}
