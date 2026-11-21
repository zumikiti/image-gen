"use client";

import { useState } from "react";
import type { GeneratedImage } from "@/lib/types";
import { ImageCard } from "./ImageCard";
import { ImageModal } from "./ImageModal";

interface GalleryProps {
  images: GeneratedImage[];
  /** カードの「プロンプトを再利用」で、フォームの入力欄へ流し込む */
  onReusePrompt: (prompt: string) => void;
}

export function Gallery({ images, onReusePrompt }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-center text-zinc-500 dark:text-zinc-400 text-lg">
          まだ画像がありません
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            onImageClick={() => setSelectedImage(image)}
            onReusePrompt={() => onReusePrompt(image.prompt)}
          />
        ))}
      </div>

      {selectedImage && (
        <ImageModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </>
  );
}
