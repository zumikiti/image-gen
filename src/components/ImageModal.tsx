"use client";

import { useEffect } from "react";
import type { GeneratedImage } from "@/lib/types";

interface ImageModalProps {
  image: GeneratedImage;
  onClose: () => void;
}

export function ImageModal({ image, onClose }: ImageModalProps) {
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
            <h3 className="text-sm font-medium text-foreground mb-2">プロンプト</h3>
            <p className="text-foreground whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-800 p-3 rounded">
              {image.prompt}
            </p>
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
        </div>
      </div>
    </div>
  );
}
