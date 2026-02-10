// ============================================
// 플레이어 표시 관리
// ============================================

import type { ControllerInfo } from '@smoregg/sdk';

// 캐릭터 이미지 URL 생성
export function getCharacterImageUrl(
  appearance: { id: string; seed: string; style: string } | null | undefined
): string {
  if (!appearance) {
    return '';
  }
  // S'MORE 캐릭터 이미지 URL 형식
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

// 모든 플레이어 슬롯 업데이트
export function updatePlayerSlots(controllers: readonly ControllerInfo[]): void {
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`player-${i}`);
    if (!slot) continue;

    const player = controllers[i];
    slot.innerHTML = renderPlayerSlot(player);

    if (player) {
      slot.classList.add('active');
    } else {
      slot.classList.remove('active');
    }
  }
}
