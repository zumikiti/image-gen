export const dynamic = "force-dynamic";

import { listImages } from "@/lib/db";
import { GenerationForm } from "@/components/GenerationForm";
import { Gallery } from "@/components/Gallery";
import type { GeneratedImage } from "@/lib/types";

export default async function Home() {
  let images: GeneratedImage[] = [];

  try {
    images = listImages();
  } catch {
    // DB layer may be unimplemented in this worktree
    images = [];
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-8">
          画像生成ギャラリー
        </h1>

        <section className="mb-12">
          <GenerationForm />
        </section>

        <section>
          <Gallery images={images} />
        </section>
      </main>
    </div>
  );
}
