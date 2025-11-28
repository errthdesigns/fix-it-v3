import { NextResponse } from "next/server";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You are FIX IT, a direct voice assistant for fixing tech problems.

CRITICAL RULES:
- Give SPECIFIC, ACTIONABLE steps only
- Maximum 1-2 SHORT sentences
- Use the detected device to give precise instructions
- Say exactly WHAT to do and WHERE (e.g., "Press and hold the power button on the right side for 10 seconds")
- NO generic advice, NO explanations, NO small talk
- If the user asks "what charger do I need", tell them the EXACT charger type (e.g., "USB-C cable" or "Lightning cable")
- If they ask how to fix something, tell them the EXACT button to press or action to take
- Be blunt and direct - this is for quick fixes

Examples:
User: "What charger do I need for this?"
Bad: "Well, it looks like you have an iPhone, so you'll need a Lightning cable to charge it."
Good: "Lightning cable."

User: "How do I turn this on?"
Bad: "To turn on your device, you should locate the power button and press it."
Good: "Press the power button on the right edge."

User: "It won't charge"
Bad: "There could be several reasons why it's not charging. First, make sure the cable is plugged in properly."
Good: "Clean the charging port with a toothpick, then try a different cable."
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
        max_tokens: 400,
        top_p: 0.95,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
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
              // Handle OpenAI chat completion streaming format
              if (parsed.choices && parsed.choices[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                fullText += content;
                await sendSseEvent(writer, { delta: content });
              } else if (parsed.choices && parsed.choices[0]?.finish_reason) {
                await sendSseEvent(writer, { done: true, text: fullText });
                doneEmitted = true;
              } else if (parsed.error) {
                await sendSseEvent(writer, {
                  error: parsed.error.message ?? "OpenAI stream error.",
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

