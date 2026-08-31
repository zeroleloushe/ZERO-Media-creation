# ZERO Media creation — установка с нуля

Репозиторий панели: **[zeroleloushe/ZERO-Media-creation](https://github.com/zeroleloushe/ZERO-Media-creation)**  
Пак чанков: **[zeroleloushe/ComfyUI-MiniMaxSeamlessChunks](https://github.com/zeroleloushe/ComfyUI-MiniMaxSeamlessChunks)**

Пошаговая инструкция: ComfyUI Portable → кастомные ноды → модели → эта панель. Если идти сверху вниз, сторонний пользователь должен дойти до первого ролика без догадок.

Панель — это веб-интерфейс над ComfyUI. **Comfy считает, панель только шлёт граф и показывает превью.** Без рабочего Comfy панель живёт в демо-режиме.

---

## 0. Что должно получиться

| Часть | Адрес | Зачем |
|---|---|---|
| ComfyUI | [http://127.0.0.1:8188](http://127.0.0.1:8188) | движок, ноды, модели |
| ZERO Media creation | [http://127.0.0.1:8080](http://127.0.0.1:8080) | интерфейс H3 / Krea / Edit / Upscale Video |

При старте панель **сама** стучится в `http://127.0.0.1:8188` и показывает тост «Подключено» или ошибку.

---

## 1. Железо и софт

- **Windows 10/11**, NVIDIA GPU. 12 ГБ VRAM — минимум для H3 turbo / Krea turbo. 16–24 ГБ — комфортно. 8 ГБ — только картинки Krea, видео будет мучить.
- Место на диске: Comfy + модели H3 + Krea ≈ **40–80 ГБ**.
- **Node.js 20 LTS** — [nodejs.org](https://nodejs.org). При установке галка *Add to PATH*.
- Git. В [ComfyUI-Easy-Install](https://github.com/Tavris1/ComfyUI-Easy-Install) он уже внутри. Для официального Portable поставь [git-scm.com](https://git-scm.com).

---

## 2. Поставь ComfyUI Portable

Рекомендуемый путь — тот же, на котором собиралась панель: **Pixaroma Community Edition**.

### 2.1. ComfyUI-Easy-Install (Windows, проще всего)

1. Скачай архив: [ComfyUI-Easy-Install.zip](https://github.com/Tavris1/ComfyUI-Easy-Install/releases/latest/download/ComfyUI-Easy-Install.zip).
2. Распакуй на диск с запасом места, путь **без кириллицы и пробелов**, например `D:\ComfyUI-Easy-Install`.
3. Запусти `ComfyUI-Easy-Install.bat` и дождись, пока доставит Python, Git, ComfyUI и базовые ноды.
4. Дальше Comfy стартует ярлыком / EZi Desktop. Порт должен быть **8188**.

В комплекте уже есть многое, что нам нужно: **ComfyUI Manager, Pixaroma, KJNodes, rgthree, Video Helper Suite, Krea2Edit**. MiniMax H3 в ядре Comfy и пак Seamless Chunks — **нет**, их ставим отдельно.

Типичные папки после установки:

```
ComfyUI-Easy-Install\
  ComfyUI\
    custom_nodes\     ← ноды
    models\           ← веса
    input\            ← загрузки
    output\           ← результат
```

### 2.2. Официальный Portable

Если Easy-Install не хочется: инструкция [ComfyUI Portable for Windows](https://docs.comfy.org/installation/comfyui_portable_windows), сборки в [релизах Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI/releases). Распаковал → `run_nvidia_gpu.bat`. Git поставь сам, Manager потом через `custom_nodes`.

### 2.3. Версия ComfyUI

Нужен **ComfyUI ≥ 0.30** с нативным MiniMax H3. Ноды `MiniMaxH3ReferenceToVideo`, `LTXVSeparateAVLatent`, `MinimaxH3LatentUpscaler3D` приходят **из ядра**, не из кастомного пака.

В Easy-Install открой **ComfyUI Manager → Update ComfyUI** (лучше nightly, если stable ещё без H3). Перезапуск обязателен.

Проверка: в поиске нод Comfy набери `MiniMaxH3ReferenceToVideo`. Нашлась — ядро ок. Пусто — обнови Comfy, не ноды.

Документация моделей: [MiniMax H3 in ComfyUI](https://docs.comfy.org/tutorials/video/minimax/minimax-h3).

---

## 3. Кастомные ноды

Все клоны — **в** `ComfyUI\custom_nodes`. После каждого клона **полностью перезапусти Comfy** (не F5 в браузере).

Как открыть папку в Easy-Install: дойди до `...\ComfyUI\custom_nodes`, в адресной строке проводника набери `cmd` и Enter.

### 3.1. Обязательные

#### MiniMax Seamless Chunks — **главный пак панели**

На нём чанки H3, склейка без стыка, апскейл видео по кускам, хвост 22 кадра.

```bat
cd ComfyUI\custom_nodes
git clone https://github.com/zeroleloushe/ComfyUI-MiniMaxSeamlessChunks
```

Репозиторий: [zeroleloushe/ComfyUI-MiniMaxSeamlessChunks](https://github.com/zeroleloushe/ComfyUI-MiniMaxSeamlessChunks).

Через Manager: **Install via Git URL** → вставь ту же ссылку.

Должны появиться ноды (категория *MiniMax H3 → Seamless Chunks*):

| Нода | Зачем в панели |
|---|---|
| `MMH3_LastFrames` | последний кадр / хвост 22 кадра для продолжения |
| `MMH3_ChunkMerge` | склейка кадров, smoothstep 2 кадра |
| `MMH3_AudioChunkMerge` | склейка звука, equal-power |
| `MMH3_AudioChunkSplitter` | точный хвост аудио под 22 кадра |
| `MMH3_LatentChunkSplitter` | нарезка video-latent на чанки апскейла |
| `MMH3_LatentChunkMerge` | сборка чанков апскейла |

Зависимости: `torch` уже есть. `opencv-python` не обязателен (нужен только blend `flow_align`). После установки Ctrl+F5 в Comfy, чтобы подтянуть `web/theme.js`.

Обновление:

```bat
cd ComfyUI\custom_nodes\ComfyUI-MiniMaxSeamlessChunks
git pull
```

#### Fantastic H3 Media Loader + Splitter

Грузит референсы (кадры / видео / аудио) и раскладывает их по слотам `<Picture N>`, `<Video N>`, `<Audio N>`.

```bat
cd ComfyUI\custom_nodes
git clone https://github.com/Adudeguyman/ComfyUI-Fantastic-MiniMaxH3-PromptBuilder
```

Репозиторий: [Adudeguyman/ComfyUI-Fantastic-MiniMaxH3-PromptBuilder](https://github.com/Adudeguyman/ComfyUI-Fantastic-MiniMaxH3-PromptBuilder).

Нужны ноды `MiniMaxH3MediaLoader` и `MiniMaxH3ReferenceSplitter`. Сам `MiniMaxH3ReferenceToVideo` — **из ядра Comfy**, не из этого пака.

#### Pixaroma

Сид, LoRA-стек, Save Mp4, ресайз, превью.

- Easy-Install: уже стоит.
- Иначе: `git clone https://github.com/pixaroma/ComfyUI-Pixaroma`

Репозиторий: [pixaroma/ComfyUI-Pixaroma](https://github.com/pixaroma/ComfyUI-Pixaroma).

Критичные ноды: `PixaromaSeed`, `PixaromaLoraLoader`, `PixaromaSaveMp4`, `PixaromaImageResize`.

#### KJNodes (живое превью)

```bat
git clone https://github.com/kijai/ComfyUI-KJNodes
```

Нужна `ModelPreviewOverrideKJ` — без неё полоса прогресса в панели есть, а кадры семплера во время прогона не идут.

Репозиторий: [kijai/ComfyUI-KJNodes](https://github.com/kijai/ComfyUI-KJNodes).

#### Video Helper Suite

Только вкладка **Upscale Video** (загрузка готового ролика).

```bat
git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite
```

Нода `VHS_LoadVideo`. Easy-Install обычно уже кладёт этот пак.

Репозиторий: [Kosinkadink/ComfyUI-VideoHelperSuite](https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite).

#### Krea 2 Edit

Вкладка **Edit**. Easy-Install часто кладёт сам.

```bat
git clone https://github.com/lbouaraba/comfyui-krea2edit
```

Ноды `Krea2EditGroundedEncode`, `Krea2EditModelPatch`.

Репозиторий: [lbouaraba/comfyui-krea2edit](https://github.com/lbouaraba/comfyui-krea2edit).

#### Context-Anchored Tile Refine (апскейл Krea / Edit)

```bat
git clone https://github.com/Blakeem/ComfyUI-ContextAnchoredTileRefine
```

Нода `ContextAnchoredTileUpscaleVL`.

Репозиторий: [Blakeem/ComfyUI-ContextAnchoredTileRefine](https://github.com/Blakeem/ComfyUI-ContextAnchoredTileRefine).

### 3.2. По желанию

| Пак | Ссылка | Зачем |
|---|---|---|
| LLM Text Processor | [KingManiya/ComfyUI-LLM-text-processor](https://github.com/KingManiya/ComfyUI-LLM-text-processor) | переключатель «Промпт через LLM» в H3 / Krea. Без пака тумблер просто не сработает |
| rgthree | [rgthree/rgthree-comfy](https://github.com/rgthree/rgthree-comfy) | Power LoRA Loader в шаблонах. Easy-Install уже несёт |

LLM:

```bat
cd ComfyUI\custom_nodes
git clone https://github.com/KingManiya/ComfyUI-LLM-text-processor.git
```

GGUF клади в `ComfyUI\models\llm` / `llms` / `LLM` — панель читает все эти папки. mmproj — туда же или в `models\mmproj`.

### 3.3. Через ComfyUI Manager, если git не любишь

1. В Comfy: Manager → **Install via Git URL**.
2. Вставь URL репозитория, Install, перезапуск.
3. Либо Custom Nodes Manager → поиск по имени (`Pixaroma`, `KJNodes`, `Video Helper Suite`, `Fantastic H3`).

Pак Seamless Chunks в каталоге Manager может не найтись — ставь **строго по Git URL**.

### 3.4. Чеклист нод после рестарта

В поиске Comfy должны находиться:

```
MiniMaxH3ReferenceToVideo
MiniMaxH3MediaLoader
MiniMaxH3ReferenceSplitter
MinimaxH3LatentUpscaler3D
LTXVSeparateAVLatent
MMH3_ChunkMerge
MMH3_LatentChunkSplitter
MMH3_LastFrames
PixaromaSaveMp4
PixaromaSeed
PixaromaLoraLoader
ModelPreviewOverrideKJ
VHS_LoadVideo
Krea2EditGroundedEncode
```

Красная нода = пак не встал или Comfy старый. Смотри консоль Comfy при старте: `Cannot import …` почти всегда = не хватает Python-зависимости. Тогда в папке Easy-Install открой встроенный Python и `pip install -r custom_nodes\<пак>\requirements.txt`.

---

## 4. Модели

Файлы — в `ComfyUI\models\...`. Имена можно чуть отличаться: панель подхватывает список из Comfy, в выпадающих списках будет то, что реально лежит на диске.

Официальная раскладка H3: [huggingface.co/Comfy-Org/MiniMax-H3](https://huggingface.co/Comfy-Org/MiniMax-H3).  
Krea 2: [huggingface.co/Comfy-Org/Krea-2](https://huggingface.co/Comfy-Org/Krea-2).

### 4.1. MiniMax H3 — обязательно для вкладок H3 и Upscale Video

Нужен **ref2va** (reference-to-video), не только fl2va.

| Куда | Файл (пример) | Примечание |
|---|---|---|
| `models/diffusion_models/` | `minimax_h3_ref2va_pruned_int8_convrot.safetensors` | ref2va. int8 / fp8 — меньше VRAM. bf16 — если памяти хватает |
| `models/text_encoders/` | `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | CLIP H3 |
| `models/vae/` | `minimax_h3_video_vae_fp16.safetensors` | видео VAE. Подойдёт и `…_int8_convrot` |
| `models/vae/` | `minimax_h3_audio_vae_fp32.safetensors` | аудио VAE |
| `models/loras/` | `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors` | turbo для R2V, по желанию |
| `models/loras/` | `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` | turbo 8 шагов |

Любой другой H3 UNET (в т.ч. сторонние вроде ErosMax) тоже в `diffusion_models` — появится в списке «Модель MiniMax H3».

### 4.2. Latent upscaler 3D — вкладка Upscale Video

Без него кнопка Upscale и вкладка «Upscale Video» упадут на `MinimaxH3LatentUpscaler3D`.

Скачать: [LBH-123-AI/Minimax_h3_latent_Upscaler](https://huggingface.co/LBH-123-AI/Minimax_h3_latent_Upscaler).

Положи `minimax_h3_latent_upscaler_3d_bf16.safetensors` в `models/latent_upscale_models/` (если нода не видит — попробуй `models/upscale_models/`). В панели файл выбирается в блоке «Latent upscaler».

### 4.3. Krea 2 — вкладки Krea и Edit

| Куда | Файл | Примечание |
|---|---|---|
| `models/diffusion_models/` | `krea2_turbo_int8_convrot.safetensors` или `krea2_turbo_bf16.safetensors` | Turbo быстрее. RAW — выше качество |
| `models/text_encoders/` | `qwen3vl_4b_bf16.safetensors` | |
| `models/vae/` | `qwen_image_vae.safetensors` | |
| `models/loras/` | `krea2_identity_edit_v1_2_r128.safetensors` | для вкладки Edit, если есть |

Свои LoRA — в `models/loras/` (подпапки можно). Панель читает дерево после подключения к Comfy.

### 4.4. LLM (если включишь «Промпт через LLM»)

Любой GGUF, который ест [LLM Text Processor](https://github.com/KingManiya/ComfyUI-LLM-text-processor) (Qwen3.5 / Qwen3-VL и т.п.) + соответствующий `mmproj`. Без этого тумблер в панели лучше не трогать.

---

## 5. Первый запуск Comfy

1. Стартани Comfy (ярлык Easy-Install / `run_nvidia_gpu.bat`).
2. Браузер: [http://127.0.0.1:8188](http://127.0.0.1:8188) — холст открылся.
3. Консоль без красных `Cannot import` по пакам из §3.
4. Manager → **Restart** не нужен, если только что ставил ноды — нужен **полный** перезапуск процесса.

Если Comfy слушает только локально — этого достаточно. Панель ходит в Comfy **со своего сервера**, CORS не нужен.

---

## 6. Панель ZERO Media creation

1. Поставь [Node.js 20 LTS](https://nodejs.org), переоткрой терминал, проверь:

```bat
node -v
```

Должно быть `v20…` или новее.

2. Распакуй архив панели в отдельную папку, снова **без кириллицы**, например `D:\zero-media-creation`.
3. Двойной клик `start.bat` (Windows) или:

```bat
cd D:\zero-media-creation
npm install
npm run dev
```

macOS / Linux: `chmod +x start.sh && ./start.sh`.

4. Открой [http://127.0.0.1:8080](http://127.0.0.1:8080).

При старте панель сама пингует `http://127.0.0.1:8188`. Тост:

- **Подключено · имя GPU · N ГБ** — можно жать Пуск.
- **Нет связи / таймаут** — Comfy не запущен или не на 8188. Запусти Comfy, в шапке **Связь** нажми Подключить ещё раз.

С телефона в той же Wi‑Fi: `http://IP-этого-ПК:8080`. Адрес Comfy в панели оставь `127.0.0.1:8188` — прокси идёт с компьютера, где крутится панель.

Чужой адрес Comfy (туннель, другая машина): шапка → **Связь** → вставь URL → Подключить. Сохраняется.

---

## 7. Первый ролик

1. Вкладка **H3**.
2. Внизу слева — референсы: кадр / короткое видео / голос. Хотя бы один кадр.
3. Промпт. Режим **Standard** — один клип 5–15 с. **Chunks** — 2–5 кусков со склейкой (нужен пак Seamless Chunks).
4. Модель — ref2va / твой H3 UNET. Steps 8 + turbo LoRA или 20–30 без неё.
5. **Пуск**. Справа в шапке — прогресс. В превью должны идти кадры текущего прохода (KJNodes).
6. Готово: клик по ролику — большое окно. Кнопка **Upscale** рядом с превью шлёт **video latent** первого прохода в апскейлер (без повторного encode).

**Upscale Video** как отдельная вкладка: загрузи mp4 → encode → только **video** latent в 3D-апскейлер → чанки → семплер → склейка. Аудио берётся с исходника.

---

## 8. Если сломалось

| Симптом | Что проверить |
|---|---|
| Тост «нет связи» | Comfy открывается на [8188](http://127.0.0.1:8188)? Файрвол не режет Node → 8188 |
| `Prompt outputs failed validation` + имя ноды | этой ноды нет — §3, перезапуск Comfy |
| `MMH3_…` not in list | не клонирован [Seamless Chunks](https://github.com/zeroleloushe/ComfyUI-MiniMaxSeamlessChunks) |
| `MiniMaxH3ReferenceToVideo` missing | Comfy < 0.30, обнови ядро |
| `MinimaxH3LatentUpscaler3D` missing model | нет файла апскейлера в `latent_upscale_models` |
| `'MiniMaxH3VideoVAE' has no attribute 'per_channel_statistics'` | в апскейлер ушёл AV-латент. На текущей панели video отделяется через `LTXVSeparateAVLatent` — обнови панель, не ноды |
| Нет живого превью | нет `ModelPreviewOverrideKJ` (KJNodes) |
| LLM падает / висит | выключи тумблер или поставь LLM Text Processor + GGUF |
| Пуск в демо | не подключился к Comfy — тост при старте, кнопка Связь |

Скачать JSON графа (иконка загрузки в шапке) и кинуть в Comfy вручную — так видно, какой именно ноды не хватает.

---

## 9. Обновление

**Панель.** Новая копия архива поверх (или `git pull`, если клонировал репозиторий) → `npm install` если просит → снова `start.bat`.

**Seamless Chunks.** Это живой пак, на нём завязаны чанки и апскейл:

```bat
cd ComfyUI\custom_nodes\ComfyUI-MiniMaxSeamlessChunks
git pull
```

Перезапуск Comfy.

**Ядро Comfy.** Manager → Update ComfyUI, особенно когда выходят правки MiniMax H3.

---

## 10. Карта «что откуда»

```
Пользователь
    │
    ├─ ZERO Media creation  :8080     ← эта папка, Node.js
    │         │  прокси /__comfy
    │         ▼
    └─ ComfyUI              :8188
              ├─ ядро 0.30+     MiniMaxH3ReferenceToVideo, LTXVSeparateAVLatent,
              │                 MinimaxH3LatentUpscaler3D, KSampler, VAE, …
              ├─ custom_nodes
              │     ComfyUI-MiniMaxSeamlessChunks          ← обязательно
              │     ComfyUI-Fantastic-MiniMaxH3-PromptBuilder
              │     ComfyUI-Pixaroma
              │     ComfyUI-KJNodes
              │     ComfyUI-VideoHelperSuite
              │     comfyui-krea2edit
              │     ComfyUI-ContextAnchoredTileRefine
              │     ComfyUI-LLM-text-processor             ← по желанию
              └─ models
                    diffusion_models / text_encoders / vae / loras
                    latent_upscale_models
```

Два процесса, два окна. Сначала Comfy, потом панель. Если Comfy уже слушает 8188, панель подцепится сама.
