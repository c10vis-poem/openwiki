# Device inventory — Snapdragon 8 Elite QAIRT assets

Cataloged from `/sdcard/Download/` on-device. SDK version: **QAIRT v2.48.0.260626**.

SDK root: `/sdcard/Download/v2.48.0.260626/qairt/2.48.0.260626/`

## GGUF model files (llama.cpp)

| File                                 | Params | Quant  | Size     | Execution path                               |
| ------------------------------------ | ------ | ------ | -------- | -------------------------------------------- |
| `Qwen3.5-9B-Q4_0.gguf`               | 9B     | Q4_0   | ~5.2 GB  | NPU (via llama.cpp QNN backend)              |
| `Qwen3-4B-Thinking-2507-IQ4_NL.gguf` | 4B     | IQ4_NL | ~2.38 GB | CPU only (community quant, not NPU-routable) |

Tokenizer files also present in `/sdcard/Download/`:

- `added_tokens.json`
- `special_tokens_map.json`
- `tokenizer.json`
- `tokenizer_config.json`

## GenieX model configs (NPU-native via QAIRT)

Located in `examples/Genie/configs/` under the SDK root. These configs define how GenieX loads and runs models natively on the Hexagon HTP.

### Qwen family

| Config path                         | Model             | Notes                            |
| ----------------------------------- | ----------------- | -------------------------------- |
| `qwen3/qwen3_eagle_basedm.json`     | Qwen3 Eagle       | Speculative decoding draft model |
| `qwen3/qwen3_eaglet_basedm_w8.json` | Qwen3 Eaglet W8   | Lightweight draft model          |
| `qwen3/qwen3_eaglet_xlam.json`      | Qwen3 Eaglet xLAM | Tool-calling variant             |
| `qwen3/qwen3_ssd_prefix_quant.json` | Qwen3 SSD         | Prefix-quantized for NPU         |
| `qwen3-5/bluelm-htp-yarnrope.json`  | Qwen3.5           | HTP with YaRN RoPE scaling       |

### Gemma family

| Config path                   | Model        | Notes                                       |
| ----------------------------- | ------------ | ------------------------------------------- |
| `gemma3/gemma3-1b-htp.json`   | Gemma 3 1B   | HTP config                                  |
| `gemma3/gemma3-270M-htp.json` | Gemma 3 270M | Ultra-compact HTP config                    |
| `gemma4/gemma4-e2b-htp.json`  | Gemma 4 E2B  | HTP config — matches AESOP Jetson executive |

### Llama family

| Config path                                              | Model      | Notes                  |
| -------------------------------------------------------- | ---------- | ---------------------- |
| `llama2-7b/llama2-7b-htp.json`                           | Llama 2 7B | HTP primary            |
| `llama2-7b/llama2-7b-gpu.json`                           | Llama 2 7B | Adreno GPU fallback    |
| `llama2-7b/llama2-7b-htp-lora.json`                      | Llama 2 7B | HTP + LoRA adapter     |
| `llama2-7b/llama2-7b-htp-ssd.json`                       | Llama 2 7B | Speculative decoding   |
| `llama2-7b/llama2-7b-htp-kv-share.json`                  | Llama 2 7B | KV cache sharing       |
| `llama2-7b/llama2-7b-draft-htp-spd.json`                 | Llama 2 7B | Draft model for SPD    |
| `llama2-7b/llama2-7b-draft-cpu-target-htp-spd.json`      | Llama 2 7B | CPU draft, HTP target  |
| `llama2-7b/llama2-7b-genaitransformer.json`              | Llama 2 7B | GenAI Transformer path |
| `llama2-7b/llama2-7b-genaitransformer-lora.json`         | Llama 2 7B | GenAI + LoRA           |
| `llama2-7b/llama2-7b-genaitransformer-htp-kv-share.json` | Llama 2 7B | GenAI + KV sharing     |
| `llama2-7b/llama2-7b-htp-multistream.json`               | Llama 2 7B | Multi-stream HTP       |
| `llama3-3b/llama3-3b-eaglet-htp.json`                    | Llama 3 3B | Eaglet HTP             |
| `llama3-3b/llama3-3b-htp-long-context.json`              | Llama 3 3B | Long context HTP       |
| `llama3-3b/llama3-3b-htp-long-context-LUT.json`          | Llama 3 3B | Long context + LUT     |
| `llama3-3b/llama3-3b-htp-loraV1.json`                    | Llama 3 3B | LoRA v1                |
| `llama3-3b/llama3-3b-htp-loraV3.json`                    | Llama 3 3B | LoRA v3                |
| `llama3-3b/llama3-3b-htp-loraV3-grouped.json`            | Llama 3 3B | LoRA v3 grouped        |
| `llama3-3b/llama3-3b-htp-loraV3-LUT.json`                | Llama 3 3B | LoRA v3 + LUT          |
| `llama3-8b/llama3-8b-genaitransformer-htp-kv-share.json` | Llama 3 8B | GenAI + KV sharing     |

