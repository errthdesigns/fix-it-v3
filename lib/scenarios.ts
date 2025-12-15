/**
 * FIX IT - Demo Mode Scenarios
 * Pre-loaded scenarios for instant (<200ms) response with zero latency
 * All scenarios work completely offline without API calls
 */

import { Scenario } from './types';

export const DEMO_SCENARIOS: Scenario[] = [
  {
    id: 'laptop-tv-hdmi',
    name: 'Connect Laptop to TV with HDMI',
    triggers: [
      'laptop tv',
      'connect laptop tv',
      'hdmi laptop',
      'laptop to tv',
      'screen mirror',
      'display laptop tv',
      'laptop hdmi tv',
      'connect computer tv',
      'pc to tv',
      'laptop external display',
    ],
    productRecognitionMessage: 'Laptop and TV detected. Let me guide you through HDMI connection.',
    steps: [
      {
        id: 'step-1',
        title: 'Locate HDMI Ports',
        description: 'Find the HDMI port on your laptop (usually on the side) and on your TV (usually on the back or side panel).',
        emoji: '🔍',
        tips: ['Look for a rectangular port labeled "HDMI"', 'Check both sides of your laptop'],
      },
      {
        id: 'step-2',
        title: 'Connect HDMI Cable',
        description: 'Plug one end of the HDMI cable into your laptop and the other end into your TV.',
        emoji: '🔌',
        tips: ['Make sure the cable is fully inserted', 'The cable only fits one way - don\'t force it'],
      },
      {
        id: 'step-3',
        title: 'Select Input Source',
        description: 'Use your TV remote to select the correct HDMI input (e.g., HDMI 1, HDMI 2).',
        emoji: '📺',
        tips: ['Press "Input" or "Source" button on TV remote', 'Try each HDMI option if unsure which port you used'],
      },
      {
        id: 'step-4',
        title: 'Configure Display Settings',
        description: 'On your laptop, press Windows+P (or System Preferences on Mac) to choose display mode: Duplicate or Extend.',
        emoji: '⚙️',
        tips: ['Windows: Press Win+P', 'Mac: System Preferences > Displays', 'Choose "Duplicate" to mirror your screen'],
      },
    ],
    fallbackToCurrys: false,
  },

  {
    id: 'tv-remote-buttons',
    name: 'TV Remote Button Identification',
    triggers: [
      'tv remote',
      'remote button',
      'remote control',
      'what button',
      'which button',
      'remote help',
      'tv buttons',
      'remote buttons',
      'identify button',
    ],
    productRecognitionMessage: 'TV Remote detected. Let me help you identify the key buttons.',
    steps: [
      {
        id: 'step-1',
        title: 'Power Button',
        description: 'Located at the top of the remote, usually red or with a power symbol (⏻). Press to turn TV on/off.',
        emoji: '⚡',
        tips: ['Usually the largest button at the top', 'May light up red when pressed'],
        highlights: [
          {
            x: 50,
            y: 15,
            width: 15,
            height: 8,
            label: 'Power',
            shape: 'circle',
            pulse: true,
          },
        ],
      },
      {
        id: 'step-2',
        title: 'Volume & Channel Controls',
        description: 'Volume buttons on the right side (+ and -). Channel buttons on the left or below volume controls.',
        emoji: '🔊',
        tips: ['Volume: Usually marked Vol+ and Vol-', 'Channel: Often marked CH↑ and CH↓'],
        highlights: [
          {
            x: 65,
            y: 40,
            width: 12,
            height: 20,
            label: 'Vol',
            shape: 'rect',
            pulse: true,
          },
          {
            x: 25,
            y: 40,
            width: 12,
            height: 20,
            label: 'CH',
            shape: 'rect',
            pulse: true,
          },
        ],
      },
      {
        id: 'step-3',
        title: 'Input/Source Button',
        description: 'Labeled "Input", "Source", or "HDMI". Press this to switch between TV, HDMI, and other inputs.',
        emoji: '🎮',
        tips: ['Usually in the top third of the remote', 'May require pressing multiple times to cycle through inputs'],
        highlights: [
          {
            x: 50,
            y: 30,
            width: 20,
            height: 8,
            label: 'Input',
            shape: 'rect',
            pulse: true,
          },
        ],
      },
    ],
    fallbackToCurrys: false,
  },

  {
    id: 'hdmi-port-damaged',
    name: 'HDMI Port Damaged - Product Recommendation',
    triggers: [
      'hdmi broken',
      'hdmi damaged',
      'hdmi port broken',
      'hdmi not working',
      'hdmi bent',
      'port damaged',
      'broken hdmi',
      'hdmi loose',
      'hdmi connector broken',
    ],
    productRecognitionMessage: 'It looks like your HDMI port may be damaged. Let me show you some solutions.',
    steps: [
      {
        id: 'step-1',
        title: 'Inspect the Damage',
        description: 'Check if the HDMI port has visible damage, bent pins, or debris inside.',
        emoji: '🔍',
        tips: ['Use a flashlight to look inside the port', 'Check for bent metal pins'],
      },
      {
        id: 'step-2',
        title: 'Try Alternative Ports',
        description: 'If your device has multiple HDMI ports, try connecting to a different one.',
        emoji: '🔄',
        tips: ['Most TVs have 2-4 HDMI ports', 'Label which ports work for future reference'],
      },
      {
        id: 'step-3',
        title: 'Consider Replacement',
        description: 'If the port is damaged, professional repair may be costly. Currys offers great replacement options.',
        emoji: '🛒',
        tips: ['Check warranty status first', 'Replacement may be more cost-effective than repair'],
      },
    ],
    currysProducts: [
      {
        id: 'tv-1',
        name: 'Samsung 55" Crystal UHD 4K Smart TV',
        price: 499,
        specs: [
          '4K Ultra HD resolution',
          '3 x HDMI ports',
          'Smart TV with built-in apps',
          'HDR support',
        ],
        currysUrl: 'https://www.currys.co.uk/products/samsung-ue55cu7100kxxu-55-smart-4k-ultra-hd-hdr-led-tv-10250717.html',
      },
      {
        id: 'tv-2',
        name: 'LG 43" 4K Ultra HD Smart LED TV',
        price: 329,
        specs: [
          '4K Ultra HD (3840 x 2160)',
          'Active HDR for enhanced contrast',
          '4 x HDMI ports',
          'webOS smart platform',
        ],
        currysUrl: 'https://www.currys.co.uk/products/lg-43ur73006la-43-smart-4k-ultra-hd-hdr-led-tv-with-google-assistant-and-amazon-alexa-10257166.html',
      },
      {
        id: 'hdmi-adapter',
        name: 'HDMI to USB-C Adapter with Multiple Ports',
        price: 39.99,
        specs: [
          'USB-C to HDMI adapter',
          'Supports 4K @ 60Hz',
          'Compact and portable',
          'Plug and play - no drivers needed',
        ],
        currysUrl: 'https://www.currys.co.uk/products/sandstrom-usbc-to-hdmi-adapter-10205587.html',
      },
    ],
    fallbackToCurrys: true,
  },
];

