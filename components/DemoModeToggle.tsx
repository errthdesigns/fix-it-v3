'use client';

/**
 * FIX IT - Demo Mode Toggle Component
 * Allows switching between demo mode (offline, instant) and live mode (API-based)
 */

interface DemoModeToggleProps {
  isDemoMode: boolean;
  onToggle: (enabled: boolean) => void;
}

export default function DemoModeToggle({ isDemoMode, onToggle }: DemoModeToggleProps) {
  return (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-3 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-3 shadow-xl">
      <span className="text-slate-300 text-sm font-medium">
        {isDemoMode ? '🎭 Demo Mode' : '🔴 Live Mode'}
      </span>
      <button
        onClick={() => onToggle(!isDemoMode)}
        className={`
          relative w-14 h-7 rounded-full transition-all duration-300
          ${isDemoMode ? 'bg-gradient-to-r from-pink-500 to-purple-600' : 'bg-slate-700'}
        `}
        aria-label={`Switch to ${isDemoMode ? 'live' : 'demo'} mode`}
      >
        <div
          className={`
            absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-300
            ${isDemoMode ? 'translate-x-7' : 'translate-x-0'}
          `}
        />
      </button>
      <div className="text-xs text-slate-400">
        {isDemoMode ? (
          <span>
            ⚡ Offline • <span className="text-green-400">&lt;200ms</span>
          </span>
        ) : (
          <span>
            🌐 API • OpenAI
          </span>
        )}
      </div>
    </div>
  );
}
