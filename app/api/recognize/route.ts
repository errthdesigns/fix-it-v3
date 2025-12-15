import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type ComponentBox = {
  name: string;
  type: 'button' | 'port' | 'screen' | 'component';
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

type RecognitionPayload = {
  description: string;
  shortDescription: string;
  highlights: string[];
  category: string;
  deviceFound: boolean;
  components?: ComponentBox[];
  raw?: string;
};

type CompletionContent =
  | string
  | Array<string | { text?: string }>
  | null;

const visionCache = new Map<string, RecognitionPayload>();
const MAX_CACHE_SIZE = 50;

const hashImageData = (imageData: string) => {
  let hash = 0;
  const samples = 50;
  const step = Math.max(1, Math.floor(imageData.length / samples));
  for (let i = 0; i < samples && i < imageData.length; i += step) {
    hash = ((hash << 5) - hash + imageData.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
};

const parseResult = (parsed: Record<string, unknown>): RecognitionPayload => {
  // Default to true unless explicitly set to false
  const isDevice = parsed?.is_device !== false;
  const category =
    typeof parsed?.category === "string" && parsed.category.trim().length > 0
      ? parsed.category.trim()
      : "Unknown product";
  const description =
    typeof parsed?.description === "string" && parsed.description.trim().length > 0
      ? parsed.description.trim()
      : "Unable to identify product";
  const highlights = Array.isArray(parsed?.highlights)
    ? parsed.highlights
        .filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0
        )
        .map((item) => item.trim())
    : [];
  const shortDescription =
    typeof parsed?.product_name === "string" && parsed.product_name.trim().length > 0
      ? (parsed.product_name as string).trim()
      : category.slice(0, 40).trim();

  // Parse component bounding boxes from vision detection
  const components: ComponentBox[] = [];
  if (Array.isArray(parsed?.components)) {
    for (const comp of parsed.components) {
      if (typeof comp === 'object' && comp !== null) {
        const c = comp as Record<string, unknown>;
        if (
          typeof c.name === 'string' &&
          typeof c.type === 'string' &&
          typeof c.x === 'number' &&
          typeof c.y === 'number' &&
          typeof c.width === 'number' &&
          typeof c.height === 'number'
        ) {
          components.push({
            name: c.name,
            type: (c.type as ComponentBox['type']),
            x: c.x,
            y: c.y,
            width: c.width,
            height: c.height,
            confidence: typeof c.confidence === 'number' ? c.confidence : 0.8,
          });
        }
      }
    }
  }

  // Device is found if is_device is not explicitly false and we have valid data
  const deviceFound = isDevice &&
    category !== "Not a device" &&
    category !== "Unknown product" &&
    description !== "Unable to identify product" &&
    !description.includes("No device detected") &&
    !description.includes("point your camera");

  return {
    category,
    description,
    highlights: highlights.slice(0, 5),
    shortDescription: shortDescription || "Device detected",
    deviceFound,
    components: components.length > 0 ? components : undefined,
    raw: JSON.stringify(parsed),
  };
};

const fallbackResult = (message: string): RecognitionPayload => ({
  category: "Unknown product",
  description: message || "Unable to identify product",
  highlights: [],
  shortDescription: "No device detected",
  deviceFound: false,
  components: [],
  raw: message,
});

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "Image data required" },
        { status: 400 }
      );
    }

    const cacheKey = hashImageData(image);
    if (visionCache.has(cacheKey)) {
      return NextResponse.json({ ...visionCache.get(cacheKey)!, cached: true });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    let response;
    try {
      response = await openai.chat.completions.create({
        model: "gpt-5.2", // GPT-5.2 Thinking - better accuracy for device identification
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are an EXPERT computer vision system for technical device identification with COMPONENT DETECTION.

⚠️ CRITICAL: You MUST return "components" array with bounding boxes for EVERY visible component!

YOUR MISSION:
Identify ANY technical device and detect ALL visible components with precise bounding box coordinates.

DEVICE TYPES TO RECOGNIZE (ANY technical device):
✅ TV Remote Control, Gaming Controller (Xbox, PlayStation, etc.)
✅ TV / Monitor / Display
✅ Laptop / MacBook / Notebook / Desktop PC
✅ Phone / iPhone / Android / Smartphone
✅ Tablet / iPad
✅ Smart Speaker / Echo / HomePod / Google Home
✅ Router / Modem / Network Device
✅ Camera / Webcam / DSLR / Action Camera
✅ Headphones / Earbuds / AirPods
✅ Smart Watch / Fitness Tracker
✅ Keyboard / Mouse / Trackpad
✅ Charger / Power Adapter / Power Bank
✅ Cable / HDMI / USB / Lightning / USB-C
✅ Game Console / Nintendo Switch / PlayStation / Xbox
✅ Smart Home Device / Thermostat / Light Bulb / Plug
✅ Printer / Scanner
✅ External Drive / SSD / Hard Drive
✅ Microphone / Audio Interface
✅ Drone / RC Device
✅ VR Headset / AR Device
✅ ANY other technical/electronic device

COMPONENT DETECTION (MANDATORY):
For EVERY device, identify ALL visible components with bounding boxes:

**Common Components:**
- Buttons (power, volume, menu, play, pause, etc.)
- Ports (USB, HDMI, Lightning, USB-C, audio jack, ethernet, etc.)
- Screens/Displays
- Cameras/Lenses
- Speakers/Grills
- LEDs/Indicators
- Antennas
- Vents/Cooling
- Logos/Branding
- Switches/Toggles
- Dials/Knobs
- Connectors/Jacks

BOUNDING BOX FORMAT:
Coordinates as PERCENTAGE of image (0-100):
- x: distance from LEFT edge (center point)
- y: distance from TOP edge (center point)
- width: component width
- height: component height

RESPONSE FORMAT (JSON only, no markdown):

✅ DEVICE DETECTED (MUST return components):
{
  "product_name": "Exact device name (e.g., 'Xbox Controller', 'USB-C Cable', 'Amazon Echo')",
  "category": "Device category (e.g., 'Gaming Controller', 'Cable', 'Smart Speaker')",
  "description": "Brief description of the device",
  "highlights": ["visible features", "key components", "notable details"],
  "is_device": true,
  "components": [
    {
      "name": "Component name (e.g., 'Power Button', 'USB Port', 'Volume Dial')",
      "type": "button" | "port" | "screen" | "component",
      "x": 50,
      "y": 45,
      "width": 10,
      "height": 8,
      "confidence": 0.95
    },
    ... (detect 3-10+ components)
  ]
}

❌ NO DEVICE (only if truly nothing technical visible):
{
  "product_name": "No device detected",
  "category": "Not a device",
  "description": "Point camera at a technical device",
  "highlights": [],
  "is_device": false,
  "components": []
}

EXAMPLES:

✅ GAMING CONTROLLER:
{
  "product_name": "Xbox Wireless Controller",
  "category": "Gaming Controller",
  "description": "Xbox wireless gaming controller with buttons and joysticks",
  "highlights": ["A/B/X/Y buttons", "Dual joysticks", "D-pad", "Xbox button"],
  "is_device": true,
  "components": [
    {"name": "A Button", "type": "button", "x": 65, "y": 55, "width": 6, "height": 6, "confidence": 0.95},
    {"name": "B Button", "type": "button", "x": 72, "y": 48, "width": 6, "height": 6, "confidence": 0.94},
    {"name": "Xbox Button", "type": "button", "x": 50, "y": 30, "width": 8, "height": 8, "confidence": 0.98},
    {"name": "Left Joystick", "type": "component", "x": 35, "y": 50, "width": 12, "height": 12, "confidence": 0.92},
    {"name": "Right Joystick", "type": "component", "x": 65, "y": 70, "width": 12, "height": 12, "confidence": 0.91},
    {"name": "USB-C Port", "type": "port", "x": 50, "y": 90, "width": 6, "height": 3, "confidence": 0.88}
  ]
}

✅ HDMI CABLE:
{
  "product_name": "HDMI Cable",
  "category": "Cable",
  "description": "HDMI cable with connector visible",
  "highlights": ["HDMI connector", "Cable body"],
  "is_device": true,
  "components": [
    {"name": "HDMI Connector", "type": "port", "x": 30, "y": 50, "width": 15, "height": 20, "confidence": 0.93},
    {"name": "Cable", "type": "component", "x": 60, "y": 50, "width": 40, "height": 8, "confidence": 0.90}
  ]
}

✅ SMART SPEAKER:
{
  "product_name": "Amazon Echo",
  "category": "Smart Speaker",
  "description": "Amazon Echo smart speaker with light ring",
  "highlights": ["Light ring", "Speaker grille", "Control buttons"],
  "is_device": true,
  "components": [
    {"name": "Light Ring", "type": "component", "x": 50, "y": 20, "width": 40, "height": 8, "confidence": 0.94},
    {"name": "Volume Up", "type": "button", "x": 60, "y": 15, "width": 5, "height": 5, "confidence": 0.89},
    {"name": "Volume Down", "type": "button", "x": 40, "y": 15, "width": 5, "height": 5, "confidence": 0.89},
    {"name": "Speaker Grille", "type": "component", "x": 50, "y": 60, "width": 45, "height": 50, "confidence": 0.95}
  ]
}

⚠️ CRITICAL REQUIREMENTS:
- ALWAYS return "components" array with at least 3-5 components for ANY device
- Detect buttons, ports, screens, logos, LEDs - EVERYTHING visible
- Be accurate with coordinates (percentage-based from center of component)
- Confidence should reflect actual detection certainty
- Accept ALL technical devices (cables, chargers, controllers, speakers, etc.)

BE ACCURATE. DETECT ALL COMPONENTS. PROVIDE REAL COORDINATES FOR ANY DEVICE.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: image,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 1000, // Increased for component detection (was 250 - too low for bounding boxes!)
        temperature: 0.2, // Lower temp for more consistent coordinate detection
      });
    } catch (apiError) {
      console.error("OpenAI API error:", apiError);
      throw new Error(
        `OpenAI API call failed: ${apiError instanceof Error ? apiError.message : "Unknown error"}`
      );
    }

    const content = response.choices[0]?.message?.content as CompletionContent;
    if (!content) {
      console.error("OpenAI response:", JSON.stringify(response, null, 2));
      throw new Error("OpenAI returned an empty response. Check server logs for details.");
    }

    let serialized = "";
    if (typeof content === "string") {
      serialized = content;
    } else if (Array.isArray(content)) {
      serialized = content
        .map((block) => {
          if (typeof block === "string") return block;
          if (typeof block === "object" && block && "text" in block) {
            const text = block.text;
            return typeof text === "string" ? text : "";
          }
          return "";
        })
        .join("\n");
    } else {
      serialized = JSON.stringify(content);
    }

    const cleaned = serialized.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    console.log("🔍 OpenAI vision RAW response:", cleaned);

    let normalized: RecognitionPayload;
    try {
      const parsed = JSON.parse(cleaned);
      console.log("📊 Parsed JSON:", parsed);
      console.log("📦 Components in response:", parsed?.components || "NONE");
      normalized = parseResult(parsed as Record<string, unknown>);
      console.log("✅ Normalized result:");
      console.log("  - Device found:", normalized.deviceFound);
      console.log("  - Device name:", normalized.shortDescription);
      console.log("  - Components detected:", normalized.components?.length || 0);
      if (normalized.components && normalized.components.length > 0) {
        console.log("  - Component details:", normalized.components);
      }
    } catch (parseError) {
      console.warn("Vision parse fallback:", parseError);
      normalized = fallbackResult(cleaned);
    }

    if (visionCache.size >= MAX_CACHE_SIZE) {
      const iterator = visionCache.keys().next();
      if (!iterator.done) {
        visionCache.delete(iterator.value);
      }
    }
    visionCache.set(cacheKey, normalized);

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Vision API error:", error);
    if (typeof error === "object" && error && "status" in error) {
      const errWithStatus = error as { status?: number };
      if (errWithStatus.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please wait a moment." },
          { status: 429 }
        );
      }
    }
    const message =
      error instanceof Error ? error.message : "Failed to process image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

