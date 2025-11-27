"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
  }>;
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

const base64ToArrayBuffer = (binary: string) => {
  const binaryString = atob(binary);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceUrlRef = useRef<string | null>(null);
  const speechQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState(
    "Auto detection standing by—point at a device."
  );
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recentActions, setRecentActions] = useState<string[]>([]);
  const [recognizedDevice, setRecognizedDevice] = useState(false);
  const [micClicks, setMicClicks] = useState(0);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [lastSpoken, setLastSpoken] = useState<string>("");
  const hasGreetedRef = useRef(false);
  const [micReady, setMicReady] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

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
        const voiceData = await voiceResponse.json();
        if (!voiceResponse.ok || !voiceData.audio) {
          throw new Error("Voice synthesis failed.");
        }
        const audioBuffer = base64ToArrayBuffer(voiceData.audio);
        const blob = new Blob([audioBuffer], {
          type: voiceData.mime ?? "audio/mpeg",
        });
        if (voiceUrlRef.current) {
          URL.revokeObjectURL(voiceUrlRef.current);
        }
        const audioUrl = URL.createObjectURL(blob);
        voiceUrlRef.current = audioUrl;
        const audioElement = audioRef.current;
        if (audioElement) {
          audioElement.src = audioUrl;
          setAudioPlaying(true);
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
      return;
    }

    setMicClicks((prev) => prev + 1);
    setStatus("Listening for your question...");
    setListening(true);

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
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-GB";

    recognition.onresult = async (event: SpeechRecognitionEventLike) => {
      const transcript = event.results[0][0].transcript;
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
              if (payload.done) {
                flushSentences(true);
              }
            } catch (err) {
              throw err instanceof Error
                ? err
                : new Error("Malformed stream payload.");
            }
          }
        }

        setLastSpoken(aggregated);
        setCooldownUntil(performance.now() + 2000);
        if (listening) {
          recognition.start();
        }
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
    if (typeof navigator === "undefined") return;
    const requiresGesture = /iPad|iPhone|iPod/i.test(navigator.userAgent);
    if (!requiresGesture) {
      setAudioUnlocked(true);
      return;
    }
    setStatus("Tap once to enable FIX IT audio, then hold up a device.");
    const unlock = () => {
      setAudioUnlocked(true);
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("touchstart", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

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
        const voiceData = await response.json();
        if (!response.ok || !voiceData.audio) {
          throw new Error("Unable to play greeting.");
        }
        const audioBuffer = base64ToArrayBuffer(voiceData.audio);
        const blob = new Blob([audioBuffer], {
          type: voiceData.mime ?? "audio/mpeg",
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

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(video, 0, 0, width, height);
    const snapshot = canvas.toDataURL("image/jpeg", 0.8);
    recordAction("Frame captured");
    return snapshot;
  }, [recordAction]);

  const handleScan = useCallback(
    async (overrideSnapshot?: string) => {
      if (!cameraReady || isAnalyzing) return;
      if (audioPlaying) return;
      cancelAudio();
      const snapshot = overrideSnapshot ?? captureFrame();
      if (!snapshot) {
        setStatus("No frame captured yet—waiting for a device.");
        return;
      }

      try {
        setIsAnalyzing(true);
        setStatus("Sending the scene to OpenAI...");
        recordAction("Recognizing product");

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

        const structuredResult: RecognitionResult = {
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
    [captureFrame, recordAction, cameraReady, isAnalyzing, audioPlaying, cooldownUntil, lastSpoken]
  );

  useEffect(() => {
    const autoInterval = setInterval(() => {
      if (!cameraReady || isAnalyzing) return;
      handleScan();
    }, 1800);

    return () => {
      clearInterval(autoInterval);
    };
  }, [cameraReady, captureFrame, handleScan, isAnalyzing]);

  useEffect(() => {
    if (cameraReady) {
      handleScan();
    }
  }, [cameraReady, handleScan]);

  const cancelAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setAudioPlaying(false);
    }
  };

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
          <div className="pointer-events-none absolute bottom-2 right-6 text-xs uppercase tracking-[0.3em] text-white/70">
            clicks: {micClicks}
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
      <audio
        ref={audioRef}
        onEnded={() => setAudioPlaying(false)}
        className="hidden"
      />
    </main>
  );
}
