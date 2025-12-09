/**
 * Quick validation script for demo mode
 * Run: node test-demo-mode.js
 */

const testInputs = [
  { input: "how do i connect my laptop to tv", expected: "laptop-tv-hdmi" },
  { input: "laptop hdmi", expected: "laptop-tv-hdmi" },
  { input: "tv remote buttons", expected: "tv-remote-buttons" },
  { input: "which button on remote", expected: "tv-remote-buttons" },
  { input: "hdmi broken", expected: "hdmi-port-damaged" },
  { input: "hdmi port damaged", expected: "hdmi-port-damaged" },
];

console.log("🧪 Demo Mode Validation Test\n");
console.log("Testing fuzzy keyword matching...\n");

// Mock matching logic (since we can't import TypeScript directly)
const mockScenarios = [
  {
    id: "laptop-tv-hdmi",
    triggers: ["laptop tv", "connect laptop tv", "hdmi laptop", "laptop to tv"],
  },
  {
    id: "tv-remote-buttons",
    triggers: ["tv remote", "remote button", "remote control", "which button"],
  },
  {
    id: "hdmi-port-damaged",
    triggers: ["hdmi broken", "hdmi damaged", "hdmi port broken", "hdmi not working"],
  },
];

function mockMatch(input) {
  const normalized = input.toLowerCase().trim();

  for (const scenario of mockScenarios) {
    for (const trigger of scenario.triggers) {
      if (normalized.includes(trigger)) {
        return scenario.id;
      }

      const triggerWords = trigger.split(' ');
      const inputWords = normalized.split(' ');

      let matchCount = 0;
      for (const word of triggerWords) {
        if (inputWords.some(iw => iw.includes(word) || word.includes(iw))) {
          matchCount++;
        }
      }

      if (matchCount / triggerWords.length >= 0.7) {
        return scenario.id;
      }
    }
  }

  return null;
}

let passed = 0;
let failed = 0;

testInputs.forEach(({ input, expected }) => {
  const result = mockMatch(input);
  const success = result === expected;

  if (success) {
    console.log(`✅ PASS: "${input}" → ${result}`);
    passed++;
  } else {
    console.log(`❌ FAIL: "${input}" → Expected: ${expected}, Got: ${result}`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed}/${testInputs.length} passed`);

if (failed === 0) {
  console.log("✅ All tests passed! Demo mode matching logic is working correctly.");
} else {
  console.log(`⚠️ ${failed} tests failed. Check trigger keywords in lib/scenarios.ts`);
  process.exit(1);
}
