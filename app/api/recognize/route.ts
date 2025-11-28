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

// LRU Cache implementation
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Delete if already exists to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Add to end (most recently used)
    this.cache.set(key, value);
    // Evict oldest if over size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }
}

const visionCache = new LRUCache<string, RecognitionPayload>(200); // Increased from 50 to 200

const hashImageData = (imageData: string) => {
  let hash = 0;
  const samples = 200; // Increased from 50 to 200 for better uniqueness
  const len = imageData.length;

  // Include length in hash to differentiate images of different sizes
  hash = ((hash << 5) - hash + len) | 0;

  // Sample evenly across the entire data
  const step = Math.max(1, Math.floor(len / samples));
  for (let i = 0; i < len; i += step) {
    const char = imageData.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }

  // Also sample from fixed positions (beginning, middle, end)
  // to catch differences in headers and trailers
  const positions = [0, Math.floor(len * 0.25), Math.floor(len * 0.5), Math.floor(len * 0.75), len - 1];
  for (const pos of positions) {
    if (pos >= 0 && pos < len) {
      hash = ((hash << 5) - hash + imageData.charCodeAt(pos)) | 0;
    }
  }

  return hash.toString(36);
};

const parseResult = (parsed: Record<string, unknown>): RecognitionPayload => {
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

  return {
    category,
    description,
    highlights: highlights.slice(0, 5),
    shortDescription: shortDescription || "Device detected",
    deviceFound: description !== "Unable to identify product",
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
    const cachedResult = visionCache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json({ ...cachedResult, cached: true });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this product image. Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "category": "product type in 2-3 words",
  "description": "concise description in 15-25 words",
  "highlights": ["feature 1", "feature 2", "feature 3"]
}
Keep it brief and accurate. Focus on visible features.`,
            },
            {
              type: "image_url",
              image_url: {
                url: image,
                detail: "low",
              },
            },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content as CompletionContent;
    if (!content) {
      throw new Error("OpenAI returned an empty response.");
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

    let normalized: RecognitionPayload;
    try {
      const parsed = JSON.parse(cleaned);
      normalized = parseResult(parsed as Record<string, unknown>);
    } catch (parseError) {
      console.warn("Vision parse fallback:", parseError);
      normalized = fallbackResult(cleaned);
    }

    // LRU cache handles eviction automatically
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

