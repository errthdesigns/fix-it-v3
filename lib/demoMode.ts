/**
 * FIX IT - Demo Mode Utilities
 * Fast (<200ms) scenario matching and guidance generation
 */

import { Scenario, GuidanceStep } from './types';
import { matchScenario } from './scenarios';

/**
 * Process user input in demo mode
 * Returns matched scenario with guidance steps ready for display
 * Optimized for <200ms performance
 */
export function processDemoInput(userInput: string): {
  scenario: Scenario | null;
  steps: GuidanceStep[];
  responseTime: number;
} {
  const startTime = performance.now();

  const scenario = matchScenario(userInput);

  if (!scenario) {
    const responseTime = performance.now() - startTime;
    return { scenario: null, steps: [], responseTime };
  }

  // Transform scenario steps into GuidanceStep format
  const steps: GuidanceStep[] = scenario.steps.map((step, idx) => ({
    ...step,
    stepNumber: idx + 1,
    totalSteps: scenario.steps.length,
  }));

  const responseTime = performance.now() - startTime;

  console.log(`✅ Demo mode match: "${scenario.name}" in ${responseTime.toFixed(2)}ms`);

  return { scenario, steps, responseTime };
}

/**
 * Generate initial response message for matched scenario
 */
export function generateDemoResponse(scenario: Scenario): string {
  return scenario.productRecognitionMessage;
}

/**
 * Check if demo mode should show Currys products
 */
export function shouldShowCurrysProducts(scenario: Scenario): boolean {
  return scenario.fallbackToCurrys && !!scenario.currysProducts && scenario.currysProducts.length > 0;
}

/**
 * Performance test for demo mode
 * Validates that all scenarios match in <200ms
 */
export function testDemoModePerformance(): {
  passed: boolean;
  results: Array<{ trigger: string; responseTime: number; passed: boolean }>;
} {
  const testInputs = [
    'how do i connect my laptop to tv',
    'tv remote buttons',
    'hdmi port broken',
    'laptop hdmi',
    'which button on remote',
    'hdmi damaged',
  ];

  const results = testInputs.map((input) => {
    const { scenario, responseTime } = processDemoInput(input);
    return {
      trigger: input,
      responseTime,
      passed: responseTime < 200 && scenario !== null,
    };
  });

  const passed = results.every((r) => r.passed);

  console.table(results);

  return { passed, results };
}
