import { NextResponse } from "next/server";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required to generate voice." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (!apiKey || !voiceId) {
      return NextResponse.json(
        { error: "ElevenLabs credentials (API_KEY + VOICE_ID) missing." },
        { status: 500 }
      );
    }

    const response = await fetch(`${ELEVENLABS_BASE}/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.65,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Voice synthesis failed." },
        { status: response.status }
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64Audio = buffer.toString("base64");
    const mime = response.headers.get("content-type") ?? "audio/mpeg";

    return NextResponse.json({
      audio: base64Audio,
      mime,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to contact the voice service.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

