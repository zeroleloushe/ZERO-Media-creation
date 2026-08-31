import type { H3State, MediaBundle, MediaItem } from "./types";

/** 22-frame tail fed to MiniMax as <Video 1> visual history. Not used for the stitch. */
export const H3_TAIL_FRAMES = 22;
/** Crossfade at the join. MiniMax already continues from the last frame, so 2 is enough. */
export const H3_STITCH_FRAMES = 2;
export const H3_CHUNK_COUNTS = [2, 3, 4, 5] as const;
export const H3_CHUNK_SEC_CHIPS = [3, 4, 5, 6, 8, 10] as const;
const SR = 44100;
const FPS = 24;

export function emptyBundle(): MediaBundle {
  return { pictures: [], videos: [], audios: [] };
}

export function bundleHint(b?: MediaBundle) {
  if (!b) return "пусто";
  const bits = [
    b.pictures.length ? `${b.pictures.length} кадр` : "",
    b.videos.length ? `${b.videos.length} видео` : "",
    b.audios.length ? `${b.audios.length} аудио` : "",
  ].filter(Boolean);
  return bits.join(" · ") || "пусто";
}

export function snapH3Chunk(seconds: number) {
  const k = Math.max(4, Math.min(14, Math.round((Math.max(3, seconds) * FPS - 5) / 17)));
  const frames = 17 * k + 5;
  const tokens = 5 * k + 2;
  return { k, frames, tokens, seconds: frames / FPS };
}

export function h3ChunkTotal(chunkSec: number, count: number) {
  const { frames, seconds } = snapH3Chunk(chunkSec);
  const n = Math.max(2, Math.min(5, count));
  const totalFrames = frames + (n - 1) * (frames - H3_STITCH_FRAMES);
  return {
    n,
    frames,
    seconds,
    overlap: H3_STITCH_FRAMES,
    tail: H3_TAIL_FRAMES,
    totalFrames,
    totalSec: totalFrames / FPS,
  };
}

export function chunkJobLabel(chunkSec: number, count: number) {
  const t = h3ChunkTotal(chunkSec, count);
  return `${t.n}×${t.seconds.toFixed(1).replace(/\.0$/, "")}с → ~${t.totalSec.toFixed(1).replace(/\.0$/, "")}с`;
}

export const CONTINUATION_PROMPT = `integrated_multimodal_description:
For the target video, at 0.00 seconds into the target video, <Picture 1> is fully referenced and must be reproduced exactly before any new motion begins.
The sequence must behave as a seamless continuation of <Video 1>, using its 22 sequential reference frames as the established visual history of the scene. <Picture 2> is the primary character identity and consistency reference.
[Shot 1]
Continue the video naturally from the progression established by <Video 1>. The generated footage must feel like the next uninterrupted segment of the same original video, not a new scene, reinterpretation, remake, or montage.
Use <Video 1> as a temporal continuation reference. Carefully infer the ongoing action, character movement, body mechanics, pose progression, direction of motion, camera movement, scene evolution, timing, and visual logic from the sequential reference frames, then continue that exact progression forward in time.
<Picture 1> defines the exact visual state at 0.00 seconds. Begin with an exact match to <Picture 1> before any new movement starts. From this frame onward, continue naturally while preserving the momentum and temporal logic established by <Video 1>.
Use <Picture 2> as the primary identity and character consistency anchor. Maintain the exact same character identity, face, facial features, hairstyle, body proportions, clothing, colors, accessories, and overall appearance throughout the entire generated video. The character must not morph, change identity, change clothing, duplicate, age, or visually drift between frames.
Camera movement must continue naturally from the trajectory implied by <Video 1>. Preserve the existing framing, direction, momentum, lens behavior, cinematographic style, pacing, lighting, environment, and spatial relationships. Any new camera movement must feel physically connected to the movement already established in <Video 1>.
<Audio 1> is part of the same ongoing sequence and must be treated as a temporal continuation reference. Synchronize the generated visual continuation with the rhythm, timing, speech, singing, actions, beats, and performance established by <Audio 1>.
If <Audio 1> contains speech or singing, maintain believable and accurate lip synchronization. Continue the character's mouth movements, facial performance, gestures, and body language naturally in synchronization with <Audio 1>, as if the footage was originally recorded continuously with this exact audio.
If <Audio 1> contains music or rhythmic elements, naturally synchronize movement, gestures, camera timing, and scene progression with its rhythm and beats without introducing unnecessary random cuts or unrelated actions.
Do not reset the action, return to an earlier pose, abruptly change the scene, introduce unrelated actions, or create a disconnected composition. Everything must progress forward naturally from the established visual context of <Video 1>, the exact starting state of <Picture 1>, the character consistency defined by <Picture 2>, and the timing and performance established by <Audio 1>.
overall_soundscape:
Continue the natural sound environment consistently with <Audio 1> and the visual environment established by <Video 1>. Preserve believable ambience, movement sounds, footsteps, clothing movement, wind, room tone, and environmental activity where appropriate.
non_diegetic_music:
Continue the musical structure established by <Audio 1>, preserving its existing rhythm, tempo, timing, and progression without introducing unrelated musical changes.`;

