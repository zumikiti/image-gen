/**
 * 動画プロンプトの雛形。
 *
 * MiniMax H3 は型が固い。アンカー行を欠けば最初のコマが活きず、`<d>` の
 * 書き方を崩せば音声が壊れる。壊れたことに気づくのは 30 分後じゃ。
 * ゆえに「穴を埋める」形の雛形を用意し、人がそれを土台にする。
 * ローカル LLM の調整は補助に留める(型を守るのはこの雛形の役目じゃ)。
 */
export const H3_PROMPT_TEMPLATE = `For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.

integrated_multimodal_description: [Shot 1] Live-action, cinematic, 〈画の調子〉. 〈<Picture 1> の人物・物がどこにいて、何をしておるか〉. 〈最初のコマの構図・人物・衣装を保つ旨〉. 〈動き: 何をし、どう反応するか〉. The girl (S1) with a bright, high, slightly breathless voice says: <d>[Japanese] 〈台詞〉</d>. Static Shot, 〈カメラを動かすなら「種類＋振幅＋速度」を自然文で〉.

overall_soundscape: 〈環境音・物理音・非言語音を 1〜4 文〉

non_diegetic_music: 〈楽器・テンポ・強弱を 1〜3 文。無ければ N/A〉`;
