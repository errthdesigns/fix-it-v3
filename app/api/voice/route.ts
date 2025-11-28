import { NextRequest, NextResponse } from "next/server";

const audioCache = new Map<string, Buffer>();
const MAX_CACHE_SIZE = 50;

const bufferToArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }

    const normalized = text.trim().toLowerCase();
    if (audioCache.has(normalized)) {
      const cached = audioCache.get(normalized)!;
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
            stability: 0.4,
            similarity_boost: 0.8,
            style: 0.6,
            use_speaker_boost: true,
          },
          optimize_streaming_latency: 3,
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

    if (audioCache.size >= MAX_CACHE_SIZE) {
      const iterator = audioCache.keys().next();
      if (!iterator.done) {
        audioCache.delete(iterator.value);
      }
    }
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

