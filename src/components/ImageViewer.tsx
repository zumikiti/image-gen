"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeneratedImage } from "@/lib/types";
import { stepIndex } from "@/lib/viewer";
import { ImageDetailPanel } from "./ImageDetailPanel";

/** 横スワイプと認める最小の移動量(px) */
const SWIPE_MIN_PX = 24;
/** 横と認めるために縦移動の何倍を要するか */
const SWIPE_AXIS_RATIO = 1.2;
/**
 * 左右 1/3 のクリックで移動する最小の画面幅(px)。
 * deliberate: タブレットを横にした幅でも領域が出るが、まずは幅で判定する。
 * 精密ポインタで判定したくなったら、この 1 箇所を差し替える
 */
const CLICK_ZONE_MIN_WIDTH = 768;
/** タッチの直後の click を無視する時間(ms)。スワイプの終わりに click が飛ぶ端末がある */
const TOUCH_CLICK_GUARD_MS = 500;

interface ImageViewerProps {
  /** 送り先の並び(絞り込み後) */
  images: GeneratedImage[];
  /** images 内の現在位置 */
  index: number;
  isDeleting?: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onReusePrompt: () => void;
  onDelete: () => void;
  /** 保存できたタイトルを親へ返す(revalidate では props が届くまで古いため) */
  onTitleUpdated: (title: string | null) => void;
}

/**
 * 全面のビューア。絵を画面いっぱいに出し、下へスクロールすると
 * 詳細(タイトル・プロンプト・生成条件・操作)が現れる。
 *
 * 移動はキー・横スワイプ・(広い画面では)左右 1/3 のクリック。
 * 縦スクロールで下を出す操作は、画面の下 1/3 の帯からだけ受け付ける。
 */
export function ImageViewer({
  images,
  index,
  isDeleting = false,
  onClose,
  onNavigate,
  onReusePrompt,
  onDelete,
  onTitleUpdated,
}: ImageViewerProps) {
  const image = images[index];
  const prevImage = images[index - 1];
  const nextImage = images[index + 1];

  const [isEditing, setIsEditing] = useState(false);
  /** 今の画像を読み終えたか。読み終えるまで隣には手を出さぬ */
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const lastTouchAt = useRef(0);

  // 開いておる間は背後のページをスクロールさせない。
  // スクロールバーが消えるぶんの横ずれは padding で埋める
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  const move = useCallback(
    (delta: number) => {
      // 編集中は動かぬ。打ちかけの文字を捨てぬためじゃ
      if (isEditing) return;
      const next = stepIndex(index, images.length, delta);
      if (next < 0 || next === index) return;
      onNavigate(next);
    },
    [isEditing, index, images.length, onNavigate],
  );

  const requestClose = useCallback(() => {
    if (isEditing) return;
    onClose();
  }, [isEditing, onClose]);

  // Escape は編集を取り消す役目を持つ。入力欄にフォーカスがある間は
  // そちらへ譲り、ここでは閉じぬ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;

      if (e.key === "Escape") {
        requestClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [move, requestClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouchAt.current = Date.now();
    if (isEditing) {
      touchStart.current = null;
      return;
    }
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || isEditing) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return;

    move(dx < 0 ? 1 : -1);
  };

  const handleAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // スワイプの終わりに click が飛ぶ端末がある。直前がタッチなら数えぬ
    if (Date.now() - lastTouchAt.current < TOUCH_CLICK_GUARD_MS) return;
    if (isEditing) return;
    if (window.innerWidth < CLICK_ZONE_MIN_WIDTH) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (ratio < 1 / 3) {
      move(-1);
    } else if (ratio > 2 / 3) {
      move(1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="画像ビューア"
    >
      {/* 常設のクローム。スクロールしても位置を変えぬ */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-start justify-between p-3">
        <p className="rounded-full bg-black/40 px-3 py-1 text-sm font-medium text-white tabular-nums backdrop-blur-sm">
          {index + 1} / {images.length}
        </p>
        <button
          type="button"
          onClick={requestClose}
          disabled={isEditing}
          aria-label="閉じる"
          title="閉じる(Esc)"
          className="pointer-events-auto rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60 disabled:opacity-40 disabled:cursor-not-allowed"
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

      <div className="h-full overflow-y-auto overscroll-contain">
        {/*
          画像の面。上 2/3 は横スワイプだけを拾い、縦は流さぬ(pinch-zoom で pan-y を禁ずる)。
          下 1/3 の帯はパネルを出す取っ手で、縦はブラウザに任せて横だけ拾う。
          触った要素から scroll 容器までの touch-action が交わるので、
          帯は画像の面の子にせず、兄弟に置いておる
        */}
        <div className="relative h-[100dvh] w-full" onClick={handleAreaClick}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/images/${image.id}`}
            alt={image.title ?? image.prompt}
            draggable={false}
            onLoad={() => setLoadedId(image.id)}
            className="h-full w-full object-contain select-none"
          />
          <div
            className="absolute inset-0 [touch-action:pinch-zoom]"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-1/3 [touch-action:pan-y_pinch-zoom]"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />
        </div>

        {/* 下へスクロールすると現れる面 */}
        <div className="rounded-t-2xl bg-white text-foreground dark:bg-zinc-950">
          <ImageDetailPanel
            key={image.id}
            image={image}
            isDeleting={isDeleting}
            onReusePrompt={onReusePrompt}
            onDelete={onDelete}
            onTitleUpdated={onTitleUpdated}
            onEditingChange={setIsEditing}
          />
        </div>
      </div>

      {/* 隣を裏で読む。今の 1 枚が読み終わってから手を出す */}
      {loadedId === image.id &&
        [prevImage, nextImage]
          .filter((neighbor): neighbor is GeneratedImage => Boolean(neighbor))
          .map((neighbor) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={neighbor.id}
              src={`/api/images/${neighbor.id}`}
              alt=""
              aria-hidden
              className="hidden"
            />
          ))}
    </div>
  );
}
