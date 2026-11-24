/**
 * タイトル(Title)の正規化と検証。
 * フォーム・HTTP API ・CLI のどの入口から来ても同じ形に整えるため、ここへ一本化する。
 */

/** タイトルの上限(コードポイント数)。カードの 1 行に収まる長さに抑える */
export const MAX_TITLE_LENGTH = 100;

/** 正規化の結果。空になったタイトルは null(未設定)で表す */
export type TitleInput =
  { ok: true; title: string | null } | { ok: false; error: string };

/**
 * 入力されたタイトルを保存できる形へ整える。
 * 改行などの連続空白は 1 つの半角空白に畳み(単一行)、前後の空白を落とす。
 * 空になったら null を返す(「未設定」と「空文字」を区別せぬため)。
 * 上限を超えたものは黙って切らずに弾く。切ると入れた側が気づけぬからのう。
 */
export function normalizeTitle(raw: string): TitleInput {
  const title = raw.replace(/\s+/g, " ").trim();
  if (title === "") {
    return { ok: true, title: null };
  }
  // 絵文字などを 2 文字と数えぬよう、コードポイントで数える
  if ([...title].length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `タイトルは ${MAX_TITLE_LENGTH} 文字以内にしてください`,
    };
  }
  return { ok: true, title };
}
