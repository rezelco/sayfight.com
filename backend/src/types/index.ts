export interface Player {
  id: string;
  name: string;
  roomCode: string;
  socketId: string;
  connected: boolean;
}

export interface Room {
  code: string;
  hostSocketId: string;
  players: Map<string, Player>;
  gameState: 'waiting' | 'preparing' | 'playing' | 'finished';
  createdAt: Date;
  hostDisconnectedAt?: Date;
  readyPlayers?: Map<string, { ready: boolean; hasMic: boolean }>;
}

export interface GameState {
  players: Array<{
    id: string;
    name: string;
    position: { x: number; y: number };
    score: number;
  }>;
  gameMode: string;
  timeRemaining: number;
}

export interface PlayerCommand {
  playerId: string;
  roomCode: string;
  command: string;
  type: 'movement' | 'action' | 'game_specific';
  confidence: number;
  timestamp: Date;
  playerName?: string;
}