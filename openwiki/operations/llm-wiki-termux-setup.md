---
name: llm-wiki-termux-setup
description: Guidance for setting up a personal LLM Wiki (persistent AI memory system) running locally on Termux/Android, including local LLM API setup, whisper.cpp voice input, and candidate wiki implementations. Use when the user wants to install or troubleshoot an LLM Wiki / OpenWiki-style memory system on Termux, or asks about running a local LLM API on Android.
---

# LLM Wiki on Termux — Setup Guide

An "LLM Wiki" (Karpathy-style persistent AI memory system) has three layers: raw sources
(untouched originals), the wiki (AI-generated interlinked Markdown), and a schema file
(`CLAUDE.md`/`AGENTS.md`) telling the AI how to maintain it. This skill covers running that
setup locally on Termux (Android), with a local LLM serving an OpenAI-compatible API instead of a
cloud provider.

For full background (candidate implementations, the mobile-only/no-Termux workflow, Docling
PDF→JSONL caching, repo submodule/subtree structuring, voice I/O troubleshooting) see
`llm-wiki-full-notes.md`. For source links see `llm-wiki-urls.txt`.

**Important**: this material originated from an AI-generated research conversation and the code in
it was NOT reliable as-is — several commands were broken or referenced non-existent packages. The
commands below are the corrected versions (see full-notes.md for the original→corrected diffs and
reasoning). Don't hand a user the raw AI output for this topic without this pass of scrutiny.

## Critical path: get a local LLM API running in Termux

```bash
# 1. Base packages
pkg update && pkg upgrade -y
pkg install -y git cmake clang make

# 2. Build llama.cpp from source (there is NO prebuilt `llama-cpp` Termux package —
# the original notes assumed `pkg install llama-cpp`, which does not exist)
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
cmake -B build
cmake --build build --config Release -j"$(nproc)"

# 3. Download a GGUF model to your device (e.g. via browser to /sdcard/Download/),
# then start an OpenAI-compatible server
./build/bin/llama-server -m /sdcard/Download/your-model.Q4_K_M.gguf -c 4096 --host 0.0.0.0 --port 8080
```

Simpler alternative if you don't want to compile anything — Ollama IS a real Termux package:

```bash
pkg install -y ollama
ollama serve &
ollama pull qwen2.5-coder:7b # or any model you want
```

### Verify it's alive

From a **second** Termux session (swipe from the left edge → "New Session") while the server runs
in the first:

```bash
curl http://localhost:8080/v1/chat/completions \
 -H "Content-Type: application/json" \
 -d '{
 "model": "local-model",
 "messages": [{"role": "user", "content": "ping"}],
 "max_tokens": 5
 }'
```

A JSON response with an assistant message means it's working. "Connection refused" means the
server process isn't listening — check the first session for a crash or a bad model path.

## Installing the Open Wiki CLI

The "Open Wiki" CLI is the `openwiki` npm package (confirmed real on the npm registry, built
around LangChain agents):

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs git
npm install -g openwiki
```

Then: `openwiki --init` inside your wiki repo folder. By default it expects a cloud API key
(Anthropic, etc.); to use the local server above instead, point its base URL at
`http://localhost:8080/v1`.

## Corrections made vs. the original AI-generated notes

- `pkg install llama-cpp` doesn't exist as a package → build llama.cpp from source with cmake.
- `pkg install ... wave-play ...` for whisper.cpp isn't a real package, and the whisper.cpp git
  clone URL was truncated → corrected package list + full clone URL
  (`https://github.com/ggml-org/whisper.cpp.git`) + modern cmake-based build with
  `-DGGML_NO_OPENMP=ON` to avoid an Android thread-crash issue.
- whisper.cpp's binary is `build/bin/whisper-cli` in current releases, not `./main` as the
  original notes assumed.
- Recording audio with `termux-microphone-record` doesn't produce a format whisper.cpp accepts
  directly (whisper.cpp needs 16kHz mono 16-bit WAV) → added an `ffmpeg -ar 16000 -ac 1` conversion
  step.
- The voice→LLM→voice pipeline built JSON by raw string interpolation and parsed replies with a
  fragile `grep`/`cut` chain that breaks on quotes/newlines in transcribed speech → rebuilt with
  `jq -n` to construct the request and `jq -r '.choices[0].message.content'` to parse the reply.
- Several multi-step install commands (`openwiki`, `docling`) were flattened into one broken line
  in the source material → split into correct, separately-executed commands.

## When more detail is needed

- Candidate wiki implementations (lucasastorian/llmwiki, nashsu/llm_wiki, MehmetGoekce/llm-wiki,
  etc.) and how they compare → `llm-wiki-full-notes.md` § "Candidate Implementations"
- Non-Termux, fully mobile (Obsidian + Markor + Google Drive) workflow → § "Mobile-Only
  Alternative"
- Structuring multiple downstream project repos off one master wiki (git submodule/subtree) →
  § "Repo Structure for Multi-Project Setups"
- Converting PDFs/docs into a fast JSONL cache with Docling (and the proot-distro fallback if pip
  install fails on-device) → § "PDF / Docs to JSONL (Docling)"
- Termux:API voice I/O (TTS/STT), the offline whisper.cpp path, and diagnosing unidentified
  ONNX/GGUF/PyTorch model files → §§ "Voice I/O in Termux", "100% Offline Alternative", and
  "Diagnosing Unidentified Model Files"
