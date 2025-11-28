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
  const [micClicks, setMicClicks] = useState(0);
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
        const voiceResponse = await fetch("/api/voice", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: trimmed }),
        });
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
          });
          await new Promise<void>((resolve) => {
            if (!audioElement) {
              resolve();
              return;
            }
            const handleEnded = () => {
              audioElement.removeEventListener("ended", handleEnded);
              resolve();
            };
            audioElement.addEventListener("ended", handleEnded, { once: true });
          });
        }
      } catch (error) {
        console.error(error);
        setStatus("Voice playback failed.");
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

  const handleMicClick = useCallback(() => {
    if (!recognizedDevice || !deviceLabel) {
      setStatus("Mic will enable once a device is detected.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setStatus("Voice input paused.");
      lastTranscriptRef.current = "";
      return;
    }

    setMicClicks((prev) => prev + 1);
    setStatus("Listening for your question...");
    setListening(true);
    lastTranscriptRef.current = "";

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
      setListening(false);
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
        setStatus(interim ? `You said: "${interim}"…` : "Listening for your question...");
        return;
      }
      const transcript = interim;
      if (!transcript || transcript === lastTranscriptRef.current) {
        return;
      }
      lastTranscriptRef.current = transcript;
      console.log("spoken transcript:", transcript);
      try {
        recordAction(`Asked about ${deviceLabel}`);
        const qaResponse = await fetch("/api/qa", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceDescription: deviceLabel,
            transcript,
          }),
        });

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
                throw new Error(payload.error);
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
              throw err instanceof Error
                ? err
                : new Error("Malformed stream payload.");
            }
          }
        }

        if (!doneSignal) {
          flushSentences(true);
        }

        setLastSpoken(aggregated);
        setCooldownUntil(performance.now() + 2000);
      } catch (err) {
        console.error(err);
        setStatus("Something went wrong with the question.");
      } finally {
        // keep recognition running until user toggles mic off
      }
    };

    recognition.onend = () => {
      if (listening) {
        recognition.start();
      }
    };

    recognition.onerror = (event: SpeechRecognitionEventLike) => {
      console.error("Speech recognition error", event.error);
      setStatus("Speech recognition error.");
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [recognizedDevice, deviceLabel, listening, recordAction, enqueueSpeech]);

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

  useEffect(() => {
    if (hasGreetedRef.current || !audioUnlocked) return;
    hasGreetedRef.current = true;
    (async () => {
      try {
        const greeting = "Hey, I'm FIX IT. What can I help you with?";
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
        }
        setMicReady(true);
      } catch (error) {
        console.error(error);
        setMicReady(true);
      }
    })();
  }, [audioUnlocked]);

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
          const recognitionResponse = await fetch("/api/recognize", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ image: snapshot }),
          });

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
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error
            ? error.message
            : "Something interrupted the scan.";
        setStatus(message);
        recordAction(message);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [captureFrame, recordAction, cameraReady, isAnalyzing, cooldownUntil, lastSpoken]
  );

  useEffect(() => {
    const autoInterval = setInterval(() => {
      if (!cameraReady || isAnalyzing || !audioUnlocked) return;
      handleScan();
    }, 1800);

    return () => {
      clearInterval(autoInterval);
    };
  }, [cameraReady, captureFrame, handleScan, isAnalyzing, audioUnlocked]);

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
          <button
            type="button"
            aria-label="Start voice question"
            onClick={handleMicClick}
            className="absolute bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/90 text-slate-900 shadow-xl transition hover:bg-white pointer-events-auto disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!micReady}
          >
            <svg
              className="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 14c1.657 0 3-1.343 3-3V6a3 3 0 0 0-6 0v5c0 1.657 1.343 3 3 3zm5-3c0 2.761-2.239 5-5 5s-5-2.239-5-5H5c0 3.533 2.613 6.432 6 6.92V22h2v-4.08c3.387-.488 6-3.387 6-6.92h-2z" />
            </svg>
          </button>
          {needsAudioUnlock && !audioUnlocked && (
            <div className="pointer-events-auto absolute bottom-20 left-1/2 z-30 w-[90%] max-w-sm -translate-x-1/2 rounded-2xl border border-white/40 bg-black/85 px-6 py-6 text-center text-white shadow-2xl backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.45em] text-white/75">
                Ready to fix it
              </p>
              <ol className="mt-4 space-y-2 text-base leading-relaxed text-white/90 text-left list-decimal list-inside">
                <li>Point your camera at the device.</li>
                <li>Speak aloud saying what’s not working.</li>
                <li>FIX IT will look through your camera and talk you through the fix.</li>
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
          <div className="pointer-events-none absolute bottom-2 right-6 text-xs uppercase tracking-[0.3em] text-white/70">
            clicks: {micClicks}
          </div>
          {/* Visible Status Overlay */}
          <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 max-w-md px-6 py-3 rounded-lg bg-black/80 backdrop-blur-sm border border-white/20 text-center">
            <p className="text-sm text-white/90 leading-relaxed">
              {status}
            </p>
            {recognizedDevice && deviceLabel && (
              <p className="text-xs text-green-400/80 mt-1">
                ✓ {deviceLabel}
              </p>
            )}
          </div>
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
