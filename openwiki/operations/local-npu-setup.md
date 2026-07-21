# Local NPU setup — Snapdragon 8 Elite + Termux

Run a local Qwen model on the Snapdragon 8 Elite's Hexagon v79 HTP NPU, then point the OpenWiki CLI at it instead of a cloud provider.

See [device-inventory.md](device-inventory.md) for the full catalog of QAIRT SDK assets, model configs, and library paths on-device.

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
- Model files in `/sdcard/Download/`:
  - `Qwen3.5-9B-Q4_0.gguf` — primary coding model (NPU-native via ggml-hexagon backend)
  - `Qwen3-4B-Thinking-2507-IQ4_NL.gguf` — reasoning model (~2.38 GB, CPU-only via llama.cpp)
  - Optionally: Qwen3-4B-Instruct from QAI Hub (QAIRT-compiled, NPU-native)

## The binary problem

The default `llama-server` installed via Termux (`pkg install llama-cpp`) is a **CPU-only** build. It does not recognize `--device hexagon` or any NPU flag. Running `--list-devices` returns blank.

You need a `llama-server` binary compiled with the **ggml-hexagon backend** (`-DGGML_HEXAGON=ON`). This backend talks directly to the Hexagon DSP via FastRPC and runs custom HTP kernels (matrix multiplication, attention, etc.) on the NPU.

### Why you can't just build it in Termux

The ggml-hexagon backend has two parts:

1. **Client-side** (ARM64): `ggml-hexagon.cpp`, `htp-drv.cpp`, `htp_iface_stub.c` — makes FastRPC calls from the CPU to the DSP. This compiles with any ARM64 C++ compiler.

2. **Skeleton** (Hexagon DSP): `libggml-htp-v79.so` — contains the actual tensor operations that run on the NPU. Built from ~30 C source files in `htp/` (matmul-ops.c, flash-attn-ops.c, etc.). This **requires the Hexagon cross-compiler** (`hexagon-clang`) and QURT runtime libraries, both from the Hexagon SDK.

The Hexagon SDK is a separate package from the QAIRT SDK you already have. The QAIRT SDK has runtime `.so` files and model configs; the Hexagon SDK has the cross-compiler, IDL tools, and DSP build infrastructure. The two are not interchangeable.

The QAIRT skeletons on-device (`libQnnHtpV79Skel.so`, etc.) are for the QNN/QAIRT framework — they cannot be used by ggml-hexagon, which needs its own custom `libggml-htp-v79.so`.

### Build dependencies

