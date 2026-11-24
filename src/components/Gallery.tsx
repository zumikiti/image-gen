"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteAction, deleteManyAction } from "@/app/actions";
import { matchesQuery } from "@/lib/search";
import type { GeneratedImage } from "@/lib/types";
import { BulkDeleteDialog } from "./BulkDeleteDialog";
import { ImageCard } from "./ImageCard";
import { ImageModal } from "./ImageModal";
import { TrashIcon } from "./icons";

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
  /**
   * 一括削除の対象。検索語を変えても保持するのじゃ
   * (非表示分も数えるが、確認モーダルが全件タイルを見せる)
   */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
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
        // 削除した画像を開いたままにも、選択にも残さぬ
        setSelectedImage((current) =>
          current?.id === image.id ? null : current,
        );
        setSelectedIds((current) => {
          if (!current.has(image.id)) return current;
          const next = new Set(current);
          next.delete(image.id);
          return next;
        });
      } finally {
        setDeletingId(null);
      }
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /** 絞り込み中は見えておる分だけを選ぶ。画面と消えるものを一致させる */
  const selectVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const image of visibleImages) next.add(image.id);
      return next;
    });
  };

  const isEveryVisibleSelected =
    visibleImages.length > 0 &&
    visibleImages.every((image) => selectedIds.has(image.id));

  /** 選択した順ではなく、一覧の並び順で見せる */
  const selectedImages = useMemo(
    () => images.filter((image) => selectedIds.has(image.id)),
    [images, selectedIds],
  );

  const handleBulkDelete = () => {
    setIsBulkDeleting(true);
    startTransition(async () => {
      try {
        await deleteManyAction([...selectedIds]);
        // 成功したときだけ閉じる。失敗すれば選択もモーダルも残り、そのまま再実行できる
        setSelectedIds(new Set());
        setIsConfirmOpen(false);
      } finally {
        setIsBulkDeleting(false);
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
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 gap-4 ${
            // 下部のバーに最後の行が隠れぬよう、選択中だけ余白を足す
            selectedIds.size > 0 ? "pb-24" : ""
          }`}
        >
          {visibleImages.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              isSelected={selectedIds.has(image.id)}
              onToggleSelected={() => toggleSelected(image.id)}
              onImageClick={() => setSelectedImage(image)}
              onReusePrompt={() => handleReuse(image)}
            />
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {selectedIds.size} 件選択中
            </p>
            <div className="ml-auto flex items-center gap-2">
              {visibleImages.length > 0 && (
                <button
                  type="button"
                  onClick={
                    isEveryVisibleSelected
                      ? () => setSelectedIds(new Set())
                      : selectVisible
                  }
                  className="px-3 py-2 text-sm font-medium rounded bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {isEveryVisibleSelected
                    ? "全解除"
                    : `表示中の ${visibleImages.length} 件を選択`}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                <TrashIcon className="w-4 h-4 shrink-0" />
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      {isConfirmOpen && (
        <BulkDeleteDialog
          images={selectedImages}
          isDeleting={isBulkDeleting}
          onCancel={() => setIsConfirmOpen(false)}
          onConfirm={handleBulkDelete}
        />
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
