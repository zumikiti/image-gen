"use client";

import { useEffect, useRef, useState } from "react";
import type { GeneratedImage } from "@/lib/types";
import { ImageActions } from "./ImageActions";
import { DocumentDuplicateIcon } from "./icons";

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

interface ImageModalProps {
  image: GeneratedImage;
  isDeleting?: boolean;
  onClose: () => void;
  onReusePrompt: () => void;
  onDelete: () => void;
}

const PROMPT_CLAMP_CLASS = "line-clamp-3";

export function ImageModal({
  image,
  isDeleting = false,
  onClose,
  onReusePrompt,
  onDelete,
}: ImageModalProps) {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isPromptOverflowing, setIsPromptOverflowing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const promptRef = useRef<HTMLParagraphElement>(null);

  // 開いておる間は背後のページをスクロールさせない。
  // スクロールバーが消えるぶんの横ずれは padding で埋める
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
        {/* Header with close button */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">画像詳細</h2>
          <button
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

        {/* Modal body */}
        <div className="p-6 space-y-6">
          {/* Image */}
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/images/${image.id}`}
              alt={image.prompt}
              className="w-full h-auto"
            />
          </div>

          {/* Prompt */}
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
              <p className="text-foreground font-medium text-sm">{formattedDate}</p>
            </div>
          </div>

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
