"use client";

import type { GeneratedImage } from "@/lib/types";
import { ImageActions } from "./ImageActions";

interface ImageCardProps {
  image: GeneratedImage;
  onImageClick: () => void;
  onReusePrompt: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

/**
 * 一覧に並ぶ 1 枚。写真と操作だけを見せ、プロンプト等の詳細はモーダルに任せる。
 */
export function ImageCard({
  image,
  onImageClick,
  onReusePrompt,
  onDelete,
  isDeleting = false,
}: ImageCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg overflow-hidden shadow border border-zinc-200 dark:border-zinc-800 hover:shadow-lg transition-shadow">
      {/* Image container */}
      <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800 cursor-pointer overflow-hidden group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/images/${image.id}`}
          alt={image.title ?? image.prompt}
          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
          onClick={onImageClick}
        />
      </div>

      {/* Title + Actions。未設定のタイトルは行ごと出さぬ */}
      <div className="p-3">
        {image.title && (
          <p
            className="mb-2 truncate text-sm font-medium text-foreground"
            title={image.title}
          >
            {image.title}
          </p>
        )}
        <ImageActions
          onReusePrompt={onReusePrompt}
          onDelete={onDelete}
          isDeleting={isDeleting}
          iconOnly
        />
      </div>
    </div>
  );
}
