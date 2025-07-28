import { Suspense } from 'react';
import PlayerContent from './player-content';

export default function PlayerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 text-white p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl">Loading...</p>
        </div>
      </div>
    }>
      <PlayerContent />
    </Suspense>
  );
}