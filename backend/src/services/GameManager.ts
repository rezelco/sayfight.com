import { EventEmitter } from 'events';
import { 
  GameState, 
  GameMode, 
  VoiceRacerState, 
  TugOfWarState,
  PlayerGameState,
  GameAction 
} from '../types/game';
import { Player } from '../types';

export class GameManager extends EventEmitter {
  private games: Map<string, GameState> = new Map(); // roomCode -> GameState
  private gameLoops: Map<string, NodeJS.Timeout> = new Map(); // roomCode -> interval
  
  // Pool of racing words - short, easy to say, distinct sounds
  private static readonly RACING_WORDS = [
    // Animals and their absurd actions
    'wifi', 'gravity', 'homework', 'rockets', 'tuxedos', 'waves', 'math', 'cookies', 'poetry', 'sweaters',
    'insurance', 'murals', 'ferraris', 'yoga', 'castles', 'chess', 'restaurants', 'websites', 'podcasts', 'hair',
    'storms', 'revolutions', 'tacos', 'karate', 'ninjas', 'helicopters', 'kingdoms', 'symphonies', 'mysteries', 'pyramids',
    'pizza', 'marathons', 'crime', 'saxophone', 'pineapples', 'bands', 'dance', 'bitcoin', 'rainbows', 'volleyball',
    'novels', 'bread', 'professionally', 'vacuums', 'mittens', 'ceramics', 'computers', 'opera', 'origami', 'parties',
    'coffee', 'hearts', 'screenplays', 'drums', 'physics', 'bicycles', 'pools', 'flowers', 'mainframes', 'spotlight',
    'loudly', 'nails', 'feelings', 'magic', 'lawyers', 'jazz', 'chaos', 'cupcakes', 'kindergarten', 'submarines',
    'socks', 'backwards', 'poorly', 'war', 'high', 'internet', 'portraits', 'fast', 'jokes', 'ballads',
    'hard', 'spaceships', 'boats', 'mockingly', 'salsa', 'jets', 'knights', 'gossip', 'masterpieces', 'systems',
    'fortunes', 'disco', 'blogs', 'treasure', 'reality'
  ];
  
  constructor() {
    super();
  }

  // Create a new game for a room
  createGame(roomCode: string, mode: GameMode, players: Map<string, Player>): GameState {
    console.log(`Creating ${mode} game for room ${roomCode}`);
    
    // Stop any existing game
    this.endGame(roomCode);
    
    let gameState: GameState;
    
    switch (mode) {
      case 'voice_racer':
        gameState = this.createVoiceRacerGame(roomCode, players);
        break;
      case 'tug_of_war':
        gameState = this.createTugOfWarGame(roomCode, players);
        break;
      case 'quick_draw':
        // TODO: Implement Quick Draw
        throw new Error('Quick Draw not implemented yet');
      case 'word_bridge':
        // TODO: Implement Word Bridge
        throw new Error('Word Bridge not implemented yet');
      default:
        throw new Error(`Unknown game mode: ${mode}`);
    }
    
    this.games.set(roomCode, gameState);
    return gameState;
  }

  // Create Voice Racer game state
  private createVoiceRacerGame(_roomCode: string, players: Map<string, Player>): VoiceRacerState {
    const playerGameStates = new Map<string, PlayerGameState>();
    const playerPositions = new Map<string, number>();
    const playerSpeeds = new Map<string, number>();
    const playerWords = new Map<string, string>();
    
    // Shuffle words to assign randomly
    const availableWords = [...GameManager.RACING_WORDS];
    for (let i = availableWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableWords[i], availableWords[j]] = [availableWords[j], availableWords[i]];
    }
    
