---
name: llm-wiki-termux-setup
description: Complete guide for LLM Wiki on Termux with dual-agent Qwen orchestration via GenieX. Setup local LLM API (GenieX unified stack with QAIRT + llama.cpp), MEMO layer integration (JSON knowledge base), voice pipeline (VAD/STT/TTS via sherpa-onnx), and OpenWiki CLI agent orchestration. Use when setting up on-device dual-model AI memory system on Android Snapdragon Elite, or troubleshooting local LLM API, voice I/O, MEMO layer queries, or agent handoff logic.
---

# LLM Wiki on Termux — Complete Dual-Agent Setup Guide

An "LLM Wiki" (Karpathy-style persistent AI memory system) on Snapdragon Elite combines three integrated layers:

1. **MEMO Layer** — JSON/Markdown knowledge base (raw events, preferences, temporal context) living in OpenWiki repo
2. **Dual-Agent LLM Core** — GenieX-orchestrated Qwen 3.5 2B (router) + 9B (deep thinker) for reasoning
3. **Voice I/O Pipeline** — VAD (end-of-speech detection) → STT (Moonshine) → LLM → TTS (Kokoro) via sherpa-onnx
4. **Shell Agent** — OpenWiki CLI (agent loop) that maintains the wiki, queries MEMO, triggers handoffs

The OpenWiki shell agent is the coordinator. It calls Agent 1 for quick lookups, writes handoff signals to `_handoff.md` when deep reasoning needed, and updates MEMO after responses.

---

## Part 1: GenieX Unified Stack (Dual-Agent Core)

### 1.1 Architecture Overview

**Critical Rule:** DO NOT run `llama-server` + QAIRT as separate background processes. The Hexagon HTP (Tensor Processing Unit) is shared — two runtimes = context-switch thrashing = 0 tokens/sec.

**Solution:** Use GenieX Unified Stack (part of QAIRT SDK v2.48.0.260626), which contains:

- **QAIRT Engine:** Direct HTP tensor graphs for hard-compiled .dlc models
- **llama.cpp Plugin:** Dynamic GGUF wrapper that compiles to NPU code

GenieX coordinates both, preventing tensor collision.

### 1.2 Model Configuration (Locked Down)

| Agent            | Model            | Size   | RAM         | Role                     | State                     |
| ---------------- | ---------------- | ------ | ----------- | ------------------------ | ------------------------- |
| Agent 1          | Qwen 3.5 2B      | ~1.2GB | 1.6GB       | Router/JSON formatter    | Always-hot                |
| Agent 2          | Qwen 3.5 9B Q4_0 | ~5.0GB | 5.74GB      | Deep reasoning/synthesis | On-demand with auto-purge |
| **Total Budget** | —                | ~6.2GB | **~7.44GB** | —                        | Within 9GB ceiling        |

### 1.3 Model Download Strategy

**Agent 1 (Qwen 3.5 2B):**

```bash
# Try NexaAI for NPU-optimized binary first
mkdir -p ~/models/qwen-2b
# Download NexaAI/Qwen3.5-2B-Instruct-NPU or fallback to standard GGUF
# Store to ~/models/qwen-2b/qwen-2b.gguf
```

**Agent 2 (Qwen 3.5 9B Q4_0):**

```bash
# Standard GGUF Q4_0 (optimal for Snapdragon)
mkdir -p ~/models/qwen-9b
# Download Qwen/Qwen3.5-9B-Instruct-GGUF (Q4_0 variant)
# Store to ~/models/qwen-9b/qwen-9b-q4_0.gguf
```

**Important:** Stay pure Qwen stack. Avoid mixing QAT Gemma (different vocab/tokenizers break MEMO parsing).

### 1.4 GenieX Configuration

Create `~/.geniex/config.yaml`:

```yaml
engines:
  qairt:
    models:
      - path: ~/models/qwen-2b/qwen-2b.gguf
        alias: "qwen-2b"
        runtime: llama_cpp # or native if NexaAI binary
      - path: ~/models/qwen-9b/qwen-9b-q4_0.gguf
        alias: "qwen-9b"
        runtime: llama_cpp
    context_size: 2048
    n_gpu_layers: 999
    threads: -1

scheduling:
  isolation: "none" # Let GenieX coordinate internally
  tensor_mode: "shared" # Single HTP access point
```

