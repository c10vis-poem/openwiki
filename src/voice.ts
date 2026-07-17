import { exec, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";

const execAsync = promisify(exec);

const HOME = process.env.HOME ?? "";
const AUDIO_RAW = path.join(HOME, ".stt_raw.wav");
const AUDIO_16K = path.join(HOME, ".stt_16k.wav");
const TTS_OUT = path.join(HOME, ".tts_out.wav");

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
    const hasMic = fs.existsSync("/data/data/com.termux/files/usr/bin/termux-microphone-record");
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

export function startRecording(): void {
  try { fs.unlinkSync(AUDIO_RAW); } catch {}
  try { fs.unlinkSync(AUDIO_16K); } catch {}

  recordingProcess = spawn("termux-microphone-record", [
    "-f", AUDIO_RAW, "-e", "amr_wb", "-r", "16000", "-c", "1",
  ]);

  spawn("termux-vibrate", ["-d", "100"]);
}

export async function stopAndTranscribe(): Promise<string> {
  try {
    await execAsync("termux-microphone-record -q", { timeout: 3000 });
  } catch {}
  recordingProcess = null;

  await new Promise((r) => globalThis.setTimeout(r, 400));

  if (!fs.existsSync(AUDIO_RAW)) return "";

  const sttScript = path.join(getAesopDir(), "deploy/phone/stt_process.py");

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
      `proot-distro login debian --bind "${HOME}:${HOME}" -- python3 "${sttScript}" "${AUDIO_16K}"`,
      { timeout: 60000 },
    );
    return stdout.trim();
  } catch {
    return "";
  }
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
  try { spawn("termux-media-player", ["stop"], { stdio: "ignore" }); } catch {}
}

export async function speakText(text: string): Promise<void> {
  if (!text || text.length === 0) return;

  const ttsScript = path.join(getAesopDir(), "deploy/phone/tts_speak.py");
  const truncated = stripMarkdown(text).slice(0, 500);
  const voiceSid = process.env.AESOP_VOICE ?? "0";

  try { fs.unlinkSync(TTS_OUT); } catch {}

  try {
    await execAsync(
      `proot-distro login debian --bind "${HOME}:${HOME}" -- python3 "${ttsScript}" "${TTS_OUT}" --sid ${voiceSid} ${escapeShellArg(truncated)}`,
      { timeout: 120000 },
    );
  } catch {
    return;
  }

  if (fs.existsSync(TTS_OUT)) {
    spawn("termux-media-player", ["play", TTS_OUT], { stdio: "ignore" });
  }
}

function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

export function cancelRecording(): void {
  if (recordingProcess) {
    try { recordingProcess.kill(); } catch {}
    recordingProcess = null;
  }
  try { spawn("termux-microphone-record", ["-q"], { stdio: "ignore" }); } catch {}
}

export function voiceDiagnostics(): string[] {
  const issues: string[] = [];
  const isTermux = fs.existsSync("/data/data/com.termux/files/usr/bin/bash");
  if (!isTermux) {
    issues.push("Not running in Termux");
    return issues;
  }
  if (!fs.existsSync("/data/data/com.termux/files/usr/bin/termux-microphone-record")) {
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
    issues.push("Missing: Silero VAD model");
  }
  if (!fs.existsSync(path.join(modelsDir, "sherpa-onnx-moonshine-base-en-int8/encode.int8.onnx"))) {
    issues.push("Missing: Moonshine STT model");
  }
  if (!fs.existsSync(path.join(modelsDir, "kokoro-multi-lang-v1.0/model.onnx"))) {
    issues.push("Missing: Kokoro TTS model");
  }
  if (issues.length > 0) {
    issues.push("Run: bash ~/aesop/deploy/phone/setup-voice.sh");
  }
  return issues;
}
