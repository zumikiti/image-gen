"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteAction } from "@/app/actions";
import { matchesQuery } from "@/lib/search";
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
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  // 全件が既に手元にあるので、絞り込みはクライアントで済ませる。
  // deliberate: 件数が数千規模になり仮想スクロールやサーバー検索へ移すときは、
  // 検索語の URL 同期(?q=)も併せて考える
  const visibleImages = useMemo(
    () =>
      query.trim() === ""
        ? images
        : images.filter((image) => matchesQuery(image, query)),
    [images, query],
  );

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
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1">
          <label htmlFor="gallery-search" className="sr-only">
            ギャラリーを検索
          </label>
          <input
            id="gallery-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="タイトル・プロンプトを検索(空白区切りで AND)"
            className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>
        {query.trim() !== "" && (
          <p className="whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
            {visibleImages.length} 件
          </p>
        )}
      </div>

      {visibleImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <p className="text-center text-zinc-500 dark:text-zinc-400 text-lg">
            該当する画像がありません
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            検索語をクリア
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {visibleImages.map((image) => (
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
      )}

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