---

## Part 2: MEMO Layer (Local Knowledge Base)

### 2.1 MEMO Structure

MEMO lives in your OpenWiki repo as JSON/Markdown files, organized by user/time/context:

```
~/openwiki/MEMO/
├── users/
│   └── me/
│       ├── timeline.json          # Events, queries, responses
│       ├── preferences.json        # User settings, model choices
│       └── memories.md             # Synthesis of key learnings
├── calendar/
│   └── events.json                 # Scheduled tasks, past events
├── canvas/
│   └── recent_states.json          # UI screenshots, reference states
└── reasoning-bank/
    └── synthesis.md                # Complex reasoning outputs
```

### 2.2 Agent 1 Query Pattern (JSON Lookups)

Agent 1 (2B router) checks MEMO without waking Agent 2:

```bash
# Get last 7 days of events
jq '.[] | select(.timestamp > (now - 604800))' ~/openwiki/MEMO/users/me/timeline.json

# Get user preferences
jq '.model_choice, .context_window' ~/openwiki/MEMO/users/me/preferences.json
```

Return immediate response if memory hits. If task is complex, write handoff.

### 2.3 State-File Handoff Logic

**Agent 1 → Agent 2 Signal:** Write structured JSON to `~/openwiki/_handoff.md`

```json
{
  "handoff_type": "DEEP_REASONING",
  "query": "user's original question",
  "memory_snapshot": {
    "recent_events": [
      { "timestamp": "2026-07-25T12:34:56Z", "action": "...", "context": "..." }
    ],
    "user_preferences": {
      "model_choice": "qwen-9b",
      "token_budget": 2048
    },
    "temporal_context": "2026-07-25 12:30:00"
  },
  "agent_1_reasoning": "why Agent 1 cannot solve alone",
  "token_budget": 2048,
  "output_format": "json|markdown|code"
}
```

**Agent 2 Trigger:** Background script monitors `_handoff.md`:

1. Reads payload + MEMO context
2. Executes heavy synthesis
3. Writes result to `~/openwiki/_result.md`
4. Immediately drops cache to free 5.74GB RAM

### 2.4 MEMO Update Pattern

After Agent 2 response, OpenWiki shell agent appends to timeline:

```json
{
  "timestamp": "ISO-8601-UTC",
  "query_type": "routing|synthesis|voice",
  "agent": 1 | 2,
  "input": "user's question or handoff payload",
  "output": "truncated response (first 200 chars)",
  "tokens_used": 1234,
  "reasoning_depth": "immediate|shallow|deep"
}
```

---

## Part 3: Voice Pipeline (VAD + STT + TTS)

### 3.1 Installation

```bash
# One-shot setup (assumes setup-voice.sh exists in aesop repo)
bash ~/aesop/deploy/phone/setup-voice.sh
```

Installs:

- Silero VAD (voice activity detection, tail-mode for end-of-speech)
- Moonshine-base-int8 STT (fast, local transcription)
- Kokoro TTS (synthesis via sherpa-onnx)
- All models cached to `~/models/`

### 3.2 Pipeline Flow

```
Audio Input (microphone)
    ↓
VAD Monitor (vad_monitor.py)  — Detects speech, triggers on end-of-speech
    ↓
STT (stt_process.py)  — Sends to local Moonshine via sherpa-onnx → text
    ↓
Agent 1 (Qwen 2B)  — Fast response (most queries)
    ├─→ Response ready? → TTS (tts_speak.py) → audio playback
    └─→ Need Agent 2? → Write _handoff.md → wait for _result.md
    ↓
Agent 2 (Qwen 9B)  — Deep reasoning only
    ↓
TTS (tts_speak.py)  — Kokoro synthesis via sherpa-onnx → audio playback
```

### 3.3 Local LLM Endpoint (Voice Integration)

Voice pipeline expects LLM at `http://localhost:8080/v1`.

**Option A: GenieX API Server** (recommended)

```bash
# GenieX exposes both models via OpenAI-compatible endpoint
geniex-server --config ~/.geniex/config.yaml --port 8080
```

**Option B: llama-server wrapper** (direct GGUF access)

