import { NextResponse } from "next/server";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `
You are FIX IT, a friendly voice assistant that helps people use and troubleshoot everyday tech and household devices.

You will receive:

- A short "Detected device: …" description of what the camera identified.
- A transcription of what the user says ("User: …").

Your job:

1. Use the detected device to understand the context.
2. Understand the user's question or request.
3. Give clear, short spoken instructions (1-2 short sentences max), for how to use or fix that device.

Critical Rules:
- NEVER mention coordinates, pixel positions, or technical specifications (like "at position X,Y" or "coordinates 123,456")
- NEVER read out device data, JSON, or technical details
- Use simple directional language: "press the button on the right side" NOT "press the button at coordinates X"
- Use descriptive physical locations: "the port on the bottom" NOT technical measurements
- Keep responses purely conversational and natural - as if you're explaining to a friend
- Scope to technical products (phones, remotes, consoles, appliances, etc.). If the user asks about something else, steer them back politely
- If no device is provided, ask "What device are you using there?" before giving instructions
- Avoid long paragraphs, no jargon, and keep it ready for voice narration
- Never mention being an AI, the camera, or the prompts. Keep answers natural and friendly
- Focus on actionable steps, not technical descriptions
`;

const sendSseEvent = async (
  writer: WritableStreamDefaultWriter<Uint8Array>,
  payload: Record<string, unknown>
) => {
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
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

Respond with a short spoken-friendly instruction set. Stream back text chunks as they are ready.
`;

    const upstream = await fetch(OPENAI_ENDPOINT, {
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
        stream: true,
        input: [
          { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "input_text", text: userPrompt }] },
        ],
      }),
    });

    if (!upstream.ok) {
      const errorPayload = await upstream.json().catch(() => null);
      return NextResponse.json(
        { error: errorPayload?.error?.message ?? "OpenAI request failed." },
        { status: upstream.status }
      );
    }

    if (!upstream.body) {
      return NextResponse.json(
        { error: "OpenAI response stream was empty." },
        { status: 500 }
      );
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();

    (async () => {
      let buffer = "";
      let fullText = "";
      let doneEmitted = false;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");
            if (!chunk || !chunk.startsWith("data:")) {
              continue;
            }
            const data = chunk.slice(5).trim();
            if (!data || data === "[DONE]") {
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (
                parsed.type === "response.output_text.delta" &&
                typeof parsed.delta === "string"
              ) {
                fullText += parsed.delta;
                await sendSseEvent(writer, { delta: parsed.delta });
              } else if (parsed.type === "response.completed") {
                await sendSseEvent(writer, { done: true, text: fullText });
                doneEmitted = true;
              } else if (parsed.type === "response.error") {
                await sendSseEvent(writer, {
                  error: parsed.error?.message ?? "OpenAI stream error.",
                });
                doneEmitted = true;
              }
            } catch (err) {
              await sendSseEvent(writer, {
                error:
                  err instanceof Error
                    ? err.message
                    : "Failed to parse OpenAI stream chunk.",
              });
              doneEmitted = true;
            }
          }
        }
        if (!doneEmitted) {
          await sendSseEvent(writer, { done: true, text: fullText });
        }
      } catch (err) {
        await sendSseEvent(writer, {
          error:
            err instanceof Error
              ? err.message
              : "Unexpected error while streaming OpenAI output.",
        });
      } finally {
        await writer.close();
      }
    })();

    return new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Unable to run the Q&A.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

