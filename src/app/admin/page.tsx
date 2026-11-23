export const dynamic = "force-dynamic";

import Link from "next/link";
import { listContextTemplates } from "@/lib/db";
import { ContextManager } from "@/components/ContextManager";
import type { ContextTemplate } from "@/lib/types";

/**
 * プロンプト調整に添えるコンテキスト設定の管理画面。
 * 一覧・新規・編集・削除の入り口を提供する。
 */
export default async function AdminPage() {
  let contexts: ContextTemplate[] = [];
  try {
    contexts = listContextTemplates();
  } catch {
    // DB layer may be unimplemented in this worktree
    contexts = [];
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <Link
            href="/"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← ギャラリーに戻る
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mt-2 mb-2">
            コンテキスト設定
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            生成フォームの「ローカルLLMでプロンプトを調整」に添えるベースコンテキスト
            (AGENTS.md / SKILL.md 的なもの)を管理します。
          </p>
        </header>

        <ContextManager initialContexts={contexts} />
      </main>
    </div>
  );
}
