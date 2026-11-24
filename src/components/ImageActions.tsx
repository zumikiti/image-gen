"use client";

import { ArrowPathIcon, TrashIcon } from "./icons";

interface ImageActionsProps {
  /** プロンプトを再利用する。上書き確認は呼び出し側が担う */
  onReusePrompt: () => void;
  /**
   * 画像を削除する。確認は呼び出し側が担う。
   * 渡されなければ削除ボタンを描かぬ(一覧のカードは一括削除に譲ったため)
   */
  onDelete?: () => void;
  isDeleting?: boolean;
  /** 一覧向け。ラベルを隠してアイコンだけにする（読み上げ用の名前は残す） */
  iconOnly?: boolean;
}

/** カードとモーダルで共用する操作ボタン */
export function ImageActions({
  onReusePrompt,
  onDelete,
  isDeleting = false,
  iconOnly = false,
}: ImageActionsProps) {
  const padding = iconOnly ? "p-2" : "flex-1 gap-1.5 py-2 px-3";

  return (
    <div className={iconOnly ? "flex justify-end gap-2" : "flex gap-2"}>
      <button
        type="button"
        onClick={onReusePrompt}
        aria-label={iconOnly ? "プロンプトを再利用" : undefined}
        title={iconOnly ? "プロンプトを再利用" : undefined}
        className={`${padding} flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium text-sm rounded transition-colors`}
      >
        <ArrowPathIcon className="w-4 h-4 shrink-0" />
        {!iconOnly && "再利用"}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label={iconOnly ? "この画像を削除" : undefined}
          title={iconOnly ? "この画像を削除" : undefined}
          className={`${padding} flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm rounded transition-colors`}
        >
          <TrashIcon className="w-4 h-4 shrink-0" />
          {!iconOnly && (isDeleting ? "削除中…" : "削除")}
        </button>
      )}
    </div>
  );
}
