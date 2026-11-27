"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cleanseVideoAction, submitVideoAction } from "@/app/actions";
import { framesForSeconds, secondsForFrames } from "@/lib/h3Graph";
import { H3_PROMPT_TEMPLATE } from "@/lib/h3Prompt";
import { thumbUrl } from "@/lib/thumbnail";
import {
  VIDEO_ASPECTS,
  VIDEO_SECONDS,
  type ContextTemplate,
} from "@/lib/types";

/** 最初のコマの候補。ピッカーに並べる分だけを渡す */
export interface FirstFrameCandidate {
  id: string;
  title: string | null;
}

interface VideoFormProps {
  images: FirstFrameCandidate[];
  contexts: ContextTemplate[];
  /** 画像の詳細から「動かす」で来たときの初期選択 */
  defaultFirstFrameId: string;
}

type Phase = "idle" | "cleansing" | "submitting";

/**
 * 動画生成の投入フォーム。
 * mp4 は 30 分後に出来るゆえ、ここは「投入して待ちに並べる」までを担う。
 */
export function VideoForm({
  images,
  contexts,
  defaultFirstFrameId,
}: VideoFormProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [firstFrameId, setFirstFrameId] = useState(defaultFirstFrameId);
  const [seconds, setSeconds] = useState<number>(5);
  const [aspect, setAspect] = useState<string>(VIDEO_ASPECTS[0]);
  const [seed, setSeed] = useState("");
  const [useCleanse, setUseCleanse] = useState(false);
  const [contextId, setContextId] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
    /** oMLX の解放についての一言(成功時のみ) */
    note?: string;
  } | null>(null);

  const isPending = phase !== "idle";
  const frames = framesForSeconds(seconds);

  const insertTemplate = () => {
    if (
      prompt.trim() !== "" &&
      !window.confirm("入力中のプロンプトを雛形で置き換えますか?")
    ) {
      return;
    }
    setPrompt(H3_PROMPT_TEMPLATE);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setMessage(null);

    let text = prompt.trim();
    if (!text) {
      setMessage({ kind: "error", text: "プロンプトは空にできません" });
      return;
    }
    if (!firstFrameId) {
      setMessage({ kind: "error", text: "最初のコマの画像を選んでください" });
      return;
    }

    // 画像側と同じ調整の口を使う。型を守るのは雛形の役目ゆえ、調整は補助じゃ
    if (useCleanse) {
      setPhase("cleansing");
      const cleansed = await cleanseVideoAction(text, contextId, seconds);
      if (!cleansed.ok) {
        setMessage({ kind: "error", text: cleansed.error });
        setPhase("idle");
        return;
      }
      text = cleansed.prompt;
    }

    setPhase("submitting");
    try {
      const result = await submitVideoAction({
        prompt: text,
        firstFrameImageId: firstFrameId,
        seconds,
        aspect,
        seed,
      });

      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
        return;
      }

      setMessage({
        kind: "ok",
        text: "投入しました。完成まで 30 分ほどかかります",
        note: result.note,
      });
      router.refresh();
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPhase("idle");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-4"
    >
      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor="video-prompt"
            className="text-sm font-medium text-foreground"
          >
            プロンプト
          </label>
          <button
            type="button"
            onClick={insertTemplate}
            className="text-xs font-medium text-zinc-500 hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          >
            型の雛形を入れる
          </button>
        </div>
        <textarea
          id="video-prompt"
          name="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          placeholder="何がどう動くか、誰が何を言うかを書く。型は「雛形を入れる」から"
          className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-foreground placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-y"
        />
      </div>

      <div>
        <p className="text-sm font-medium text-foreground mb-2">
          最初のコマ(Gallery の画像)
        </p>
        {images.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            まだ画像がありません。先に画像を作ってください
          </p>
        ) : (
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {images.map((image) => {
              const selected = image.id === firstFrameId;
              return (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setFirstFrameId(image.id)}
                  aria-pressed={selected}
                  title={image.title ?? "無題"}
                  className={`relative aspect-square overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800 transition-all ${
                    selected
                      ? "ring-2 ring-zinc-900 dark:ring-zinc-100"
                      : "opacity-80 hover:opacity-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl(image.id)}
                    alt={image.title ?? "無題"}
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label className="text-sm text-foreground">
          <span className="block font-medium mb-1">尺(秒)</span>
          <input
            type="number"
            min={VIDEO_SECONDS.min}
            max={VIDEO_SECONDS.max}
            step={1}
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
            className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
          />
          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
            {frames} フレーム = {secondsForFrames(frames).toFixed(2)} 秒
          </span>
        </label>

        <label className="text-sm text-foreground">
          <span className="block font-medium mb-1">アスペクト</span>
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value)}
            className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
          >
            {VIDEO_ASPECTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-foreground">
          <span className="block font-medium mb-1">seed</span>
          <input
            type="text"
            inputMode="numeric"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="空なら乱数"
            className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={useCleanse}
            onChange={(e) => setUseCleanse(e.target.checked)}
            className="h-4 w-4"
          />
          ローカルLLMで H3 の型に整えてから投入
        </label>

        {useCleanse && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <span className="text-zinc-500 dark:text-zinc-400">
              コンテキスト
            </span>
            <select
              value={contextId}
              onChange={(e) => setContextId(e.target.value)}
              className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-sm"
            >
              <option value="">なし</option>
              {contexts.map((context) => (
                <option key={context.id} value={context.id}>
                  {context.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {phase === "cleansing"
            ? "整えています…"
            : phase === "submitting"
              ? "投入しています…"
              : "動画を作る"}
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          1 本およそ 30 分。投入の前に oMLX のモデルを解放する
        </span>
      </div>

      {message && (
        <div role="status">
          <p
            className={`text-sm ${
              message.kind === "ok"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {message.text}
          </p>
          {message.note && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {message.note}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
