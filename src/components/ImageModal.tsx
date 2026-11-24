"use client";

import { useEffect, useRef, useState } from "react";
import { updateTitleAction } from "@/app/actions";
import { copyText } from "@/lib/clipboard";
import { MAX_TITLE_LENGTH } from "@/lib/title";
import type { GeneratedImage } from "@/lib/types";
import { ImageActions } from "./ImageActions";
import { PixivPostPanel } from "./PixivPostPanel";
import { DocumentDuplicateIcon, PencilIcon } from "./icons";

type CopyStatus = "idle" | "copied" | "failed";

interface ImageModalProps {
  image: GeneratedImage;
  isDeleting?: boolean;
  onClose: () => void;
  onReusePrompt: () => void;
  onDelete: () => void;
  /** 保存できたタイトルを親へ返す(revalidate では selectedImage が更新されぬため) */
  onTitleUpdated: (title: string | null) => void;
}

const PROMPT_CLAMP_CLASS = "line-clamp-3";

export function ImageModal({
  image,
  isDeleting = false,
  onClose,
  onReusePrompt,
  onDelete,
  onTitleUpdated,
}: ImageModalProps) {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isPromptOverflowing, setIsPromptOverflowing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const promptRef = useRef<HTMLParagraphElement>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(image.title ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // 開いておる間は背後のページをスクロールさせない。
  // スクロールバーが消えるぶんの横ずれは padding で埋める
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  // Escape は二段構え。編集中なら編集だけを取り消し、モーダルは閉じぬ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      if (isEditingTitle) {
        setIsEditingTitle(false);
        setTitleDraft(image.title ?? "");
        setTitleError(null);
        return;
      }
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isEditingTitle, image.title]);

  // 3 行に収まらないときだけ「全文を表示」を出す。折りたたんだ高さで測る
  useEffect(() => {
    const el = promptRef.current;
    if (!el || isPromptExpanded) return;
    setIsPromptOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [isPromptExpanded, image.prompt]);

  // 「コピーしました」はしばらくしたら戻す
  useEffect(() => {
    if (copyStatus === "idle") return;
    const timer = setTimeout(() => setCopyStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  const startEditingTitle = () => {
    setTitleDraft(image.title ?? "");
    setTitleError(null);
    setIsEditingTitle(true);
  };

  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setTitleDraft(image.title ?? "");
    setTitleError(null);
  };

  const handleSaveTitle = async () => {
    if (isSavingTitle) return;
    setIsSavingTitle(true);
    setTitleError(null);
    try {
      const result = await updateTitleAction(image.id, titleDraft);
      if (!result.ok) {
        setTitleError(result.error);
        return;
      }
      onTitleUpdated(result.title);
      setIsEditingTitle(false);
    } catch (e) {
      setTitleError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleCopyPrompt = async () => {
    const copied = await copyText(image.prompt);
    setCopyStatus(copied ? "copied" : "failed");
  };

  const formattedDate = new Date(image.createdAt).toLocaleString("ja-JP");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: タイトル(未設定なら「画像詳細」)と編集・閉じる */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between gap-2">
            {isEditingTitle ? (
              <div className="flex flex-1 items-center gap-2">
                <label htmlFor="image-title" className="sr-only">
                  タイトル
                </label>
                <input
                  id="image-title"
                  autoFocus
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSaveTitle();
                    }
                  }}
                  maxLength={MAX_TITLE_LENGTH}
                  placeholder="タイトル(空で保存すると解除)"
                  disabled={isSavingTitle}
                  className="flex-1 min-w-0 px-3 py-1.5 text-base border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveTitle()}
                  disabled={isSavingTitle}
                  className="shrink-0 px-3 py-1.5 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSavingTitle ? "保存中…" : "保存"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditingTitle}
                  disabled={isSavingTitle}
                  className="shrink-0 px-3 py-1.5 text-sm font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-foreground truncate">
                  {image.title ?? "画像詳細"}
                </h2>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={startEditingTitle}
                    className="text-zinc-400 hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                    aria-label="タイトルを編集"
                    title="タイトルを編集"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-zinc-400 hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                    aria-label="Close"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
          {titleError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {titleError}
            </p>
          )}
        </div>

        {/* Modal body */}
        <div className="p-6 space-y-6">
          {/* Image */}
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/images/${image.id}`}
              alt={image.title ?? image.prompt}
              className="w-full h-auto"
            />
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-foreground">
                プロンプト
              </h3>
              <button
                type="button"
                onClick={handleCopyPrompt}
                aria-label="プロンプトをコピー"
                className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
              >
                <DocumentDuplicateIcon className="w-4 h-4 shrink-0" />
                <span aria-live="polite">
                  {copyStatus === "copied"
                    ? "コピーしました"
                    : copyStatus === "failed"
                      ? "コピーできません"
                      : "コピー"}
                </span>
              </button>
            </div>
            <p
              ref={promptRef}
              className={`text-foreground whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-800 p-3 rounded ${
                isPromptExpanded ? "" : PROMPT_CLAMP_CLASS
              }`}
            >
              {image.prompt}
            </p>
            {isPromptOverflowing && (
              <button
                type="button"
                onClick={() => setIsPromptExpanded((expanded) => !expanded)}
                className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {isPromptExpanded ? "折りたたむ" : "全文を表示"}
              </button>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                モデル
              </p>
              <p className="text-foreground font-medium">{image.model}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                サイズ
              </p>
              <p className="text-foreground font-medium">{image.size}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                品質
              </p>
              <p className="text-foreground font-medium">{image.quality}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                作成日時
              </p>
              <p className="text-foreground font-medium text-sm">
                {formattedDate}
              </p>
            </div>
          </div>

          {/* pixiv 投稿の下ごしらえ */}
          <PixivPostPanel image={image} />

          {/* Actions (modal footer) */}
          <ImageActions
            onReusePrompt={onReusePrompt}
            onDelete={onDelete}
            isDeleting={isDeleting}
          />
        </div>
      </div>
    </div>
  );
}
