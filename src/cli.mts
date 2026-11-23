/**
 * 画面を介さずに、プロンプト調整(cleanse)と画像生成を実行する CLI。
 * pi のエージェントなどが bash から呼ぶことを想定している。
 * 生成結果はギャラリーと同じ場所(data/app.db と data/images/<id>.png)に貯まる。
 *
 * 使い方:
 *   npm run gen -- contexts
 *   npm run gen -- prompt "赤い船" [--context <id または名前>]
 *   npm run gen -- image "赤い船" [--cleanse] [--context <id または名前>]
 *                                 [--model mflux] [--size 1024x1024] [--quality auto]
 *
 * 結果は JSON を stdout に、進捗やエラーは stderr に出す。
 */

import { cleansePrompt } from "./lib/cleanse.ts";
import { generateImage } from "./lib/generate.ts";
import { DEFAULT_MODEL_ID, findModel } from "./lib/models.ts";
import { insertImage, listContextTemplates } from "./lib/db.ts";
import { saveImageFile } from "./lib/storage.ts";
import type { ContextTemplate, Quality, Size } from "./lib/types.ts";

const DEFAULT_SIZE: Size = "1024x1024";
const DEFAULT_QUALITY: Quality = "auto";

const USAGE = `使い方:
  npm run gen -- contexts
  npm run gen -- prompt "<プロンプト>" [--context <id または名前>]
  npm run gen -- image "<プロンプト>" [--cleanse] [--context <id または名前>]
                                    [--model ${DEFAULT_MODEL_ID}] [--size ${DEFAULT_SIZE}] [--quality ${DEFAULT_QUALITY}]`;

/** コマンドの使い方が誤っているときのエラー。終了コード 2 で終わる */
class UsageError extends Error {}

interface ParsedArgs {
  command: "contexts" | "prompt" | "image";
  /** 位置引数(クォートされていなくても空白で連結する) */
  text: string;
  /** コンテキストの id または名前 */
  context?: string;
  cleanse: boolean;
  model: string;
  size: Size;
  quality: Quality;
}

function takeValue(argv: string[], index: number, name: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new UsageError(`${name} には値が必要です`);
  }
  return value;
}

function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0];
  if (command === "--help" || command === "-h") {
    throw new UsageError(USAGE);
  }
  if (command !== "contexts" && command !== "prompt" && command !== "image") {
    throw new UsageError(
      `未知のコマンド: ${command ?? "(未指定)"}\n\n${USAGE}`,
    );
  }

  const positional: string[] = [];
  let context: string | undefined;
  let cleanse = false;
  let model: string = DEFAULT_MODEL_ID;
  let size: Size = DEFAULT_SIZE;
  let quality: Quality = DEFAULT_QUALITY;

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        throw new UsageError(USAGE);
      case "--cleanse":
        cleanse = true;
        break;
      case "--context":
        context = takeValue(argv, i, "--context");
        i++;
        break;
      case "--model":
        model = takeValue(argv, i, "--model");
        i++;
        break;
      case "--size":
        size = takeValue(argv, i, "--size") as Size;
        i++;
        break;
      case "--quality":
        quality = takeValue(argv, i, "--quality") as Quality;
        i++;
        break;
      default:
        if (arg.startsWith("--")) {
          throw new UsageError(`未知のオプション: ${arg}\n\n${USAGE}`);
        }
        positional.push(arg);
    }
  }

  return {
    command,
    text: positional.join(" ").trim(),
    context,
    cleanse,
    model,
    size,
    quality,
  };
}

/** コンテキストは id でも名前でも引ける */
function resolveContext(ref: string): ContextTemplate {
  const templates = listContextTemplates();
  const found =
    templates.find((t) => t.id === ref) ??
    templates.find((t) => t.name === ref);
  if (!found) {
    const names = templates.map((t) => `${t.name}(${t.id})`).join(", ");
    throw new UsageError(
      `コンテキストが見つかりません: ${ref}${names ? `\n利用可能: ${names}` : "\nコンテキストが 1 件も登録されていません"}`,
    );
  }
  return found;
}

async function runContexts(): Promise<void> {
  console.log(JSON.stringify(listContextTemplates(), null, 2));
}

async function runPrompt(args: ParsedArgs): Promise<void> {
  if (!args.text) {
    throw new UsageError(`プロンプトが空です\n\n${USAGE}`);
  }
  const context = args.context
    ? resolveContext(args.context).content
    : undefined;
  const prompt = await cleansePrompt(args.text, context);
  console.log(JSON.stringify({ prompt }, null, 2));
}

async function runImage(args: ParsedArgs): Promise<void> {
  if (!args.text) {
    throw new UsageError(`プロンプトが空です\n\n${USAGE}`);
  }

  const modelDef = findModel(args.model);
  if (!modelDef) {
    throw new UsageError(`モデルが見つかりません: ${args.model}`);
  }
  if (!modelDef.sizes.includes(args.size)) {
    throw new UsageError(
      `サイズ ${args.size} は ${modelDef.label} では使えません(利用可能: ${modelDef.sizes.join(", ")})`,
    );
  }
  if (!modelDef.qualities.includes(args.quality)) {
    throw new UsageError(
      `品質 ${args.quality} は ${modelDef.label} では使えません(利用可能: ${modelDef.qualities.join(", ")})`,
    );
  }

  const context = args.context
    ? resolveContext(args.context).content
    : undefined;
  const prompt = args.cleanse
    ? await cleansePrompt(args.text, context)
    : args.text;

  const png = await generateImage({
    prompt,
    model: args.model,
    size: args.size,
    quality: args.quality,
  });

  const id = crypto.randomUUID();
  saveImageFile(id, png);
  const image = {
    id,
    prompt,
    model: args.model,
    size: args.size,
    quality: args.quality,
    createdAt: new Date().toISOString(),
  };
  insertImage(image);

  console.log(
    JSON.stringify(
      {
        ...image,
        file: `data/images/${id}.png`,
        apiPath: `/api/images/${id}`,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case "contexts":
      return runContexts();
    case "prompt":
      return runPrompt(args);
    case "image":
      return runImage(args);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = error instanceof UsageError ? 2 : 1;
});
