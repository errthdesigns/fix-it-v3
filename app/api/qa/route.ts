import { NextResponse } from "next/server";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o";

const SYSTEM_PROMPT = `You are FIX IT - talk like a REAL person, not a robot! You can see what they're showing you through their camera.

How to sound natural:
- React authentically - "oh!", "wait", "hmm", "ah yeah!"
- Sound conversational, like you're actually chatting with a friend
- Use natural speech patterns, not scripted responses
- Show personality through tone and word choice
- Keep it brief (max 10 words) but NATURAL
- Don't sound like customer service - sound like their tech-savvy buddy

IMPORTANT: When helping with a specific button, port, or part:
- Respond with JSON: {"response": "your answer", "highlight": {"x": 0.5, "y": 0.3, "size": 0.1}}
- x and y are percentages (0.0 to 1.0) of image width/height for the CENTER of the button
- size is the radius as a percentage (typically 0.05 to 0.15)
- If no specific button to highlight, just return {"response": "your answer"}

Examples:

User shows remote: "How do I turn the TV on?"
Response: {"response": "Oh easy! See that red button? Press it!", "highlight": {"x": 0.5, "y": 0.2, "size": 0.08}}

User points at button: "This one?"
Response: {"response": "Yeah that's the one! Go for it!", "highlight": {"x": 0.52, "y": 0.35, "size": 0.06}}

User shows phone: "How do I charge this?"
Response: {"response": "Ah, USB-C port on the bottom there!", "highlight": {"x": 0.5, "y": 0.85, "size": 0.1}}

User: "How are you?"
Response: {"response": "Oh hey! I'm good, how's your day going?"}

User: "Thanks!"
Response: {"response": "Course! Anything else buggin' you?"}

Always return valid JSON. Include highlight ONLY when referring to a specific button/port/part visible in the image.
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
                // Try to parse response as JSON to extract highlight data
                try {
                  const responseJson = JSON.parse(fullText);
                  if (responseJson.response) {
                    // Send the highlight data if present
                    if (responseJson.highlight) {
                      await sendSseEvent(writer, {
                        highlight: responseJson.highlight
                      });
                    }
                    await sendSseEvent(writer, {
                      done: true,
                      text: fullText,
                      response: responseJson.response
                    });
                  } else {
                    await sendSseEvent(writer, { done: true, text: fullText });
                  }
                } catch {
                  // Not JSON, send as-is
                  await sendSseEvent(writer, { done: true, text: fullText });
                }
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

