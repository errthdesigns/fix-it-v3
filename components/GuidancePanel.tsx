'use client';

/**
 * FIX IT - Step-by-Step Guidance Panel
 * Displays repair steps with visual indicators, navigation, and progress tracking
 * Optimized for projectors: large text, high contrast, responsive design
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-slate-900/95 border-2 border-pink-500 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-6xl">{currentStep.emoji}</span>
              <div>
                <p className="text-white/80 text-sm font-medium">
                  Step {currentStep.stepNumber} of {currentStep.totalSteps}
                </p>
                <h2 className="text-white text-2xl font-bold mt-1">
                  {currentStep.title}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-3xl font-light transition-colors"
              aria-label="Close guidance"
            >
              ×
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-500"
            style={{
              width: `${((currentStepIndex + 1) / steps.length) * 100}%`,
            }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          <p className="text-slate-200 text-xl leading-relaxed mb-6">
            {currentStep.description}
          </p>

          {currentStep.tips && currentStep.tips.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-5 mb-6">
              <p className="text-pink-400 font-semibold text-sm uppercase tracking-wide mb-3">
                💡 Pro Tips
              </p>
              <ul className="space-y-2">
                {currentStep.tips.map((tip, idx) => (
                  <li key={idx} className="text-slate-300 text-base flex items-start gap-2">
                    <span className="text-pink-400 mt-1">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4 mt-8">
            <button
              onClick={onPrevious}
              disabled={isFirstStep}
              className={`
                px-6 py-3 rounded-lg font-semibold text-lg transition-all
                ${
                  isFirstStep
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-slate-800 text-white hover:bg-slate-700 hover:scale-105'
                }
              `}
            >
              ← Previous
            </button>

            <div className="flex gap-2">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`
                    w-3 h-3 rounded-full transition-all duration-300
                    ${
                      idx === currentStepIndex
                        ? 'bg-pink-500 scale-125'
                        : idx < currentStepIndex
                        ? 'bg-purple-500'
                        : 'bg-slate-700'
                    }
                  `}
                />
              ))}
            </div>

            <button
              onClick={onNext}
              disabled={isLastStep}
              className={`
                px-6 py-3 rounded-lg font-semibold text-lg transition-all
                ${
                  isLastStep
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:scale-105 hover:shadow-lg hover:shadow-pink-500/50'
                }
              `}
            >
              Next →
            </button>
          </div>

          {isLastStep && (
            <div className="mt-6 text-center">
              <button
                onClick={onClose}
                className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-lg rounded-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-green-500/50"
              >
                ✓ Complete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
