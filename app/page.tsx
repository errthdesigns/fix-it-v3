"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
  error?: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type RecognitionResult = {
  description: string;
  shortDescription: string;
  highlights: string[];
  category: string;
  raw?: string;
  deviceFound: boolean;
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceUrlRef = useRef<string | null>(null);
  const speechQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastScanRef = useRef(0);
  const lastRecognitionRef = useRef<{
    signature: string;
    timestamp: number;
    result: RecognitionResult;
  } | null>(null);
  const [status, setStatus] = useState(
    "Auto detection standing by—point at a device."
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recentActions, setRecentActions] = useState<string[]>([]);
  const [recognizedDevice, setRecognizedDevice] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const lastTranscriptRef = useRef("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [lastSpoken, setLastSpoken] = useState<string>("");
  const hasGreetedRef = useRef(false);
  const [micReady, setMicReady] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(true);
  const scanErrorCountRef = useRef(0);
  const scanIntervalRef = useRef(3000); // Start with 3 seconds
  const [userTranscript, setUserTranscript] = useState<string>("");
  const hasProcessedQuestionRef = useRef(false);

  const recordAction = useCallback(
    (message: string) => {
      setRecentActions((prev) => [...prev.slice(-3), message]);
    },
    [setRecentActions]
  );

  const playVoiceLine = useCallback(
    async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        // Add timeout to fetch request (10 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const voiceResponse = await fetch("/api/voice", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: trimmed }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!voiceResponse.ok) {
          const errorText = await voiceResponse.text();
          throw new Error(errorText || "Voice synthesis failed.");
        }
        const arrayBuffer = await voiceResponse.arrayBuffer();
        const blob = new Blob([arrayBuffer], {
          type: voiceResponse.headers.get("Content-Type") ?? "audio/mpeg",
        });
        if (voiceUrlRef.current) {
          URL.revokeObjectURL(voiceUrlRef.current);
        }
        const audioUrl = URL.createObjectURL(blob);
        voiceUrlRef.current = audioUrl;
        const audioElement = audioRef.current;
        if (audioElement) {
          audioElement.src = audioUrl;
          await audioElement.play().catch((err) => {
            console.error("Voice playback failed", err);
            throw err; // Re-throw to trigger catch block
          });

          // Add timeout to audio playback (30 seconds max)
          await new Promise<void>((resolve, reject) => {
            if (!audioElement) {
              resolve();
              return;
            }

            const playbackTimeout = setTimeout(() => {
              audioElement.removeEventListener("ended", handleEnded);
              audioElement.removeEventListener("error", handleError);
              audioElement.pause();
              reject(new Error("Audio playback timeout"));
            }, 30000);

            const handleEnded = () => {
              clearTimeout(playbackTimeout);
              audioElement.removeEventListener("ended", handleEnded);
              audioElement.removeEventListener("error", handleError);
              resolve();
            };

            const handleError = () => {
              clearTimeout(playbackTimeout);
              audioElement.removeEventListener("ended", handleEnded);
              audioElement.removeEventListener("error", handleError);
              reject(new Error("Audio playback error"));
            };

            audioElement.addEventListener("ended", handleEnded, { once: true });
            audioElement.addEventListener("error", handleError, { once: true });
          });
        }
      } catch (error) {
        console.error("Voice playback error:", error);
        // Don't set status here, just log - this allows queue to continue
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn("Voice request timed out");
        }
      }
    },
    [setStatus]
  );

  const enqueueSpeech = useCallback(
    (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      speechQueueRef.current = speechQueueRef.current
        .catch(() => {})
        .then(() => playVoiceLine(trimmed));
    },
    [playVoiceLine]
  );

  // Process Q&A when both device and transcript are ready
  const processQuestion = useCallback(
    async (deviceDesc: string, transcript: string) => {
      console.log('[DEBUG] processQuestion called:', { deviceDesc, transcript });

      if (hasProcessedQuestionRef.current) {
        console.log('[DEBUG] Question already processed, skipping');
        return;
      }
      hasProcessedQuestionRef.current = true;

      try {
        recordAction(`Answering question about ${deviceDesc}`);
        setStatus("Processing your question...");
        console.log('[DEBUG] Sending Q&A request to /api/qa');

        const qaController = new AbortController();
        const qaTimeoutId = setTimeout(() => qaController.abort(), 30000);

        const qaResponse = await fetch("/api/qa", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceDescription: deviceDesc,
            transcript,
          }),
          signal: qaController.signal,
        });

        clearTimeout(qaTimeoutId);

        if (!qaResponse.ok || !qaResponse.body) {
          const qaError = await qaResponse
            .json()
            .catch(() => ({ error: "QA request failed." }));
          throw new Error(qaError.error ?? "QA request failed.");
        }

        const reader = qaResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let aggregated = "";
        let consumedLength = 0;
        let doneSignal = false;

        const flushSentences = (force = false) => {
          const sentenceRegex = /[^.!?]+[.!?]/g;
          sentenceRegex.lastIndex = consumedLength;
          let match = sentenceRegex.exec(aggregated);
          while (match) {
            consumedLength = match.index + match[0].length;
            enqueueSpeech(match[0]);
            match = sentenceRegex.exec(aggregated);
          }
          if (force) {
            const remainder = aggregated.slice(consumedLength).trim();
            if (remainder) {
              enqueueSpeech(remainder);
              consumedLength = aggregated.length;
            }
          }
        };

        setStatus("Assistant is replying...");

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");
            if (!chunk.startsWith("data:")) continue;
            const payloadRaw = chunk.slice(5).trim();
            if (!payloadRaw || payloadRaw === "[DONE]") continue;
            try {
              const payload = JSON.parse(payloadRaw);
              if (payload.error) {
                console.error("Stream error from server:", payload.error);
                setStatus(`Error: ${payload.error}`);
                continue;
              }
              if (typeof payload.delta === "string") {
                aggregated += payload.delta;
                setStatus(aggregated);
                flushSentences();
              }
              if (payload.done || payload.text) {
                doneSignal = true;
                flushSentences(true);
              }
            } catch (err) {
              console.error("Failed to parse chunk:", payloadRaw, err);
              continue;
            }
          }
        }

        if (!doneSignal) {
          flushSentences(true);
        }

        setLastSpoken(aggregated);
        setCooldownUntil(performance.now() + 2000);
      } catch (err) {
        console.error("Q&A error:", err);
        if (err instanceof Error && err.name === 'AbortError') {
          setStatus("Request timed out. Please try again.");
        } else {
          setStatus("Something went wrong with the question.");
        }
      }
    },
    [enqueueSpeech, recordAction]
  );

  // Auto-start voice recognition (no button needed)
  const startVoiceRecognition = useCallback(() => {
    if (listening) return; // Already listening

    const SpeechRecognitionCtor =
      (window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }).SpeechRecognition ||
      (window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setStatus("Speech recognition is unavailable.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GB";

    recognition.onresult = async (event: SpeechRecognitionEventLike) => {
      const result = event.results[event.results.length - 1];
      const interim = result[0]?.transcript?.trim() ?? "";

      if (!result.isFinal) {
        setStatus(interim ? `You said: "${interim}"…` : "Listening...");
        return;
      }

      const transcript = interim;
      if (!transcript || transcript === lastTranscriptRef.current) {
        return;
      }

      lastTranscriptRef.current = transcript;
      console.log("User transcript:", transcript);

      // Store the transcript - will be processed when device is detected
      setUserTranscript(transcript);
      setStatus(`Got it: "${transcript}". Scanning for device...`);
      recordAction("User spoke");
    };

    recognition.onend = () => {
      if (listening) {
        recognition.start();
      }
    };

    recognition.onerror = (event: SpeechRecognitionEventLike) => {
      console.error("Speech recognition error", event.error);
      setStatus("Speech recognition error.");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setStatus("Listening... Tell me about your issue.");
  }, [listening, recordAction]);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
        setCameraError(null);
        setStatus("Auto detection ready—hold steady near the product.");
        recordAction("Camera online");
      } catch (error) {
        console.error(error);
        setCameraError("Camera access is required to scan a product.");
        setStatus("Camera blocked—grant permissions to continue.");
        recordAction("Camera permission needed");
      }
    };

    startCamera();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [recordAction]);

  useEffect(() => {
    if (audioUnlocked) return;
    setStatus("Tap Start to enable FIX IT audio, then hold up a device.");
  }, [audioUnlocked]);

  const handleAudioUnlock = useCallback(() => {
    if (audioUnlocked) return;
    setAudioUnlocked(true);
    setNeedsAudioUnlock(false);
    setMicReady(true);
    setStatus("Audio unlocked—camera will announce when ready.");
  }, [audioUnlocked]);

  // Auto-start voice recognition after greeting
  useEffect(() => {
    if (hasGreetedRef.current || !audioUnlocked) return;
    hasGreetedRef.current = true;
    (async () => {
      try {
        const greeting = "Hey, I'm FIX IT. Tell me what's wrong and show me the device.";
        setStatus(greeting);
        const response = await fetch("/api/voice", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: greeting }),
        });
        if (!response.ok) {
          throw new Error("Unable to play greeting.");
        }
        const audioBuffer = await response.arrayBuffer();
        const blob = new Blob([audioBuffer], {
          type: response.headers.get("Content-Type") ?? "audio/mpeg",
        });
        const url = URL.createObjectURL(blob);
        if (voiceUrlRef.current) {
          URL.revokeObjectURL(voiceUrlRef.current);
        }
        voiceUrlRef.current = url;
        if (audioRef.current) {
          audioRef.current.src = url;
          await audioRef.current.play();
          // Wait for greeting to finish, then start listening
          await new Promise<void>((resolve) => {
            if (!audioRef.current) {
              resolve();
              return;
            }
            const handleEnded = () => {
              audioRef.current?.removeEventListener("ended", handleEnded);
              resolve();
            };
            audioRef.current.addEventListener("ended", handleEnded, { once: true });
          });
        }
        setMicReady(true);
        // Auto-start voice recognition after greeting
        startVoiceRecognition();
      } catch (error) {
        console.error(error);
        setMicReady(true);
        // Still try to start voice recognition even if greeting fails
        startVoiceRecognition();
      }
    })();
  }, [audioUnlocked, startVoiceRecognition]);

  // Process Q&A automatically when both device and transcript are ready
  useEffect(() => {
    console.log('[DEBUG] Q&A Trigger Check:', {
      hasDevice: !!deviceLabel,
      hasTranscript: !!userTranscript,
      alreadyProcessed: hasProcessedQuestionRef.current,
      deviceLabel,
      userTranscript: userTranscript?.substring(0, 50) + '...',
    });

    if (deviceLabel && userTranscript && !hasProcessedQuestionRef.current) {
      console.log('[DEBUG] Triggering Q&A with:', { deviceLabel, userTranscript });
      processQuestion(deviceLabel, userTranscript);
    }
  }, [deviceLabel, userTranscript, processQuestion]);

  useEffect(() => {
    const currentAudio = audioRef.current;
    return () => {
      const currentVoiceUrl = voiceUrlRef.current;
      if (currentVoiceUrl) {
        URL.revokeObjectURL(currentVoiceUrl);
      }
      if (currentAudio) {
        currentAudio.pause();
      }
    };
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      setStatus("Still warming up... hold the phone steady.");
      return null;
    }

    const targetWidth = 640;
    const aspect =
      video.videoWidth && video.videoHeight
        ? video.videoHeight / video.videoWidth
        : 720 / 1280;
    const targetHeight = Math.max(1, Math.round(targetWidth * aspect));
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(video, 0, 0, targetWidth, targetHeight);
    const snapshot = canvas.toDataURL("image/webp", 0.65);
    recordAction("Frame captured");
    return snapshot;
  }, [recordAction]);

  const handleScan = useCallback(
    async (overrideSnapshot?: string) => {
      if (!cameraReady || isAnalyzing) return;
      const now = performance.now();
      if (now - lastScanRef.current < 1200) return;
      lastScanRef.current = now;
      const snapshot = overrideSnapshot ?? captureFrame();
      if (!snapshot) {
        setStatus("No frame captured yet—waiting for a device.");
        return;
      }

      const snapshotSignature = snapshot.slice(0, 200);

      try {
        setIsAnalyzing(true);
        setStatus("Sending the scene to OpenAI...");
        recordAction("Recognizing product");

        let structuredResult: RecognitionResult | null = null;
        if (
          lastRecognitionRef.current &&
          lastRecognitionRef.current.signature === snapshotSignature &&
          now - lastRecognitionRef.current.timestamp < 5000
        ) {
          structuredResult = lastRecognitionRef.current.result;
          recordAction("Reuse cached recognition");
        } else {
          // Add timeout to recognize request (15 seconds)
          const recognizeController = new AbortController();
          const recognizeTimeoutId = setTimeout(() => recognizeController.abort(), 15000);

          const recognitionResponse = await fetch("/api/recognize", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ image: snapshot }),
            signal: recognizeController.signal,
          });

          clearTimeout(recognizeTimeoutId);

          const recognitionData = await recognitionResponse.json();
          if (!recognitionResponse.ok) {
            throw new Error(
              recognitionData?.error ?? "OpenAI could not describe the product."
            );
          }

          structuredResult = {
            description: recognitionData.description ?? "",
            shortDescription:
              recognitionData.shortDescription ??
              recognitionData.description ??
              "Product detected.",
            highlights: recognitionData.highlights ?? [],
            category: recognitionData.category ?? "Product",
            raw: recognitionData.raw ?? "",
            deviceFound: recognitionData.deviceFound ?? true,
          };

          lastRecognitionRef.current = {
            signature: snapshotSignature,
            timestamp: now,
            result: structuredResult,
          };
        }

        if (!structuredResult.deviceFound) {
          setStatus(structuredResult.shortDescription);
          recordAction("No technical product found");
          return;
        }

        const voiceText = structuredResult.shortDescription;
        if (performance.now() < cooldownUntil && lastSpoken === voiceText) {
          setStatus("Still reviewing the device...");
          return;
        }
        setStatus(`${voiceText}. Tap the mic when you're ready with a question.`);
        recordAction("Description received");
        setRecognizedDevice(true);
        setDeviceLabel(structuredResult.shortDescription);
        setLastSpoken(voiceText);
        setCooldownUntil(performance.now() + 4000);

        // Reset scan interval and error count on success
        scanErrorCountRef.current = 0;
        scanIntervalRef.current = 3000;
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error
            ? error.message
            : "Something interrupted the scan.";

        // Implement exponential backoff on errors
        scanErrorCountRef.current += 1;
        const backoffMultiplier = Math.min(Math.pow(2, scanErrorCountRef.current - 1), 8);
        scanIntervalRef.current = 3000 * backoffMultiplier; // Max 24 seconds

        // Check for rate limit errors
        if (message.includes("Rate limit") || message.includes("429")) {
          setStatus("Rate limit reached. Slowing down scans...");
          scanIntervalRef.current = 10000; // Back off to 10 seconds on rate limit
        } else {
          setStatus(message);
        }
        recordAction(message);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [captureFrame, recordAction, cameraReady, isAnalyzing, cooldownUntil, lastSpoken]
  );

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const scheduleNextScan = () => {
      timeoutId = setTimeout(() => {
        if (!cameraReady || isAnalyzing || !audioUnlocked) {
          scheduleNextScan(); // Retry with same interval
          return;
        }
        handleScan();
        scheduleNextScan(); // Schedule next scan
      }, scanIntervalRef.current);
    };

    scheduleNextScan();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [cameraReady, handleScan, isAnalyzing, audioUnlocked]);

  useEffect(() => {
    if (cameraReady) {
      handleScan();
    }
  }, [cameraReady, handleScan]);

  return (
    <main className="relative h-screen w-full bg-slate-950">
      <div className="absolute inset-0 bg-black/95 pointer-events-none" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-full w-full overflow-hidden bg-black">
          <div className="pointer-events-none absolute left-6 top-6 flex flex-col items-start gap-0.5 text-black">
            <span className="text-4xl font-black tracking-[0.15em]">FIX IT</span>
            <span className="text-xs uppercase tracking-[0.25em]">
              object recognition v1
            </span>
          </div>
          <video
            ref={videoRef}
            className="h-full w-full object-cover pointer-events-none"
            autoPlay
            muted
            playsInline
          />
          {/* Listening status indicator */}
          {listening && (
            <div className="absolute bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-red-500 bg-red-500/90 text-white shadow-xl pointer-events-none animate-pulse">
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 14c1.657 0 3-1.343 3-3V6a3 3 0 0 0-6 0v5c0 1.657 1.343 3 3 3zm5-3c0 2.761-2.239 5-5 5s-5-2.239-5-5H5c0 3.533 2.613 6.432 6 6.92V22h2v-4.08c3.387-.488 6-3.387 6-6.92h-2z" />
              </svg>
            </div>
          )}
          {needsAudioUnlock && !audioUnlocked && (
            <div className="pointer-events-auto absolute bottom-20 left-1/2 z-30 w-[90%] max-w-sm -translate-x-1/2 rounded-2xl border border-white/40 bg-black/85 px-6 py-6 text-center text-white shadow-2xl backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.45em] text-white/75">
                Ready to fix it
              </p>
              <ol className="mt-4 space-y-2 text-base leading-relaxed text-white/90 text-left list-decimal list-inside">
                <li>Tap START and FIX IT will start listening.</li>
                <li>Point your camera at the device while telling FIX IT what's wrong.</li>
                <li>FIX IT will recognize the device and guide you through the fix.</li>
              </ol>
              <button
                type="button"
                onClick={handleAudioUnlock}
                className="mt-5 w-full rounded-full border border-white/60 bg-white/90 px-8 py-3 text-base font-bold uppercase tracking-[0.35em] text-slate-900 transition hover:bg-white"
              >
                START
              </button>
            </div>
          )}
          {/* Status indicator - show when listening */}
          {listening && (
            <div className="pointer-events-none absolute bottom-20 right-6 text-xs uppercase tracking-[0.3em] text-white bg-red-500/80 px-3 py-1 rounded-full">
              ● LISTENING
            </div>
          )}
        </div>
      </div>
      <div className="sr-only" aria-live="polite">
        {status}
        {cameraError ? ` Camera error: ${cameraError}.` : ""}
        {recentActions.length
          ? ` Recent actions: ${recentActions.join(", ")}.`
          : ""}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <audio ref={audioRef} className="hidden" />
    </main>
  );
}
