import { exec, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";

const execAsync = promisify(exec);

const HOME = process.env.HOME ?? "";
const AUDIO_RAW = path.join(HOME, ".stt_raw.wav");
const AUDIO_16K = path.join(HOME, ".stt_16k.wav");
const TTS_OUT = path.join(HOME, ".tts_out.wav");
const INTERRUPT_RAW = path.join(HOME, ".interrupt_raw.wav");

const PROOT_CMD = "proot-distro login debian";
const PROOT_BIND = `--bind "${HOME}:${HOME}"`;

function findAesopDir(): string | null {
  const candidates = [
    path.join(HOME, "aesop"),
    path.join(HOME, "Aesop"),
    path.join(HOME, "repos/aesop"),
    path.join(HOME, "storage/shared/aesop"),
  ];
  for (const d of candidates) {
    if (
      fs.existsSync(path.join(d, "deploy/phone/stt_process.py")) &&
      fs.existsSync(path.join(d, "deploy/phone/tts_speak.py"))
    ) {
      return d;
    }
  }
  return null;
}

let cachedAvailable: boolean | undefined;
let cachedAesopDir: string | null = null;

export function isVoiceAvailable(): boolean {
  if (cachedAvailable !== undefined) return cachedAvailable;
  try {
    const hasMic = fs.existsSync(
      "/data/data/com.termux/files/usr/bin/termux-microphone-record",
    );
    const hasAesop = findAesopDir() !== null;
    cachedAvailable = hasMic && hasAesop;
    if (hasAesop) cachedAesopDir = findAesopDir();
    return cachedAvailable;
  } catch {
    cachedAvailable = false;
    return false;
  }
}

function getAesopDir(): string {
  if (cachedAesopDir) return cachedAesopDir;
  cachedAesopDir = findAesopDir();
  return cachedAesopDir ?? path.join(HOME, "aesop");
}

let recordingProcess: ChildProcess | null = null;
let vadProcess: ChildProcess | null = null;
let interruptProcess: ChildProcess | null = null;
let interruptMicProcess: ChildProcess | null = null;

function cleanFile(p: string): void {
  try {
    fs.unlinkSync(p);
  } catch {
    /* file may not exist */
  }
}

function prootExec(script: string, args: string): string {
  return `${PROOT_CMD} ${PROOT_BIND} -- python3 "${script}" ${args}`;
}

export function startRecording(): void {
  cleanFile(AUDIO_RAW);
  cleanFile(AUDIO_16K);

  recordingProcess = spawn("termux-microphone-record", [
    "-f",
    AUDIO_RAW,
    "-e",
    "amr_wb",
    "-r",
    "16000",
    "-c",
    "1",
  ]);

  spawn("termux-vibrate", ["-d", "100"]);

  const vadScript = path.join(getAesopDir(), "deploy/phone/vad_monitor.py");
  if (fs.existsSync(vadScript)) {
    vadProcess = spawn(
      "sh",
      ["-c", prootExec(vadScript, `tail "${AUDIO_RAW}"`)],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
  }
}

export type CaptureResult = {
  text: string;
  source: "vad" | "manual" | "timeout";
};

/**
 * Wait for VAD end-of-speech signal. Resolves when VAD detects the user
 * stopped talking, or after a timeout. Falls back to immediate stop if
 * VAD is not running.
 */
export function waitForVAD(): Promise<"vad" | "timeout" | "no-vad"> {
  return new Promise((resolve) => {
    if (!vadProcess || !vadProcess.stdout) {
      resolve("no-vad");
      return;
    }

    let resolved = false;
    const finish = (result: "vad" | "timeout") => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    vadProcess.stdout.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      try {
        const evt = JSON.parse(line) as { event?: string };
        if (evt.event === "speech_end" || evt.event === "timeout") {
          finish(evt.event === "speech_end" ? "vad" : "timeout");
        }
      } catch {
        /* partial JSON, ignore */
      }
    });

    vadProcess.on("close", () => {
      finish("vad");
    });
  });
}

/**
 * Stop recording and transcribe. If VAD already signaled end-of-speech,
 * this just runs STT. Otherwise stops the mic immediately (manual stop).
 */
