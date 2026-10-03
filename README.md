# Wiki Kit Mini

Markdownで手軽に作れる、小規模な個人Wiki向けの軽量Wikiソフトウェアです。

> Wikiは欲しい。  
> でも大規模なWikiシステムまではいらない。

データベースや管理画面を使わず、Markdownファイルを置くだけでWikiを作れます。

静的ホスティングでそのまま公開することも、付属のGoサーバーでローカルから起動することもできます。

> [!NOTE]
> 現在は開発初期版です。  
> 今後、仕様変更や破壊的変更が行われる可能性があります。

## Demo

GitHub Pagesで実際に動作しているWiki Kit Miniを試せます。

[Live Demo](https://tamatengudaka-hue.github.io/Wiki-Kit-Mini/)

---

## Features

- Markdownベースの記事
- データベース不要
- ビルド不要
- Wikiリンク
- 見出しへのWikiリンク
- 未作成記事の赤リンク
- 全文検索
- 検索結果の本文プレビュー
- タグ
- タグ別記事一覧
- 記事一覧
- 自動目次
- 現在位置に追従する目次
- 関連リンク
- 被リンク
- 外部リンク一覧
- Markdown画像
- 画像キャプション
- コードハイライト
- コードコピー
- PC向け3カラムレイアウト
- モバイル対応
- カスタムHome
- カスタム未作成記事ページ
- Go製の簡易Webサーバー

---

## Quick Start

### Goを使う

Goがインストールされている場合は、プロジェクトのルートで実行します。

```bash
go run server.go
```

起動後、ブラウザから以下を開きます。

```text
http://127.0.0.1:8080
```

Goサーバーはデフォルトでlocalhostのみ待ち受けます。

### 静的ホスティングを使う

このWikiはビルド不要なので、プロジェクトをそのまま静的ホスティングへ配置できます。

例:

- GitHub Pages
- Cloudflare Pages
- Nginx
- Apache
- その他の静的Webサーバー

GitHub Pagesのプロジェクトサイトなど、サブディレクトリ配下への配置にも対応しています。

`file://` から直接 `index.html` を開くのではなく、HTTPサーバー経由で利用してください。


---

## Directory

```text
.
├─ index.html
├─ config.json
├─ server.go
├─ LICENSE
├─ README.md
│
├─ content/
│  ├─ articles.json
│  ├─ images/
│  └─ *.md
│
├─ src/
│  ├─ main.js
│  └─ style.css
│
├─ system/
│  └─ not-found.md
│
├─ vendor/
│  ├─ marked.esm.js
│  ├─ highlight.min.js
│  └─ purify.es.mjs
│
└─ THIRD_PARTY_LICENSES/
   ├─ marked.txt
   ├─ highlight.js.txt
   └─ dompurify.txt
```

---

## 記事を作る

### 1. Markdownを作成

`content/` にMarkdownファイルを追加します。

例:

```text
content/docker.md
```

```md
# Docker

Dockerについてのメモ。

## 概要

コンテナを利用するためのプラットフォームです。
```

### 2. articles.json に登録

`content/articles.json` に記事を追加します。

```json
[
    {
        "title": "Docker",
        "file": "docker.md",
        "tags": ["コンテナ", "インフラ"]
    }
]
```

#### title

Wiki上で表示される記事名です。

#### file

`content/` 内にあるMarkdownファイル名です。

`title` と `file` は同じ名前である必要はありません。

```json
{
    "title": "夕焼けの宣伝茶亭",
    "file": "chatei.md",
    "tags": ["Discord"]
}
```

#### tags

記事に付けるタグです。

```json
"tags": [
    "Discord",
    "Bot",
    "インフラ"
]
```

タグは記事上部に表示され、検索やタグ別記事一覧にも利用されます。

---

## Wiki Links

通常のMarkdownリンクに加えて、Wiki形式のリンクを利用できます。

### 通常リンク

```md
[[Docker]]
```

### 表示名を変更

```md
[[Docker|Dockerについて]]
```

### 見出しへリンク

```md
[[Docker#概要]]
```

### 見出し + 表示名

```md
[[Docker#概要|Dockerの概要を見る]]
```

存在しない記事へのWikiリンクは赤色で表示されます。

コードブロックやインラインコード内に書かれたWiki記法は変換されません。

例:

```text
[[これはWikiリンクになりません]]
```

---

## Markdown

基本的なMarkdown記法を利用できます。

```md
# 見出し1

## 見出し2

### 見出し3

**太字**

*斜体*

- リスト
- リスト

> 引用

[リンク](https://example.com)
```

Markdownの解析には Marked を使用しています。

---

## Images

通常のMarkdown画像を利用できます。

```md
![画像の説明](./content/images/example.png)
```

HTTPS上の画像も使用できます。

```md
![外部画像](https://example.com/image.png)
```

画像にaltテキストが設定されている場合、その内容がキャプションとして表示されます。

キャプションが不要な場合:

```md
![](./content/images/example.png)
```

---

## Code Blocks

コードブロックでは構文ハイライトが利用できます。

````md
```go
package main

import "fmt"

func main() {
    fmt.Println("Hello Wiki")
}
```
````

コードブロックにはコピーボタンも表示されます。

構文ハイライトには highlight.js を使用しています。

---

## Search

ヘッダーの検索欄から記事を検索できます。

検索対象:

- 記事タイトル
- Markdown本文
- タグ

初回検索時に記事を読み込み、その後はブラウザ内のキャッシュを利用します。

検索結果には、一致した本文周辺のプレビューも表示されます。

---

## Tags

記事に設定したタグはクリックできます。

例:

```text
/?tag=Discord
```

タグページでは、そのタグが設定されている記事だけが一覧表示されます。

---

## Related Links

記事下部には、記事内のリンク情報から関連リンクが自動生成されます。

```text
→ このページから別の記事へのリンク
← 別の記事からこのページへのリンク
↗ 外部サイトへのリンク
```

同じリンクが複数回登場する場合は1件にまとめられます。

リンク数が少ない場合はまとめて表示され、多い場合はWikiリンクと外部リンクに分けて表示されます。

---

## Table of Contents

記事内の `h2` / `h3` から目次が自動生成されます。

PCでは右側に表示され、スクロール位置に応じて現在の見出しが強調されます。

同じ名前の見出しが複数ある場合:

```text
#その他
#その他-2
#その他-3
```

のように自動で区別されます。

モバイルでは目次ボタンから開くことができます。

---

## Configuration

Wiki全体の設定は `config.json` で行います。

```json
{
    "name": "My Wiki",
    "home": "auto",
    "notFound": "./system/not-found.md"
}
```

### name

Wiki名です。

```json
"name": "My Wiki"
```

ヘッダーやページタイトルなどに使用されます。

### home

トップページを設定します。

```json
"home": "auto"
```

`auto` の場合:

- 記事が0件 → 標準Home
- 記事が1件 → その記事を直接表示
- 記事が複数 → 標準Home

特定の記事をHomeにすることもできます。

```json
"home": "ホーム"
```

この場合、`articles.json` に登録されている「ホーム」という記事がトップページとして表示されます。

### notFound

存在しない記事を開いたときに使用するMarkdownです。

```json
"notFound": "./system/not-found.md"
```

---

## Custom Not Found Page

`system/not-found.md` を編集することで、未作成記事の表示を変更できます。

```md
# {{title}}

「{{title}}」という記事はまだ作成されていません。

[記事一覧へ戻る](?page=all)
```

`{{title}}` にはアクセスされた記事名が入ります。

URL由来の記事名はHTMLとして実行されず、テキストとして安全に挿入されます。

---

## Sidebar

PCでは左側にナビゲーションが表示されます。

表示内容:

- ホーム
- 記事一覧
- タグ一覧
- 記事数
- タグ数

モバイルではメニューボタンから開くことができます。

---

## Security

MarkdownのHTML出力はDOMPurifyでサニタイズしています。

Wikiリンクの生成もHTML文字列として挿入せず、DOM APIを使用しています。

ただし、このプロジェクトは現在 **小規模な個人Wiki** を主な用途として設計しています。

不特定多数のユーザーが自由に記事を投稿・編集するWikiシステムとしての利用は想定していません。

---

## Project Scope

このプロジェクトは、大規模なWikiシステムを目指していません。

想定用途:

- 個人メモ
- 技術メモ
- 趣味のWiki
- 創作設定
- 小規模なドキュメント
- 身内向けWiki

以下のような用途には、他のWikiソフトウェアを推奨します。

- 数百〜数千以上の記事
- 複数人によるWeb上からの編集
- ユーザー管理
- 詳細な権限管理
- 編集履歴
- 大規模な全文検索
- 高度な管理画面

---

## Dependencies

このプロジェクトでは以下のライブラリを使用しています。

- Marked
- highlight.js
- DOMPurify

依存ファイルは `vendor/` に含まれているため、通常の利用で外部CDNへの接続は必要ありません。

各ライブラリのライセンスについては、

```text
THIRD_PARTY_LICENSES/
```

を参照してください。

---

## License

This project is licensed under the MIT License.

```text
Copyright (c) 2026 tamatengudaka-hue
```

See `LICENSE` for details.

Third-party libraries are distributed under their respective licenses.

See `THIRD_PARTY_LICENSES/` for details.

---

## Status

現在は初期開発版です。

動作確認を行いながら開発していますが、今後仕様変更や破壊的変更が入る可能性があります。