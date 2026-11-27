# image-gen

OpenAI の画像生成 API、または手元の Mac で動かす **mflux**（OpenAI 互換サーバー）で画像を 1 枚ずつ生成し、ローカルに貯めて一覧で眺める個人用ツールである。できた画像 1 枚を種に、LAN の Mac mini で動く ComfyUI の **MiniMax H3** で短い動画も作れる。localhost で単一ユーザーが使う前提で作ってある。

## できること

- プロンプトから画像を 1 枚生成（既定のモデルはローカルの mflux）
- 生成結果を SQLite と PNG ファイルに保存し、ギャラリーに新しい順で並べる
- カードから**プロンプトの再利用**、モーダルで**全文表示・コピー・削除**
- 画像に任意の**タイトル**を付けて、あとからモーダル・HTTP API・CLI で登録・変更・解除
- pixiv へ上げるための**投稿下書き**（題名・タグ・キャプション）を作り、画像と文面をクリップボードへ載せる
- ギャラリーを**あいまい検索**で絞り込み（表記ゆれを吸収し、タイトルとプロンプトを対象に空白区切りで AND）
- 「ローカルLLMでプロンプトを調整」で、プロンプトを画像生成向けに書き直してから生成（添えるコンテキストは管理画面 `/admin` で設定・保存・再利用できる）
- モデル・サイズ・品質はカタログで宣言する（追加は定義 1 つ。用語は [CONTEXT.md](./CONTEXT.md) を参照）
- 画像 1 枚を種に、ComfyUI の **MiniMax H3** で 5 秒ほどの**動画**を作り、専用の一覧（`/videos`）で待ち・完成・失敗を眺める
- 画面を開かずに、CLI または pi のツールから同じ調整・生成を実行できる

## 必要環境

- Node.js **20.9 以上**（Next.js 16 の要件）
- `better-sqlite3` が動く環境（主要プラットフォームは prebuilt で入る）

## セットアップ

```bash
npm install
cp .env.example .env   # 値を埋める
```

`.env` の項目:

| 変数                 | 用途                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY`     | OpenAI 系モデルの生成に必要                                                                |
| `MFLUX_BASE_URL`     | ローカル mflux の OpenAI 互換端点（例: `http://<Mac の LAN IP>:8420/v1`）                  |
| `MFLUX_MODEL`        | サーバー側のモデル名。起動中の `/health` の `model.name` と一致させる                      |
| `LOCAL_LLM_BASE_URL` | プロンプト調整に使うローカルLLMの OpenAI 互換端点（既定は `http://192.168.68.56:8888/v1`） |
| `LOCAL_LLM_MODEL`    | プロンプト調整に使うモデル名（既定は `gemma-4-31b-it-4bit`）                               |
| `LOCAL_LLM_API_KEY`  | プロンプト調整の認証キー（未設定なら環境変数 `OXLM_API_KEY` を共用）                       |

`MFLUX_MODEL` は省略可に見えるが、**実質必須**である。未設定だとカタログ ID `mflux` をそのまま送るため、モデル名を検証するサーバーでは 400 になる。

## プロンプト調整とコンテキスト設定

生成フォームの「ローカルLLMでプロンプトを調整してから生成」にチェックを入れると、入力をローカルLLM（既定は `192.168.68.56:8888` の OpenAI 互換サーバー。この VM で pi が使うのと同じもの）で画像生成向けに書き直してから生成する。実際に画像生成へ渡った文面はギャラリーに記録される。

調整に添える**コンテキスト**（AGENTS.md / SKILL.md 的なベース文面）は管理画面 `/admin` で一覧・新規・編集・削除でき、`data/app.db` の `context_templates` テーブルに保存される。生成フォームの「コンテキスト」で選択したものを調整時に添える（「なし」も選べる）。

## pixiv への投稿（pixiv 投稿の下ごしらえ）

pixiv には**投稿用の公式 API が無い**。ゆえにこのアプリは投稿そのものを行わず、人が pixiv の画面で投稿する前提で「下ごしらえ」だけを担う。X への投稿も pixiv の投稿画面から同時に行えるため、このアプリは X の API を持たぬ。

1. ギャラリーで画像を開き、「pixiv 投稿の下ごしらえ」の「ローカルLLMで作成」を押す
2. 題名（pixiv は 32 文字まで）・タグ（10 個まで）・キャプションの叩き台が入る。その場で直せる
3. 各欄の「コピー」で文面を控え、「画像をコピーして pixiv の投稿画面を開く」を押す
4. 開いた投稿画面で `Ctrl+V` で画像を貼り、文面を貼り、**AI 生成作品のフラグを立てて**投稿する

