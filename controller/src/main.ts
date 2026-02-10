import { createController } from '@smoregg/sdk';

interface GameEvents {
  'score-update': { score: number };
  'personal-message': { text: string };
  'tap': { timestamp: number };
}

let count = 0;

const playerInfoEl = document.getElementById('player-info')!;
const countEl = document.getElementById('count')!;
const tapBtn = document.getElementById('tap-btn')!;

const controller = createController<GameEvents>({ debug: true });

// Lifecycle callbacks (uncomment to use):
// controller.onControllerJoin((playerIndex, info) => { console.log('Player joined:', playerIndex); });
// controller.onControllerLeave((playerIndex) => { console.log('Player left:', playerIndex); });
// controller.onError((error) => { console.error('SDK Error:', error.message); });
// controller.onAllReady(() => { console.log('All participants ready'); });
// To control autoReady: createScreen({ autoReady: false }) or createController({ autoReady: false })

controller.onAllReady(() => {
  playerInfoEl.textContent = `Player ${controller.myPlayerIndex}`;
});

controller.on('score-update', (data) => {
  count = data.score;
  countEl.textContent = String(count);
});

controller.on('personal-message', (data) => {
  console.log('Received message:', data.text);
});

tapBtn.addEventListener('pointerdown', () => {
  controller.send('tap', { timestamp: Date.now() });
  count++;
  countEl.textContent = String(count);
});
