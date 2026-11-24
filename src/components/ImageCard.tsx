"use client";

import type { GeneratedImage } from "@/lib/types";

interface ImageCardProps {
  image: GeneratedImage;
  onImageClick: () => void;
}

/**
 * 一覧に並ぶ 1 枚。絵と名前だけを見せ、詳細と操作はビューアに任せる。
 */
export function ImageCard({ image, onImageClick }: ImageCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg overflow-hidden shadow border border-zinc-200 dark:border-zinc-800 hover:shadow-lg transition-shadow">
      {/* Image container */}
      <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800 cursor-pointer overflow-hidden group">
        {/* ファーストビュー外はブラウザに遅延させる。枠は aspect-square で確保済みじゃ */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/images/${image.id}`}
          alt={image.title ?? image.prompt}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
          onClick={onImageClick}
        />
      </div>

      {/* Title。未設定のタイトルは行ごと出さぬ */}
      {image.title && (
        <p
          className="p-3 truncate text-sm font-medium text-foreground"
          title={image.title}
        >
          {image.title}
        </p>
      )}
    </div>
  );
}