```bash
./llama-server \
  --model ~/models/qwen-9b/qwen-9b-q4_0.gguf \
  --alias "qwen-9b" \
  --port 8080 \
  --threads -1 \
  --n-gpu-layers 999 \
  --ctx-size 2048
```

### 3.4 Test Voice Pipeline

```bash
# Terminal 1: Start voice monitor
python3 ~/aesop/deploy/phone/vad_monitor.py

# Terminal 2: Watch for handoff signals
tail -f ~/openwiki/_handoff.md

# Terminal 3: Speak into phone mic
# "What did I do yesterday?" → VAD detects → STT → Agent 1 queries MEMO → response
```

---

## Part 4: OpenWiki Shell Agent (Coordinator)

### 4.1 Installation

```bash
pkg install -y nodejs git
npm install -g openwiki
cd ~/openwiki && openwiki --init
```

### 4.2 Agent Loop Configuration

OpenWiki shell agent runs in a tmux session, continuously:

1. Listens for user queries (voice or text via `_input.md`)
2. Calls Agent 1 endpoint (`http://localhost:8080/v1/messages`)
3. Checks MEMO layer for context
4. Decides: immediate response OR deep reasoning
5. If deep reasoning: writes `_handoff.md`, monitors `_result.md`
6. Updates MEMO timeline with result

### 4.3 Handoff Script (Agent 1 → Agent 2 Trigger)

Create `~/bin/trigger-agent-2.sh`:

```bash
#!/data/data/com.termux/files/usr/bin/bash
set -e

# Check if _handoff.md exists and is not empty
if [ ! -s ~/openwiki/_handoff.md ]; then
  exit 0
fi

# Spawn Agent 2 (Qwen 9B) in background
(
  # Set memory budget limit
  ulimit -v $((6 * 1024 * 1024))  # 6GB hard ceiling

  # Read handoff payload
  PAYLOAD=$(cat ~/openwiki/_handoff.md)

  # Call Agent 2 via GenieX with deep reasoning
  curl -s http://localhost:8080/v1/messages \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"qwen-9b\",
      \"max_tokens\": $(jq -r '.token_budget' ~/openwiki/_handoff.md),
      \"messages\": [{
        \"role\": \"user\",
        \"content\": $(echo "$PAYLOAD" | jq -c '.memory_snapshot | @json')
      }]
    }" > ~/openwiki/_result.md.tmp

  # Atomic rename (prevent partial reads)
  mv ~/openwiki/_result.md.tmp ~/openwiki/_result.md

  # Clean up handoff signal
  rm ~/openwiki/_handoff.md

  # Immediately drop context cache (free RAM)
  # (GenieX auto-purges on next model load; explicit clear if available)
  sync
) &
```

### 4.4 Running the Shell Agent in tmux

```bash
# Create persistent session on boot
tmux new-session -d -s openwiki -c ~/openwiki \
  bash -c "termux-wake-lock && openwiki run --memo-path MEMO --handoff _handoff.md"

# Attach to see logs
tmux attach -t openwiki
```

---

## Part 5: Device Persistence & Boot

### 5.1 Complete Boot Script (boot.sh)

```bash
#!/data/data/com.termux/files/usr/bin/bash

# 1. Acquire wake lock (prevent device sleep)
termux-wake-lock

# 2. Wait for system stabilization
sleep 2

# 3. Start GenieX unified stack (both models)
geniex-server \
  --config ~/.geniex/config.yaml \
  --port 8080 \
  --threads -1 &
GENIEX_PID=$!

# 4. Health check for GenieX
sleep 5
for i in {1..10}; do
  curl -s http://localhost:8080/v1/models && break
  sleep 1
done

# 5. Start voice pipeline (background)
python3 ~/aesop/deploy/phone/vad_monitor.py &
VAD_PID=$!

# 6. Start OpenWiki shell agent
tmux new-window -t openwiki -c ~/openwiki \
  "openwiki run --memo-path MEMO --handoff _handoff.md"

echo "✓ Snapdragon Elite dual-agent AI stack ready."
echo "  - GenieX (Qwen 2B + 9B) on port 8080"
echo "  - VAD monitoring active (PID: $VAD_PID)"
echo "  - OpenWiki agent running (tmux: openwiki)"
```

### 5.2 Auto-Launch on Boot (tmux Session)

Add to `~/.bashrc`:

