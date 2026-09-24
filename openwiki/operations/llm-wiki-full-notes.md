# LLM Wiki on Termux — Research Notes

Cleaned and code-reviewed notes extracted from a Google AI Mode research conversation about
setting up a personal "LLM Wiki" (a Karpathy-style persistent AI memory system) and, specifically,
running it on Android via Termux with a local LLM API. UI chrome, source-card fragments, and a
trailing block of duplicate Google tracking/redirect URLs were stripped. Every command block below
was checked for correctness against real Termux/GitHub package names and syntax; anything wrong
was corrected with an inline `<!-- fixed -->` note explaining what changed and why. Anything that
could not be independently confirmed is marked `<!-- UNVERIFIED -->`.

## What Is an LLM Wiki

"LLM Wiki" (sometimes written "LLM-Wiki") is a methodology popularized by AI researcher Andrej
Karpathy for using a large language model to automatically organize raw notes and documents into a
structured, interlinked wiki. It acts as a persistent "memory layer" instead of a chat session that
resets and forgets everything between conversations.

### The 3-layer structure

1. **Raw Sources** — your original, unedited documents (PDFs, articles, notes, transcripts). The AI
   reads these but never modifies them.
2. **The Wiki** — a folder of AI-generated, interlinked Markdown files representing the compiled
   knowledge (concepts, entities, summaries). The LLM owns this layer and updates it as new sources
   are added.
3. **The Schema** — a configuration document (often `CLAUDE.md` or `AGENTS.md`) that tells the AI
   exactly how to structure the wiki, handle new sources, and maintain formatting.

### How it compares to traditional RAG

- **Traditional RAG**: the AI searches raw documents every single query. It only works with what you
  feed it at that moment.
- **LLM Wiki**: the AI compiles and synthesizes the knowledge once into a living knowledge base. Each
  new document is extracted and integrated into the existing network of pages, rather than
  re-searched from scratch every time.

## Candidate Implementations

Because "LLM Wiki" is a methodology rather than a single piece of software, several independent
open-source projects implement it. The original design is described in Andrej Karpathy's LLM Wiki
GitHub Gist, which laid out the theoretical framework but was conceptual rather than full working
code — the projects below are community implementations built on top of that idea.