export function continuationPrompt(user: string) {
  const body = user.trim();
  return body ? `${CONTINUATION_PROMPT}\n\n${body}` : CONTINUATION_PROMPT;
}

type ChunkMeta = {
  index: number;
  core_start: number;
  core_len: number;
  left_ov: number;
  right_ov: number;
  raw_start: number;
  raw_end: number;
  raw_len: number;
  pad: number;
  final_len: number;
};

/**
 * Plan for independently GENERATED clips, not a split of one video.
 *
 * Each clip is L frames (valid 17k+5). Chunk 2+ is conditioned on the last
 * 22 frames of the previous clip as <Video 1> HISTORY plus last frame as
 * <Picture 1>. MiniMax already continues from that last frame, so the
 * stitch only crossfades `H3_STITCH_FRAMES` (2) at the join — the 22-frame
 * tail is NOT duplicated in the output.
 *
 * MMH3_ChunkMerge blends `core[core_len - right_ov :]` of clip i against
 * `piece[:right_ov]` of clip i+1.
 *
 * Cores sum to L + (N-1)×(L-2) — the stitched timeline.
 */
export function buildGenChunkPlan(count: number, frames: number, overlap = H3_STITCH_FRAMES) {
  const n = Math.max(2, Math.min(5, count));
  const ov = Math.min(overlap, Math.max(0, frames - 1));
  const chunks: ChunkMeta[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    const first = i === 0;
    const last = i === n - 1;
    const left = first ? 0 : ov;
    const right = last ? 0 : ov;
    const core = first ? frames : frames - ov;
    chunks.push({
      index: i,
      core_start: cursor,
      core_len: core,
      left_ov: left,
      right_ov: right,
      raw_start: 0,
      raw_end: frames,
      raw_len: frames,
      pad: 0,
      final_len: frames,
    });
    cursor += core;
  }
  return {
    total_frames: cursor,
    num_chunks: n,
    overlap: ov,
    pad_multiple: 0,
    pad_remainder: 0,
    chunks,
  };
}

/**
 * Same cumulative rounding as MMH3_AudioChunkSplitter so cores sum to
 * exactly total_samples and the 2-frame video stitch maps to an
 * equal-power audio crossfade of ~80ms.
 */
