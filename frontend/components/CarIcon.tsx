import React from 'react';

interface CarIconProps {
  color: string;
  size?: number;
  facingLeft?: boolean;
  className?: string;
}

export default function CarIcon({ color, size = 40, facingLeft = false, className = '' }: CarIconProps) {
  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox="0 0 100 60"
      className={className}
      style={{
        transform: facingLeft ? 'scaleX(-1)' : 'none',
        transition: 'transform 0.3s ease-out'
      }}
    >
      {/* Car body */}
      <path
        d="M 15 35 L 20 20 L 35 15 L 65 15 L 75 20 L 85 35 L 85 45 L 15 45 Z"
        fill={color}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="1"
      />
      
      {/* Windows */}
      <path
        d="M 25 25 L 35 20 L 50 20 L 50 30 L 25 30 Z"
        fill="rgba(135, 206, 235, 0.8)"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="1"
      />
      <path
        d="M 52 20 L 65 20 L 70 25 L 70 30 L 52 30 Z"
        fill="rgba(135, 206, 235, 0.8)"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="1"
      />
      
      {/* Wheels */}
      <circle cx="25" cy="45" r="8" fill="#333" />
      <circle cx="25" cy="45" r="4" fill="#666" />
      <circle cx="70" cy="45" r="8" fill="#333" />
      <circle cx="70" cy="45" r="4" fill="#666" />
      
      {/* Headlights */}
      <ellipse cx="82" cy="35" rx="4" ry="3" fill="#FFF59D" opacity="0.8" />
      
      {/* Racing stripe (optional) */}
      <rect x="15" y="28" width="70" height="4" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}