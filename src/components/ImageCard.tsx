"use client";

import { useTransition } from "react";
import { deleteAction } from "@/app/actions";
import type { GeneratedImage } from "@/lib/types";

interface ImageCardProps {
  image: GeneratedImage;
  onImageClick: () => void;
  /** フォームの入力欄へプロンプトを流し込む（上書き確認は呼び出し側が担う） */
  onReusePrompt: () => void;
}

export function ImageCard({ image, onImageClick, onReusePrompt }: ImageCardProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const confirmed = window.confirm("この画像を削除しますか?");
    if (confirmed) {
      startTransition(() => {
        deleteAction(image.id);
      });
    }
  };

  const formattedDate = new Date(image.createdAt).toLocaleString("ja-JP");

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg overflow-hidden shadow border border-zinc-200 dark:border-zinc-800 hover:shadow-lg transition-shadow">
      {/* Image container */}
      <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800 cursor-pointer overflow-hidden group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/images/${image.id}`}
          alt={image.prompt}
          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
          onClick={onImageClick}
        />
      </div>

      {/* Card content */}
      <div className="p-4 space-y-3">
        {/* Prompt */}
        <p className="text-sm text-foreground line-clamp-2">{image.prompt}</p>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-block px-2 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded font-medium">
            {image.model}
          </span>
          <span className="inline-block px-2 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded font-medium">
            {image.size}
          </span>
          <span className="inline-block px-2 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded font-medium">
            {image.quality}
          </span>
        </div>

        {/* Created date */}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{formattedDate}</p>

        {/* Actions: reuse prompt / delete */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReusePrompt}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium text-sm rounded transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4 shrink-0" />
            再利用
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm rounded transition-colors"
          >
            <TrashIcon className="w-4 h-4 shrink-0" />
            {isPending ? "削除中…" : "削除"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * アイコンは Heroicons v2 (MIT License) の outline/24 をインライン化したもの。
 * https://heroicons.com/ — 新規依存を増やさず、既存のスピナー等と同じ流儀で使う
 */
function ArrowPathIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  );
}
