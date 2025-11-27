# FIX IT Scanner

Stylized product reconnaissance built with Next.js, OpenAI’s Responses API, and ElevenLabs voice. Point your device at a product, capture a frame, and instantly hear what the model believes you are holding.

## Key behaviors

- **Live capture panel** — Native `getUserMedia` preview with instant snapshot feedback.
- **OpenAI intelligence** — App Router API posts the snapshot to `gpt-4.1` and extracts a concise JSON description plus highlights.
- **ElevenLabs audio** — The same route feeds the description to ElevenLabs for high-fidelity narration so you can hear the answer immediately.
- **Stylized experience** — Gradient surfaces, timeline cards, and live status indicators keep the flow modern and readable.

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Provision your API keys**

   - Copy `env.example` to `.env.local`.
   - Set `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, and `ELEVENLABS_VOICE_ID`.
   - `OPENAI_API_KEY` must have access to the Responses API (e.g. `gpt-4.1` or similar).
   - `ELEVENLABS_VOICE_ID` is the ID of the voice you want to use from your ElevenLabs dashboard.

3. **Start the dev server**

   ```bash
   npm run dev
   ```

4. **Scan a product**

   - Allow camera access when prompted.
   - Position a product, tap **Capture**, then **Scan + Speak**.
   - The right-side panel shows the text description, auto-generated highlights, and the action timeline while the ElevenLabs voice narrates the result.

## API overview

- `POST /api/recognize`  
  Receives the base64 snapshot, prompts OpenAI for a JSON response, and normalizes the description/highlights/category.
- `POST /api/voice`  
  Sends the cleaned description to ElevenLabs and streams back an audio blob encoded as base64 so the client can playback without exposing API keys.

## Testing tips

- Try capturing multiple angles so the model has different visual data.
- Adjust the voice settings inside `app/api/voice/route.ts` (stability, similarity boost) to find the right tonality.
- Watch the action timeline to see how long each step takes and surface any rate-limit errors that might be returned in the status area.

## Building & deployment

- `npm run build` — Production build; verify that API routes compile cleanly.
- `npm run start` — Serve the built app.
- `npm run lint` — Run the bundled ESLint config.

Deploy on any platform that supports Next.js 16 and serverless functions. Keep your keys safe by never shipping `.env.local`. The `env.example` file documents what values are required.
