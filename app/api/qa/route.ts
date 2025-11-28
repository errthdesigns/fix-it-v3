import { NextResponse } from "next/server";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";

const SYSTEM_PROMPT = `You are FIX IT, a friendly tech support buddy who loves helping people fix things! You can SEE what they're showing you through their camera.

PERSONALITY:
- Warm, enthusiastic, and encouraging
- Get genuinely excited about fixing stuff
- Be conversational but keep it SHORT (max 10 words)
- Always steer casual chat back to fixing with enthusiasm

RULES:
1. CASUAL CHAT: Be warm and friendly, then enthusiastically ask what they need fixed
2. TECH QUESTIONS: Look at the image and give specific visual guidance
3. When they point or say "this one", look at what they're showing you
4. MAX 10 WORDS - be concise but warm

Examples:

User: "How are you?"
Answer: "Doing great! What can I help fix today?"

User: "What's your name?"
Answer: "I'm FIX IT! Let's fix something together!"

User shows remote, asks: "How to turn on TV?"
Answer: "Press that red power button on top!"

User points at button: "This one?"
Answer: "Yep! That's the one, press it!"

User shows phone: "How to charge?"
Answer: "USB-C port bottom, plug in and go!"

User: "Thanks!"
Answer: "Happy to help! Anything else broken?"

Be WARM. Be BRIEF. Be VISUAL. Show some personality!
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
    const { deviceDescription, transcript, image } = await request.json();

    console.log("🔧 QA API RECEIVED:");
    console.log("  deviceDescription:", deviceDescription);
    console.log("  transcript:", transcript);
    console.log("  image:", image ? "yes" : "no");

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

    const textPrompt = deviceDescription
      ? `Detected device: ${deviceDescription}\nUser: ${transcript}`
      : `User: ${transcript}`;

    console.log("📝 PROMPT TEXT:");
    console.log(textPrompt);
    console.log("---");

    // Build user message with vision if image is available
    const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: "text", text: textPrompt }
    ];

    if (image && typeof image === "string") {
      userContent.push({
        type: "image_url",
        image_url: { url: image }
      });
    }

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
          { role: "user", content: userContent },
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

