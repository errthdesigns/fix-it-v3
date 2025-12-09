'use client';

/**
 * FIX IT - Step-by-Step Guidance Panel
 * Bottom-anchored minimal glass design that doesn't block camera feed
 */

import { GuidanceStep } from '@/lib/types';

interface GuidancePanelProps {
  steps: GuidanceStep[];
  currentStepIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export default function GuidancePanel({
  steps,
  currentStepIndex,
  onNext,
  onPrevious,
  onClose,
}: GuidancePanelProps) {
  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  if (!currentStep) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      {/* Gradient fade to black at bottom */}
      <div className="h-32 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />

      {/* Glass panel at bottom */}
      <div className="bg-black/40 backdrop-blur-2xl border-t border-white/10 pointer-events-auto">
        {/* Progress Bar */}
        <div className="h-px bg-white/5">
          <div
            className="h-full bg-white/30 transition-all duration-500"
            style={{
              width: `${((currentStepIndex + 1) / steps.length) * 100}%`,
            }}
          />
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-3xl sm:text-4xl opacity-60 flex-shrink-0">{currentStep.emoji}</span>
              <div className="min-w-0">
                <p className="text-white/40 text-xs font-light uppercase tracking-wider">
                  Step {currentStep.stepNumber} of {currentStep.totalSteps}
                </p>
                <h2 className="text-white text-base sm:text-lg font-light mt-0.5 line-clamp-1">
                  {currentStep.title}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white text-2xl font-extralight transition-colors flex-shrink-0 w-8 h-8 flex items-center justify-center touch-manipulation"
              aria-label="Close guidance"
            >
              ×
            </button>
          </div>

          {/* Description */}
          <p className="text-white/60 text-sm sm:text-base font-light leading-relaxed mb-3">
            {currentStep.description}
          </p>

          {/* Tips - Collapsible on mobile */}
          {currentStep.tips && currentStep.tips.length > 0 && (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 mb-3">
              <ul className="space-y-1">
                {currentStep.tips.map((tip, idx) => (
                  <li key={idx} className="text-white/50 text-xs sm:text-sm font-light flex items-start gap-2">
                    <span className="text-white/30 mt-0.5">•</span>
                    <span className="line-clamp-2">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onPrevious}
              disabled={isFirstStep}
              className={`
                px-4 sm:px-5 py-2.5 rounded-xl font-light text-sm sm:text-base transition-all touch-manipulation
                ${
                  isFirstStep
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-white/10 text-white/70 hover:bg-white/15 active:scale-95 backdrop-blur-sm'
                }
              `}
            >
              ← Prev
            </button>

            {/* Step Indicators */}
            <div className="flex gap-1.5">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`
                    w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all duration-300
                    ${
                      idx === currentStepIndex
                        ? 'bg-white/80 scale-125'
                        : idx < currentStepIndex
                        ? 'bg-white/40'
                        : 'bg-white/10'
                    }
                  `}
                />
              ))}
            </div>

            {!isLastStep ? (
              <button
                onClick={onNext}
                className="px-4 sm:px-5 py-2.5 rounded-xl font-light text-sm sm:text-base transition-all touch-manipulation bg-white/20 text-white backdrop-blur-sm hover:bg-white/25 active:scale-95"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 sm:px-5 py-2.5 rounded-xl font-light text-sm sm:text-base transition-all touch-manipulation bg-white/15 text-white/80 backdrop-blur-sm hover:bg-white/20 active:scale-95"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
