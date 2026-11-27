export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  getImage,
  listContextTemplates,
  listImages,
  listVideos,
} from "@/lib/db";
import { VideoForm, type FirstFrameCandidate } from "@/components/VideoForm";
import { VideoList } from "@/components/VideoList";
import type { ContextTemplate, GeneratedVideo } from "@/lib/types";

/** 最初のコマのピッカーに並べる最近の画像の数 */
const PICKER_LIMIT = 24;

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ first?: string }>;
}) {
  const { first } = await searchParams;

  let videos: GeneratedVideo[] = [];
  let contexts: ContextTemplate[] = [];
  let candidates: FirstFrameCandidate[] = [];

  try {
    videos = listVideos();
    contexts = listContextTemplates();
    candidates = listImages()
      .slice(0, PICKER_LIMIT)
      .map((image) => ({ id: image.id, title: image.title }));

    // 「この絵を動かす」で来た画像が最近の分に無ければ、先頭に足して見せる
    const requested = typeof first === "string" ? first : "";
    if (requested !== "" && !candidates.some((c) => c.id === requested)) {
      const image = getImage(requested);
      if (image) {
        candidates = [{ id: image.id, title: image.title }, ...candidates];
      }
    }
  } catch {
    // DB 層が未実装でも画面は開けるようにする(画像側と同じ扱い)
    videos = [];
    contexts = [];
    candidates = [];
  }

  const defaultFirstFrameId = candidates.some((c) => c.id === first)
    ? String(first)
    : (candidates[0]?.id ?? "");

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            動画生成
          </h1>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-500 hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          >
            ← 画像ギャラリー
          </Link>
        </div>

        <section className="mb-10">
          <VideoForm
            images={candidates}
            contexts={contexts}
            defaultFirstFrameId={defaultFirstFrameId}
          />
        </section>

        <VideoList videos={videos} />
      </main>
    </div>
  );
}
