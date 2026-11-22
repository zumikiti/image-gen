"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteContextAction, saveContextAction } from "@/app/actions";
import type { ContextTemplate } from "@/lib/types";

interface ContextManagerProps {
  initialContexts: ContextTemplate[];
}

/**
 * コンテキスト設定の一覧・新規・編集・削除を担うクライアントコンポーネント。
 * サーバーアクションの後は router.refresh() で最新の一覧に追従する。
 */
export function ContextManager({ initialContexts }: ContextManagerProps) {
  const router = useRouter();
  // 一覧はサーバーコンポーネントが渡す props をそのまま使う。サーバーアクション後の
  // revalidate / router.refresh() で最新の一覧が再配布される。
  const contexts = initialContexts;
  // null = フォーム非表示 / "" = 新規 / それ以外は編集対象の id
  const [editingId, setEditingId] = useState<string | null>(null);

  const [saveState, formAction, isPending] = useActionState(
    saveContextAction,
    null,
  );

  // 保存が成功したら、フォームを閉じて最新の一覧を取得し直す
  useEffect(() => {
    if (saveState?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditingId(null);
      router.refresh();
    }
  }, [saveState, router]);

  const editing = contexts.find((c) => c.id === editingId);

  return (
    <div className="space-y-6">
      {/* 一覧 */}
      <section className="bg-white dark:bg-zinc-900 rounded-lg shadow p-4 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">一覧({contexts.length})</h2>
          {editingId === null && (
            <button
              type="button"
              onClick={() => setEditingId("")}
              className="px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white font-medium text-sm rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              新規追加
            </button>
          )}
        </div>

        {contexts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            コンテキストはまだありません。「新規追加」から作ってください。
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {contexts.map((c) => (
              <li
                key={c.id}
                className="py-3 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 whitespace-pre-line line-clamp-3">
                    {c.content}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingId(c.id)}
                    className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    編集
                  </button>
                  <form action={deleteContextAction.bind(null, c.id)}>
                    <button
                      type="submit"
                      onClick={(e) => {
                        if (!window.confirm(`「${c.name}」を削除しますか?`)) {
                          e.preventDefault();
                        }
                      }}
                      className="px-3 py-1.5 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-md text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      削除
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 新規・編集フォーム */}
      {editingId !== null && (
        <section className="bg-white dark:bg-zinc-900 rounded-lg shadow p-4 border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold mb-3">
            {editing ? `「${editing.name}」を編集` : "新規追加"}
          </h2>
          <form
            key={editing?.id ?? "new"}
            action={formAction}
            className="space-y-3"
          >
            {editing && <input type="hidden" name="id" value={editing.id} />}

            <div>
              <label
                htmlFor="context-name"
                className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1"
              >
                名前
              </label>
              <input
                id="context-name"
                name="name"
                defaultValue={editing?.name ?? ""}
                required
                placeholder="例: 油絵調ファンタジー"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>

            <div>
              <label
                htmlFor="context-content"
                className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1"
              >
                本文
              </label>
              <textarea
                id="context-content"
                name="content"
                defaultValue={editing?.content ?? ""}
                required
                rows={8}
                placeholder="画像生成に添えるベースコンテキストを書く(AGENTS.md / SKILL.md 的)"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-y"
              />
            </div>

            {saveState && !saveState.ok && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {saveState.error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white font-medium text-sm rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? "保存中…" : "保存"}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