```bash
# Auto-launch main tmux session if device reboots
if ! tmux ls | grep -q "^main:"; then
  tmux new-session -d -s main -c ~ bash -c "source ~/boot.sh"
fi
```

---

## Part 6: GGUF Quantization & Model Export

### 6.1 Quantization Guide for Snapdragon Elite

| Quant  | Size (9B) | Inference | Quality   | Recommendation         |
| ------ | --------- | --------- | --------- | ---------------------- |
| Q4_0   | ~5.0GB    | Fast      | Good      | **Use this (optimal)** |
| Q4_K_M | ~5.5GB    | Slower    | Better    | GPU-heavy only         |
| Q8_0   | ~8.0GB    | Very slow | Excellent | Don't use on phone     |
| f16    | ~18GB     | Slowest   | Perfect   | Never on phone         |

**Why Q4_0 for Snapdragon:** Balances speed, quality, and RAM on 6-9GB ceiling.

### 6.2 Export Command (if fine-tuning locally)

```python
# After training with Unsloth
model.save_pretrained_gguf("qwen-export", tokenizer, quantization_method="q4_0")
```

Or download pre-quantized from Qwen official: `Qwen/Qwen3.5-9B-Instruct-GGUF`

---

## Part 7: NPU Optimization & Debugging

### 7.1 Hexagon HTP Status

```bash
# Check active HTP sessions
qir-info

# Monitor tensor load during inference
adb logcat | grep -i "htp\|npu"

# Check memory pressure (approaching 6GB)
free -h
```

### 7.2 Context Window Management (RAM Pressure)

If approaching 6GB ceiling:

- Reduce Agent 2 context: `--ctx-size 1024` instead of 2048
- Lower max tokens per response: `--n-predict 512`
- Pre-purge Agent 2 cache: trigger cache-drop in `trigger-agent-2.sh`

### 7.3 Common Failure Modes

| Symptom                | Cause                                 | Fix                                 |
| ---------------------- | ------------------------------------- | ----------------------------------- |
| 0 tokens/sec inference | HTP thrashing (two runtimes fighting) | Use GenieX, not separate llama-cli  |
| OOM crash at 6GB       | Device memory pressure                | Pre-kill cache, reduce context      |
| VAD never triggers     | Microphone not initialized            | Check `termux-mic-test`             |
| Transcription empty    | STT model path wrong                  | Verify `~/models/moonshine/` exists |
| No device persistence  | Boot script not in tmux               | Add auto-launch to `~/.bashrc`      |

---

## Part 8: Critical Path Quick Reference

### Complete Setup Sequence

```bash
# 1. Install Termux packages
pkg update && pkg upgrade -y
pkg install -y git cmake clang python python-dev python-pip nodejs

# 2. Set up storage access
termux-setup-storage

# 3. Clone repos
cd ~ && git clone https://github.com/c10vis-poem/openwiki
git clone https://github.com/c10vis-poem/aesop

# 4. Download models to ~/models/
mkdir -p ~/models/{qwen-2b,qwen-9b,moonshine,kokoro}
# (Use browser or wget to download GGUF files to these directories)

# 5. Install voice pipeline dependencies
bash ~/aesop/deploy/phone/setup-voice.sh

# 6. Configure GenieX
mkdir -p ~/.geniex
# (Create config.yaml with model paths from Step 4)

# 7. Install OpenWiki CLI
npm install -g openwiki
cd ~/openwiki && openwiki --init

# 8. Create boot script
cp ~/aesop/deploy/phone/boot.sh ~/ && chmod +x ~/boot.sh

# 9. Enable auto-launch (add to ~/.bashrc)
# tmux new-session -d -s main -c ~ bash -c "termux-wake-lock && source ~/boot.sh"

# 10. Test
# Start one session, voice into phone mic: "What time is it?"
# Expect: VAD detection → transcription → Agent 1 response → TTS playback
```

---

## Part 9: When More Detail Needed

- Full notes on candidate implementations, mobile-only workflows, Docling PDF caching → `llm-wiki-full-notes.md`
- Source links and external resources → `llm-wiki-urls.txt`
- Diagnosing ONNX/GGUF/PyTorch model files → See `llm-wiki-full-notes.md`
- Git submodule/subtree structuring for multi-project setups → See full-notes.md § "Repo Structure"
