export const dynamic = "force-dynamic";

import { listContextTemplates, listImages } from "@/lib/db";
import { GeneratorAndGallery } from "@/components/GeneratorAndGallery";
import type { ContextTemplate, GeneratedImage } from "@/lib/types";
import { resolveInitialImageId } from "@/lib/viewer";

interface HomeProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Home({ searchParams }: HomeProps) {
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

  // ?image= はビューアで開く画像。一覧に無い id は開かずに null で渡し、
  // クライアント側で URL を掃除する
  const params = await searchParams;
  const initialImageId = resolveInitialImageId(params.image, images);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-8">
          画像生成ギャラリー
        </h1>

        <GeneratorAndGallery
          images={images}
          contexts={contexts}
          initialImageId={initialImageId}
        />
      </main>
    </div>
  );
}
