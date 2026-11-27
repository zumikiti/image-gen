"use client";

import { useEffect } from "react";
import type { GeneratedImage } from "@/lib/types";
import { thumbUrl } from "@/lib/thumbnail";
import { useBodyScrollLock } from "./useBodyScrollLock";

interface BulkDeleteDialogProps {
  /** 削除しようとしておる画像。確認のため全件タイルで見せる */
  images: GeneratedImage[];
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 一括削除の確認。何が消えるかをタイルで見せてから決を取る。
 * ここで対象を選び直すことはできぬ(外したければ閉じてチェックを外す)。
 */
export function BulkDeleteDialog({
  images,
  isDeleting,
  onCancel,
  onConfirm,
}: BulkDeleteDialogProps) {
  useBodyScrollLock();

  // 削除中は取り消せぬ。返事を待たずに閉じられると、何が消えたか分からなくなる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isDeleting) return;
      onCancel();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={isDeleting ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-title"
        className="bg-white dark:bg-zinc-900 rounded-lg max-w-2xl w-full shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2
            id="bulk-delete-title"
            className="text-lg font-semibold text-foreground"
          >
            {images.length} 件の画像を削除しますか?
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            削除した画像は元に戻せません。
          </p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {images.map((image) => (
              <li
                key={image.id}
                className="aspect-square overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbUrl(image.id)}
                  alt={image.title ?? image.prompt}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDeleting ? "削除中…" : `${images.length} 件を削除`}
          </button>
        </div>
      </div>
    </div>
  );
}
