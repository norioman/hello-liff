# hello-liff — LIFF来店ポイント デモ

LINE LIFF + Google Apps Script + Googleスプレッドシートで、店舗の来店ポイントカード機能を試作したデモ。
社内テスト用途で、ユーザーがLINEログインして「来店チェックイン」ボタンを押すと、ポイントが加算されシートに記録される。

## URL

| 用途 | URL |
|---|---|
| デモページ（直接） | https://norioman.github.io/hello-liff/ |
| LIFF URL（QR・LINE内ブラウザ向け） | https://liff.line.me/2009931254-QLYpvjDp |
| GitHubリポジトリ | https://github.com/norioman/hello-liff |
| GASエンドポイント | https://script.google.com/macros/s/AKfycbw5j6Ep7HJYq-1T3zd8s2Ybf59Ke4pKEHj4t1mhuN1F4h7cNwH55Tbm57x2O24vO3OROw/exec |

## 構成

```
[ユーザーのスマホ]
   │ LINEログイン
   ▼
[GitHub Pages: index.html]    ← 静的ホスティング
   │ POST (text/plain JSON)
   ▼
[Google Apps Script Web App]  ← APIサーバー
   │ 読み書き
   ▼
[Google スプレッドシート]      ← 会員DB兼ログ
```

- **フロント**: 静的HTML + LIFF SDK v2
- **バックエンド**: Google Apps Script ウェブアプリ
- **DB**: Googleスプレッドシート (`visits` シート)

## ディレクトリ

```
hello-liff/
├── index.html       # LIFFログイン + ポイントカードUI
├── gas/
│   └── Code.gs      # GAS用バックエンドコード
└── README.md
```

## 機能

- LIFF SDKでログイン → プロフィール (displayName / userId / avatar) 取得
- 来店チェックインボタン → +1pt 加算
- 同日2回目以降は加算せず「本日チェックイン済み」表示
- 累計ポイント / 来店回数 / 最終来店日時を表示
- 通常ブラウザでもLINE内ブラウザでも動作（`isInClient` で判別可）
- 開発者向けセクション: 環境情報・デコード済みIDトークン・アクセストークンを表示

## プライバシー対応

| 項目 | 状態 |
|---|---|
| 画面のuserId表示 | マスク (`U1234…abcd`) |
| スプレッドシートのuserId | マスク (`U1234…abcd`) |
| displayName | そのまま記録（社内テストのため） |
| LIFF ID | ソースコードに埋め込み（公開してOKな情報） |

## スプレッドシートのスキーマ

| userId (masked) | displayName | points | lastVisitAt | visitCount |
|---|---|---|---|---|
| U1234…abcd | 山田太郎 | 12 | 2026-04-29 13:42:00 | 12 |

## セットアップ手順（ゼロから再現する場合）

### 1. LINE Developers
1. [LINE Developers Console](https://developers.line.biz/) でプロバイダー作成
2. LINEログインチャネル作成 → LIFFタブで新規LIFFアプリ作成
   - Endpoint URL: `https://<ユーザー名>.github.io/<リポジトリ名>/`
   - Scope: `profile`, `openid`
3. 発行された **LIFF ID** を控える

### 2. リポジトリ作成 & GitHub Pages公開
```bash
git init -b main
git add index.html
git commit -m "Initial commit"
gh repo create hello-liff --public --source=. --remote=origin --push
gh api -X POST /repos/<ユーザー名>/hello-liff/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
```

`index.html` 内の `DEFAULT_LIFF_ID` を発行されたLIFF IDに書き換える。

### 3. Google Apps Script デプロイ
1. Googleスプレッドシートを新規作成
2. **拡張機能 → Apps Script** で開く
3. `gas/Code.gs` の内容を全コピペして保存
4. **デプロイ → 新しいデプロイ → ウェブアプリ**
   - 実行: 自分
   - アクセス: 全員
5. デプロイ後のウェブアプリURLを取得
6. `index.html` の `POINT_API_URL` に貼り付けてpush

### コード更新時の再デプロイ手順
**保存だけでは反映されない。** 以下が必須:
1. Apps Scriptで保存
2. **デプロイ → デプロイを管理 → ✏️ → バージョン: 新しいバージョン → デプロイ**

`doGet` で動作中の `version` 値を確認できるようにしてある。

## 本番運用に向けての検討事項

- **QRコード配布**: LIFF URL (`https://liff.line.me/<LIFF_ID>`) をQRに埋め込めば、LINE未インストールでもログイン可能・インストール済みなら内蔵ブラウザでシームレス
- **顧客データ扱い**: 社内テスト範囲なら本名OKだが、一般公開時はdisplayNameもマスクorハッシュ化を検討
- **idTokenのサーバー検証**: 現在はクライアントから送られた userId をそのまま信用している。本番では LINE の verify API (`https://api.line.me/oauth2/v2.1/verify`) でidTokenを検証してuserIdを確定すべき
- **不正対策**: 1日1チェックインの制限はサーバー側にあるが、店舗で押されたかは確認不可。位置情報チェック・店内QR動的生成・店員確認などの仕組みが必要
- **データベース**: スプレッドシートはデモには最適だが、レコード数が増えると遅くなる。本格運用では Firestore / Supabase / RDB への移行を検討

## ハマりどころメモ

- **GAS Web App は保存だけでは反映されない** — 必ず「デプロイを管理 → 新しいバージョン」で再デプロイ
- **CORS** — GASにJSON POSTすると preflight で失敗する。`Content-Type: text/plain` で送って GAS 側で `JSON.parse(e.postData.contents)` する回避策を採用
- **`getRange(2, 1, 0, 1)` がエラー** — シートにヘッダーしかないとき `numRows=0` で失敗するので、`lastRow < 2` チェックで早期return
- **userIdマスクと識別の両立** — 同じ入力に対して同じマスクを返す決定的関数なら、マスク後の値をキーとして findRow できる（衝突リスクは小規模デモでは無視可能）