/**
 * Fuzzy keyword matching for instant scenario detection
 * Optimized for <200ms performance
 */
export function matchScenario(userInput: string): Scenario | null {
  const normalized = userInput.toLowerCase().trim();

  console.log("🔍 Matching user input:", normalized);

  for (const scenario of DEMO_SCENARIOS) {
    for (const trigger of scenario.triggers) {
      // Direct substring match - ultra fast
      if (normalized.includes(trigger)) {
        console.log(`✅ Direct match: "${trigger}" → ${scenario.name}`);
        return scenario;
      }

      // Fuzzy match: allow 1-2 missing words
      const triggerWords = trigger.split(' ').filter(w => w.length > 2); // Ignore short words
      const inputWords = normalized.split(' ').filter(w => w.length > 2);

      let matchCount = 0;
      for (const word of triggerWords) {
        // Stricter matching: word must be at least 50% similar (not just substring)
        if (inputWords.some(iw =>
          iw === word || // Exact match
          (iw.length >= 4 && word.length >= 4 && iw.includes(word)) || // Longer word substring
          (word.length >= 4 && iw.length >= 4 && word.includes(iw))
        )) {
          matchCount++;
        }
      }

      // Match if >80% of trigger words present (increased from 70%)
      const matchRatio = triggerWords.length > 0 ? matchCount / triggerWords.length : 0;
      if (matchRatio >= 0.8) {
        console.log(`✅ Fuzzy match (${(matchRatio * 100).toFixed(0)}%): "${trigger}" → ${scenario.name}`);
        return scenario;
      }
    }
  }

  console.log("❌ No scenario matched for:", normalized);
  return null;
}

/**
 * Get scenario by ID for direct access
 */
export function getScenarioById(id: string): Scenario | undefined {
  return DEMO_SCENARIOS.find(s => s.id === id);
}

/**
 * Add custom scenario (for future extensibility)
 * In production, this would write to a database or JSON file
 */
export function addCustomScenario(scenario: Scenario): void {
  // Validate scenario structure
  if (!scenario.id || !scenario.triggers.length || !scenario.steps.length) {
    throw new Error('Invalid scenario: must have id, triggers, and steps');
  }

  DEMO_SCENARIOS.push(scenario);
  console.log(`✅ Added custom scenario: ${scenario.name}`);
}
