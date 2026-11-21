"use client";

import { useState } from "react";
import type { GeneratedImage } from "@/lib/types";
import { GenerationForm } from "./GenerationForm";
import { Gallery } from "./Gallery";

interface GeneratorAndGalleryProps {
  images: GeneratedImage[];
}

/**
 * 生成フォームとギャラリーの共通の親。
 * 「プロンプトを再利用」はフォームの入力欄とギャラリーのカードの両方に跨るため、
 * テキストエリアの値をここで保持して双方に配る。
 */
export function GeneratorAndGallery({ images }: GeneratorAndGalleryProps) {
  const [prompt, setPrompt] = useState("");

  const handleReusePrompt = (next: string) => {
    // 入力済みの内容を黙って捨てない。上書きの可否を利用者に委ねる
    if (
      prompt.trim() !== "" &&
      !window.confirm("入力中のプロンプトを上書きしますか?")
    ) {
      return;
    }
    setPrompt(next);
  };

  return (
    <>
      <section className="mb-12">
        <GenerationForm prompt={prompt} onPromptChange={setPrompt} />
      </section>

      <section>
        <Gallery images={images} onReusePrompt={handleReusePrompt} />
      </section>
    </>
  );
}
