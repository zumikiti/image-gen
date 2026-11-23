/**
 * image-gen のプロンプト調整と画像生成を、pi のツールとして使えるようにする。
 * 実処理は CLI(src/cli.mts)に任せ、ここは引数の組み立てと結果の受け渡しだけを行う。
 * 生成結果はギャラリーと同じ場所(data/app.db と data/images/<id>.png)に貯まる。
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  type ExtensionAPI,
  type ExtensionToolContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

/** image-gen リポジトリ直下からの相対パス */
const CLI_PATH = "src/cli.mts";
/** mflux の大判生成は 20 分で打ち切られるため、子プロセスは少し長めに待つ */
const TIMEOUT_MS = 25 * 60 * 1000;

interface CliResult {
  stdout: string;
  stderr: string;
  code: number;
}

/** CLI を子プロセスで走らせる(.env の読み込みと TS 解決は CLI 側で行う) */
async function runCli(
  pi: ExtensionAPI,
  ctx: ExtensionToolContext,
  signal: AbortSignal | undefined,
  args: string[],
): Promise<string> {
  if (!existsSync(join(ctx.cwd, CLI_PATH))) {
    throw new Error(
      `${ctx.cwd} に ${CLI_PATH} が見つかりません。image-gen リポジトリのルートで実行してください`,
    );
  }

  const result: CliResult = await pi.exec(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--env-file-if-exists=.env",
      "--import",
      "./tests/loader.mjs",
      CLI_PATH,
      ...args,
    ],
    { cwd: ctx.cwd, signal, timeout: TIMEOUT_MS },
  );

  if (result.code !== 0) {
    throw new Error(
      result.stderr.trim() ||
        result.stdout.trim() ||
        `CLI が終了コード ${result.code} で失敗しました`,
    );
  }
  return result.stdout;
}

/** 未指定のフラグは CLI の既定値に任せる */
function pushIfSet(args: string[], flag: string, value?: string): void {
  if (value !== undefined && value.trim() !== "") {
    args.push(flag, value);
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "cleanse_prompt",
    label: "Cleanse Prompt",
    description:
      "image-gen のローカルLLMで、画像生成向けにプロンプトを書き直す。画像は生成しない。",
    promptSnippet:
      "Rewrite an image prompt for image generation using the local LLM",
    promptGuidelines: [
      "Use cleanse_prompt when the user wants an image prompt refined before generating; generate_image can also do this in one step with cleanse: true.",
    ],
    parameters: Type.Object({
      prompt: Type.String({ description: "書き直したい元のプロンプト" }),
      context: Type.Optional(
        Type.String({
          description:
            "添えるコンテキストの id または名前(image-gen の管理画面で登録したもの)",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["prompt", params.prompt];
      pushIfSet(args, "--context", params.context);
      return {
        content: [{ type: "text", text: await runCli(pi, ctx, signal, args) }],
        details: undefined,
      };
    },
  });

  pi.registerTool({
    name: "generate_image",
    label: "Generate Image",
    description:
      "image-gen で画像を 1 枚生成し、ギャラリー(data/app.db と data/images)に保存する。結果は JSON で返る。",
    promptSnippet:
      "Generate one image with image-gen and save it to the local gallery",
    promptGuidelines: [
      "Use generate_image when the user asks to create an image with this repository's pipeline; set cleanse: true to refine the prompt with the local LLM first.",
      "Use generate_image instead of calling npm run gen manually.",
    ],
    parameters: Type.Object({
      prompt: Type.String({ description: "画像の説明(プロンプト)" }),
      cleanse: Type.Optional(
        Type.Boolean({
          description:
            "true なら生成前にローカルLLMでプロンプトを書き直す(既定は false)",
        }),
      ),
      context: Type.Optional(
        Type.String({
          description:
            "cleanse 時に添えるコンテキストの id または名前(cleanse: true のときだけ意味を持つ)",
        }),
      ),
      model: Type.Optional(
        Type.String({
          description:
            "モデルカタログの id(既定は mflux。gpt-image-1 系も選べる)",
        }),
      ),
      size: Type.Optional(
        Type.String({
          description:
            "サイズ(既定は 1024x1024。mflux なら 2048x2048 などの大判も可)",
        }),
      ),
      quality: Type.Optional(
        Type.String({
          description: "品質(auto / low / medium / high。既定は auto)",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const args = ["image", params.prompt];
      if (params.cleanse) {
        args.push("--cleanse");
      }
      pushIfSet(args, "--context", params.context);
      pushIfSet(args, "--model", params.model);
      pushIfSet(args, "--size", params.size);
      pushIfSet(args, "--quality", params.quality);
      return {
        content: [{ type: "text", text: await runCli(pi, ctx, signal, args) }],
        details: undefined,
      };
    },
  });
}
