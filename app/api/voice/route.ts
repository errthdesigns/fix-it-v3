import { NextRequest, NextResponse } from "next/server";

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

const audioCache = new LRUCache<string, Buffer>(200); // Increased from 50 to 200

const bufferToArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }

    const normalized = text.trim().toLowerCase();
    const cached = audioCache.get(normalized);
    if (cached) {
      return new NextResponse(bufferToArrayBuffer(cached), {
        headers: {
          "Content-Type": "audio/mpeg",
          "X-Cache": "HIT",
        },
      });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (!apiKey || !voiceId) {
      return NextResponse.json(
        { error: "ElevenLabs credentials missing." },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: false,
          },
          optimize_streaming_latency: 4,
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("ElevenLabs error:", errorBody);
      return NextResponse.json(
        { error: "Voice generation failed." },
        { status: response.status }
      );
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // LRU cache handles eviction automatically
    audioCache.set(normalized, audioBuffer);

    return new NextResponse(bufferToArrayBuffer(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Voice API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

