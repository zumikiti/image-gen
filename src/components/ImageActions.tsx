"use client";

import { ArrowPathIcon, TrashIcon } from "./icons";

interface ImageActionsProps {
  /** プロンプトを再利用する。上書き確認は呼び出し側が担う */
  onReusePrompt: () => void;
  /** 画像を削除する。確認は呼び出し側が担う */
  onDelete: () => void;
  isDeleting?: boolean;
}

/** カードとモーダルで共用する操作ボタン */
export function ImageActions({
  onReusePrompt,
  onDelete,
  isDeleting = false,
}: ImageActionsProps) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onReusePrompt}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium text-sm rounded transition-colors"
      >
        <ArrowPathIcon className="w-4 h-4 shrink-0" />
        再利用
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm rounded transition-colors"
      >
        <TrashIcon className="w-4 h-4 shrink-0" />
        {isDeleting ? "削除中…" : "削除"}
      </button>
    </div>
  );
}
