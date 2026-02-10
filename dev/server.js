/**
 * S'MORE Dev Server - minimal Socket.IO relay for local development.
 *
 * Replicates the production genericRelay protocol:
 *   Player -> Host: attach playerIndex, forward to host socket
 *   Host -> All:    broadcast to all player sockets (no targetPlayerIndex)
 *   Host -> One:    route to specific player, strip targetPlayerIndex
 *
 * System events (smore:*) are handled explicitly and never relayed.
 */

import express from 'express';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { networkInterfaces } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Port detection ──

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = createTcpServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
}

async function findPort(preferred) {
  for (let p = preferred; p < preferred + 100; p++) {
    if (await isPortFree(p)) return p;
  }
  return new Promise((resolve) => {
    const srv = createTcpServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// ── Room state ──

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const room = {
  code: generateCode(),
  hostSocketId: null,
  players: [],       // { socketId, playerIndex, nickname, sessionId }
  nextIndex: 0,
  gameId: '',
  status: 'waiting',
  readyIds: new Set(),
};

function toPlayerDTO(p) {
  return { playerIndex: p.playerIndex, name: p.nickname, connected: p.connected !== undefined ? p.connected : true, character: null };
}

function toRoomDTO() {
  return {
    code: room.code,
    players: room.players.map(toPlayerDTO),
    maxPlayers: 12,
    gameId: room.gameId,
    status: room.status,
    gameSelectionMode: false,
  };
}

// ── Main ──

async function main() {
  const SERVER_PORT = await findPort(3000);
  const SCREEN_PORT = await findPort(5173);
  const CONTROLLER_PORT = await findPort(5174);

  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
    },
  });

  // ── Serve dev harness & controller page ──

  function servePage(filePath) {
    return (_req, res) => {
      let html = readFileSync(filePath, 'utf-8');
      html = html.replace(/__LOCAL_IP__/g, localIP);
      html = html.replace(/__SERVER_PORT__/g, String(SERVER_PORT));
      html = html.replace(/__SCREEN_PORT__/g, String(SCREEN_PORT));
      html = html.replace(/__CONTROLLER_PORT__/g, String(CONTROLLER_PORT));
      res.type('html').send(html);
    };
  }

  const localIP = getLocalIP();
  app.get('/', servePage(join(__dirname, 'index.html')));
  app.get('/controller', servePage(join(__dirname, 'controller.html')));

  // ── Socket handling ──

  io.on('connection', (socket) => {
    console.log('  [connect] ' + socket.id);

    // Screen (host) connects
    // Note: smore:create matches production server's EVENT_NAMES.ROOM.CREATE
    socket.on('smore:create', (data, callback) => {
      // Reset room state for fresh start
      room.players = [];
      room.nextIndex = 0;
      room.gameId = '';
      room.status = 'waiting';
      room.hostSocketId = socket.id;
      socket.role = 'host';
      socket.join(room.code);
      console.log('  [host] Screen connected, room ' + room.code);
      if (typeof callback === 'function') {
        callback({ code: room.code, room: toRoomDTO() });
      }
    });

    // Controller (player) joins
    socket.on('smore:join', (data, callback) => {
      const playerIndex = room.nextIndex++;
      const sessionId = 'session-' + playerIndex;
      const nickname = (data && data.nickname) || ('Player ' + (playerIndex + 1));

      const player = { socketId: socket.id, playerIndex, nickname, sessionId };
      room.players.push(player);

      socket.role = 'player';
      socket.playerIndex = playerIndex;
      socket.sessionId = sessionId;
      socket.join(room.code);

      console.log('  [join] ' + nickname + ' (index ' + playerIndex + ')');

      // Notify entire room (host + all controllers)
      io.to(room.code).emit('smore:player-joined', {
        player: toPlayerDTO(player),
        room: toRoomDTO(),
      });

      if (typeof callback === 'function') {
        callback({
          success: true,
          playerIndex,
          sessionId,
          roomCode: room.code,
          player: toPlayerDTO(player),
          room: toRoomDTO(),
        });
      }
    });

    // Game lifecycle
    // NOTE: Dev server combines select-game + start-game for simplicity.
    // Production server handles these as separate events.
    socket.on('smore:select-game', (data) => {
      room.gameId = (data && data.gameId) || '';
      room.readyIds = new Set();
      room.status = 'playing';
      console.log('  [game] Selected: ' + room.gameId);
      io.to(room.code).emit('smore:game-selected', { gameId: room.gameId, room: toRoomDTO() });
      io.to(room.code).emit('smore:game-started', { gameId: room.gameId, room: toRoomDTO() });
    });

    socket.on('smore:start-game', (data) => {
      room.status = 'playing';
      console.log('  [game] Started');
      io.to(room.code).emit('smore:game-started', { gameId: room.gameId, room: toRoomDTO() });
    });

    // Game ready sync: collect ready signals, broadcast all-ready when complete
    socket.on('smore:game-ready', () => {
      if (room.status !== 'playing') return;
      const id = socket.role === 'host' ? '__host__' : socket.sessionId;
      if (!id) return;
      room.readyIds.add(id);
      // Check: host ready + all players ready
      const hostReady = room.readyIds.has('__host__');
      const allPlayersReady = room.players.length > 0 && room.players.every(p => room.readyIds.has(p.sessionId));
      if (hostReady && allPlayersReady) {
        console.log('  [ready] All participants ready, broadcasting all-ready');
        io.to(room.code).emit('smore:all-ready', {});
        room.readyIds.clear();
      }
    });

    socket.on('smore:game-over', (data) => {
      room.status = 'finished';
      console.log('  [game] Game over');
      io.to(room.code).emit('smore:game-over', data);
    });

    socket.on('smore:return-to-selection', () => {
      room.status = 'waiting';
      room.gameId = '';
      console.log('  [game] Return to selection');
      io.to(room.code).emit('smore:selection-returned', { room: toRoomDTO() });
    });

    // Dashboard reset
    socket.on('smore:reset-room', (data, callback) => {
      if (socket.role !== 'host') return;
      // Emit kicked to all players (they will disconnect themselves)
      for (const p of room.players) {
        const ps = io.sockets.sockets.get(p.socketId);
        if (ps) ps.emit('smore:kicked');
      }
      // Clear room state immediately (no setTimeout!)
      room.players = [];
      room.nextIndex = 0;
      room.gameId = '';
      room.status = 'waiting';
      room.readyIds = new Set();
      console.log('  [reset] Room reset by host');
      if (typeof callback === 'function') callback({ success: true });
    });

    // ── Generic relay (the core protocol) ──
    // Note: Rate limiting is not implemented in dev server. Production server applies rate limits.
    // Note: Event name validation (EVENT_NAME_REGEX) is not implemented in dev server. SDK client-side validateEventName() provides primary validation.
    socket.onAny((event, ...args) => {
      // Skip system events - they are handled above
      if (event.startsWith('smore:')) return;

      const data = args[0];
      const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;

      if (socket.role === 'player') {
        // Player -> Host: inject playerIndex, forward to host
        if (!room.hostSocketId) {
          if (callback) callback({ success: false, error: 'No host' });
          return;
        }

        const payload = data && typeof data === 'object' ? data : (data !== undefined ? { data: data } : {});
        io.to(room.hostSocketId).emit(event, {
          ...payload,
          playerIndex: socket.playerIndex,
        });

        if (callback) callback({ success: true });

      } else if (socket.role === 'host') {
        if (data && data.targetPlayerIndex !== undefined) {
          // Host -> Specific Player: route by playerIndex, strip targetPlayerIndex
          const target = room.players.find((p) => p.playerIndex === data.targetPlayerIndex);
          if (target) {
            const { targetPlayerIndex, ...rest } = data;
            io.to(target.socketId).emit(event, rest);
          }
        } else {
          // Host -> All Players: broadcast to room (excludes host)
          socket.to(room.code).emit(event, data);
        }
      }
    });

    // Disconnect
    // Dev server limitation: no reconnection support.
    // Production server has a grace period + sessionId-based reconnect.
    // Here, disconnect immediately removes the player (simplified for dev).
    // This means we emit smore:player-left instead of smore:player-disconnected,
    // because the player is permanently removed from the room.
    socket.on('disconnect', () => {
      if (socket.role === 'player') {
        const idx = room.players.findIndex((p) => p.socketId === socket.id);
        if (idx !== -1) {
          const player = room.players[idx];
          room.players.splice(idx, 1);
          console.log('  [leave] Player ' + player.playerIndex + ' left');

          // Notify entire room (host + all controllers)
          // Dev server immediately removes players, so emit smore:player-left.
          io.to(room.code).emit('smore:player-left', {
            player: toPlayerDTO(player),
            room: toRoomDTO(),
          });
        }
      } else if (socket.role === 'host') {
        console.log('  [host] Screen disconnected');
        room.hostSocketId = null;
      }
    });
  });

  // ── Start ──

  server.listen(SERVER_PORT, () => {
    console.log('');
    console.log("  \x1b[1m\x1b[35mS'MORE Dev Server\x1b[0m");
    console.log('');
    console.log('  Room Code:   \x1b[1m\x1b[36m' + room.code + '\x1b[0m');
    console.log('');
    console.log('  Dashboard:   \x1b[36mhttp://localhost:' + SERVER_PORT + '\x1b[0m');
    console.log('  Controller:  \x1b[36mhttp://' + localIP + ':' + SERVER_PORT + '/controller\x1b[0m  (open on phone)');
    console.log('');
    console.log('  Screen app:  \x1b[36mhttp://localhost:' + SCREEN_PORT + '\x1b[0m');
    console.log('  Controller:  \x1b[36mhttp://localhost:' + CONTROLLER_PORT + '\x1b[0m');
    console.log('');
  });

  const ROOT = join(__dirname, '..');
  const screenProc = spawn('npx', ['vite', '--port', String(SCREEN_PORT), '--host'], {
    cwd: join(ROOT, 'screen'), stdio: ['ignore', 'pipe', 'pipe'], shell: true,
  });
  const controllerProc = spawn('npx', ['vite', '--port', String(CONTROLLER_PORT), '--host'], {
    cwd: join(ROOT, 'controller'), stdio: ['ignore', 'pipe', 'pipe'], shell: true,
  });
  screenProc.stderr.on('data', (d) => { const s = d.toString().trim(); if (s) console.error('  \x1b[33m[screen]\x1b[0m ' + s); });
  controllerProc.stderr.on('data', (d) => { const s = d.toString().trim(); if (s) console.error('  \x1b[33m[controller]\x1b[0m ' + s); });
  function cleanup() { screenProc.kill(); controllerProc.kill(); process.exit(); }
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main();
