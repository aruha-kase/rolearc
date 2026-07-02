# RoleArc

TRPG配信向けのシーン管理・演出ツール。GM（管理者）がシーン・キャラクター・プロップ・BGM/SE・各種演出をリアルタイムに操作し、OBS経由で配信できます。

制作: **伽世アルハ (Aruha Kase)**

- **スタック:** Vite + React + TypeScript + Supabase（DB / 認証 / Realtime）+ Cloudflare R2（メディア保管）+ Vercel（ホスティング）

## 主な機能

- 1920×1080 のズーム・パン可能なキャンバス盤面（メイン＋サブの2画面対応）
- シーン管理（背景・エフェクト・アンビエント・BGM連動）
- キャラクター／セットオブジェクト／プロップの配置・表示制御・表情切り替え
- BGM / SE 再生（フェード・シーン連動）
- 画面演出（画面揺れ・フラッシュ・テキスト表示・カウントダウン・バウンス・白黒化 など）
- LSM（Live Scenario Master）: シナリオを読みながら盤面をボタン操作できる専用エディタ（`/lsm`）
- OBS出力ページ（`/obs/:roomId?obs=main` / `?obs=sub`）とPLビュー（`/view/:token`）

---

## かんたん導入（推奨）

RoleArc は**あなた自身のアカウント**で動かす「セルフホスト型」です。サーバー代はかかりません（各サービスの無料枠で開始できます）。

導入には3つのサービスのアカウントが必要です:

| サービス | 用途 | 無料枠 |
|---|---|---|
| [Supabase](https://supabase.com/) | データベース・認証・同期 | あり |
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | 画像・動画・音声の保管 | あり |
| [Vercel](https://vercel.com/) | アプリの公開 | あり |

### 🤖 導入が不安な方へ — AIアシスタントにサポートしてもらえます

セットアップ（特に Cloudflare R2）は少し手順が多いです。**ChatGPT などのAIに下記のファイルを渡すと、対話形式で導入を手伝ってくれます。**

→ [`docs/SETUP_ASSISTANT_PROMPT.md`](docs/SETUP_ASSISTANT_PROMPT.md) の中身をコピーして、ChatGPT等に貼り付けてください。

### ワンクリックでデプロイ

Supabase と R2 の準備ができたら、下のボタンから Vercel にデプロイできます（環境変数を入力する画面が出ます）:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/aruha-kase/rolearc&env=VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY,VITE_R2_PUBLIC_URL,R2_ACCOUNT_ID,R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY,R2_BUCKET_NAME)

---

## 手動セットアップ

### 1. リポジトリを取得して依存をインストール

```sh
git clone https://github.com/aruha-kase/rolearc.git
cd rolearc
npm install
```

### 2. Supabase を準備

1. Supabase でプロジェクトを新規作成
2. ダッシュボードの **SQL Editor** で [`supabase/combined_schema.sql`](supabase/combined_schema.sql) を実行（全テーブル・RLS・Realtime設定が一括で作成されます）
3. **Project Settings → API** から `URL` と `anon public key` を控える

### 3. Cloudflare R2 を準備

1. R2 でバケットを作成（例: `rolearc-assets`）
2. バケットを公開設定にし、公開URL（`https://pub-xxxx.r2.dev` 等）を控える
3. **R2 API トークン**を作成し、Account ID / Access Key ID / Secret Access Key を控える
4. CORS を設定し、デプロイ先ドメイン（Vercel の URL）からの `PUT` / `GET` を許可する

> R2の手順が難しい場合は、上記の [🤖 AIアシスタント用プロンプト](docs/SETUP_ASSISTANT_PROMPT.md) を活用してください。

### 4. 環境変数を設定

[`.env.example`](.env.example) をコピーして `.env` を作成し、各値を埋めます。

```sh
cp .env.example .env
```

| 変数 | 種別 | 説明 |
|---|---|---|
| `VITE_SUPABASE_URL` | クライアント | Supabase プロジェクト URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | クライアント | Supabase anon public key |
| `VITE_R2_PUBLIC_URL` | クライアント＋サーバー | R2 バケットの公開URL（※下記注意） |
| `R2_ACCOUNT_ID` | サーバー | Cloudflare アカウントID |
| `R2_ACCESS_KEY_ID` | サーバー | R2 アクセスキーID |
| `R2_SECRET_ACCESS_KEY` | サーバー | R2 シークレットアクセスキー |
| `R2_BUCKET_NAME` | サーバー | R2 バケット名 |

> **注意:** `VITE_R2_PUBLIC_URL` はクライアント（ブラウザ表示）とサーバーレスAPI（署名付きURL発行）の両方で参照されます。Vercel にデプロイする際は、この変数を含めすべての環境変数をプロジェクト設定に登録してください。`R2_*` のシークレットはサーバー側のみで使われ、クライアントには露出しません。

### 5. ローカルで起動

```sh
npm run dev
```

> R2 への署名付きURL発行は `api/` 配下の Vercel サーバーレス関数で動作します。ローカルでアップロード機能まで確認したい場合は `vercel dev` の利用を検討してください（フロントの表示のみなら `npm run dev` で確認できます）。

## デプロイ（Vercel・手動の場合）

1. このリポジトリを Vercel にインポート
2. 上記の環境変数をすべて Vercel のプロジェクト設定に登録
3. デプロイ（ビルドコマンド `npm run build` / 出力 `dist` は自動検出）

SPA ルーティングと `/lsm` の振り分けは [`vercel.json`](vercel.json) で設定済みです。

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run preview` | ビルド成果物のプレビュー |
| `npm run test` | テスト実行（Vitest） |
| `npm run lint` | Lint 実行 |

## ライセンス

[MIT License](LICENSE) © 2026 Aruha Kase