### Vision / multimodal

| Config path                                 | Model        | Notes                     |
| ------------------------------------------- | ------------ | ------------------------- |
| `glm-4v/glm-4v.json`                        | GLM-4V       | Vision-language model     |
| `glm-4v/siglip.json`                        | SigLIP       | Vision encoder for GLM-4V |
| `glm-4v/text-encoder.json`                  | Text encoder | Text component for GLM-4V |
| `llava-e2t/llava-e2t-genaitransformer.json` | LLaVA E2T    | Vision-language           |

### Other models

| Config path                                                | Model          | Notes                                         |
| ---------------------------------------------------------- | -------------- | --------------------------------------------- |
| `bge-large-htp.json`                                       | BGE Large      | Embedding model (HTP)                         |
| `bluelm-yarnrope/bluelm-htp-yarnrope.json`                 | BlueLM         | YaRN RoPE HTP                                 |
| `phi3-mini/phi3-mini-genaitransformer-htp-kv-share.json`   | Phi-3 Mini     | GenAI + KV sharing                            |
| `mt5-small-genaitransformer/mt5-small-text-encoder.json`   | mT5 Small      | Text encoder                                  |
| `mt5-small-genaitransformer/mt5-small-text-generator.json` | mT5 Small      | Text generator                                |
| `mx-translation/mx-translation-text-encoder.json`          | MX Translation | Encoder                                       |
| `mx-translation/mx-translation-text-generator.json`        | MX Translation | Generator                                     |
| `lm-executor-node/llama-3b/`                               | Llama 3B       | Executor node configs (input/output/executor) |

## AISW genai model configs

Located in `lib/python/qti/aisw/genai/configs/` under the SDK root. These are converter/pipeline configs for the AISW toolchain.

### Qwen family (5 configs)

| Config                        | Model                         |
| ----------------------------- | ----------------------------- |
| `qwen-7b-chat.json`           | Qwen 7B Chat                  |
| `qwen2.5-7b.json`             | Qwen 2.5 7B                   |
| `qwen3-4b-instruct-2507.json` | Qwen3 4B Instruct (July 2025) |
| (GenieX) `qwen3/`             | Qwen3 (4 variant configs)     |
| (GenieX) `qwen3-5/`           | Qwen3.5                       |

### Other AISW configs

| Config                                              | Model                   |
| --------------------------------------------------- | ----------------------- |
| `Phi-3-mini-128k-instruct.json`                     | Phi-3 Mini 128K         |
| `Phi-3.5-mini-instruct.json`                        | Phi-3.5 Mini            |
| `Phi-4-mini-instruct.json`                          | Phi-4 Mini              |
| `baichuan1-7b.json`                                 | Baichuan 7B             |
| `bge-large-en-v1_5.json`                            | BGE Large EN v1.5       |
| `cerebras-gpt-111m.json`                            | Cerebras GPT 111M       |
| `cerebras-gpt-13b.json`                             | Cerebras GPT 13B        |
| `cerebras-gpt-2.7b.json`                            | Cerebras GPT 2.7B       |
| `cerebras-gpt-256m.json`                            | Cerebras GPT 256M       |
| `cerebras-gpt-590m.json`                            | Cerebras GPT 590M       |
| `cerebras-gpt-6.7b.json`                            | Cerebras GPT 6.7B       |
| `gemma-2b.json`                                     | Gemma 2B                |
| `gpt2-124m.json`                                    | GPT-2 124M              |
| `gpt2-335m.json`                                    | GPT-2 335M              |
| `gpt2-774m.json`                                    | GPT-2 774M              |
| `llama2-7b.json`                                    | Llama 2 7B              |
| `llama2-13b.json`                                   | Llama 2 13B             |
| `llama3-8b.json`                                    | Llama 3 8B              |
| `llama3.1-8b.json`                                  | Llama 3.1 8B            |
| `llama3.2-1b.json`                                  | Llama 3.2 1B            |
| `llama3.2-3b.json`                                  | Llama 3.2 3B            |
| `llava-1.5-7b.json`                                 | LLaVA 1.5 7B            |
| `mMiniLMv2-L12-H384-distilled-from-XLMR-Large.json` | MiniLM v2               |
| `mistral-7b-v0.2.json`                              | Mistral 7B v0.2         |
| `mistral-7b-v0.3.json`                              | Mistral 7B v0.3         |
| `mt5-small.json`                                    | mT5 Small               |
| `mx-encoder-decoder.json`                           | MX Encoder-Decoder      |
| `tinyllama-1.1b.json`                               | TinyLlama 1.1B          |
| `wmt19-en-de.json`                                  | WMT19 EN-DE Translation |