| Project                                                                             | What it is                                                                                                                            | Notes                                                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [lucasastorian/llmwiki](https://github.com/lucasastorian/llmwiki)                   | Full ecosystem: CLI + web app UI, Chrome extension for clipping web pages, a native concept-graph viewer, connects to Claude via MCP  | Widely cited as the most complete/most adopted implementation; supports both terminal and web-app usage |
| [nashsu/llm_wiki](https://github.com/nashsu/llm_wiki)                               | Cross-platform desktop app (Windows/Mac/Linux) with a three-column layout (file tree, chat window, live preview)                      | Has a full GUI rather than a terminal-first workflow                                                    |
| [MehmetGoekce/llm-wiki](https://github.com/MehmetGoekce/llm-wiki)                   | Bridges AI coding tools (e.g. Claude Code) into Markdown editors like Obsidian and Logseq, with a caching layer to keep API costs low | Aimed at people who already use Obsidian/Logseq                                                         |
| [eleven-net-cn/llm-wiki-starter](https://github.com/eleven-net-cn/llm-wiki-starter) | Lightweight starter/quickstart template to bootstrap an empty LLM Wiki directory with one command                                     | Good minimal starting point                                                                             |
| [green-dalii/obsidian-llm-wiki](https://github.com/green-dalii/obsidian-llm-wiki)   | Obsidian plugin pairing a CLI agent (e.g. Claude Code) with the Obsidian desktop/mobile app                                           | Alternative "plugin route" if you want to stay inside Obsidian's UI                                     |

`lucasastorian/llmwiki` is the one repeatedly recommended as the best option offering **both** a CLI
and an app interface — it supports Model Context Protocol (MCP) so an agent like Claude can use your
local command-line tools natively to read, write, and index your Markdown files, and it can run
fully locally or have its web UI hosted separately for access across devices.

<!-- UNVERIFIED: exact GitHub star counts, activity levels, and feature claims for each repo were not independently re-verified against the live repos; treat feature descriptions as directional, confirm details on the repo pages before relying on them. -->

## Mobile-Only Alternative (No Termux / No Computer)

Before settling on Termux, the conversation explored a fully mobile workflow (useful context if you
ever want to run this without a terminal at all):

- **Storage**: Obsidian (free, iOS/Android, syncs via iCloud/Google Drive) as the visual wiki viewer,
  reading the same folder of interlinked `.md` files.
- **Compiler**: Claude or ChatGPT's mobile app/PWA acting as the AI that turns raw text into
  Markdown wiki pages with `[[double-bracket links]]`.
- **Raw-text editor**: Markor, a lightweight offline Android Markdown editor, used as a fast local
  "raw inbox" when Google Docs/Keep can't open arbitrary plain-text/Markdown/log files.
- **Two-folder separation**: keep raw, untouched notes in one folder (e.g. `01_Inbox`) and
  AI-generated wiki pages in a separate folder (e.g. `02_Wiki`), so the source material is never
  overwritten. Obsidian opens the parent folder and reads both sub-folders simultaneously, drawing
  graph links between raw notes and their AI-generated wiki counterparts.
- **Sync bridge**: a folder-sync app (Autosync/FolderSync, or Google Drive's own sync) keeps a local
  Android folder mirrored to Google Drive, so Obsidian, Termux, and Google Drive are all looking at
  the exact same files.
- **Direct Drive access**: if your Claude client is already connected to Google Drive, you can skip
  copy-pasting — attach the Doc directly in the chat and ask Claude to convert it to a flat Markdown
  wiki page with `[[links]]`, output only inside a code block for one-tap copying into Obsidian/Markor.

A reusable copy-paste prompt for this workflow:

```text
You are the dedicated AI compiler for my personal LLM Wiki. I am working entirely on a mobile
device, so text formatting must be clean and copy-paste friendly.

Context: I use Markor for my raw text inbox and Obsidian for my final wiki folders.

Task: Process the raw text provided below.
1. If it introduces a new core concept, person, or project, generate a brand new Markdown (.md)
 wiki page.
2. Aggressively use [[Double Bracket Wiki Links]] for all major entities, nouns, and sub-concepts.
3. Keep the layout flat and compact. Do not add conversational fluff.
4. Output the result strictly inside a clean Markdown code block so it can be copied with one tap.

Here is the raw text to process: [PASTE YOUR RAW TEXT HERE]
```

A stricter variant, used when the goal is only to _extract links without touching the original text
at all_ (append-only, never destructive):

```text
You are my personal LLM Wiki link generator.

CRITICAL RULE: Do not rewrite, summarize, or replace my text. I must keep 100% of my original
thoughts exactly as written.

Task: Read the text below. Extract the main entities, concepts, or people, and format them ONLY as
a bulleted list of [[Wiki Links]] — nothing else.

Here is my text: [PASTE TEXT HERE]
```

## Termux Setup: Installing the Open Wiki CLI

The "Open Wiki" CLI referenced throughout is the `openwiki` npm package (built around LangChain
agents). It runs on Node.js.

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs git
npm install -g openwiki
```

<!-- fixed: original ran "pkg update && pkg upgrade pkg install nodejs git npm install -g openwiki" as one unbroken line, which would not execute as intended (pkg upgrade would swallow "pkg install nodejs git npm install -g openwiki" as extra arguments). Split into three separate, correctly-ordered commands and added -y so pkg upgrade doesn't block on an interactive prompt. -->

Usage: navigate to your repo folder and run `openwiki --init`. By default it expects an API key
(e.g. Anthropic) in the environment; to use a local model instead, point it at your local server's
base URL (see below).

The `openwiki` npm package name and its LangChain/agent-oriented description were confirmed against
the public npm registry.

## Running a Local LLM API in Termux

### Option A: llama.cpp (compiled from source)

```bash
pkg update && pkg upgrade -y
pkg install -y git cmake clang make
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
cmake -B build
cmake --build build --config Release -j"$(nproc)"
```

<!-- fixed: original said "pkg install llama-cpp", implying a prebuilt Termux package. No such package exists in the termux-main repo — llama.cpp must be compiled from source using cmake (clang/make toolchain), which is what actual Termux/llama.cpp guides do. Replaced with the real build sequence; the resulting server binary is build/bin/llama-server. -->

Download a GGUF model (e.g. from Hugging Face) to your device, then start the OpenAI-compatible
server:

```bash
./build/bin/llama-server -m /sdcard/Download/your-model.Q4_K_M.gguf -c 4096 --host 0.0.0.0 --port 8080
```

<!-- fixed: original referenced a bare "llama-server" binary as if it were on PATH after "pkg install llama-cpp". Since llama.cpp is built from source (see above), invoke the compiled binary at build/bin/llama-server. Flags -m/-c/--host/--port are valid llama-server options and were left as-is. -->

This exposes an OpenAI-compatible endpoint at `http://localhost:8080/v1` (and specifically
`http://localhost:8080/v1/chat/completions`), which the OpenWiki CLI or any custom UI can point to.

### Option B: Ollama (available as a real Termux package)

```bash
pkg update && pkg upgrade -y
pkg install -y ollama
ollama serve &
```

Unlike a desktop install, Ollama does not start automatically in the background in Termux — start it
manually and background it, then pull/run a model with the usual `ollama pull <model>` /
`ollama run <model>` commands. This path avoids compiling llama.cpp yourself.

### Verifying the local API with curl

```bash
curl http://localhost:8080/v1/chat/completions \
 -H "Content-Type: application/json" \
 -d '{
 "model": "local-model",
 "messages": [{"role": "user", "content": "ping"}],
 "max_tokens": 5
 }'
```

Run this from a **second** Termux session (swipe from the left edge → "New Session") while the first
session keeps `llama-server`/`ollama serve` running in the foreground. A JSON response containing an
assistant reply means the server is reachable; "Connection refused" means the server process isn't
actually listening (check the first session for a crash or wrong model path).

### Model notes from the conversation

- Snapdragon 8 Gen 2/3/Elite devices with 12–16GB RAM can comfortably run 4B–9B GGUF models at
  interactive speeds (community-reported ballpark: 6–20 tokens/sec depending on model size and
  quantization).
- Smaller/faster: `Phi-3-mini-4k-instruct-q4.gguf`, Qwen 2.5/3.5 4B quants.
- Larger/smarter for code generation: `Meta-Llama-3-8B-Instruct.Q4_K_M.gguf`, Qwen 2.5 Coder 7B,
  Qwen3-8B/9B quants.
- Dropping `-c` (context size) from e.g. 8192 to 2048–4096 meaningfully reduces RAM usage if you hit
  memory pressure running multiple things concurrently.

<!-- UNVERIFIED: specific tokens/sec figures and RAM headroom numbers are community-reported estimates from the original conversation, not independently benchmarked here. Treat as ballpark guidance, not guarantees. -->

### Quick-switch script between two local models

```bash
nano toggle_qwen.sh
```

Paste:

```bash
#!/bin/bash
MODEL_DIR="/sdcard/Download"

echo "Select your model to boot:"
echo "1) Small/fast model (quick text processing)"
echo "2) Large model (complex code generation)"
read -p "Enter choice [1 or 2]: " choice

if [ "$choice" == "1" ]; then
 echo "Launching small model..."
 ./build/bin/llama-server -m "$MODEL_DIR/small-model-q4_0.gguf" -c 8192 --host 0.0.0.0 --port 8080
elif [ "$choice" == "2" ]; then
 echo "Launching large model..."
 ./build/bin/llama-server -m "$MODEL_DIR/large-model-q4_k_m.gguf" -c 4096 --host 0.0.0.0 --port 8080
else
 echo "Invalid selection."
fi
```

```bash
chmod +x toggle_qwen.sh
./toggle_qwen.sh
```

<!-- fixed: original invoked a bare "llama-server" binary inside the script (same PATH issue as above) and had the shebang line run together with the MODEL_DIR assignment due to PDF line-wrapping. Reformatted into valid multi-line bash and pointed at the compiled build/bin/llama-server path. Model filenames genericized since the original hardcoded a specific Qwen 3.5 filename that could not be verified to exist. -->

## Repo Structure for Multi-Project Setups

To avoid one giant unorganized folder when the wiki needs to feed multiple downstream projects
(e.g. separate GGUF/ONNX/TFLite-targeted codebases), use a hub-and-spoke layout with the wiki
pulled in as a Git submodule or subtree rather than copy-pasted:

```text
AI_Projects/
├── 00_Master_Wiki/ <- central source of truth (synced to cloud storage)
├── Project_Fork_A/
│ └── docs/core_wiki/ <- read-only copy of the master wiki
└── Project_Fork_B/
  └── docs/core_wiki/
```

Linking the master wiki into a new project as a submodule:

```bash
cd /sdcard/AI_Projects/Project_Fork_A
git init
git submodule add /sdcard/AI_Projects/00_Master_Wiki docs/core_wiki
```

Or, to pull it in as a subtree (no `.gitmodules` pointer, files land directly in the repo):

```bash
git subtree add --prefix=docs/wiki ~/my-master-wiki main --squash
```

Both commands are valid Git syntax; `git subtree add` requires the source (`~/my-master-wiki` here)
to itself be a Git repository with the referenced branch (`main`).

## PDF / Docs to JSONL (Docling)

For turning PDFs or long documents into a fast, machine-searchable cache, the tool referenced is
[Docling](https://github.com/DS4SD/docling) (IBM). It parses layout (including tables and
multi-column text) and emits both a human-readable Markdown copy and a machine-readable JSON Lines
(`.jsonl`) file — one JSON object per chunk, with metadata — intended for fast line-by-line retrieval
rather than re-parsing a whole document on every query.

```bash
pkg install -y python
pip install docling
```

<!-- fixed: original ran "pkg install python pip install docling" as one line (same missing-separator bug as the OpenWiki install). Split into two commands. -->

Docling has heavy dependencies (it pulls in PyTorch-based layout models), and pure-Termux installs
can fail with native build errors on Android. If that happens, install `proot-distro` and run a
proper Debian/Ubuntu userland inside Termux first, then install Docling there:

```bash
pkg install -y proot-distro
proot-distro install debian
proot-distro login debian
# then, inside the Debian shell:
apt update && apt install -y python3 python3-pip
pip install docling
```

<!-- fixed: original only said "you will need to install proot-distro and run debian or ubuntu inside Termux first" without giving the actual commands. Added the concrete proot-distro install/login sequence and the in-distro Python setup, since this is exactly the kind of gap the source material flagged but didn't fill in. -->

The `.jsonl` output is plain, uncompressed, line-delimited JSON — readable but not meant for humans;
keep the Markdown copy for reading yourself in Obsidian, and let local tooling consume the `.jsonl`
for fast search.

## Extracting URLs from a Chat Log

To pull a clean, de-duplicated list of URLs out of a raw exported chat transcript using only
built-in Termux tools:

```bash
grep -o 'https\?://[^"]\+' chat.txt > urls_only.txt
```

Or, deduplicated:

```bash
grep -o 'https\?://[^" ]\+' chat_log.txt | sort -u > clean_urls.txt
```

Both use GNU grep's `\?` / `\+` basic-regex extensions (supported by the grep shipped in Termux), so
they run correctly as written once PDF line-wrap artifacts are removed. `sort -u` removes duplicate
lines from the result.

To turn a public webpage or already-public chat share-link into a clean PDF or Markdown copy, the
referenced tools are PrintFriendly / Microlink (URL → PDF) and Firecrawl / Jina AI Reader (URL →
Markdown). These cannot scrape a logged-in AI chat UI directly — first create a public share link
from inside the chat app's "Share" menu, or export/copy the transcript to a local file and process it
with the Termux commands above instead.

## Voice I/O in Termux

### Hardware bridge setup (Termux:API)

Standalone STT/TTS Python models tend to hang or get killed in Termux because Android's security
sandbox blocks raw microphone/audio-thread access from a terminal app. The reliable path is to use
Android's native voice engine through the Termux:API companion app instead of a standalone model.

```bash
pkg update && pkg upgrade -y
pkg install -y termux-api
```

Install the separate **Termux:API** companion app (same source as Termux itself — F-Droid is
recommended over Play Store), then in Android Settings → Apps → Termux:API, grant Microphone,
Storage, and unrestricted background/battery permissions.

### Text-to-speech

```bash
termux-tts-speak "Hardware bridge active."
```

Pipe any file or command output straight to speech:

```bash
cat docs/core_wiki/Project_Notes.md | termux-tts-speak
```

### Speech-to-text

```bash
termux-speech-to-text
```

Speaking after the beep prints the transcribed text to the terminal. Redirect it to a file:

```bash
termux-speech-to-text >> /sdcard/My_Drive_Sync/01_Inbox/voice_log.txt
```

### Voice round-trip through a local LLM

```bash
TEXT=$(termux-speech-to-text)
curl -s http://localhost:8080/v1/chat/completions \
 -H "Content-Type: application/json" \
 -d "$(jq -n --arg t "$TEXT" '{model:"local-model", messages:[{role:"user", content:$t}]}')" \
 | jq -r '.choices[0].message.content' \
 | termux-tts-speak
```

<!-- fixed: original built the JSON body by interpolating "$(termux-speech-to-text)" directly inside a hand-written JSON string (`"content": "$(termux-speech-to-text)"`), and parsed the reply with a fragile `grep -o '"content":"[^"]*' | cut -d'"' -f4` chain. If the spoken text contains a double quote, backslash, or newline, both the request body and the parse step break. Replaced with `jq -n` to safely construct the JSON request and `jq -r '.choices[0].message.content'` to reliably extract the reply. Requires `pkg install -y jq`. -->

### 100% offline alternative: whisper.cpp

If you need STT with no reliance on Android's built-in engine (e.g. fully offline, no Google/Samsung
services), compile whisper.cpp directly:

```bash
pkg update && pkg upgrade -y
pkg install -y clang cmake make git ffmpeg
git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp
cmake -S . -B build -DGGML_NO_OPENMP=ON
cmake --build build -j"$(nproc)"
bash ./models/download-ggml-model.sh base.en
```

<!-- fixed: original ran "pkg install clang cmake make wave-play git clone https://github.com cd whisper.cpp" as one broken line — "wave-play" is not a real Termux package, and the git clone URL was truncated (missing the actual repo path). Replaced with the correct package list (added ffmpeg, needed for the recording step below), the full clone URL for the actual upstream repo (ggml-org/whisper.cpp; the older ggerganov/whisper.cpp name may still redirect there), and the current cmake-based build (whisper.cpp's plain "make" build has been superseded by cmake, and -DGGML_NO_OPENMP=ON avoids the thread-crash issue on Android that the original text alluded to). -->

Record and transcribe manually:

```bash
termux-microphone-record -f /sdcard/voice.m4a -l 10
ffmpeg -i /sdcard/voice.m4a -ar 16000 -ac 1 -c:a pcm_s16le /sdcard/voice.wav
./build/bin/whisper-cli -m models/ggml-base.en.bin -f /sdcard/voice.wav
```

<!-- fixed: original recorded to "voice.amr" and fed it straight into "./main -m models/ggml-base.en.bin -f voice.amr". termux-microphone-record's encoders (aac/amr_wb/amr_nb/opus) don't produce whisper.cpp's required format directly, and whisper.cpp needs 16kHz mono 16-bit PCM WAV input — not amr/aac — or it will fail to parse the file. Added the ffmpeg conversion step. Also, the compiled binary in current whisper.cpp builds is build/bin/whisper-cli, not ./main (renamed in a later release). -->

## Diagnosing Unidentified Model Files (Kokoro / ONNX / GGUF / PyTorch)

If a downloaded voice/model file's format is unclear (missing or ambiguous extension), inspect it
directly rather than guessing:

```bash
ls -lh /sdcard/Download/ | grep -iE 'onnx|txt|bin|json|pth'
pkg install -y file
file /sdcard/Download/your_model_filename_here
```

Interpreting `file`'s output:

- `ONNX` / serialized Protocol Buffer → raw ONNX runtime model, loadable directly with `onnxruntime`.
- `ASCII text` → likely a plain-text token/phoneme dictionary (e.g. `tokens.txt`); confirm with
  `head /sdcard/Download/tokens.txt`.
- `data` / PyTorch zip archive → a raw PyTorch (`.pth`) checkpoint or generic tensor binary (`.bin`),
  which needs a full PyTorch runtime or a dedicated C++ loader — not something `onnxruntime` alone
  can read.

Files created inside Termux's home directory (`~`) live in a private sandbox that Android apps
(e.g. a TTS front-end app) cannot browse. To search for files that "disappeared" into Termux and move
them somewhere an Android app can see:

```bash
find ~ -type f \( -iname "*kokoro*" -o -iname "*cocoro*" \)
mkdir -p /sdcard/Download/shared_models
cp ~/path/to/found/file /sdcard/Download/shared_models/
```

A minimal (non-functional, illustrative-only) skeleton for driving a split Kokoro `model.onnx` +
`tokens.txt` pair from a Termux Python script, for reference:

```python
import onnxruntime as ort
import soundfile as sf
import numpy as np

model_path = "/sdcard/Download/model.onnx"
tokens_path = "/sdcard/Download/tokens.txt"

session = ort.InferenceSession(model_path)

def generate_voice(text, output_path="output.wav"):
 # Tokenization + inference logic goes here — this stub only demonstrates the plumbing.
 print(f"Synthesizing: {text}")
 audio_data = np.zeros(24000) # placeholder silence, not real synthesis
 sf.write(output_path, audio_data, 24000)

generate_voice("Terminal audio layer online.")
```

```bash
pip install onnxruntime soundfile numpy
python speak_kokoro.py && termux-media-player play output.wav
```

<!-- NOTE (not a bug fix): this Python snippet was explicitly a placeholder/stub in the source material (it writes silence, not real audio) — kept as-is since it illustrates the wiring (load ONNX session, take text in, write WAV out), but real tokenization + inference calls into the ONNX session still need to be filled in for actual Kokoro synthesis. -->

To pipe text to an already-running local TTS HTTP server (e.g. a Sherpa-ONNX/Piper-based app
exposing an OpenAI-style speech endpoint on the phone itself):

```bash
curl -X POST http://localhost:5000/v1/audio/speech \
 -H "Content-Type: application/json" \
 -d '{"input": "Testing local Kokoro pipeline."}' \
 --output /sdcard/Download/output.wav && termux-media-player play /sdcard/Download/output.wav
```

<!-- UNVERIFIED: this assumes the local TTS app's server implements the same /v1/audio/speech request shape as OpenAI's TTS API; confirm the exact required fields (model/voice/etc.) against that specific app's docs before relying on it verbatim. -->

Note on prebuilt TTS apps (e.g. "VoxSherpa"-style apps mentioned in the source conversation): such
apps often require models in a specific bundled format (e.g. Piper: a single `.onnx` file paired with
a same-named `.onnx.json` config) and may explicitly refuse to import a differently-structured raw
Kokoro export (separate `model.onnx` + `voices.bin` + `tokens.txt` + lexicon file) through their
manual "import model" UI. If an app's own in-app model catalog offers the same model as a prebuilt
download, prefer that over manually importing raw split files.