    // Initialize each player
    let wordIndex = 0;
    players.forEach((player, playerId) => {
      playerGameStates.set(playerId, {
        id: playerId,
        name: player.name,
        score: 0,
        isAlive: true,
        position: { x: 0, y: 50 } // Start at left side, middle height
      });
      playerPositions.set(playerId, 0); // Start at beginning of track
      playerSpeeds.set(playerId, 0); // Start with no speed
      
      // Assign a unique word to each player
      const assignedWord = availableWords[wordIndex % availableWords.length];
      playerWords.set(playerId, assignedWord);
      wordIndex++;
      
      console.log(`Player ${player.name} (${playerId}) assigned word: "${assignedWord}"`);
    });
    
    return {
      mode: 'voice_racer',
      status: 'waiting',
      players: playerGameStates,
      trackLength: 100, // Simple 100 unit track
      playerPositions,
      playerSpeeds,
      playerWords
    };
  }

  // Create Tug of War game state
  private createTugOfWarGame(_roomCode: string, players: Map<string, Player>): TugOfWarState {
    const playerGameStates = new Map<string, PlayerGameState>();
    const playerWords = new Map<string, string>();
    const playerArray = Array.from(players.values());
    
    // Check for even number of players
    if (playerArray.length % 2 !== 0) {
      throw new Error('Tug of War requires an even number of players');
    }
    
    // Shuffle words to assign randomly
    const availableWords = [...GameManager.RACING_WORDS];
    for (let i = availableWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableWords[i], availableWords[j]] = [availableWords[j], availableWords[i]];
    }
    
    // Split players into two teams
    const midpoint = playerArray.length / 2;
    const redTeam: string[] = [];
    const blueTeam: string[] = [];
    
    let wordIndex = 0;
    playerArray.forEach((player, index) => {
      playerGameStates.set(player.id, {
        id: player.id,
        name: player.name,
        score: 0,
        isAlive: true,
        position: { x: index < midpoint ? 25 : 75, y: 50 } // Position on left or right
      });
      
      // Assign a unique word to each player
      const assignedWord = availableWords[wordIndex % availableWords.length];
      playerWords.set(player.id, assignedWord);
      wordIndex++;
      
      if (index < midpoint) {
        redTeam.push(player.id);
        console.log(`Player ${player.name} (${player.id}) assigned to RED team with word: "${assignedWord}"`);
      } else {
        blueTeam.push(player.id);
        console.log(`Player ${player.name} (${player.id}) assigned to BLUE team with word: "${assignedWord}"`);
      }
    });
    
    return {
      mode: 'tug_of_war',
      status: 'waiting',
      players: playerGameStates,
      teams: {
        red: redTeam,
        blue: blueTeam
      },
      playerWords,
      ropePosition: 0 // Start at center
    };
  }

  // Start the game
  startGame(roomCode: string): void {
    const game = this.games.get(roomCode);
    if (!game) {
      throw new Error(`No game found for room ${roomCode}`);
    }
    
    game.status = 'countdown';
    game.startTime = new Date();
    
    // Start countdown
    let countdown = 3;
    const countdownInterval = setInterval(() => {
      this.emit('countdown', { roomCode, count: countdown });
      countdown--;
      
      if (countdown < 0) {
        clearInterval(countdownInterval);
        game.status = 'playing';
        this.startGameLoop(roomCode);
      }
    }, 1000);
  }

  // Start the 60 FPS game loop
  private startGameLoop(roomCode: string): void {
    const FRAME_RATE = 60;
    const FRAME_TIME = 1000 / FRAME_RATE; // ~16.67ms
    
    const gameLoop = setInterval(() => {
      const game = this.games.get(roomCode);
      if (!game || game.status !== 'playing') {
        this.stopGameLoop(roomCode);
        return;
      }
      
      // Update game based on mode
      switch (game.mode) {
        case 'voice_racer':
          this.updateVoiceRacer(game as VoiceRacerState);
          break;
        case 'tug_of_war':
          this.updateTugOfWar(game as TugOfWarState);
          break;
        // Add other game modes here
      }
      
      // Convert Maps to objects for serialization
      const serializedGame = this.serializeGameState(game);
      
      // Emit updated game state
      this.emit('gameUpdate', { roomCode, gameState: serializedGame });
      
      // Check for game end conditions
      if (this.checkGameEnd(game)) {
        this.endGame(roomCode);
      }
    }, FRAME_TIME);
    
    this.gameLoops.set(roomCode, gameLoop);
    console.log(`Started game loop for room ${roomCode} at ${FRAME_RATE} FPS`);
  }

  // Update Voice Racer game state
  private updateVoiceRacer(game: VoiceRacerState): void {
    const FRICTION = 0.98; // Reduced friction for smoother coasting
    
    // Update each player's position based on speed
    game.playerPositions.forEach((position, playerId) => {
      const speed = game.playerSpeeds.get(playerId) || 0;
      
      // Apply friction
      const newSpeed = speed * FRICTION;
      game.playerSpeeds.set(playerId, newSpeed > 0.001 ? newSpeed : 0); // Stop if very slow (adjusted for 10x slower speeds)
      
      // Update position (allow slight overshoot for finish detection)
      const newPosition = Math.min(position + newSpeed, game.trackLength + 1);
      game.playerPositions.set(playerId, newPosition);
      
      // Update player game state position
      const playerState = game.players.get(playerId);
      if (playerState && playerState.position) {
        playerState.position.x = (newPosition / game.trackLength) * 100; // Convert to percentage
      }
    });
  }

  // Update Tug of War game state
  private updateTugOfWar(_game: TugOfWarState): void {
    // Rope stays in position - no auto-centering
    // The rope only moves when players actively pull
  }

  // Process voice command
  processCommand(roomCode: string, action: GameAction): void {
    const game = this.games.get(roomCode);
    if (!game || game.status !== 'playing') {
      return;
    }
    
    switch (game.mode) {
      case 'voice_racer':
        this.processVoiceRacerCommand(game as VoiceRacerState, action);
        break;
      case 'tug_of_war':
        this.processTugOfWarCommand(game as TugOfWarState, action);
        break;
      // Add other game modes here
    }
  }

  // Process Voice Racer commands
  private processVoiceRacerCommand(game: VoiceRacerState, action: GameAction): void {
    const { playerId, command, matchScore = 1.0 } = action;
    const playerWord = game.playerWords.get(playerId);
    
    if (!playerWord) {
      console.log(`No word assigned to player ${playerId}`);
      return;
    }
    
    // CommandExtractor has already validated this is a match
    // Apply speed boost based on match score
    const currentSpeed = game.playerSpeeds.get(playerId) || 0;
    
    // Base boost amount, multiplied by match score
    const baseBoost = currentSpeed < 0.015 ? 0.06 : 0.04;
    const boostAmount = baseBoost * matchScore; // 1x for trigger word, 1.5x for 2 words, 2x for full phrase
    const newSpeed = Math.min(currentSpeed + boostAmount, 0.15 * matchScore); // Max speed also scales
    
    game.playerSpeeds.set(playerId, newSpeed);
    
    // Log with match score info
    const scoreText = matchScore === 2.0 ? ' (full phrase!)' : matchScore === 1.5 ? ' (partial phrase)' : '';
    console.log(`Player ${playerId} said "${command}"${scoreText} - boosted to speed ${newSpeed.toFixed(2)}`);
  }

  // Process Tug of War commands
  private processTugOfWarCommand(game: TugOfWarState, action: GameAction): void {
    const { playerId, matchScore = 1.0 } = action;
    
    // Find which team the player is on
    const isRedTeam = game.teams.red.includes(playerId);
    const isBlueTeam = game.teams.blue.includes(playerId);
    
    if (!isRedTeam && !isBlueTeam) {
      console.log(`Player ${playerId} not found in any team`);
      return;
    }
    
    // CommandExtractor has already validated this is a match
    // Apply pull force based on match score
    const BASE_PULL_FORCE = 3;
    const pullForce = BASE_PULL_FORCE * matchScore; // 1x for trigger word, 1.5x for 2 words, 2x for full phrase
    
    // Log with match score info
    const scoreText = matchScore === 2.0 ? ' (full phrase!)' : matchScore === 1.5 ? ' (partial phrase)' : '';
    
    if (isRedTeam) {
      game.ropePosition = Math.max(-100, game.ropePosition - pullForce);
      console.log(`RED team player ${playerId} pulled${scoreText}! Force: ${pullForce.toFixed(1)}, Rope at ${game.ropePosition.toFixed(1)}`);
    } else {
      game.ropePosition = Math.min(100, game.ropePosition + pullForce);
      console.log(`BLUE team player ${playerId} pulled${scoreText}! Force: ${pullForce.toFixed(1)}, Rope at ${game.ropePosition.toFixed(1)}`);
    }
  }

  // Check if game should end
  private checkGameEnd(game: GameState): boolean {
    switch (game.mode) {
      case 'voice_racer':
        // Check if any player reached the finish line
        const racerGame = game as VoiceRacerState;
        for (const [playerId, position] of racerGame.playerPositions) {
          if (position >= racerGame.trackLength) {
            game.winner = playerId;
            return true;
          }
        }
        break;
      case 'tug_of_war':
        // Check if rope reached either side
        const tugGame = game as TugOfWarState;
        if (tugGame.ropePosition <= -80) {
          // Red team wins - set first red player as winner for now
          game.winner = tugGame.teams.red[0];
          console.log('RED team wins!');
          return true;
        } else if (tugGame.ropePosition >= 80) {
          // Blue team wins - set first blue player as winner for now
          game.winner = tugGame.teams.blue[0];
          console.log('BLUE team wins!');
          return true;
        }
        break;
      // Add other game end conditions
    }
    
    return false;
  }

  // Stop game loop
  private stopGameLoop(roomCode: string): void {
    const loop = this.gameLoops.get(roomCode);
    if (loop) {
      clearInterval(loop);
      this.gameLoops.delete(roomCode);
      console.log(`Stopped game loop for room ${roomCode}`);
    }
  }

  // End game
  endGame(roomCode: string): void {
    this.stopGameLoop(roomCode);
    
    const game = this.games.get(roomCode);
    if (game) {
      game.status = 'finished';
      game.endTime = new Date();
      const serializedGame = this.serializeGameState(game);
      this.emit('gameEnd', { roomCode, gameState: serializedGame });
      
      // Delete game state immediately to ensure clean state for new games
      this.games.delete(roomCode);
    }
  }

  // Get game state
  getGame(roomCode: string): GameState | undefined {
    return this.games.get(roomCode);
  }
  
  // Get serialized game state for Socket.io
  getSerializedGameState(roomCode: string): any | undefined {
    const game = this.games.get(roomCode);
    return game ? this.serializeGameState(game) : undefined;
  }

  // Get all active games
  getActiveGames(): number {
    return this.games.size;
  }
  
  // Serialize game state for Socket.io transmission
  private serializeGameState(game: GameState): any {
    const serialized: any = {
      ...game,
      players: Object.fromEntries(game.players),
    };
    
    // Handle Voice Racer specific fields
    if (game.mode === 'voice_racer') {
      const racerGame = game as VoiceRacerState;
      serialized.playerPositions = Object.fromEntries(racerGame.playerPositions);
      serialized.playerSpeeds = Object.fromEntries(racerGame.playerSpeeds);
      serialized.playerWords = Object.fromEntries(racerGame.playerWords);
    }
    
    // Handle Tug of War specific fields
    if (game.mode === 'tug_of_war') {
      const tugGame = game as TugOfWarState;
      serialized.teams = tugGame.teams;
      serialized.playerWords = Object.fromEntries(tugGame.playerWords);
      serialized.ropePosition = tugGame.ropePosition;
    }
    
    return serialized;
  }
}