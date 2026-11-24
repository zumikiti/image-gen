"use client";

import type { GeneratedImage } from "@/lib/types";
import { ImageActions } from "./ImageActions";

interface ImageCardProps {
  image: GeneratedImage;
  /** 一括削除の対象に選ばれておるか */
  isSelected: boolean;
  onToggleSelected: () => void;
  onImageClick: () => void;
  onReusePrompt: () => void;
}

/**
 * 一覧に並ぶ 1 枚。写真と操作だけを見せ、プロンプト等の詳細はモーダルに任せる。
 * 削除は一覧の下部でまとめて行うゆえ、このカードには削除ボタンを置かぬ。
 */
export function ImageCard({
  image,
  isSelected,
  onToggleSelected,
  onImageClick,
  onReusePrompt,
}: ImageCardProps) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-lg overflow-hidden shadow border border-zinc-200 dark:border-zinc-800 hover:shadow-lg transition-shadow ${
        isSelected ? "ring-2 ring-blue-500" : ""
      }`}
    >
      {/* Image container */}
      <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800 cursor-pointer overflow-hidden group">
        {/* 選択チェックは画像の上に重ねる。クリックがモーダルに抜けぬよう止める */}
        <div className="absolute top-2 left-2 z-10 rounded bg-white/90 dark:bg-zinc-900/90 p-1 shadow">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelected}
            onClick={(e) => e.stopPropagation()}
            aria-label={image.title ?? image.prompt}
            className="block h-4 w-4 cursor-pointer accent-blue-600"
          />
        </div>

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
        <ImageActions onReusePrompt={onReusePrompt} iconOnly />
      </div>
    </div>
  );
}
