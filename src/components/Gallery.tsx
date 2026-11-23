"use client";

import { useState, useTransition } from "react";
import { deleteAction } from "@/app/actions";
import type { GeneratedImage } from "@/lib/types";
import { ImageCard } from "./ImageCard";
import { ImageModal } from "./ImageModal";

interface GalleryProps {
  images: GeneratedImage[];
  /** カード/モーダルの「再利用」で、フォームの入力欄へ流し込む。適用したら true */
  onReusePrompt: (prompt: string) => boolean;
}

export function Gallery({ images, onReusePrompt }: GalleryProps) {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleDelete = (image: GeneratedImage) => {
    const confirmed = window.confirm("この画像を削除しますか?");
    if (!confirmed) return;

    setDeletingId(image.id);
    startTransition(async () => {
      try {
        await deleteAction(image.id);
        // 削除した画像を開いたままにしない
        setSelectedImage((current) =>
          current?.id === image.id ? null : current,
        );
      } finally {
        setDeletingId(null);
      }
    });
  };

  /** 上書き確認でキャンセルされた場合はモーダルを閉じない */
  const handleReuse = (image: GeneratedImage, closeModal = false) => {
    if (onReusePrompt(image.prompt) && closeModal) {
      setSelectedImage(null);
    }
  };

  /**
   * revalidatePath で images props は更新されるが、モーダルが握る selectedImage は
   * 古いままなので、保存できたタイトルをその場で差し替える
   */
  const handleTitleUpdated = (title: string | null) => {
    setSelectedImage((current) => (current ? { ...current, title } : current));
  };

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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            isDeleting={deletingId === image.id}
            onImageClick={() => setSelectedImage(image)}
            onReusePrompt={() => handleReuse(image)}
            onDelete={() => handleDelete(image)}
          />
        ))}
      </div>

      {selectedImage && (
        <ImageModal
          image={selectedImage}
          isDeleting={deletingId === selectedImage.id}
          onClose={() => setSelectedImage(null)}
          onReusePrompt={() => handleReuse(selectedImage, true)}
          onDelete={() => handleDelete(selectedImage)}
          onTitleUpdated={handleTitleUpdated}
        />
      )}
    </>
  );
}
