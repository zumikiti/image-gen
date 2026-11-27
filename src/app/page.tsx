export const dynamic = "force-dynamic";

import Link from "next/link";
import { listContextTemplates, listImages } from "@/lib/db";
import { GeneratorAndGallery } from "@/components/GeneratorAndGallery";
import type { ContextTemplate, GeneratedImage } from "@/lib/types";

export default async function Home() {
  let images: GeneratedImage[] = [];
  let contexts: ContextTemplate[] = [];

  try {
    images = listImages();
    contexts = listContextTemplates();
  } catch {
    // DB layer may be unimplemented in this worktree
    images = [];
    contexts = [];
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            画像生成ギャラリー
          </h1>
          <Link
            href="/videos"
            className="text-sm font-medium text-zinc-500 hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          >
            動画生成 →
          </Link>
        </div>

        <GeneratorAndGallery images={images} contexts={contexts} />
      </main>
    </div>
  );
}
