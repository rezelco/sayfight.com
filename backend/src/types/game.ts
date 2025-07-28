export type GameMode = 'voice_racer' | 'tug_of_war' | 'quick_draw' | 'word_bridge';
export type GameStatus = 'waiting' | 'countdown' | 'playing' | 'finished';

// Base game state shared by all games
export interface BaseGameState {
  mode: GameMode;
  status: GameStatus;
  startTime?: Date;
  endTime?: Date;
  winner?: string; // Player ID
  players: Map<string, PlayerGameState>;
}

// Player state within a game
export interface PlayerGameState {
  id: string;
  name: string;
  score: number;
  isAlive: boolean; // For elimination games
  position?: { x: number; y: number }; // For movement games
}

// Voice Racer specific state
export interface VoiceRacerState extends BaseGameState {
  mode: 'voice_racer';
  trackLength: number;
  playerPositions: Map<string, number>; // Player ID -> position on track (0-100)
  playerSpeeds: Map<string, number>; // Player ID -> current speed
  playerWords: Map<string, string>; // Player ID -> their unique word to say
}

// Quick Draw specific state
export interface QuickDrawState extends BaseGameState {
  mode: 'quick_draw';
  currentRound: number;
  drawSignalTime?: Date;
  eliminatedPlayers: Set<string>;
  roundWinners: string[];
}

// Word Bridge specific state
export interface WordBridgeState extends BaseGameState {
  mode: 'word_bridge';
  currentCategory: string;
  usedWords: Set<string>;
  playerBridges: Map<string, number>; // Player ID -> bridge progress
  categoryWords: string[];
}

// Tug of War specific state
export interface TugOfWarState extends BaseGameState {
  mode: 'tug_of_war';
  teams: {
    red: string[]; // Player IDs
    blue: string[]; // Player IDs
  };
  playerWords: Map<string, string>; // Player ID -> their unique word to say
  ropePosition: number; // -100 (red wins) to 100 (blue wins)
}

// Union type for all game states
export type GameState = VoiceRacerState | TugOfWarState | QuickDrawState | WordBridgeState;

// Game events
export interface GameEvent {
  type: 'game_update' | 'game_start' | 'game_end' | 'player_action';
  gameState: GameState;
  timestamp: Date;
}

// Voice commands mapped to game actions
export interface GameAction {
  playerId: string;
  command: string;
  timestamp: Date;
  matchScore?: number; // Score based on phrase completeness
}