- 画像のクリップボード書き込みは Chromium 系のみ対応である。Firefox などでは画像を保存し、投稿画面へドラッグすること
- 題名は既存の Title（100 文字まで）とは別物で、pixiv 用に 32 文字へ切り詰めて渡す

## ローカル生成（mflux）

mflux 本体にはサーバーが無い。LAN の Mac で **OpenAI 互換の HTTP サーバー**を起こし、その URL を `MFLUX_BASE_URL` に指す。以下は [mfluxible](https://github.com/wesbiggs/mfluxible) を使う例である。

```bash
pip install 'mfluxible==0.9.3'

MFLUXIBLE_MODEL=z-image-turbo \
MFLUXIBLE_QUANTIZE=4 \
mfluxible-server --host 0.0.0.0 --port 8420
```

- `--host` を省くと `127.0.0.1` にしか縛られぬ。LAN の他端末から使うなら `0.0.0.0` を明示する
- 起動後に `curl http://<host>:8420/health` で `model.name` を確かめ、`.env` の `MFLUX_MODEL` を合わせる
- 初回起動は重みの取得と量子化で長い。大判（2048 系）は RAM と時間を食い、アプリ側は 20 分で打ち切る
- 品質（`quality`）は mflux の互換端点では無視される（OpenAI 系では有効）

## 動画生成（MiniMax H3 / ComfyUI）

画像を 1 枚選び、ComfyUI の **MiniMax H3**（ImageToVideo）で 5 秒ほどの動画にする。一覧は `/videos` で、画像モーダルの「動かす」からも入れる。

- ComfyUI は LAN の Mac mini（既定 `http://192.168.68.56:8188`）で動いておる前提じゃ。`.env` の `H3_BASE_URL` で差し替える
- 最初のコマは **Gallery の画像だけ**から選ぶ。送った画像は ComfyUI の `input/` に残る（消す口が無いため掃除せぬ）
- 出力の `filename_prefix` は `video/<動画ID>` にするゆえ、ComfyUI 側の `output/` でも見分けられる
- **1 本およそ 30 分**。同梱の `h3/skeleton.json` は 640×640・0.4MP・8 steps（turbo）で測った設定じゃ。尺を伸ばせば更にかかる
- 投入は待たずに返る。一覧を開いておる間だけ 15 秒ごとに ComfyUI へ問い、完成した mp4 を `data/videos/<id>.mp4` に写す。ゆえに**誰も一覧を開かぬ間は回収されぬ**（ComfyUI の `output/` と history を消さなければ、後から開いたときに回収できる）
- 投入の直前に **oMLX（ローカルLLM）のモデルを解放**し、メモリを ComfyUI に譲る。LLM が載ったままだと尺の長い生成が OOM で落ちるゆえじゃ。解放の鍵は `LOCAL_LLM_API_KEY` か `OXLM_API_KEY` を使い回す
- 待ちは取り消せる。実行中のものを止めるときは、いま流れておる生成すべてが止まる（ComfyUI の `interrupt` じゃ）
- 尺は 17k+5 フレームに丸まる（5 秒 → 124 フレーム = 5.17 秒）。画面には丸めた実尺を出す
- 動画の生成は HTTP API では受け付けぬ。CLI も未対応じゃ（必要になったら `src/lib/videos.ts` に載せるだけで済む）

### skeleton を取り直す

ComfyUI の UI で workflow を変えたら（ノードを足した、モデルを替えた）、`h3/skeleton.json` を取り直す。API 形式のグラフは `/history` から取れる。

```bash
curl -s 'http://192.168.68.56:8188/history?max_items=1' \
  | python3 -c 'import sys,json;print(json.dumps(list(json.load(sys.stdin).values())[-1]["prompt"][2], indent=1, ensure_ascii=False))' \
  > h3/skeleton.json
```

テンプレートは**不動**じゃ。前回ジョブのプロンプトや最初のコマを引き継がぬよう、投入のたびに上書きする。書き換えはノード ID ではなく `class_type` で探すゆえ、UI でノードを足し引きしても追従する（欠けておれば 30 分を無駄にせぬよう投入前に弾く）。

> MiniMax H3 の重みは MiniMax H3 Community License じゃ。生成物を商用に使うには Comfy の商用ライセンスが要る。

## 起動

```bash
# 開発
npm run dev

# 本番
npm run build
npm start -- -H 0.0.0.0 -p 3000
```

`next dev` は既定で `0.0.0.0` に待つが、**LAN の IP で開くには** `next.config.ts` の `allowedDevOrigins` にそのホストを足す必要がある（Next.js 16 は開発中のクロスオリジン要求を遮断するため）。本番（`next start`）では不要である。

## CLI・API から使う

画面を開かずに、プロンプト調整と画像生成を実行できる。結果はギャラリーと同じ `data/` に貯まるので、実行後にギャラリーを再読み込みすれば並ぶ。

### CLI

`.env` を読むため、リポジトリ直下で実行する。

```bash
npm run gen -- contexts
npm run gen -- prompt "赤い船" --context <id または名前>
npm run gen -- image "赤い船" --cleanse --context <id または名前> \
  --title "夕暮れの港" --model mflux --size 1024x1024 --quality auto
npm run gen -- title <id> "夕暮れの港"
npm run gen -- title <id> --clear
```

| コマンド   | すること                      | 出力                                                                    |
| ---------- | ----------------------------- | ----------------------------------------------------------------------- |
| `contexts` | 登録済みコンテキストの一覧    | `[{ id, name, content, createdAt }]`                                    |
| `prompt`   | ローカルLLMでプロンプトを調整 | `{ prompt }`（画像は生成しない）                                        |
| `image`    | 調整（任意）と画像生成・保存  | `{ id, title, prompt, model, size, quality, createdAt, file, apiPath }` |
| `title`    | 保存済み画像のタイトルを変更  | `{ id, title }`（`--clear` で解除すると `title` は `null`）             |

`image` のオプション:

| オプション                  | 意味                                                      | 既定                 |
| --------------------------- | --------------------------------------------------------- | -------------------- |
| `--cleanse`                 | 生成前にローカルLLMでプロンプトを書き直す                 | 無し（そのまま生成） |
| `--context <id または名前>` | 調整に添えるコンテキスト                                  | 無し                 |
| `--title "<タイトル>"`      | 生成時に付けるタイトル（100 文字まで）                    | 無し（未設定）       |
| `--model <id>`              | モデルカタログの id                                       | `mflux`              |
| `--size <サイズ>`           | 画像サイズ                                                | `1024x1024`          |
| `--quality <品質>`          | `auto` / `low` / `medium` / `high`（OpenAI 系でのみ有効） | `auto`               |

サイズはモデルごとの宣言に従う。OpenAI 系は `1024x1024` / `1536x1024` / `1024x1536`、`mflux` はこれに大判（`2048x2048` / `2304x1536` / `1536x2304`）も選べる。範囲外を指定すると CLI がエラーで止まる。

結果は JSON を stdout、進捗やエラーを stderr に出す。失敗時は終了コード 1（使い方の誤りは 2）。

### pi のツール

このリポジトリで pi を起動すると `.pi/extensions/image-gen.ts` が読み込まれ、同じ処理がツールとして使える。

| ツール            | 引数                                                                      | すること                       |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------ |
| `cleanse_prompt`  | `prompt`, `context?`                                                      | プロンプトだけ調整する         |
| `generate_image`  | `prompt`, `cleanse?`, `context?`, `model?`, `size?`, `quality?`, `title?` | 生成してギャラリーに保存する   |
| `set_image_title` | `id`, `title`                                                             | 保存済み画像のタイトルを変える |

### HTTP API

サーバーが公開する API は保存済み画像の配信とタイトルの更新のみで、生成は受け付けない。

| メソッド | パス               | 内容                                                                                |
| -------- | ------------------ | ----------------------------------------------------------------------------------- |
| `GET`    | `/api/images/<id>` | `data/images/<id>.png` を `image/png` で返す。無ければ 404                          |
| `GET`    | `/api/videos/<id>` | `data/videos/<id>.mp4` を `video/mp4` で返す。`Range` に応じる（206）。無ければ 404 |
| `PATCH`  | `/api/videos/<id>` | `{"title": "..."}` でタイトルを登録・変更。`null` か空文字で解除。422/404           |

```bash
curl -X PATCH http://localhost:3000/api/images/<id> \
  -H 'Content-Type: application/json' -d '{"title": "夕暮れの港"}'
```

タイトルは前後の空白を落として改行を空白に畳み、100 文字を超えると 422 で弾く。生成時のサイズ指定は API ではできず、CLI の `--size` か pi ツールの `size` で行う。`id` は `[A-Za-z0-9-]` のみ受け付ける。認証は無いので、信頼できる LAN に留めること。

## データ

- `data/app.db`（SQLite）と `data/images/<id>.png`、`data/videos/<id>.mp4` に保存する。いずれも `.gitignore` 済みである
- 動画の mp4 は ComfyUI の `output/` にも残る。こちらで消しても向こうは消えぬ（逆も同じ）
- バックアップするならこの `data/` ごと控えること。消せば失われる

## 心得

- 認証は無い。信頼できる LAN に留め、外部へ晒さぬこと
- 開発の作法は [AGENTS.md](./AGENTS.md)、語彙は [CONTEXT.md](./CONTEXT.md) にある
- `npm run lint` で静的検査
