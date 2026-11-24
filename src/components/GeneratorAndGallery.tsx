"use client";

import { useEffect, useState } from "react";
import type { ContextTemplate, GeneratedImage } from "@/lib/types";
import { GenerationForm } from "./GenerationForm";
import { Gallery } from "./Gallery";

interface GeneratorAndGalleryProps {
  images: GeneratedImage[];
  contexts: ContextTemplate[];
  /** URL の ?image= から決まった、最初に開く画像。無ければ null */
  initialImageId: string | null;
}

/** トーストを出しておく時間 */
const TOAST_DURATION_MS = 2500;

/** seq は同じ文言を続けて出したときも表示時間を測り直すための番号 */
type Toast = { message: string; seq: number };

/**
 * 生成フォームとギャラリーの共通の親。
 * 「プロンプトを再利用」はフォームの入力欄とギャラリーのカードの両方に跨るため、
 * テキストエリアの値をここで保持して双方に配る。
 */
export function GeneratorAndGallery({
  images,
  contexts,
  initialImageId,
}: GeneratorAndGalleryProps) {
  const [prompt, setPrompt] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  /**
   * 流し込んだら true、上書き確認で取り止めたら false。
   * 呼び出し側(ビューア)は、適用できたときだけ閉じる。
   */
  const handleReusePrompt = (next: string): boolean => {
    // 入力済みの内容を黙って捨てない。上書きの可否を利用者に委ねる
    if (
      prompt.trim() !== "" &&
      !window.confirm("入力中のプロンプトを上書きしますか?")
    ) {
      return false;
    }
    setPrompt(next);
    setToast((prev) => ({
      message: "プロンプトを再利用しました",
      seq: (prev?.seq ?? 0) + 1,
    }));
    return true;
  };

  return (
    <>
      <section className="mb-12">
        <GenerationForm
          prompt={prompt}
          onPromptChange={setPrompt}
          contexts={contexts}
        />
      </section>

      <section>
        <Gallery
          images={images}
          initialImageId={initialImageId}
          onReusePrompt={handleReusePrompt}
        />
      </section>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
