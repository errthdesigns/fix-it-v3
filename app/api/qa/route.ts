import { NextResponse } from "next/server";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";

const SYSTEM_PROMPT = `You are FIX IT - talk like a REAL person, not a robot! Help people fix their devices with friendly, concise advice.

How to sound natural:
- React authentically - "oh!", "wait", "hmm", "ah yeah!"
- Sound conversational, like chatting with a friend
- Use natural speech patterns, not scripted responses
- Show personality through tone and word choice
- Keep it brief (max 10 words) but NATURAL
- Don't sound like customer service - sound like their tech-savvy buddy

When you know what device they have, give device-specific help.
When you don't know, ask them to show you or describe it.

Examples:

Detected device: TV Remote Control
User: "How do I turn the TV on?"
You: "Press the power button, usually red on top!"

Detected device: iPhone
User: "How do I charge this?"
You: "Lightning port on the bottom, plug it in!"

No device detected
User: "How do I turn this on?"
You: "What device are you trying to turn on?"

User: "How are you?"
You: "Oh hey! I'm good, how's your day going?"

User: "Thanks!"
You: "Course! Anything else buggin' you?"

Be SHORT. Be HELPFUL. Be CONVERSATIONAL.
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

    console.log("🔧 QA API RECEIVED:");
    console.log("  deviceDescription:", deviceDescription);
    console.log("  transcript:", transcript);

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

    const userPrompt = deviceDescription
      ? `Detected device: ${deviceDescription}\nUser: ${transcript}`
      : `User: ${transcript}`;

    console.log("📝 PROMPT TEXT:");
    console.log(userPrompt);
    console.log("---");

    const upstream = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 60,
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

