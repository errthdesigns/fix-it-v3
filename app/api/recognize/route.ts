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
                text: `You are an EXPERT computer vision system for device identification with COMPONENT DETECTION.

CRITICAL RULES:
1. ONLY recognize: TV Remote Control, TV/Television, Laptop/MacBook, Phone/iPhone/Android, Tablet/iPad
2. Focus on MAIN device in center/foreground
3. Detect ALL visible components (buttons, ports, screens)
4. Return BOUNDING BOX coordinates for each component
5. NEVER guess - only identify what you clearly see

DEVICE TYPES (ONLY THESE):
✅ TV Remote Control
✅ TV / Television
✅ Laptop / MacBook / Notebook
✅ Phone / iPhone / Android
✅ Tablet / iPad

❌ Reject everything else (gaming controllers, cables, chargers, etc.)

COMPONENT DETECTION:
For each device, identify VISIBLE components with bounding boxes:

**Remote Control:**
- Power button, Volume buttons, Channel buttons
- Number pad, Menu button, Back button
- Input/Source button, Netflix/streaming buttons

**TV/Television:**
- Screen area
- HDMI ports (1, 2, 3), USB ports
- Power button, Input button

**Laptop:**
- Screen, Keyboard, Trackpad
- USB ports, HDMI port, Power port
- Webcam, Power button

**Phone/Tablet:**
- Screen, Power button, Volume buttons
- Charging port, Camera

BOUNDING BOX FORMAT:
Coordinates as PERCENTAGE of image (0-100):
- x: distance from LEFT edge
- y: distance from TOP edge
- width: component width
- height: component height

RESPONSE FORMAT (JSON only, no markdown):

If supported device detected:
{
  "product_name": "TV Remote Control" | "TV" | "Laptop" | "MacBook" | "iPhone" | "Android Phone" | "iPad",
  "category": "Remote Control" | "Television" | "Laptop" | "Phone" | "Tablet",
  "description": "Brief description",
  "highlights": ["visible features"],
  "is_device": true,
  "components": [
    {
      "name": "Power Button",
      "type": "button",
      "x": 48,
      "y": 12,
      "width": 8,
      "height": 6,
      "confidence": 0.95
    },
    {
      "name": "Volume Up",
      "type": "button",
      "x": 75,
      "y": 35,
      "width": 6,
      "height": 5,
      "confidence": 0.88
    }
  ]
}

If unsupported or no device:
{
  "product_name": "No device detected",
  "category": "Not a device",
  "description": "Point camera at remote, TV, laptop, or phone",
  "highlights": [],
  "is_device": false,
  "components": []
}

EXAMPLES:
✅ See remote with buttons → Identify device + detect each button location
✅ See TV with HDMI ports → Identify TV + detect port locations
✅ See laptop → Identify laptop + detect ports, screen, keyboard
❌ See gaming controller → Reject ("No device detected")
❌ See cable → Reject ("No device detected")

BE ACCURATE. DETECT ALL COMPONENTS. PROVIDE REAL COORDINATES.`,
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
        max_tokens: 250,
        temperature: 0.3,
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
    console.log("OpenAI vision response:", cleaned);

    let normalized: RecognitionPayload;
    try {
      const parsed = JSON.parse(cleaned);
      console.log("Parsed JSON:", parsed);
      normalized = parseResult(parsed as Record<string, unknown>);
      console.log("Normalized result - deviceFound:", normalized.deviceFound);
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

