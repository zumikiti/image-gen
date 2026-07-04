"use client";

import { useState } from "react";
import type { GeneratedImage } from "@/lib/types";
import { ImageCard } from "./ImageCard";
import { ImageModal } from "./ImageModal";

interface GalleryProps {
  images: GeneratedImage[];
}

export function Gallery({ images }: GalleryProps) {
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
