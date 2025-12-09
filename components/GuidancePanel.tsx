'use client';

/**
 * FIX IT - Step-by-Step Guidance Panel
 * Minimal glass design with black theme
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/60 backdrop-blur-xl overflow-y-auto">
      <div className="w-full max-w-3xl my-auto bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-8 border-b border-white/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <span className="text-4xl sm:text-5xl flex-shrink-0 opacity-60">{currentStep.emoji}</span>
              <div className="min-w-0">
                <p className="text-white/40 text-xs sm:text-sm font-light uppercase tracking-wider">
                  Step {currentStep.stepNumber} of {currentStep.totalSteps}
                </p>
                <h2 className="text-white text-xl sm:text-3xl font-light mt-1 line-clamp-2">
                  {currentStep.title}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white text-3xl font-extralight transition-colors flex-shrink-0 w-10 h-10 flex items-center justify-center"
              aria-label="Close guidance"
            >
              ×
            </button>
          </div>
        </div>

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
        <div className="p-5 sm:p-8">
          <p className="text-white/70 text-base sm:text-xl font-light leading-relaxed mb-5 sm:mb-6">
            {currentStep.description}
          </p>

          {currentStep.tips && currentStep.tips.length > 0 && (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-5 mb-5 sm:mb-6">
              <p className="text-white/50 font-light text-xs sm:text-sm uppercase tracking-widest mb-2 sm:mb-3">
                Tips
              </p>
              <ul className="space-y-2">
                {currentStep.tips.map((tip, idx) => (
                  <li key={idx} className="text-white/60 text-sm sm:text-base font-light flex items-start gap-2">
                    <span className="text-white/30 mt-1">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 sm:gap-4 mt-6 sm:mt-8">
            <button
              onClick={onPrevious}
              disabled={isFirstStep}
              className={`
                px-4 sm:px-6 py-3 rounded-xl font-light text-base sm:text-lg transition-all min-w-[100px] touch-manipulation
                ${
                  isFirstStep
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-white/10 text-white/80 hover:bg-white/15 active:scale-95 backdrop-blur-sm'
                }
              `}
            >
              ← Previous
            </button>

            <div className="flex gap-1.5 sm:gap-2">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`
                    w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300
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

            <button
              onClick={onNext}
              disabled={isLastStep}
              className={`
                px-4 sm:px-6 py-3 rounded-xl font-light text-base sm:text-lg transition-all min-w-[100px] touch-manipulation
                ${
                  isLastStep
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-white/20 text-white backdrop-blur-sm hover:bg-white/25 active:scale-95'
                }
              `}
            >
              Next →
            </button>
          </div>

          {isLastStep && (
            <div className="mt-5 sm:mt-6 text-center">
              <button
                onClick={onClose}
                className="px-6 sm:px-8 py-3 sm:py-4 bg-white/15 hover:bg-white/20 backdrop-blur-sm text-white font-light text-base sm:text-lg rounded-xl transition-all active:scale-95 touch-manipulation"
              >
                Complete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
