"use client";

import { useEffect, useState } from "react";
import { originalUrl } from "@/lib/thumbnail";
import { draftPixivAction } from "@/app/actions";
import { copyImage, copyText } from "@/lib/clipboard";
import {
  PIXIV_CAPTION_MAX_LENGTH,
  PIXIV_TITLE_MAX_LENGTH,
  normalizePixivTags,
} from "@/lib/pixiv";
import type { GeneratedImage } from "@/lib/types";
import { DocumentDuplicateIcon } from "./icons";

/**
 * pixiv のイラスト投稿画面。押したらここを開き、貼り付けて投稿してもらう。
 * pixiv には投稿用の公式 API が無いため、投稿は人に委ねる(半自動)。
 */
const PIXIV_UPLOAD_URL = "https://www.pixiv.net/illustration/create";

/** 案内文を出しておく時間 */
const NOTICE_DURATION_MS = 5000;

type Notice = { kind: "ok" | "error"; text: string };

type DraftField = "title" | "tags" | "caption";

const FIELD_LABELS: Record<DraftField, string> = {
  title: "題名",
  tags: "タグ",
  caption: "キャプション",
};

interface PixivPostPanelProps {
  image: GeneratedImage;
}

/**
 * pixiv 投稿の下ごしらえ。題名・タグ・キャプションをローカル LLM に作らせ、
 * 手で直せるようにし、画像と文面をクリップボードへ載せる。
 * 投稿そのものは pixiv の画面で行われ、ここでは行わぬ。
 */
export function PixivPostPanel({ image }: PixivPostPanelProps) {
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [caption, setCaption] = useState("");

  const [notice, setNotice] = useState<Notice | null>(null);

  // 画像は先に読み込んでおく。クリックの中で fetch を待つと、
  // ブラウザの「操作起点」が切れてクリップボードへ書けなくなるためじゃ
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(originalUrl(image.id));
        if (!response.ok) return;
        const blob = await response.blob();
        if (!cancelled) setImageBlob(blob);
      } catch {
        // 読めなければ下のボタンが失敗として知らせる
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [image.id]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const isDraftReady = title.trim() !== "" || caption.trim() !== "";

  const handleDraft = async () => {
    if (isDrafting) return;
    setIsDrafting(true);
    setDraftError(null);
    try {
      const result = await draftPixivAction(image.id);
      if (!result.ok) {
        setDraftError(result.error);
        return;
      }
      setTitle(result.draft.title);
      setTagsText(result.draft.tags.join(" "));
      setCaption(result.draft.caption);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDrafting(false);
    }
  };

  const valueOf = (field: DraftField): string => {
    if (field === "title") return title;
    if (field === "tags") return normalizePixivTags(tagsText).join(" ");
    return caption;
  };

  const handleCopyField = async (field: DraftField) => {
    const copied = await copyText(valueOf(field));
    setNotice(
      copied
        ? { kind: "ok", text: `${FIELD_LABELS[field]}をコピーしました` }
        : {
            kind: "error",
            text: `${FIELD_LABELS[field]}をコピーできませんでした`,
          },
    );
  };

  const handleCopyImage = () => {
    // タブを開くのは操作の直後に済ませる。await を挟むとポップアップ扱いになる
    window.open(PIXIV_UPLOAD_URL, "_blank", "noopener,noreferrer");

    if (!imageBlob) {
      setNotice({
        kind: "error",
        text: "画像をまだ読み込めていません。少し待ってからもう一度押してください",
      });
      return;
    }

    void copyImage(imageBlob).then((copied) => {
      setNotice(
        copied
          ? {
              kind: "ok",
              text: "画像をコピーしました。pixiv の投稿画面で貼り付けてください",
            }
          : {
              kind: "error",
              text: "このブラウザは画像のコピーに非対応です。画像を保存して投稿画面へドラッグしてください",
            },
      );
    });
  };

  return (
    <section className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-medium text-foreground">
          pixiv 投稿の下ごしらえ
        </h3>
        <button
          type="button"
          onClick={() => void handleDraft()}
          disabled={isDrafting}
          className="px-3 py-1.5 text-sm font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isDrafting ? "作成中…" : "ローカルLLMで作成"}
        </button>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
        pixiv には投稿用の API が無いため、投稿は pixiv
        の画面で行う。ここでは題名・タグ・キャプションと画像を用意するのじゃ。
      </p>

      {draftError && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400">
          {draftError}
        </p>
      )}

      {isDraftReady && (
        <div className="space-y-3 mb-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="pixiv-title"
                className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                題名(pixiv は {PIXIV_TITLE_MAX_LENGTH} 文字まで)
              </label>
              <FieldCopyButton
                field="title"
                onCopy={() => void handleCopyField("title")}
              />
            </div>
            <input
              id="pixiv-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={PIXIV_TITLE_MAX_LENGTH}
              className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="pixiv-tags"
                className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                タグ(空白区切り)
              </label>
              <FieldCopyButton
                field="tags"
                onCopy={() => void handleCopyField("tags")}
              />
            </div>
            <input
              id="pixiv-tags"
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="pixiv-caption"
                className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                キャプション
              </label>
              <FieldCopyButton
                field="caption"
                onCopy={() => void handleCopyField("caption")}
              />
            </div>
            <textarea
              id="pixiv-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              maxLength={PIXIV_CAPTION_MAX_LENGTH}
              className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-y"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              pixiv の投稿画面で「AI 生成作品」のフラグを立てるのを忘れぬよう。
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleCopyImage}
        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm rounded transition-colors"
      >
        <DocumentDuplicateIcon className="w-4 h-4 shrink-0" />
        画像をコピーして pixiv の投稿画面を開く
      </button>

      {notice && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-2 text-xs ${
            notice.kind === "ok"
              ? "text-zinc-500 dark:text-zinc-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {notice.text}
        </p>
      )}
    </section>
  );
}

/** 各欄の「コピー」。押した結果は欄ごとではなく下部の案内で知らせる */
function FieldCopyButton({
  field,
  onCopy,
}: {
  field: DraftField;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={`${FIELD_LABELS[field]}をコピー`}
      className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
    >
      <DocumentDuplicateIcon className="w-4 h-4 shrink-0" />
      コピー
    </button>
  );
}
