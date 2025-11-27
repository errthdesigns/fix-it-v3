import { NextResponse } from "next/server";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5.1";

const SYSTEM_PROMPT = `
You are FIX IT, a friendly voice assistant that helps people use and troubleshoot everyday tech and household devices.

You will receive:

- A short “Detected device: …” description of what the camera identified.
- A transcription of what the user says (“User: …”).

Your job:

1. Use the detected device to understand the context.
2. Understand the user’s question or request.
3. Give clear, short spoken instructions (2 short sentences max), ideally numbered, for how to use or fix that device.

Rules:
- Scope to technical products (phones, remotes, consoles, appliances, routers, printers, etc.). If the user asks about something else, steer them back politely by referencing the device.
- If no device is provided, ask “What device are you using there?” before giving instructions.
- Avoid long paragraphs, no jargon, and keep it ready for ElevenLabs narration.
- If you’re unsure, be honest but helpful (“It looks like a generic Android phone; try holding the power button until it turns on.”).
- Never mention being an AI, the camera, or the prompts. Keep answers natural and friendly.
`;

type ResponseChunk =
  | string
  | {
      text?: string;
      value?: string;
    };

type ResponseMessage = {
  content?: ResponseChunk[];
};

const flattenOutputToText = (output?: ResponseMessage[]): string => {
  const textParts = (output ?? []).flatMap((message) => {
    return (message.content ?? []).flatMap((chunk) => {
      if (typeof chunk === "string") {
        return chunk;
      }
      if (chunk && typeof chunk === "object") {
        if (typeof chunk.text === "string") {
          return chunk.text;
        }
        if (typeof chunk.value === "string") {
          return chunk.value;
        }
      }
      return "";
    });
  });

  return textParts.join(" ").replace(/```json/gi, "").replace(/```/g, "").trim();
};

const parseJsonSafely = (text: string) => {
  const candidate = text.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const jsonMatch = candidate.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
};

export async function POST(request: Request) {
  try {
    const { deviceDescription, transcript } = await request.json();
    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Transcript text is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const userPrompt = `
Detected device: ${deviceDescription ?? "Unknown device"}
User: ${transcript}

Respond with a short spoken-friendly instruction set and include the main answer inside a JSON object like {"answer": "..."}. Keep it scoped to the detected device.
`;

    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_output_tokens: 400,
        top_p: 0.95,
        input: [
          { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "input_text", text: userPrompt }] },
        ],
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error?.message ?? "OpenAI request failed." },
        { status: response.status }
      );
    }

    const rawText = flattenOutputToText(payload.output ?? []);
    const parsed = parseJsonSafely(rawText) ?? {};
    const answer =
      typeof parsed.answer === "string" && parsed.answer.trim().length > 0
        ? parsed.answer.trim()
        : rawText;

    return NextResponse.json({ answer });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Unable to run the Q&A.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

