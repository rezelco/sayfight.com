'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HostRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  useEffect(() => {
    // Store the room code and redirect to main host page
    if (roomCode && roomCode.length === 4) {
      sessionStorage.setItem('sayfight-host-room', roomCode.toUpperCase());
      router.replace('/host');
    } else {
      // Invalid room code, just go to host page
      router.replace('/host');
    }
  }, [roomCode, router]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <p className="text-xl">Redirecting to host view...</p>
    </div>
  );
}