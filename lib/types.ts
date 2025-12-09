/**
 * FIX IT - Core Type Definitions
 * Types for demo mode, scenarios, guidance steps, and product recommendations
 */

export interface DeviceHighlight {
  x: number; // Percentage from left (0-100)
  y: number; // Percentage from top (0-100)
  width: number; // Width in percentage
  height: number; // Height in percentage
  label?: string; // e.g., "Power Button", "HDMI 1"
  shape?: 'circle' | 'rect' | 'port'; // Shape of highlight
  pulse?: boolean; // Whether to animate with pulse
}

export interface GuidanceStep {
  id: string;
  title: string;
  description: string;
  emoji: string;
  stepNumber: number;
  totalSteps: number;
  tips?: string[];
  highlights?: DeviceHighlight[]; // AR-style overlays on camera feed
}

export interface CurrysProduct {
  id: string;
  name: string;
  price: number;
  specs: string[];
  imageUrl?: string;
  currysUrl: string;
  colors?: string[];
  inStock?: boolean;
  rating?: number;
  reviewCount?: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  keywords: string[];
  products: CurrysProduct[];
}

export interface Scenario {
  id: string;
  name: string;
  triggers: string[];
  productRecognitionMessage: string;
  steps: Omit<GuidanceStep, 'stepNumber' | 'totalSteps'>[];
  currysProducts?: CurrysProduct[];
  fallbackToCurrys: boolean;
}

export interface MatchResult {
  scenario: Scenario;
  confidence: number;
  matchedTrigger: string;
}

export interface DemoModeState {
  enabled: boolean;
  currentScenario: Scenario | null;
  currentStepIndex: number;
  showProducts: boolean;
}
