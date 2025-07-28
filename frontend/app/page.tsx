'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative min-h-screen flex flex-col items-center justify-center p-8">
        {/* Logo and title */}
        <div className="text-center space-y-6 mb-12">
          <div className="relative">
            <h1 className="text-7xl md:text-8xl font-black text-white animate-bounce-slow">
              Say<span className="text-yellow-400">Fight</span>
            </h1>
            <div className="absolute -top-8 -right-8 text-4xl animate-spin-slow">🎤</div>
            <div className="absolute -bottom-6 -left-6 text-4xl animate-pulse">🎮</div>
          </div>
          <p className="text-2xl text-white/90 font-semibold">
            Voice-Controlled Party Game Madness!
          </p>
          <p className="text-lg text-white/70 max-w-md mx-auto">
            Shout, laugh, and compete with friends in hilarious voice-powered mini-games
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-6 mb-12">
          <Link
            href="/host"
            className="group relative px-10 py-6 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-3xl font-bold text-xl shadow-2xl transform transition-all duration-200 hover:scale-105 hover:shadow-pink-500/25"
          >
            <span className="relative z-10 flex items-center gap-3">
              <span className="text-3xl">👑</span>
              Host Game
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-rose-600 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </Link>
          
          <Link
            href="/player"
            className="group relative px-10 py-6 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-3xl font-bold text-xl shadow-2xl transform transition-all duration-200 hover:scale-105 hover:shadow-teal-500/25"
          >
            <span className="relative z-10 flex items-center gap-3">
              <span className="text-3xl">🎯</span>
              Join Game
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </Link>
        </div>

        {/* Game modes preview */}
        <div className="grid grid-cols-2 gap-4 max-w-md w-full">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center transform transition-all duration-200 hover:scale-105 border border-white/20">
            <div className="text-4xl mb-3">🏎️</div>
            <h3 className="text-white font-bold text-lg">Voice Racer</h3>
            <p className="text-white/70 text-sm mt-2">Say your word to speed up!</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center transform transition-all duration-200 hover:scale-105 border border-white/20">
            <div className="text-4xl mb-3">🪢</div>
            <h3 className="text-white font-bold text-lg">Tug of War</h3>
            <p className="text-white/70 text-sm mt-2">Team up and pull!</p>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 text-center">
          <p className="text-white/50 text-sm">Powered by AssemblyAI&apos;s Universal Streaming API 🎙️</p>
        </div>
      </div>

    </div>
  );
}