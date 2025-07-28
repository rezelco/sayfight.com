'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export default function TestSessionPage() {
  const [hostSocket, setHostSocket] = useState<Socket | null>(null);
  const [playerSocket, setPlayerSocket] = useState<Socket | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string, success: boolean = true) => {
    const timestamp = new Date().toLocaleTimeString();
    const icon = success ? '✅' : '❌';
    setTestResults(prev => [...prev, `${timestamp} ${icon} ${message}`]);
  };

  const runHostRefreshTest = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    
    // Step 1: Create host and room
    addResult('Creating host connection and room...');
    const host = io(socketUrl, { timeout: 5000 });
    setHostSocket(host);
    
    await new Promise<void>((resolve) => {
      host.on('connect', () => resolve());
    });
    
    const roomPromise = new Promise<string>((resolve) => {
      host.on('roomCreated', (code: string) => {
        setRoomCode(code);
        resolve(code);
      });
    });
    
    host.emit('createRoom');
    const createdRoomCode = await roomPromise;
    addResult(`Room created: ${createdRoomCode}`);
    
    // Step 2: Add player
    addResult('Adding player to room...');
    const player = io(socketUrl, { timeout: 5000 });
    setPlayerSocket(player);
    
    await new Promise<void>((resolve) => {
      player.on('connect', () => resolve());
    });
    
    await new Promise<void>((resolve) => {
      player.on('joinedRoom', () => {
        addResult('Player joined room');
        resolve();
      });
    });
    
    player.emit('joinRoom', { roomCode: createdRoomCode, playerName: 'TestPlayer' });
    
    // Step 3: Simulate host refresh
    addResult('Simulating host refresh (disconnecting)...');
    host.disconnect();
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if player got disconnected
    let playerGotDisconnected = false;
    player.on('hostDisconnected', () => {
      playerGotDisconnected = true;
      addResult('Player received hostDisconnected event', false);
    });
    
    // Step 4: Reconnect host within grace period
    addResult('Host reconnecting within grace period...');
    const newHost = io(socketUrl, { timeout: 5000 });
    setHostSocket(newHost);
    
    await new Promise<void>((resolve) => {
      newHost.on('connect', () => resolve());
    });
    
    await new Promise<void>((resolve) => {
      newHost.on('roomReconnected', (data: { roomCode: string; players: Array<{ id: string; name: string; connected: boolean }>; gameState: string }) => {
        addResult(`Host reconnected to room: ${data.roomCode}`);
        addResult(`Players still in room: ${data.players.length}`);
        resolve();
      });
    });
    
    newHost.emit('reconnectRoom', createdRoomCode);
    
    // Wait to see if player gets disconnected
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (!playerGotDisconnected) {
      addResult('Player stayed connected during host refresh!');
    } else {
      addResult('Player was disconnected during host refresh', false);
    }
    
    // Cleanup
    setTimeout(() => {
      newHost.disconnect();
      player.disconnect();
      setIsRunning(false);
      addResult('Test completed');
    }, 1000);
  };

  const runTest = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    
    // Step 1: Create host connection
    addResult('Creating host connection...');
    const host = io(socketUrl, { timeout: 5000 });
    setHostSocket(host);
    
    await new Promise<void>((resolve) => {
      host.on('connect', () => {
        addResult('Host connected');
        resolve();
      });
    });
    
    // Step 2: Create room
    addResult('Creating room...');
    const roomPromise = new Promise<string>((resolve) => {
      host.on('roomCreated', (code: string) => {
        addResult(`Room created: ${code}`);
        setRoomCode(code);
        resolve(code);
      });
    });
    
    host.emit('createRoom');
    const createdRoomCode = await roomPromise;
    
    // Step 3: Create player connection
    addResult('Creating player connection...');
    const player = io(socketUrl, { timeout: 5000 });
    setPlayerSocket(player);
    
    await new Promise<void>((resolve) => {
      player.on('connect', () => {
        addResult('Player connected');
        resolve();
      });
    });
    
    // Step 4: Player joins room
    addResult('Player joining room...');
    const joinPromise = new Promise<void>((resolve) => {
      player.on('joinedRoom', () => {
        addResult('Player joined room');
        resolve();
      });
      
      host.on('playerJoined', (playerData: { id: string; name: string }) => {
        addResult(`Host notified: ${playerData.name} joined`);
      });
    });
    
    player.emit('joinRoom', { roomCode: createdRoomCode, playerName: 'TestPlayer' });
    await joinPromise;
    
    // Step 5: Start game
    addResult('Starting game...');
    let hostReceivedGameStarted = false;
    let playerReceivedGameStarted = false;
    
    const gameStartPromise = new Promise<void>((resolve) => {
      host.on('gameStarted', () => {
        addResult('Host received gameStarted event');
        hostReceivedGameStarted = true;
        if (playerReceivedGameStarted) resolve();
      });
      
      player.on('gameStarted', () => {
        addResult('Player received gameStarted event');
        playerReceivedGameStarted = true;
        if (hostReceivedGameStarted) resolve();
      });
    });
    
    host.emit('startGame', createdRoomCode);
    
    // Wait for game start with timeout
    try {
      await Promise.race([
        gameStartPromise,
        new Promise((_, reject) => setTimeout(() => reject('Timeout'), 5000))
      ]);
      addResult('Game started successfully! Both clients received the event.');
    } catch (error) {
      addResult(`Game start failed: ${error}`, false);
      if (!hostReceivedGameStarted) {
        addResult('Host did NOT receive gameStarted event', false);
      }
      if (!playerReceivedGameStarted) {
        addResult('Player did NOT receive gameStarted event', false);
      }
    }
    
    // Cleanup
    setTimeout(() => {
      host.disconnect();
      player.disconnect();
      setIsRunning(false);
      addResult('Test completed');
    }, 1000);
  };

  useEffect(() => {
    return () => {
      hostSocket?.disconnect();
      playerSocket?.disconnect();
    };
  }, [hostSocket, playerSocket]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Socket Connection Tests</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          <div className="space-x-4">
            <button
              onClick={runTest}
              disabled={isRunning}
              className={`px-6 py-3 rounded font-semibold ${
                isRunning 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isRunning ? 'Test Running...' : 'Test Game Start'}
            </button>
            
            <button
              onClick={runHostRefreshTest}
              disabled={isRunning}
              className={`px-6 py-3 rounded font-semibold ${
                isRunning 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isRunning ? 'Test Running...' : 'Test Host Refresh'}
            </button>
          </div>
          
          {roomCode && (
            <p className="mt-4 text-sm text-gray-400">
              Testing with room code: <span className="font-mono">{roomCode}</span>
            </p>
          )}
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          {testResults.length === 0 ? (
            <p className="text-gray-400">No results yet. Click &quot;Run Test&quot; to start.</p>
          ) : (
            <div className="space-y-2 font-mono text-sm">
              {testResults.map((result, index) => (
                <div key={index} className={result.includes('❌') ? 'text-red-400' : 'text-green-400'}>
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}