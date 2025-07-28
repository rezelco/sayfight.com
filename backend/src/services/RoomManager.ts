import { Room, Player } from '../types';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerToRoom: Map<string, string> = new Map();

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  generateRoomCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code: string;
    
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
    } while (this.rooms.has(code));
    
    return code;
  }

  createRoom(hostSocketId: string): string {
    const code = this.generateRoomCode();
    const room: Room = {
      code,
      hostSocketId,
      players: new Map(),
      gameState: 'waiting',
      createdAt: new Date(),
      readyPlayers: new Map()
    };
    
    this.rooms.set(code, room);
    return code;
  }

  joinRoom(roomCode: string, player: Player): boolean {
    const room = this.rooms.get(roomCode);
    if (!room || room.gameState !== 'waiting') {
      return false;
    }
    
    room.players.set(player.id, player);
    this.playerToRoom.set(player.socketId, roomCode);
    return true;
  }

  leaveRoom(socketId: string): { roomCode: string; playerId: string; isHost?: boolean } | null {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) return null;
    
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    let playerId: string | null = null;
    
    // Find and mark player as disconnected (don't remove them)
    for (const [id, player] of room.players) {
      if (player.socketId === socketId) {
        playerId = id;
        player.connected = false;
        break;
      }
    }
    
    this.playerToRoom.delete(socketId);
    
    // If host disconnected, mark the disconnection time but keep the room
    if (room.hostSocketId === socketId) {
      room.hostDisconnectedAt = new Date();
      // Don't delete the room immediately - let cleanup handle it
      return { roomCode, playerId: 'host', isHost: true };
    }
    
    return playerId ? { roomCode, playerId } : null;
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  getRoomBySocketId(socketId: string): Room | undefined {
    // Check if socket is a host
    for (const room of this.rooms.values()) {
      if (room.hostSocketId === socketId) {
        return room;
      }
    }
    
    // Check if socket is a player
    const roomCode = this.playerToRoom.get(socketId);
    if (roomCode) {
      return this.rooms.get(roomCode);
    }
    
    return undefined;
  }

  getRoomByPlayerId(playerId: string): string | undefined {
    // Search through all rooms to find the player
    for (const [roomCode, room] of this.rooms) {
      if (room.players.has(playerId)) {
        return roomCode;
      }
    }
    return undefined;
  }

  startGame(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room || room.players.size < 1) {
      return false;
    }
    
    room.gameState = 'playing';
    return true;
  }

  endGame(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return false;
    }
    
    room.gameState = 'finished';
    return true;
  }

  resetRoom(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return false;
    }
    
    // Reset room state back to waiting
    room.gameState = 'waiting';
    
    // Clear ready players map
    if (room.readyPlayers) {
      room.readyPlayers.clear();
    }
    
    return true;
  }

  reconnectHost(roomCode: string, newSocketId: string): Room | null {
    const room = this.rooms.get(roomCode);
    
    // Check if room exists and is still valid
    if (!room) {
      return null;
    }
    
    // Update the host socket ID to the new connection
    room.hostSocketId = newSocketId;
    // Clear the disconnection timestamp since host is back
    delete room.hostDisconnectedAt;
    
    return room;
  }

  isRoomValid(roomCode: string): boolean {
    return this.rooms.has(roomCode);
  }

  reconnectPlayer(roomCode: string, playerId: string, newSocketId: string): Player | null {
    const room = this.rooms.get(roomCode);
    
    if (!room) {
      return null;
    }
    
    const player = room.players.get(playerId);
    if (!player) {
      return null;
    }
    
    // Update player's socket ID and mark as connected
    player.socketId = newSocketId;
    player.connected = true;
    this.playerToRoom.set(newSocketId, roomCode);
    
    return player;
  }

  // Clean up old rooms (call periodically)
  cleanupOldRooms(): void {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000); // 30 second grace period for host reconnection
    
    for (const [code, room] of this.rooms) {
      // Clean up very old rooms
      if (room.createdAt < twoHoursAgo) {
        // Remove all players from this room
        for (const player of room.players.values()) {
          this.playerToRoom.delete(player.socketId);
        }
        this.rooms.delete(code);
      }
      // Clean up rooms where host disconnected and didn't reconnect within grace period
      else if (room.hostDisconnectedAt && room.hostDisconnectedAt < thirtySecondsAgo) {
        // Remove all players from this room
        for (const player of room.players.values()) {
          this.playerToRoom.delete(player.socketId);
        }
        this.rooms.delete(code);
      }
    }
  }

  // Get rooms that should notify players of host disconnection
  getRoomsToNotifyHostDisconnect(): string[] {
    const now = new Date();
    const fiveSecondsAgo = new Date(now.getTime() - 5 * 1000); // Wait 5 seconds before notifying
    const roomCodes: string[] = [];
    
    for (const [code, room] of this.rooms) {
      if (room.hostDisconnectedAt && 
          room.hostDisconnectedAt < fiveSecondsAgo && 
          room.hostDisconnectedAt > new Date(now.getTime() - 30 * 1000)) {
        roomCodes.push(code);
      }
    }
    
    return roomCodes;
  }

  // Get count of active rooms
  getRoomCount(): number {
    return this.rooms.size;
  }

  // Get total count of players across all rooms
  getTotalPlayerCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.players.size;
    }
    return count;
  }
  
  // Remove a player completely from a room (used by host)
  removePlayer(roomCode: string, playerId: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    
    const player = room.players.get(playerId);
    if (!player) return false;
    
    // Remove from room players
    room.players.delete(playerId);
    
    // Remove from playerToRoom mapping
    if (player.socketId) {
      this.playerToRoom.delete(player.socketId);
    }
    
    return true;
  }
}