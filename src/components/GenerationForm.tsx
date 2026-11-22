"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { generateAction } from "@/app/actions";
import { MODEL_CATALOG, DEFAULT_MODEL_ID, findModel } from "@/lib/models";
import type { ContextTemplate, GenerationResult } from "@/lib/types";

interface GenerationFormProps {
  /** テキストエリアの値。ギャラリーの「プロンプトを再利用」から差し替えられる */
  prompt: string;
  onPromptChange: (value: string) => void;
  /** プロンプト調整に添えるコンテキスト(管理画面 /admin で管理) */
  contexts: ContextTemplate[];
}

export function GenerationForm({
  prompt,
  onPromptChange,
  contexts,
}: GenerationFormProps) {
  const [selectedContextId, setSelectedContextId] = useState("");
  const [state, formAction, isPending] = useActionState<
    GenerationResult | null,
    FormData
  >(generateAction, null);

  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const defaultModel = findModel(DEFAULT_MODEL_ID);
  const [selectedSize, setSelectedSize] = useState<string>(
    defaultModel?.sizes[0] ?? "",
  );
  const [selectedQuality, setSelectedQuality] = useState<string>(
    defaultModel?.qualities[0] ?? "",
  );

  const currentModel = findModel(selectedModelId);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Reset size/quality when model changes
  useEffect(() => {
    const model = findModel(selectedModelId);
    if (model) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedSize(model.sizes[0]);
      setSelectedQuality(model.qualities[0]);
    }
  }, [selectedModelId]);

  // 入力の長さに合わせて伸び縮みさせる。2 行を下限、上限は CSS(max-h)に任せる。
  // 再利用や生成成功でのクリアなど、外から値が変わった時も計り直す
  useEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    el.style.height = "auto";
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + border}px`;
  }, [prompt]);

  // 生成が成功したら文面を空に戻す(2 行へ縮む)
  useEffect(() => {
    if (state?.ok) {
      onPromptChange("");
    }
  }, [state, onPromptChange]);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModelId(e.target.value);
  };

  // Ctrl/Cmd + Enter で送信。Enter 単独は改行のままにする
  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter" || isPending) return;
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-4 border border-zinc-200 dark:border-zinc-800">
      <form action={formAction} className="space-y-3">
        {/* 常時表示: プロンプト / サイズ / 生成 */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
          <div className="flex-1">
            <label htmlFor="prompt" className="sr-only">
              プロンプト
            </label>
            <textarea
              id="prompt"
              name="prompt"
              ref={promptRef}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={handlePromptKeyDown}
              required
              rows={2}
              placeholder="生成したい画像について説明してください… (Ctrl/⌘+Enter で生成)"
              className="w-full min-h-[4.5rem] max-h-64 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-y overflow-y-auto"
              disabled={isPending}
            />
          </div>

          <div className="flex gap-2 sm:flex-col sm:w-40">
            <div className="flex-1 sm:w-full">
              <label htmlFor="size" className="sr-only">
                サイズ
              </label>
              <select
                id="size"
                name="size"
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
              >
                {currentModel?.sizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="flex-1 sm:w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 dark:bg-blue-500 text-white font-medium text-sm rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  生成中…
                </>
              ) : (
                "生成する"
              )}
            </button>
          </div>
        </div>

        {/* 詳細設定: 普段は閉じておく */}
        <details className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
          <summary className="cursor-pointer select-none text-sm font-medium text-zinc-600 dark:text-zinc-300">
            詳細設定
          </summary>

          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="model"
                  className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1"
                >
                  モデル
                </label>
                <select
                  id="model"
                  name="model"
                  value={selectedModelId}
                  onChange={handleModelChange}
                  disabled={isPending}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                >
                  {MODEL_CATALOG.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label} ({model.priceHint})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="quality"
                  className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1"
                >
                  品質
                </label>
                <select
                  id="quality"
                  name="quality"
                  value={selectedQuality}
                  onChange={(e) => setSelectedQuality(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                >
                  {currentModel?.qualities.map((quality) => (
                    <option key={quality} value={quality}>
                      {quality}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="context"
                className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1"
              >
                コンテキスト
              </label>
              <select
                id="context"
                name="context"
                value={selectedContextId}
                onChange={(e) => setSelectedContextId(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
              >
                <option value="">なし</option>
                {contexts.map((context) => (
                  <option key={context.id} value={context.id}>
                    {context.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                プロンプト調整に添えるベースコンテキスト。
                <Link
                  href="/admin"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  設定画面で管理
                </Link>
              </p>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="cleanse"
                name="cleanse"
                disabled={isPending}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <label htmlFor="cleanse" className="text-sm text-foreground">
                <span className="font-medium">
                  ローカルLLMでプロンプトを調整してから生成
                </span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  入力を画像生成向けに書き直してから渡します(生成時間が少し増えます)
                </span>
              </label>
            </div>
          </div>
        </details>

        {/* Error message */}
        {state && !state.ok && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-700 dark:text-red-400 text-sm">
              {state.error}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
