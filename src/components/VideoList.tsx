"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelVideoAction,
  deleteVideoAction,
  retryVideoAction,
  syncVideosAction,
  updateVideoTitleAction,
} from "@/app/actions";
import { PlayIcon } from "./icons";
import { secondsForFrames } from "@/lib/h3Graph";
import { MAX_TITLE_LENGTH } from "@/lib/title";
import { thumbUrl } from "@/lib/thumbnail";
import type { GeneratedVideo, VideoStatus } from "@/lib/types";

/** 見回りの間隔。30 分待つ前では 15 秒の遅れは無に等しい */
const POLL_INTERVAL_MS = 15_000;

const STATUS_LABEL: Record<VideoStatus, string> = {
  queued: "待ち",
  running: "生成中",
  succeeded: "完成",
  failed: "失敗",
  canceled: "取り消し",
};

const STATUS_CLASS: Record<VideoStatus, string> = {
  queued: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  running: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  succeeded:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  canceled:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function isUnsettled(video: GeneratedVideo): boolean {
  return video.status === "queued" || video.status === "running";
}

/**
 * 動画の一覧と操作。
 *
 * 未完了のものがある間だけ、15 秒ごとに ComfyUI へ見回りを出す。
 * タブが裏に回っておれば止める(見えぬ画面のために叩かぬ)。
 */
export function VideoList({ videos }: { videos: GeneratedVideo[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** 再生を押された動画だけ `<video>` を置く。押すまで 1 バイトも取りに行かぬ */
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");

  const unsettled = videos.filter(isUnsettled);
  const hasUnsettled = unsettled.length > 0;
  const running = unsettled.filter(
    (video) => video.status === "running",
  ).length;
  const queued = unsettled.length - running;

  const syncNow = useCallback(async () => {
    const result = await syncVideosAction();
    setNotice(result.ok ? null : result.error);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!hasUnsettled) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void syncNow();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [hasUnsettled, syncNow]);

  const runAction = async (
    id: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setBusyId(id);
    setNotice(null);
    try {
      const result = await action();
      if (!result.ok) setNotice(result.error ?? "失敗しました");
    } finally {
      setBusyId(null);
      router.refresh();
    }
  };

  const handleCancel = (video: GeneratedVideo) => {
    const question =
      video.status === "running"
        ? "実行中の生成を止めます。いま流れておるものすべてが止まります。よろしいか?"
        : "この待ちを取り消しますか?";
    if (!window.confirm(question)) return;
    void runAction(video.id, () => cancelVideoAction(video.id));
  };

  const handleRetry = (video: GeneratedVideo) => {
    void runAction(video.id, () => retryVideoAction(video.id));
  };

  const handleDelete = async (video: GeneratedVideo) => {
    if (!window.confirm("この動画を削除しますか?(mp4 も消えます)")) return;
    setBusyId(video.id);
    setNotice(null);
    try {
      await deleteVideoAction(video.id);
    } finally {
      setBusyId(null);
      router.refresh();
    }
  };

  const startEditingTitle = (video: GeneratedVideo) => {
    setEditingId(video.id);
    setTitleDraft(video.title ?? "");
  };

  const saveTitle = async (id: string) => {
    const result = await updateVideoTitleAction(id, titleDraft);
    if (!result.ok) setNotice(result.error);
    setEditingId(null);
    router.refresh();
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {videos.length === 0
            ? "まだ動画はありません"
            : `全 ${videos.length} 本`}
          {unsettled.length > 0 && (
            <span className="ml-2">
              実行中 {running} / 待ち {queued}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => void syncNow()}
          className="rounded border border-zinc-300 dark:border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          今すぐ見る
        </button>
      </div>

      {notice && (
        <p
          role="alert"
          className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        >
          {notice}
        </p>
      )}

      <ul className="space-y-3">
        {videos.map((video) => (
          <li
            key={video.id}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:p-4"
          >
            <div className="flex gap-3">
              <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                {video.firstFrameImageId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbUrl(video.firstFrameImageId)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-400">
                    元画像なし
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {video.title ?? "無題"}
                  </h3>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_CLASS[video.status]}`}
                  >
                    {STATUS_LABEL[video.status]}
                  </span>
                </div>

                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-zinc-500 dark:text-zinc-400">
                  {video.prompt}
                </p>

                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {video.aspect} / {secondsForFrames(video.frames).toFixed(2)}{" "}
                  秒{video.seed !== null && ` / seed ${video.seed}`}
                </p>

                {video.error && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {video.error}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEditingTitle(video)}
                    className="rounded px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    名前
                  </button>

                  {isUnsettled(video) && (
                    <button
                      type="button"
                      onClick={() => handleCancel(video)}
                      disabled={busyId === video.id}
                      className="rounded px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-50 transition-colors"
                    >
                      取り消し
                    </button>
                  )}

                  {(video.status === "failed" ||
                    video.status === "canceled") && (
                    <button
                      type="button"
                      onClick={() => handleRetry(video)}
                      disabled={busyId === video.id}
                      className="rounded px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                    >
                      もう一度
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleDelete(video)}
                    disabled={busyId === video.id}
                    className="rounded px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 transition-colors"
                  >
                    削除
                  </button>
                </div>

                {editingId === video.id && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      maxLength={MAX_TITLE_LENGTH}
                      placeholder="この動画の名前"
                      className="min-w-0 flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void saveTitle(video.id)}
                      className="rounded bg-zinc-900 dark:bg-zinc-100 px-2 py-1 text-xs font-medium text-white dark:text-zinc-900"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            </div>

            {video.status === "succeeded" &&
              (playingId === video.id ? (
                <video
                  autoPlay
                  controls
                  src={`/api/videos/${video.id}`}
                  poster={
                    video.firstFrameImageId
                      ? thumbUrl(video.firstFrameImageId)
                      : undefined
                  }
                  className="mt-3 w-full rounded-lg bg-black"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlayingId(video.id)}
                  aria-label="動画を再生"
                  className="group relative mt-3 block aspect-video w-full overflow-hidden rounded-lg bg-black"
                >
                  {video.firstFrameImageId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbUrl(video.firstFrameImageId)}
                      alt=""
                      className="h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-85"
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-lg">
                      <PlayIcon className="h-6 w-6" />
                    </span>
                  </span>
                </button>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
