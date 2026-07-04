"use client";

import { useTransition } from "react";
import { deleteAction } from "@/app/actions";
import type { GeneratedImage } from "@/lib/types";

interface ImageCardProps {
  image: GeneratedImage;
  onImageClick: () => void;
}

export function ImageCard({ image, onImageClick }: ImageCardProps) {
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

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="w-full py-2 px-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm rounded transition-colors"
        >
          {isPending ? "削除中…" : "削除"}
        </button>
      </div>
    </div>
  );
}
