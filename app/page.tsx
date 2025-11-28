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
  onstart: (() => void) | null;
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
    "Click START to begin."
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recentActions, setRecentActions] = useState<string[]>([]);
  const [recognizedDevice, setRecognizedDevice] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
  const deviceLabelRef = useRef<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const lastTranscriptRef = useRef("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [lastSpoken, setLastSpoken] = useState<string>("");
  const hasGreetedRef = useRef(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(true);
  const isSpeakingRef = useRef(false);
  const isStartingRecognitionRef = useRef(false);
  const [lastQARequest, setLastQARequest] = useState<{device: string | null, question: string} | null>(null);

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
        isSpeakingRef.current = true;
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
              isSpeakingRef.current = false;
              resolve();
            };
            audioElement.addEventListener("ended", handleEnded, { once: true });
          });
        }
      } catch (error) {
        console.error(error);
        setStatus("Voice playback failed.");
        isSpeakingRef.current = false;
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

  const startListening = useCallback(() => {
    if (listening || isStartingRecognitionRef.current) {
      return; // Already listening or starting
    }

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

    isStartingRecognitionRef.current = true;
    setListening(true);
    setStatus("Listening...");
    lastTranscriptRef.current = "";

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GB";

    recognition.onresult = async (event: SpeechRecognitionEventLike) => {
      const result = event.results[event.results.length - 1];
      const interim = result[0]?.transcript?.trim() ?? "";

      // If user starts speaking while AI is talking, stop the AI immediately
      if (isSpeakingRef.current && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        isSpeakingRef.current = false;
        setStatus("Listening...");
      }

      if (!result.isFinal) {
        setStatus(interim ? `"${interim}"` : "Listening...");
        return;
      }
      const transcript = interim;
      if (!transcript || transcript === lastTranscriptRef.current) {
        return;
      }
      lastTranscriptRef.current = transcript;
      console.log("User question:", transcript);

      // STOP LISTENING while processing
      recognitionRef.current?.stop();
      setListening(false);

      try {
        recordAction(`Q: ${transcript.slice(0, 30)}`);
        console.log("💬 Sending QA request:");
        console.log("  Device:", deviceLabelRef.current || "null");
        console.log("  Question:", transcript);

        // Capture current camera frame for visual context
        const currentFrame = captureFrame();

        // Store for debug display
        setLastQARequest({
          device: deviceLabelRef.current,
          question: transcript
        });

        const qaResponse = await fetch("/api/qa", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceDescription: deviceLabelRef.current || null,
            transcript,
            image: currentFrame,
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

        setStatus("FIX IT is answering...");

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

        // Wait for speech to finish, then restart listening
        await speechQueueRef.current;
        setTimeout(() => {
          startListening();
        }, 500);

      } catch (err) {
        console.error(err);
        setStatus("Something went wrong. Try again.");
        setTimeout(() => {
          startListening();
        }, 2000);
      }
    };

    recognition.onstart = () => {
      isStartingRecognitionRef.current = false;
      // If AI is speaking when user starts talking, interrupt it
      if (isSpeakingRef.current && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        isSpeakingRef.current = false;
      }
    };

    recognition.onend = () => {
      setListening(false);
      isStartingRecognitionRef.current = false;
    };

    recognition.onerror = (event: SpeechRecognitionEventLike) => {
      console.error("Speech recognition error", event.error);
      setListening(false);
      isStartingRecognitionRef.current = false;

      // Only restart on specific errors, not network/aborted/no-speech
      const error = event.error;
      if (error !== 'network' && error !== 'aborted' && error !== 'no-speech') {
        setTimeout(() => {
          startListening();
        }, 2000);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.error("Failed to start recognition:", error);
      setListening(false);
      isStartingRecognitionRef.current = false;
    }
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
        setStatus("Camera ready.");
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
    setStatus("Audio unlocked—camera will announce when ready.");
  }, [audioUnlocked]);

  useEffect(() => {
    if (hasGreetedRef.current || !audioUnlocked) return;
    hasGreetedRef.current = true;
    (async () => {
      try {
        isSpeakingRef.current = true;
        const greeting = "Hey, I'm FIX IT. What needs fixing?";
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
          await new Promise<void>((resolve) => {
            if (!audioRef.current) {
              resolve();
              return;
            }
            const handleEnded = () => {
              audioRef.current?.removeEventListener("ended", handleEnded);
              isSpeakingRef.current = false;
              resolve();
            };
            audioRef.current.addEventListener("ended", handleEnded, { once: true });
          });
        }
        // Start listening after greeting
        setTimeout(() => {
          startListening();
        }, 500);
      } catch (error) {
        console.error(error);
        isSpeakingRef.current = false;
        // Still start listening even if greeting failed
        setTimeout(() => {
          startListening();
        }, 500);
      }
    })();
  }, [audioUnlocked, startListening]);

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

  // Removed auto-start on device detection - listening starts after greeting instead

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
        return;
      }

      const snapshotSignature = snapshot.slice(0, 200);

      try {
        setIsAnalyzing(true);
        // Don't update status during scan - keep conversation flowing
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
          recordAction("No technical product found");
          // Don't clear existing device if we fail to detect on this scan
          // Keep the last known device
          return;
        }

        // Silently update device label without interrupting conversation
        const voiceText = structuredResult.shortDescription;
        if (performance.now() < cooldownUntil && lastSpoken === voiceText) {
          return;
        }

        console.log("🔍 DEVICE DETECTED:", structuredResult.shortDescription);
        console.log("📱 Device data:", structuredResult);

        // Only update status if not currently listening or speaking
        if (!listening && !isSpeakingRef.current) {
          setStatus(`${voiceText} detected.`);
        }

        recordAction("Description received");
        setRecognizedDevice(true);
        setDeviceLabel(structuredResult.shortDescription);
        deviceLabelRef.current = structuredResult.shortDescription;
        setLastSpoken(voiceText);
        setCooldownUntil(performance.now() + 4000);
      } catch (error) {
        console.error("❌ Scan error:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Something interrupted the scan.";
        recordAction(message);
        // Don't clear device on error - keep last known device
      } finally {
        setIsAnalyzing(false);
      }
    },
    [captureFrame, recordAction, cameraReady, isAnalyzing, cooldownUntil, lastSpoken, listening]
  );

  useEffect(() => {
    // Passive background scanning every 8 seconds (less aggressive)
    // Scans quietly without blocking conversation
    const scanInterval = setInterval(() => {
      if (!cameraReady || !audioUnlocked) return;
      // Scan passively in background - don't block if already analyzing
      if (!isAnalyzing) {
        handleScan();
      }
    }, 8000);

    return () => {
      clearInterval(scanInterval);
    };
  }, [cameraReady, handleScan, isAnalyzing, audioUnlocked]);

  useEffect(() => {
    // Do one initial scan after camera is ready
    if (cameraReady && audioUnlocked) {
      setTimeout(() => {
        handleScan();
      }, 2000);
    }
  }, [cameraReady, audioUnlocked, handleScan]);

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
          {/* Listening Indicator */}
          {listening && (
            <div className="absolute bottom-6 right-6 z-30 flex h-16 w-16 items-center justify-center pointer-events-none">
              <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-500 bg-red-500/90 shadow-xl">
                <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
              </div>
            </div>
          )}
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
          {/* Debug Info - Top Right */}
          <div className="pointer-events-none absolute top-20 right-4 bg-black/80 backdrop-blur-sm border border-yellow-500/60 px-3 py-2 rounded-lg text-xs font-mono max-w-xs">
            <p className="text-yellow-400 font-bold mb-1">DEBUG</p>
            <p className="text-white">Device: {deviceLabel || "null"}</p>
            <p className="text-white">Recognized: {recognizedDevice ? "yes" : "no"}</p>
            <p className="text-white">Analyzing: {isAnalyzing ? "yes" : "no"}</p>
            {lastQARequest && (
              <>
                <p className="text-yellow-400 font-bold mt-2 mb-1">LAST QA REQUEST:</p>
                <p className="text-white break-words">Sent Device: {lastQARequest.device || "NULL!"}</p>
                <p className="text-white break-words">Q: {lastQARequest.question.slice(0, 30)}...</p>
              </>
            )}
          </div>

          {/* Visible Status Overlay */}
          <div className={`pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 max-w-lg px-8 py-4 rounded-2xl backdrop-blur-md border-2 text-center transition-all duration-300 ${
            listening
              ? 'bg-red-500/20 border-red-500/60'
              : 'bg-black/90 border-white/30'
          }`}>
            {listening && (
              <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2 flex items-center justify-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                LISTENING
              </p>
            )}
            <p className="text-base text-white font-medium leading-relaxed">
              {status}
            </p>
            {recognizedDevice && deviceLabel && !listening && (
              <p className="text-sm text-green-400 mt-2 font-semibold">
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