export async function stopAndTranscribe(): Promise<string> {
  if (vadProcess) {
    try {
      vadProcess.kill();
    } catch {
      /* already exited */
    }
    vadProcess = null;
  }

  try {
    await execAsync("termux-microphone-record -q", { timeout: 3000 });
  } catch {
    /* best-effort stop */
  }
  recordingProcess = null;

  await new Promise((r) => globalThis.setTimeout(r, 400));

  if (!fs.existsSync(AUDIO_RAW)) return "";

  const sttScript = path.join(getAesopDir(), "deploy/phone/stt_process.py");

  if (fs.existsSync(sttScript)) {
    try {
      const { stdout } = await execAsync(
        prootExec(sttScript, `"${AUDIO_RAW}"`),
        { timeout: 60000 },
      );
      return stdout.trim();
    } catch {
      return "";
    }
  }

  // Fallback: legacy stt_process.py path (pre-sherpa-onnx)
  try {
    await execAsync(
      `ffmpeg -y -i "${AUDIO_RAW}" -ar 16000 -ac 1 -acodec pcm_s16le "${AUDIO_16K}"`,
      { timeout: 15000 },
    );
  } catch {
    return "";
  }

  try {
    const { stdout } = await execAsync(
      `${PROOT_CMD} ${PROOT_BIND} -- python3 "${path.join(getAesopDir(), "deploy/phone/stt_process.py")}" "${AUDIO_16K}"`,
      { timeout: 60000 },
    );
    return stdout.trim();
  } catch {
    return "";
  }
}

/**
 * Full VAD-aware capture: start recording, wait for VAD end-of-speech,
 * then transcribe. Returns the transcription and how it was triggered.
 */
export async function captureVoiceInput(): Promise<CaptureResult> {
  startRecording();
  const trigger = await waitForVAD();
  const text = await stopAndTranscribe();
  return {
    text,
    source:
      trigger === "vad" ? "vad" : trigger === "timeout" ? "timeout" : "manual",
  };
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .trim();
}

export function stopSpeaking(): void {
  if (interruptProcess) {
    try {
      interruptProcess.kill();
    } catch {
      /* already exited */
    }
    interruptProcess = null;
  }
  if (interruptMicProcess) {
    try {
      interruptMicProcess.kill();
    } catch {
      /* already exited */
    }
    interruptMicProcess = null;
  }
  try {
    execAsync("termux-microphone-record -q", { timeout: 2000 }).catch(() => {});
  } catch {
    /* best-effort */
  }
  try {
    spawn("termux-media-player", ["stop"], { stdio: "ignore" });
  } catch {
    /* best-effort stop */
  }
  cleanFile(INTERRUPT_RAW);
}

export type SpeakResult = {
  interrupted: boolean;
};

/**
 * Speak text via TTS with VAD-based interrupt detection.
 *
 * While the response is playing, a background mic + VAD onset monitor
 * listens for the user starting to speak. If detected, playback is
 * killed immediately and `interrupted: true` is returned.
 */
