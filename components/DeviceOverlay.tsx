'use client';

/**
 * FIX IT - Device Overlay Component
 * AR-style highlights that appear over camera feed to guide users to specific buttons/ports
 */

import { DeviceHighlight } from '@/lib/types';

interface DeviceOverlayProps {
  highlights: DeviceHighlight[];
}

export default function DeviceOverlay({ highlights }: DeviceOverlayProps) {
  if (!highlights || highlights.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {highlights.map((highlight, idx) => {
        const isCircle = highlight.shape === 'circle';
        const isPort = highlight.shape === 'port';

        return (
          <div
            key={idx}
            className="absolute"
            style={{
              left: `${highlight.x}%`,
              top: `${highlight.y}%`,
              width: `${highlight.width}%`,
              height: `${highlight.height}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Highlight Shape */}
            <div
              className={`
                w-full h-full border-2 border-white/80 backdrop-blur-sm
                ${isCircle ? 'rounded-full' : 'rounded-lg'}
                ${isPort ? 'rounded-md' : ''}
                ${highlight.pulse ? 'animate-pulse' : ''}
              `}
              style={{
                boxShadow: '0 0 20px rgba(255, 255, 255, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.2)',
                animation: highlight.pulse
                  ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  : 'none',
              }}
            />

            {/* Pulsing Ring */}
            {highlight.pulse && (
              <div
                className={`
                  absolute inset-0 border-2 border-white/40
                  ${isCircle ? 'rounded-full' : 'rounded-lg'}
                  ${isPort ? 'rounded-md' : ''}
                `}
                style={{
                  animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                }}
              />
            )}

            {/* Label */}
            {highlight.label && (
              <div
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap"
                style={{
                  top: highlight.shape === 'circle' ? '-30px' : '-25px',
                }}
              >
                <div className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                  <span className="text-black text-xs sm:text-sm font-medium">
                    {highlight.label}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
