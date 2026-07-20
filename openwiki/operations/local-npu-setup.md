# Local NPU setup — Snapdragon 8 Elite + Termux

Run a local Qwen model on the Snapdragon 8 Elite's Hexagon v79 HTP NPU, then point the OpenWiki CLI at it instead of a cloud provider.

## Hardware assumptions

- Snapdragon 8 Elite (SM8750), 16 GB RAM
- Hexagon v79 HTP (Hexagon Tensor Processor) NPU
- Termux installed from F-Droid
- Qualcomm shared libraries already on-device (from your UI app build or QAI Hub):
  - `libQnnHtp.so` — QNN HTP backend
  - `libQairtHtp.so` — QAIRT pipeline
  - `libGenie.so` — Genie X core engine
  - `libSnpeHtpV79Stub.so` — v79 stub
  - `libQnnHtp.so` — Qualcomm Neural Network runtime
- Model file: `Qwen3.5-9B-Q4_0.gguf` in `/sdcard/Download/`

## The binary problem

The default `llama-server` installed via Termux (`pkg install llama-cpp`) is a **CPU-only** build. It does not recognize `--device hexagon`, `--device qnn`, or any NPU flag. Running `--list-devices` returns blank.

You need a `llama-server` binary compiled with the **QNN backend** (`-DLLAMA_QNN=ON`). Two paths:

### Path A — Use the pre-compiled QNN binary (if available)

If you have `libllama-server-impl.so` in your Downloads, that file is the pre-compiled QNN/QAIRT server implementation. It needs to be loaded by a compatible `llama-cli` or `llama-server` that was built against the same QNN SDK.

Check what you have:

```bash
find ~/bin/ -name "*llama*" -type f
find /sdcard/Download/ -name "*llama*" -type f
ls /sdcard/Download/aarch64-oe-linux-gcc11.2/
```

### Path B — Compile llama.cpp with QNN backend in Termux

```bash
pkg update && pkg install -y git cmake clang golang ndk-sysroot

git clone --depth 1 https://github.com/ggml-org/llama.cpp && cd llama.cpp

mkdir build && cd build
cmake .. \
  -DLLAMA_QNN=ON \
  -DQNN_SDK_DIR=$HOME/openwiki/aarch64-oe-linux-gcc11.2 \
  -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release -j$(nproc)
```

The resulting `bin/llama-server` will recognize `--device qnn` and load `libQnnHtp.so`.

## Starting the local server

Once you have a QNN-enabled binary, start the server. Key flags:

- `--no-mmap` — allocates weights into a concrete memory buffer instead of mmap; prevents Android's LMK from swapping chunks mid-inference
- `-c 8192` or `-c 16384` — cap context to prevent KV cache from eating the ~2.5 GB free buffer after model load
- `--port 8080` — the OpenAI-compatible endpoint
- `GGML_HEXAGON_NDEV=4` — parallelize across 4 HTP compute threads

```bash
LD_LIBRARY_PATH=/sdcard/Download/:$HOME/openwiki/aarch64-oe-linux-gcc11.2:$LD_LIBRARY_PATH \
  GGML_HEXAGON_NDEV=4 \
  $HOME/bin/llama-server \
  --no-mmap \
  -m /sdcard/Download/Qwen3.5-9B-Q4_0.gguf \
  -c 8192 \
  --port 8080
```

Watch for these markers in the boot log:

```
Found Hexagon device...
Loading Qualcomm AI Runtime (QAIRT)...
HTP backend initialized successfully with 4 devices.
```

If it says `invalid device: qnn` or `invalid device: hexagon`, your binary is CPU-only — go to Path B.

**Important:** Do not `export LD_LIBRARY_PATH` globally. The inline form (`LD_LIBRARY_PATH=... command`) scopes it to that single process, keeping your UI app's build environment clean.

## Verify the server

From a second Termux tab:

```bash
curl http://localhost:8080/v1/models
```

You should see your loaded model name. Then test a completion:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3.5-9b-q4_0","messages":[{"role":"user","content":"Hello"}],"max_tokens":64}'
```

## Pointing OpenWiki at the local server

Set the provider to `local` in `~/.openwiki/.env`:

```
OPENWIKI_PROVIDER=local
OPENWIKI_MODEL_ID=qwen3.5-9b-q4_0
```

Or configure interactively:

```bash
ow
```

Select **Local (llama-server)** from the provider list during setup.

The local provider hits `http://localhost:8080/v1` by default. Override with:

```
OPENWIKI_LOCAL_ENDPOINT=http://localhost:8080/v1
```

## Memory budget (16 GB device)

| Component | RAM |
| --- | --- |
| Android OS + apps | ~8–9.5 GB |
| Free for model | ~6.5–8 GB |
| Qwen3.5-9B Q4_0 weights | ~5.2–5.5 GB |
| Remaining for KV cache | ~1–2.5 GB |

Cap context (`-c 8192` or `-c 16384`) to keep the KV cache within the remaining buffer. The native 256K context will OOM.

## AESOP tier mapping

In the AESOP protocol, this setup maps the phone to **T1 — Edge / Mobile** running the query/tool-exec role with a local model. See `profiles/nav.yaml` in the aesop repo:

```yaml
phone:
  tiers: [edge]
  model:
    local: "Qwen3.5-9B-VLM"
    quant: "Q4_0-GGUF"
    runtime: "QAIRT / HTP (Hexagon NPU)"
```

When home-tier nodes (Jetson, Rubik Pi) are reachable, the executive role offloads to those. When only the phone is available, query + exec collapse onto the edge with this local model as the brain.
