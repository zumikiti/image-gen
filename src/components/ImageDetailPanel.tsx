"use client";

import { useEffect, useRef, useState } from "react";
import { updateTitleAction } from "@/app/actions";
import { MAX_TITLE_LENGTH } from "@/lib/title";
import type { GeneratedImage } from "@/lib/types";
import { ImageActions } from "./ImageActions";
import { DocumentDuplicateIcon, PencilIcon } from "./icons";

type CopyStatus = "idle" | "copied" | "failed";

/**
 * クリップボードへ書き込む。
 * navigator.clipboard は secure context(https / localhost)でしか使えず、
 * LAN の http で開いておると使えぬため、旧来の execCommand へ落とす。
 */
async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 権限拒否などはフォールバックへ回す
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  let copied = false;
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

interface ImageDetailPanelProps {
  image: GeneratedImage;
  isDeleting?: boolean;
  onReusePrompt: () => void;
  onDelete: () => void;
  /** 保存できたタイトルを親へ返す(revalidate では image.title が届くまで古いため) */
  onTitleUpdated: (title: string | null) => void;
  /** 編集中はビューアが移動・閉じるを受け付けぬようにする */
  onEditingChange: (editing: boolean) => void;
}

const PROMPT_CLAMP_CLASS = "line-clamp-3";

/**
 * ビューアを下へスクロールすると現れる面。
 * タイトル・プロンプト・生成条件・操作をここに集める。
 */
export function ImageDetailPanel({
  image,
  isDeleting = false,
  onReusePrompt,
  onDelete,
  onTitleUpdated,
  onEditingChange,
}: ImageDetailPanelProps) {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isPromptOverflowing, setIsPromptOverflowing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const promptRef = useRef<HTMLParagraphElement>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(image.title ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // 「コピーしました」はしばらくしたら戻す
  useEffect(() => {
    if (copyStatus === "idle") return;
    const timer = setTimeout(() => setCopyStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  // 3 行に収まらないときだけ「全文を表示」を出す。折りたたんだ高さで測る。
  // 測定した結果を effect の中でそのまま setState すると、画像を素早く
  // 送り続けたときに「commit 中の更新」が積み上がって React が音を上げる。
  // 1 フレーム待って測り、通常の更新として反映させる
  useEffect(() => {
    const el = promptRef.current;
    if (!el || isPromptExpanded) return;
    const frame = requestAnimationFrame(() => {
      setIsPromptOverflowing(el.scrollHeight > el.clientHeight + 1);
    });
    return () => cancelAnimationFrame(frame);
  }, [isPromptExpanded, image.prompt]);

  // 編集の開始と終了をその場で知らせる。effect で state を見張ると、
  // 画像を送るたびに「編集していない」を通知し直すことになり、
  // 素早く送り続けたときに更新が積み上がる
  const startEditingTitle = () => {
    setTitleDraft(image.title ?? "");
    setTitleError(null);
    setIsEditingTitle(true);
    onEditingChange(true);
  };

  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setTitleDraft(image.title ?? "");
    setTitleError(null);
    onEditingChange(false);
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
      onEditingChange(false);
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
    <div className="space-y-6 p-6 pb-12">
      {/* タイトル: 未設定なら「タイトルなし」と出し、その場で付けられるようにする */}
      <div>
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
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
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEditingTitle();
                  return;
                }
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
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {image.title ?? (
                <span className="text-zinc-400 dark:text-zinc-500">
                  タイトルなし
                </span>
              )}
            </h2>
            <button
              type="button"
              onClick={startEditingTitle}
              className="shrink-0 text-zinc-400 hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
              aria-label="タイトルを編集"
              title="タイトルを編集"
            >
              <PencilIcon className="w-5 h-5" />
            </button>
          </div>
        )}
        {titleError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {titleError}
          </p>
        )}
      </div>

      {/* プロンプト */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-foreground">プロンプト</h3>
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

      {/* メタ情報 */}
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
          <p className="text-foreground font-medium text-sm">{formattedDate}</p>
        </div>
      </div>

      {/* 操作。破壊的操作を一番下に置く */}
      <ImageActions
        onReusePrompt={onReusePrompt}
        onDelete={onDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