| Component | What it does | Source |
| --- | --- | --- |
| Hexagon SDK 6.6+ | Cross-compiler (`hexagon-clang`), QURT runtime, IDL compiler, SDK headers | [snapdragon-toolchain/hexagon-sdk](https://github.com/snapdragon-toolchain/hexagon-sdk/releases) (trimmed, ~662 MB) |
| Android NDK r27+ | ARM64 cross-compiler, Android sysroot, linker | [developer.android.com](https://developer.android.com/ndk/downloads) |
| FastRPC headers | `remote.h`, `dspqueue.h`, `rpcmem.h`, `AEEStdDef.h`, `AEEStdErr.h` | Bundled in Hexagon SDK at `incs/` |

## Path A — Pre-built binaries (recommended)

The openwiki repo includes a GitHub Actions workflow that cross-compiles everything:

```
.github/workflows/build-llama-hexagon.yml
```

To trigger a build:

1. Go to the repo's Actions tab on GitHub
2. Select "Build llama-server (Hexagon NPU)"
3. Click "Run workflow" (optionally pin a llama.cpp version)
4. Wait ~20 minutes for the build
5. Download the `llama-hexagon-v79-*` artifact

Then on your phone:

```bash
# Download the artifact (extract the zip first on a PC, or use unzip in Termux)
cd ~/Downloads
tar xzf llama-hexagon-v79.tar.gz
cd llama-hexagon-v79
bash install.sh
```

The install script places everything in `~/llama-hexagon/` and creates `run-server.sh`.

## Path B — Cross-compile on a Linux PC

On any x86_64 Linux machine:

```bash
# 1. Download Hexagon SDK (trimmed, ~662 MB)
curl -L -o /tmp/hexagon-sdk.tar.xz \
  "https://github.com/snapdragon-toolchain/hexagon-sdk/releases/download/v6.6.0.0/hexagon-sdk-v6.6.0.0-amd64-lnx.tar.xz"
mkdir -p /opt/hexagon && tar -xf /tmp/hexagon-sdk.tar.xz -C /opt/hexagon

# 2. Download Android NDK
curl -L -o /tmp/ndk.zip \
  "https://dl.google.com/android/repository/android-ndk-r27c-linux.zip"
unzip -q /tmp/ndk.zip -d /opt

# 3. Set environment
export HEXAGON_SDK_ROOT=/opt/hexagon/6.6.0.0
export HEXAGON_TOOLS_ROOT=$(python3 -c "
import json, pathlib
cfg = json.loads(pathlib.Path('$HEXAGON_SDK_ROOT/hexagon_sdk.json').read_text())
print('$HEXAGON_SDK_ROOT/' + cfg['root']['tools']['info'][0]['path'])
")
export ANDROID_NDK_ROOT=/opt/android-ndk-r27c

# 4. Clone and build
git clone --depth 1 https://github.com/ggml-org/llama.cpp && cd llama.cpp
cp docs/backend/snapdragon/CMakeUserPresets.json CMakeUserPresets.json

cmake --preset arm64-android-snapdragon-release \
  -B build-snapdragon \
  -DGGML_OPENCL=OFF \
  -DLLAMA_BUILD_UI=OFF

cmake --build build-snapdragon --config Release -j$(nproc)
```

The binaries land in `build-snapdragon/bin/` and the skeleton .so files in `build-snapdragon/`.

Transfer to phone:
```bash
# From the PC (phone connected via USB)
adb push build-snapdragon/bin/llama-server /data/local/tmp/llama-server
adb push build-snapdragon/libggml-htp-v79.so /data/local/tmp/
# ... or use scp/rsync to Termux's ~/bin/
```

## Starting the local server

Once you have the NPU-enabled binary and skeleton installed:

```bash
INSTALL_DIR=~/llama-hexagon   # or wherever you installed

QNN_SDK=/sdcard/Download/v2.48.0.260626/qairt/2.48.0.260626
LD_LIBRARY_PATH=$INSTALL_DIR/lib:$QNN_SDK/lib/aarch64-android:$QNN_SDK/lib/hexagon-v79/unsigned:$LD_LIBRARY_PATH \
  GGML_HEXAGON_NDEV=4 \
  $INSTALL_DIR/bin/llama-server \
  --no-mmap \
  -m /sdcard/Download/Qwen3.5-9B-Q4_0.gguf \
  -c 8192 \
  --port 8080
```

Or use the generated `run-server.sh` if you used the install script.

Key flags:
- `--no-mmap` — allocates weights into a concrete memory buffer instead of mmap; prevents Android's LMK from swapping chunks mid-inference
- `-c 8192` or `-c 16384` — cap context to prevent KV cache from eating the ~2.5 GB free buffer after model load
- `--port 8080` — the OpenAI-compatible endpoint
- `GGML_HEXAGON_NDEV=4` — parallelize across 4 HTP compute threads

**Important:** Do not `export LD_LIBRARY_PATH` globally. The inline form (`LD_LIBRARY_PATH=... command`) scopes it to that single process, keeping your UI app's build environment clean.

Watch for these markers in the boot log:

```
ggml-hex: Loading driver libcdsprpc.so
ggml-hex: new session: HTP0 : ... uri file:///libggml-htp-v79.so?htp_iface_skel_handle_invoke
```

If it says `failed to load libcdsprpc.so`, the FastRPC client library isn't accessible from Termux. Try:
```bash
# Find the system library
find /vendor/lib64 /system/vendor/lib64 -name "libcdsprpc.so" 2>/dev/null
# Add its directory to LD_LIBRARY_PATH
```

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

## Model landscape — NPU vs CPU execution

Not all GGUF files run on the NPU. The execution path depends on how the model was quantized and packaged:

| Model | Quant | Size | Runtime | Backend |
| --- | --- | --- | --- | --- |
| Qwen3.5-9B | Q4_0 | ~5.2 GB | llama.cpp + ggml-hexagon | **Hexagon NPU** (runtime-routed, not precompiled) |
| Qwen3-4B-Instruct (QAI Hub) | q4_0 / w4a16 | ~2.5 GB | QAIRT/GenieX | **Hexagon NPU** (precompiled) |
| Qwen3-4B-Thinking-2507 | IQ4_NL | ~2.38 GB | llama.cpp | **CPU** (ARM cores) |

**Why the distinction matters:**

- **Q4_0 GGUF + ggml-hexagon backend** — llama.cpp's Hexagon backend loads the GGUF and routes matrix ops to the v79 HTP via FastRPC. The custom skeleton (`libggml-htp-v79.so`) runs the actual tensor operations on the DSP. This is the path for the 9B model.
- **QAIRT-compiled models from QAI Hub** — pre-compiled by Qualcomm for native NPU execution via GenieX. The Qwen3-4B-Instruct is available in this format.
- **IQ4_NL (importance-matrix quant)** — community quant from Unsloth/bartowski optimized for llama.cpp on CPU/GPU. The ggml-hexagon backend cannot route these to the NPU; execution falls back to Snapdragon ARM CPU or Adreno GPU.

For OpenWiki coding tasks, the **Qwen3.5-9B Q4_0 on NPU** is the clear winner — 9B parameters give substantially better code comprehension, multi-turn tracking, and generation quality than 4B. The 4B Thinking model is a fallback for when you want explicit chain-of-thought reasoning and can tolerate CPU-speed inference.

## AESOP tier mapping

In the AESOP protocol, this setup maps the phone to **T1 — Edge / Mobile** running the query/tool-exec role with a local model. See `profiles/nav.yaml` in the aesop repo:

```yaml
phone:
  tiers: [edge]
  model:
    local: "Qwen3.5-9B-VLM"
    quant: "Q4_0-GGUF"
    runtime: "ggml-hexagon / HTP (Hexagon NPU)"
```

When home-tier nodes (Jetson, Rubik Pi) are reachable, the executive role offloads to those. When only the phone is available, query + exec collapse onto the edge with this local model as the brain.
