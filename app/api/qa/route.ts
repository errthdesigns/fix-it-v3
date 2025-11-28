import { NextResponse } from "next/server";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You are FIX IT, a helpful tech support assistant. Keep ALL responses under 10 words.

CRITICAL: When you see "Detected device: [device name]", that means we CAN SEE the device in the camera. Give device-specific help immediately. Do NOT ask to see it.

RULES:
1. CASUAL QUESTIONS: Respond briefly, then ask "What needs fixing?"
2. TECH QUESTIONS:
   - "Detected device: X" = Device IS visible, give specific answer
   - "No device detected" = Ask to see device first
3. MAX 10 WORDS

Examples:

Detected device: Samsung TV
User: "How do I connect to WiFi?"
Answer: "Settings, Network, WiFi Setup."

Detected device: iPhone 14 Pro
User: "What charger?"
Answer: "Lightning cable."

No device detected yet
User: "How do I connect to WiFi?"
Answer: "Show me your device first."

User: "How are you?"
Answer: "Good! What needs fixing?"

Be SHORT. Be HELPFUL.
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
      ? `Detected device: ${deviceDescription}
User: ${transcript}`
      : `No device detected yet
User: ${transcript}`;

    console.log("📝 FULL PROMPT BEING SENT TO LLM:");
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
        max_tokens: 80,
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

