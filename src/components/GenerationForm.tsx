"use client";

import { useActionState, useState, useEffect } from "react";
import { generateAction } from "@/app/actions";
import { MODEL_CATALOG, DEFAULT_MODEL_ID, findModel } from "@/lib/models";
import type { GenerationResult } from "@/lib/types";

export function GenerationForm() {
  const [state, formAction, isPending] = useActionState<
    GenerationResult | null,
    FormData
  >(generateAction, null);

  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const defaultModel = findModel(DEFAULT_MODEL_ID);
  const [selectedSize, setSelectedSize] = useState<string>(
    defaultModel?.sizes[0] ?? ""
  );
  const [selectedQuality, setSelectedQuality] = useState<string>(
    defaultModel?.qualities[0] ?? ""
  );

  const currentModel = findModel(selectedModelId);

  // Reset size/quality when model changes
  useEffect(() => {
    const model = findModel(selectedModelId);
    if (model) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedSize(model.sizes[0]);
      setSelectedQuality(model.qualities[0]);
    }
  }, [selectedModelId]);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModelId(e.target.value);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 border border-zinc-200 dark:border-zinc-800">
      <form action={formAction} className="space-y-6">
        {/* Prompt textarea */}
        <div>
          <label
            htmlFor="prompt"
            className="block text-sm font-medium text-foreground mb-2"
          >
            プロンプト
          </label>
          <textarea
            id="prompt"
            name="prompt"
            required
            placeholder="生成したい画像について説明してください..."
            rows={4}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            disabled={isPending}
          />
        </div>

        {/* Model select */}
        <div>
          <label
            htmlFor="model"
            className="block text-sm font-medium text-foreground mb-2"
          >
            モデル
          </label>
          <select
            id="model"
            name="model"
            value={selectedModelId}
            onChange={handleModelChange}
            disabled={isPending}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
          >
            {MODEL_CATALOG.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label} ({model.priceHint})
              </option>
            ))}
          </select>
        </div>

        {/* Size select */}
        <div>
          <label
            htmlFor="size"
            className="block text-sm font-medium text-foreground mb-2"
          >
            サイズ
          </label>
          <select
            id="size"
            name="size"
            value={selectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
            disabled={isPending}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
          >
            {currentModel?.sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Quality select */}
        <div>
          <label
            htmlFor="quality"
            className="block text-sm font-medium text-foreground mb-2"
          >
            品質
          </label>
          <select
            id="quality"
            name="quality"
            value={selectedQuality}
            onChange={(e) => setSelectedQuality(e.target.value)}
            disabled={isPending}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
          >
            {currentModel?.qualities.map((quality) => (
              <option key={quality} value={quality}>
                {quality}
              </option>
            ))}
          </select>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 dark:bg-blue-500 text-white font-medium rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <>
              <svg
                className="w-5 h-5 animate-spin"
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

        {/* Error message */}
        {state && !state.ok && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-700 dark:text-red-400 text-sm">{state.error}</p>
          </div>
        )}
      </form>
    </div>
  );
}
