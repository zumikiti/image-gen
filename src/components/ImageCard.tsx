"use client";

import { useEffect, useRef } from "react";
import type { GeneratedImage } from "@/lib/types";
import { CheckIcon } from "./icons";

interface ImageCardProps {
  image: GeneratedImage;
  /** 編集モードなら、タップは詳細ではなく選択トグルになる */
  isEditing: boolean;
  /** 一括削除の対象に選ばれておるか */
  isSelected: boolean;
  onOpen: () => void;
  onToggleSelected: () => void;
  /** 長押しで編集モードに入り、この 1 枚を選んだ状態にする */
  onLongPress: () => void;
}

/** 長押しと見なすまでの時間。短すぎるとスクロールの直前で誤爆する */
const LONG_PRESS_MS = 500;

/** これ以上指が動いたら長押しを取りやめる(スクロールの意図と見る) */
const MOVE_TOLERANCE_PX = 10;

/**
 * 一覧に並ぶ 1 枚。写真とタイトルだけを見せ、操作はモーダルに任せる。
 * 削除は一覧の下部でまとめて行うゆえ、このカードにはボタンを置かぬ。
 */
export function ImageCard({
  image,
  isEditing,
  isSelected,
  onOpen,
  onToggleSelected,
  onLongPress,
}: ImageCardProps) {
  const timerRef = useRef<number | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  /** 長押しで成立した場合、直後に飛んでくる click を捨てるための印 */
  const didLongPressRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // アンマウント時にタイマーを残さぬ
  useEffect(() => clearTimer, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isEditing || e.button !== 0) return;

    clearTimer();
    didLongPressRef.current = false;
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      didLongPressRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = pressStartRef.current;
    if (!start) return;

    if (
      Math.abs(e.clientX - start.x) > MOVE_TOLERANCE_PX ||
      Math.abs(e.clientY - start.y) > MOVE_TOLERANCE_PX
    ) {
      clearTimer();
      pressStartRef.current = null;
    }
  };

  const handlePointerEnd = () => {
    clearTimer();
    pressStartRef.current = null;
  };

  const handleClick = () => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    if (isEditing) {
      onToggleSelected();
    } else {
      onOpen();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isEditing ? isSelected : undefined}
      aria-label={image.title ?? image.prompt}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      // 長押しで OS のメニューや画像の保存が出るとモードに入れぬ
      onContextMenu={(e) => e.preventDefault()}
      // iOS で長押しすると型紙のコールアウトが出てモードに入れぬ
      style={{ WebkitTouchCallout: "none" }}
      className={`relative block w-full cursor-pointer select-none overflow-hidden rounded-lg bg-white shadow border border-zinc-200 transition-shadow hover:shadow-lg dark:bg-zinc-900 dark:border-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isSelected ? "ring-2 ring-blue-500" : ""
      }`}
    >
      <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden group">
        {/* ファーストビュー外はブラウザに遅延させる。枠は aspect-square で確保済みじゃ */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/images/${image.id}`}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          /* ポインタは親に任せる。画像を掴んだ長押しでもモードに入れるようにするためじゃ */
          className="pointer-events-none w-full h-full object-cover group-hover:opacity-90 transition-opacity"
        />

        {/* 選択の合図はリングとバッジの二段じゃ */}
        {isSelected && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow">
            <CheckIcon className="w-4 h-4 shrink-0" />
          </span>
        )}
      </div>

      {/* 未設定のタイトルは行ごと出さぬ */}
      {image.title && (
        <div className="p-3">
          <p
            className="truncate text-sm font-medium text-foreground"
            title={image.title}
          >
            {image.title}
          </p>
        </div>
      )}
    </div>
  );
}