export async function speakText(text: string): Promise<SpeakResult> {
  if (!text || text.length === 0) return { interrupted: false };

  const ttsScript = path.join(getAesopDir(), "deploy/phone/tts_speak.py");
  const truncated = stripMarkdown(text).slice(0, 500);
  const voiceSid = process.env.AESOP_VOICE ?? "0";

  cleanFile(TTS_OUT);

  // Generate TTS audio
  if (fs.existsSync(ttsScript)) {
    try {
      await execAsync(
        prootExec(
          ttsScript,
          `"${TTS_OUT}" --sid ${voiceSid} ${escapeShellArg(truncated)}`,
        ),
        { timeout: 120000 },
      );
    } catch {
      return { interrupted: false };
    }
  } else {
    // Fallback: legacy tts_speak.py with positional args
    try {
      await execAsync(
        `${PROOT_CMD} ${PROOT_BIND} -- python3 "${path.join(getAesopDir(), "deploy/phone/tts_speak.py")}" "${TTS_OUT}" --sid ${voiceSid} ${escapeShellArg(truncated)}`,
        { timeout: 120000 },
      );
    } catch {
      return { interrupted: false };
    }
  }

  if (!fs.existsSync(TTS_OUT)) return { interrupted: false };

  // Start playback
  const player = spawn("termux-media-player", ["play", TTS_OUT], {
    stdio: "ignore",
  });

  // Start interrupt detection: mic + VAD onset monitor
  const vadScript = path.join(getAesopDir(), "deploy/phone/vad_monitor.py");
  let interrupted = false;

  if (fs.existsSync(vadScript)) {
    cleanFile(INTERRUPT_RAW);

    interruptMicProcess = spawn("termux-microphone-record", [
      "-f",
      INTERRUPT_RAW,
      "-e",
      "amr_wb",
      "-r",
      "16000",
      "-c",
      "1",
    ]);

    const interruptPromise = new Promise<boolean>((resolve) => {
      interruptProcess = spawn(
        "sh",
        ["-c", prootExec(vadScript, `onset "${INTERRUPT_RAW}"`)],
        { stdio: ["ignore", "pipe", "ignore"] },
      );

      interruptProcess.stdout?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        try {
          const evt = JSON.parse(line) as { event?: string };
          if (evt.event === "speech_start") {
            resolve(true);
          }
        } catch {
          /* partial JSON */
        }
      });

      interruptProcess.on("close", () => resolve(false));
    });

    const playbackPromise = new Promise<void>((resolve) => {
      player.on("close", () => resolve());
      // Safety timeout matching typical TTS duration
      globalThis.setTimeout(() => resolve(), 120000);
    });

    const result = await Promise.race([
      interruptPromise,
      playbackPromise.then(() => false),
    ]);

    interrupted = result === true;

    if (interrupted) {
      try {
        player.kill();
      } catch {
        /* already exited */
      }
      spawn("termux-media-player", ["stop"], { stdio: "ignore" });
    }

    // Clean up interrupt monitoring
    if (interruptMicProcess) {
      try {
        interruptMicProcess.kill();
      } catch {
        /* already exited */
      }
      try {
        await execAsync("termux-microphone-record -q", { timeout: 2000 });
      } catch {
        /* best-effort */
      }
      interruptMicProcess = null;
    }
    if (interruptProcess) {
      try {
        interruptProcess.kill();
      } catch {
        /* already exited */
      }
      interruptProcess = null;
    }
    cleanFile(INTERRUPT_RAW);
  } else {
    // No VAD available — just wait for playback to finish
    await new Promise<void>((resolve) => {
      player.on("close", () => resolve());
    });
  }

  return { interrupted };
}

function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export function cancelRecording(): void {
  if (vadProcess) {
    try {
      vadProcess.kill();
    } catch {
      /* already exited */
    }
    vadProcess = null;
  }
  if (recordingProcess) {
    try {
      recordingProcess.kill();
    } catch {
      /* process may have already exited */
    }
    recordingProcess = null;
  }
  try {
    spawn("termux-microphone-record", ["-q"], { stdio: "ignore" });
  } catch {
    /* best-effort stop */
  }
}

export function voiceDiagnostics(): string[] {
  const issues: string[] = [];
  const isTermux = fs.existsSync("/data/data/com.termux/files/usr/bin/bash");
  if (!isTermux) {
    issues.push("Not running in Termux");
    return issues;
  }
  if (
    !fs.existsSync(
      "/data/data/com.termux/files/usr/bin/termux-microphone-record",
    )
  ) {
    issues.push("Missing: pkg install termux-api");
  }
  if (!fs.existsSync("/data/data/com.termux/files/usr/bin/ffmpeg")) {
    issues.push("Missing: pkg install ffmpeg");
  }
  if (!fs.existsSync("/data/data/com.termux/files/usr/bin/proot-distro")) {
    issues.push("Missing: pkg install proot-distro");
  }
  if (!findAesopDir()) {
    issues.push("Missing: AESOP scripts (clone aesop repo to ~/aesop)");
  }
  const modelsDir = path.join(HOME, "models");
  if (!fs.existsSync(path.join(modelsDir, "silero_vad.onnx"))) {
    issues.push("Missing: Silero VAD model (~/models/silero_vad.onnx)");
  }
  if (
    !fs.existsSync(
      path.join(
        modelsDir,
        "sherpa-onnx-moonshine-base-en-int8/encode.int8.onnx",
      ),
    )
  ) {
    issues.push("Missing: Moonshine STT model");
  }
  if (
    !fs.existsSync(path.join(modelsDir, "kokoro-multi-lang-v1.0/model.onnx"))
  ) {
    issues.push("Missing: Kokoro TTS model");
  }
  if (issues.length > 0) {
    issues.push("Run: bash ~/aesop/deploy/phone/setup-voice.sh");
  }
  return issues;
}
