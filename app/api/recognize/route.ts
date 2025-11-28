import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type RecognitionPayload = {
  description: string;
  shortDescription: string;
  highlights: string[];
  category: string;
  deviceFound: boolean;
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
    raw: JSON.stringify(parsed),
  };
};

const fallbackResult = (message: string): RecognitionPayload => ({
  category: "Unknown product",
  description: message || "Unable to identify product",
  highlights: [],
  shortDescription: "No device detected",
  deviceFound: false,
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
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `IDENTIFY THE DEVICE IN THIS IMAGE.

Look for ANY technical device visible - phones, tablets, laptops, chargers, cables, remotes, game consoles, cameras, headphones, appliances, etc.

CRITICAL: Be as SPECIFIC as possible:
- If it's an iPhone, identify the model (iPhone 14 Pro, iPhone 12, etc.) based on camera layout, design, notch/island
- If it's Android, identify brand and model if possible (Samsung Galaxy, Google Pixel, etc.)
- For laptops, identify brand (MacBook Pro, Dell XPS, etc.)
- For cables/chargers, identify the connector type (USB-C, Lightning, Micro-USB, MagSafe, etc.)
- For any device, note visible buttons, ports, logos, colors, features

If you see a device, respond with:
{
  "product_name": "SPECIFIC model/brand (e.g., 'iPhone 14 Pro', 'MacBook Air M2', 'USB-C cable', 'PlayStation 5 controller')",
  "category": "device type",
  "description": "specific details about THIS exact device visible in the image",
  "highlights": ["camera layout", "specific port type", "visible brand/model indicators"],
  "is_device": true
}

If NO device visible:
{
  "product_name": "No device detected",
  "category": "Not a device",
  "description": "Point camera at a technical device",
  "highlights": [],
  "is_device": false
}

Respond with JSON only, no markdown.`,
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

