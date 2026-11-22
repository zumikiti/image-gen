# image-gen

OpenAI の画像生成 API、または手元の Mac で動かす **mflux**（OpenAI 互換サーバー）で画像を 1 枚ずつ生成し、ローカルに貯めて一覧で眺める個人用ツールである。localhost で単一ユーザーが使う前提で作ってある。

## できること

- プロンプトから画像を 1 枚生成（既定のモデルはローカルの mflux）
- 生成結果を SQLite と PNG ファイルに保存し、ギャラリーに新しい順で並べる
- カードから**プロンプトの再利用**、モーダルで**全文表示・コピー・削除**
- 「ローカルLLMでプロンプトを調整」で、プロンプトを画像生成向けに書き直してから生成（添えるコンテキストは管理画面 `/admin` で設定・保存・再利用できる）
- モデル・サイズ・品質はカタログで宣言する（追加は定義 1 つ。用語は [CONTEXT.md](./CONTEXT.md) を参照）

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

## 起動

```bash
# 開発
npm run dev

# 本番
npm run build
npm start -- -H 0.0.0.0 -p 3000
```

`next dev` は既定で `0.0.0.0` に待つが、**LAN の IP で開くには** `next.config.ts` の `allowedDevOrigins` にそのホストを足す必要がある（Next.js 16 は開発中のクロスオリジン要求を遮断するため）。本番（`next start`）では不要である。

## データ

- `data/app.db`（SQLite）と `data/images/<id>.png` に保存する。どちらも `.gitignore` 済みである
- バックアップするならこの `data/` ごと控えること。消せば失われる

## 心得

- 認証は無い。信頼できる LAN に留め、外部へ晒さぬこと
- 開発の作法は [AGENTS.md](./AGENTS.md)、語彙は [CONTEXT.md](./CONTEXT.md) にある
- `npm run lint` で静的検査
