"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { deleteAction } from "@/app/actions";
import { matchesQuery } from "@/lib/search";
import type { GeneratedImage } from "@/lib/types";
import { indexOfImage } from "@/lib/viewer";
import { ImageCard } from "./ImageCard";
import { ImageViewer } from "./ImageViewer";

interface GalleryProps {
  images: GeneratedImage[];
  /** URL の ?image= から決まった、最初に開く画像。無ければ null */
  initialImageId: string | null;
  /** カード/ビューアの「再利用」で、フォームの入力欄へ流し込む。適用したら true */
  onReusePrompt: (prompt: string) => boolean;
}

/**
 * 開いておる画像を URL に表す。?image= 以外の検索語などは触らぬ。
 * null を渡すと ?image= を落とす。
 */
function historyUrl(id: string | null): string {
  const url = new URL(window.location.href);
  if (id === null) {
    url.searchParams.delete("image");
  } else {
    url.searchParams.set("image", id);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function Gallery({
  images,
  initialImageId,
  onReusePrompt,
}: GalleryProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialImageId);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /** 保存直後のタイトル。revalidate が届くまで props は古いままじゃ */
  const [titleFixes, setTitleFixes] = useState<Record<string, string | null>>(
    {},
  );
  const [, startTransition] = useTransition();
  /** ビューアを開くときに history へ積んだか。積んでおれば閉じるのは戻る操作で行う */
  const pushedRef = useRef(false);

  // 全件が既に手元にあるので、絞り込みはクライアントで済ませる。
  // deliberate: 件数が数千規模になり仮想スクロールやサーバー検索へ移すときは、
  // 検索語の URL 同期(?q=)も併せて考える
  const filteredImages = useMemo(
    () =>
      query.trim() === ""
        ? images
        : images.filter((image) => matchesQuery(image, query)),
    [images, query],
  );

  const visibleImages = useMemo(
    () =>
      filteredImages.map((image) =>
        image.id in titleFixes
          ? { ...image, title: titleFixes[image.id] }
          : image,
      ),
    [filteredImages, titleFixes],
  );

  const selectedIndex = selectedId
    ? indexOfImage(visibleImages, selectedId)
    : -1;
  const selectedImage =
    selectedIndex >= 0 ? visibleImages[selectedIndex] : null;

  // 戻る操作はビューアを閉じる。URL に残った ?image= も戻れば消える
  useEffect(() => {
    const handlePopState = () => {
      pushedRef.current = false;
      setSelectedId(null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // 一覧に無い id(削除済みなど)で開かれたら、開かずに URL を掃除する
  useEffect(() => {
    if (initialImageId !== null) return;
    if (!new URLSearchParams(window.location.search).has("image")) return;
    window.history.replaceState(window.history.state, "", historyUrl(null));
  }, [initialImageId]);

  const openImage = (image: GeneratedImage) => {
    window.history.pushState(window.history.state, "", historyUrl(image.id));
    pushedRef.current = true;
    setSelectedId(image.id);
  };

  /** 移動は history を積まぬ。積むと戻る操作が 1 枚戻しになってしまう */
  const navigateTo = useCallback(
    (next: number) => {
      const image = visibleImages[next];
      if (!image) return;
      window.history.replaceState(
        window.history.state,
        "",
        historyUrl(image.id),
      );
      setSelectedId(image.id);
    },
    [visibleImages],
  );

  const closeViewer = useCallback(() => {
    if (pushedRef.current) {
      // 開くときに積んだ分を戻す。state は popstate で落とす
      window.history.back();
      return;
    }
    window.history.replaceState(window.history.state, "", historyUrl(null));
    setSelectedId(null);
  }, []);

  const handleDelete = (image: GeneratedImage) => {
    const confirmed = window.confirm("この画像を削除しますか?");
    if (!confirmed) return;

    setDeletingId(image.id);
    startTransition(async () => {
      try {
        await deleteAction(image.id);
        // 消したらビューアを閉じ、一覧で確かめさせる
        closeViewer();
      } finally {
        setDeletingId(null);
      }
    });
  };

  /** 上書き確認でキャンセルされた場合はビューアを閉じぬ */
  const handleReuse = (image: GeneratedImage) => {
    if (onReusePrompt(image.prompt)) {
      closeViewer();
    }
  };

  const handleTitleUpdated = (title: string | null) => {
    if (!selectedId) return;
    setTitleFixes((fixes) => ({ ...fixes, [selectedId]: title }));
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
        // deliberate: 一覧からの一括削除は別途。必要になったら選択モードと
        // 一括削除 API を足す(今は 1 枚ずつ、ビューアを開いて消す)
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {visibleImages.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              onImageClick={() => openImage(image)}
            />
          ))}
        </div>
      )}

      {selectedImage && (
        <ImageViewer
          images={visibleImages}
          index={selectedIndex}
          isDeleting={deletingId === selectedImage.id}
          onClose={closeViewer}
          onNavigate={navigateTo}
          onReusePrompt={() => handleReuse(selectedImage)}
          onDelete={() => handleDelete(selectedImage)}
          onTitleUpdated={handleTitleUpdated}
        />
      )}
    </>
  );
}