export function buildGenAudioPlan(videoPlan: ReturnType<typeof buildGenChunkPlan>, sampleRate = SR) {
  const rate = sampleRate / FPS;
  const smp = (f: number) => Math.round(f * rate);
  let cum = 0;
  const pos = [0];
  for (const c of videoPlan.chunks) {
    cum += c.core_len;
    pos.push(Math.round(cum * rate));
  }
  const chunks = videoPlan.chunks.map((c, i) => {
    const core_len_samples = pos[i + 1] - pos[i];
    const left_ov_samples = c.left_ov > 0 ? Math.round(c.left_ov * rate) : 0;
    const right_ov_samples = c.right_ov > 0 ? Math.round(c.right_ov * rate) : 0;
    const raw_len_samples = smp(c.raw_len);
    return {
      index: c.index,
      core_len_samples,
      left_ov_samples,
      right_ov_samples,
      raw_len_samples,
      pad_samples: 0,
      final_len_samples: raw_len_samples,
    };
  });
  return {
    total_samples: pos[pos.length - 1],
    sample_rate: sampleRate,
    chunks,
  };
}

/**
 * Fake 2-way split of one clip: chunk 2 is the last `overlap` frames.
 * Feed this plan + the decoded AUDIO into MMH3_AudioChunkSplitter — output
 * index 1 is a sample-accurate tail that matches the 22-frame IMAGE tail
 * used as <Video 1> (uses the real waveform length, not a guessed sample rate).
 */
export function buildTailExtractPlan(frames: number, overlap = H3_TAIL_FRAMES) {
  const L = Math.max(overlap + 1, frames);
  const ov = Math.min(overlap, L - 1);
  const head = L - ov;
  return {
    total_frames: L,
    num_chunks: 2,
    overlap: 0,
    pad_multiple: 0,
    pad_remainder: 0,
    chunks: [
      {
        index: 0,
        core_start: 0,
        core_len: head,
        left_ov: 0,
        right_ov: 0,
        raw_start: 0,
        raw_end: head,
        raw_len: head,
        pad: 0,
        final_len: head,
      },
      {
        index: 1,
        core_start: head,
        core_len: ov,
        left_ov: 0,
        right_ov: 0,
        raw_start: head,
        raw_end: L,
        raw_len: ov,
        pad: 0,
        final_len: ov,
      },
    ],
  };
}

export function mediaToState(bundle: MediaBundle) {
  return [
    ...bundle.pictures.map((p) => ({
      kind: "picture" as const,
      file: p.name,
      name: p.name,
      duration: null,
      width: p.width ?? 0,
      height: p.height ?? 0,
      has_audio: false,
      audio_mode: "off",
    })),
    ...bundle.videos.map((v) => ({
      kind: "video" as const,
      file: v.name,
      name: v.name,
      duration: v.trimLength || v.duration || null,
      width: v.width ?? 0,
      height: v.height ?? 0,
      has_audio: true,
      audio_mode: "auto",
      start: v.trimStart,
      length: v.trimLength,
    })),
    ...bundle.audios.map((a) => ({
      kind: "audio" as const,
      file: a.name,
      name: a.name,
      duration: a.trimLength || a.duration || null,
      start: a.trimStart,
      length: a.trimLength,
    })),
  ];
}

export function refsForChunk(h3: H3State, index: number): MediaBundle {
  if (h3.genMode === "chunks" && h3.refMode === "per_chunk") {
    return h3.chunkRefs?.[index] ?? emptyBundle();
  }
  return { pictures: h3.pictures, videos: h3.videos, audios: h3.audios };
}

export function allH3Media(h3: H3State): MediaItem[] {
  const out: MediaItem[] = [...h3.pictures, ...h3.videos, ...h3.audios];
  if (h3.genMode === "chunks" && h3.refMode === "per_chunk") {
    for (const b of h3.chunkRefs ?? []) {
      out.push(...b.pictures, ...b.videos, ...b.audios);
    }
  }
  return out;
}

export function joinedChunkPrompt(h3: H3State) {
  if (h3.genMode !== "chunks") return h3.prompt;
  const n = Math.max(2, Math.min(5, h3.chunkCount || 3));
  const parts = (h3.chunkPrompts ?? []).slice(0, n).map((p, i) => {
    const t = (p || "").trim();
    return t || (i === 0 ? h3.prompt.trim() : "");
  });
  return parts.filter(Boolean).join("\n---\n") || h3.prompt;
}
