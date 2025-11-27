import { NextResponse } from "next/server";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4.1";

const SYSTEM_PROMPT = `
You are the vision and voice brain for an app called FIX IT. Mention brands/models whenever you are confident about them (e.g. “iPhone,” “Samsung TV”).

The app uses a live webcam feed to look at what the user is pointing their phone at.

Your ONLY job in this version of the app is:

Look at what’s in the camera frame.

Decide if there is a technical product / device clearly visible.

If there is, say out loud what it is in one short sentence.

If there isn’t, say a short “no device has been located” message.

Only treat something as relevant if it is a tech or household device, including phones, tablets, computers, remotes, game consoles, home appliances, audio gear, routers, printers, etc.

If you are not sure if an item is a device or just decor/furniture, treat it as NOT relevant.

Never describe people, pets, plants, art, furniture, walls, floors, food, drinks, clutter, or any UI overlays. If you only see those things, act as if no relevant product is present.

Always respond with one short sentence, plain casual UK English. Identify the main visible device or reply that nothing technical is detected. No instructions, no explanation about the webcam, and no reference to being an AI model.
`;

const USER_PROMPT = `
You are a product intelligence agent. Identify the object in the image, guess the likely category, and explain how a person would use it.
Always respond with a single JSON object, never with Markdown wrappers. Include the following keys:
{
  "description": "A full sentence that explains the object, its brand cues, and what it does.",
  "product_name": "Only the product name as it appears on the device (brand + model if visible). Keep it very short.",
  "highlights": ["A short keyword for a notable trait", "..."],
  "category": "Strong label such as 'kitchen gadget' or 'beauty device'",
  "confidence": "Optional short phrase about how certain you are.",
  "device_found": true,
  "bbox": [0, 0, 0, 0]
}
If you are uncertain, state that clearly inside the description.
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
    return (message.content ?? []).map((chunk) => {
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
    // Attempt to extract JSON inside the text.
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
    const { image } = await request.json();
    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "Image data is required for recognition." },
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

    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          max_output_tokens: 500,
          top_p: 0.95,
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: SYSTEM_PROMPT,
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: USER_PROMPT,
                },
                {
                  type: "input_image",
                  image_url: image,
                },
              ],
            },
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

    const description =
      parsed.description ??
      rawText ??
      "OpenAI could not describe this product confidently.";
    const highlights = Array.isArray(parsed.highlights)
      ? (parsed.highlights as string[]).filter(Boolean)
      : [];
    const category =
      (typeof parsed.category === "string" && parsed.category) ||
      (typeof parsed.useCase === "string" && parsed.useCase) ||
      "Product";

    const booleanFromField = (fieldName: "device_found" | "deviceFound") => {
      const value = parsed[fieldName];
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "yes", "1"].includes(normalized)) return true;
        if (["false", "no", "0"].includes(normalized)) return false;
      }
      return undefined;
    };

    const parseBBox = (value: unknown): number[] | null => {
      if (!Array.isArray(value) || value.length !== 4) return null;
      const coords = value.map((num) => {
        if (typeof num !== "number") return NaN;
        return Math.min(1, Math.max(0, num));
      });
      if (coords.some((num) => Number.isNaN(num))) return null;
      return coords as number[];
    };

    let parsedDeviceFound =
      booleanFromField("device_found") ?? booleanFromField("deviceFound");

    if (parsedDeviceFound === undefined) {
      const lowerText = rawText.toLowerCase();
      parsedDeviceFound = lowerText.includes("no device detected")
        ? false
        : true;
    }

    const createShort = (value: string) => {
      const withoutNewlines = value.replace(/\s+/g, " ").trim();
      const separatorIndex = withoutNewlines.indexOf(".");
      if (separatorIndex === -1 || separatorIndex > 120) {
        return withoutNewlines.slice(0, 120).trim();
      }
      return withoutNewlines.slice(0, separatorIndex).trim();
    };

    const shortDescriptionFromParsed =
      (parsed.product_name as string | undefined) ??
      (parsed.productName as string | undefined);

    const shortDescription =
      shortDescriptionFromParsed ??
      (parsed.shortDescription as string | undefined) ??
      (parsed.short_description as string | undefined) ??
      createShort(description);

    const parsedBoundingBox =
      parseBBox(parsed.bbox) ??
      parseBBox(parsed.bounding_box) ??
      parseBBox(parsed.boundingBox);

    return NextResponse.json({
      description,
      shortDescription,
      highlights,
      category,
      raw: rawText,
      deviceFound: parsedDeviceFound,
      bbox: parsedBoundingBox,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to run the recognition request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