## Native library architectures

The SDK ships libraries for multiple targets. Only `aarch64-android` runs directly on the phone.

| Path                                          | Target                       | Use                                       |
| --------------------------------------------- | ---------------------------- | ----------------------------------------- |
| `lib/aarch64-android/`                        | Phone (Android ARM64)        | Runtime libs for on-device inference      |
| `lib/aarch64-oe-linux-gcc11.2/`               | Embedded Linux ARM64         | llama.cpp QNN cmake build (`QNN_SDK_DIR`) |
| `lib/aarch64-oe-linux-gcc9.3/`                | Embedded Linux ARM64 (GCC 9) | Older toolchain variant                   |
| `lib/aarch64-ubuntu-gcc9.4/`                  | Ubuntu ARM64                 | Desktop ARM64                             |
| `lib/x86_64-linux-clang/`                     | x86_64 host                  | Dev machine simulation/tools              |
| `lib/hexagon-v66/` through `lib/hexagon-v81/` | Hexagon DSP/HTP              | On-chip skel libs (v79 = SD 8 Elite)      |
| `lib/lpai-v5/`, `lpai-v5_1/`, `lpai-v6/`      | LPAI                         | Low-power AI coprocessor                  |

### Key aarch64-android libraries

- `libGenie.so` — GenieX core engine
- `libQnnHtp.so` + `libQnnHtpV79Stub.so` — QNN HTP backend (your NPU)
- `libQairtHtp.so` + `libQairtHtpV79Stub.so` — QAIRT HTP pipeline
- `libQnnGenAiTransformer.so` — GenAI Transformer runtime
- `libQnnGenAiTransformerModel.so` — GenAI model loader
- `libQnnLoraAdapterBinUpdater.so` — LoRA adapter support
- `libQnnGpu.so` — Adreno GPU fallback
- `libSNPE.so` — Legacy SNPE runtime
- `libQnnTFLiteDelegate.so` — TFLite delegate
- `libQnnModelDlc.so` — DLC model loader

### Hexagon v79 skel libraries (unsigned)

Located at `lib/hexagon-v79/unsigned/`:

- `libCalculator_skel.so`
- `libQairtHtpV79Skel.so`
- `libQnnHexagonSkel_dspApp.so`
- `libQnnHtpNetRunExtensions.so`
- `libQnnHtpV79.so`, `libQnnHtpV79Skel.so`
- `libQnnNetRunDirectV79Skel.so`
- `libQnnSaver.so`, `libQnnSystem.so`
- `libSnpeHtpV79Skel.so`

## SDK tooling

- `benchmarks/QNN/` — QNN performance benchmarking configs
- `examples/SNPE/` — SNPE NativeCpp / UdoExample / psnpe-demo
- `lib/python/qti/aisw/accuracy_debugger/` — Model accuracy debugging
- `lib/python/qti/aisw/accuracy_evaluator/` — Accuracy evaluation
- `lib/python/qti/aisw/converters/` — Model format converters (ONNX, TF, etc.)
- `tools/core/utilities/qairt_log_config.yaml` — Logging config
- `sdk.yaml` — SDK manifest

## Internal storage (not yet inventoried)

Voice layer assets (STT/TTS) live on internal storage, not `/sdcard/Download/`. Run from Termux:

```bash
find ~/storage/shared/ -name "*.onnx" -o -name "*.bin" -o -name "*.model" | sort
find ~ -path "*/aesop/*" -type f | sort
```

## Correct SDK paths

The setup docs and cmake build should use these paths (not the shorthand):

| Reference                           | Actual path                                           |
| ----------------------------------- | ----------------------------------------------------- |
| `QNN_SDK_DIR` (for llama.cpp build) | `/sdcard/Download/v2.48.0.260626/qairt/2.48.0.260626` |
| Android runtime libs                | `$QNN_SDK_DIR/lib/aarch64-android/`                   |
| Embedded Linux libs                 | `$QNN_SDK_DIR/lib/aarch64-oe-linux-gcc11.2/`          |
| Hexagon v79 skels                   | `$QNN_SDK_DIR/lib/hexagon-v79/unsigned/`              |
| GenieX configs                      | `$QNN_SDK_DIR/examples/Genie/configs/`                |
| AISW genai configs                  | `$QNN_SDK_DIR/lib/python/qti/aisw/genai/configs/`     |
