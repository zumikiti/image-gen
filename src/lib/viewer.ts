/**
 * ビューアの移動と初期表示の決めごと。
 * 画面から切り離した純関数にして、端の扱いをテストで守る。
 */

/**
 * 送り先の index。両端で止まる(巡回せぬ)。
 * 一覧が空のときは開く先が無いので -1 を返す。
 */
export function stepIndex(
  current: number,
  length: number,
  delta: number,
): number {
  if (length <= 0) return -1;
  return Math.min(Math.max(current + delta, 0), length - 1);
}

/** 一覧から id の位置を探す。見つからねば -1 */
export function indexOfImage(
  images: readonly { id: string }[],
  id: string,
): number {
  return images.findIndex((image) => image.id === id);
}

/**
 * URL の ?image= を、初期表示に使える id へ正す。
 * 一覧に無い id(削除済み・別端末で消えた等)は開かずに null を返し、
 * 呼び出し側が URL を掃除する。
 */
export function resolveInitialImageId(
  param: string | string[] | undefined,
  images: readonly { id: string }[],
): string | null {
  const id = Array.isArray(param) ? param[0] : param;
  if (!id) return null;
  return indexOfImage(images, id) >= 0 ? id : null;
}
