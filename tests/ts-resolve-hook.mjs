/**
 * テストと CLI(src/cli.mts)共用の ESM 解決フック。
 *
 * アプリのソースは bundler 前提で `./types` のように拡張子を省いて import しており、
 * Node の ESM 解決では引けぬ。テストのためだけにソースの書き方を変えるより、
 * 相対指定かつ拡張子なしのときだけ `.ts` を補う小さなフックを挟む。
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const isRelative =
      specifier.startsWith("./") || specifier.startsWith("../");
    const hasExtension = /\.[a-z0-9]+$/i.test(specifier);

    if (isRelative && !hasExtension) {
      return nextResolve(`${specifier}.ts`, context);
    }

    throw error;
  }
}
