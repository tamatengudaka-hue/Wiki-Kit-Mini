# Wiki Kit Miniへようこそ

Wiki Kit Miniは、Markdownで手軽に使える小規模な個人Wikiです。

このページでは、記事の追加方法やWiki独自の機能を簡単に紹介します。

複数のMarkdownを組み合わせた表示は、[[分割記事サンプル]]で試せます。

## 記事を追加する

記事は `content/` ディレクトリにMarkdownファイルとして保存します。

例えば、

```text
content/docker.md
```

を作成します。

内容は普通のMarkdownです。

```md
# Docker

Dockerについてのメモ。

## 概要

ここに本文を書きます。
```

Markdownファイルを作成したら、`content/articles.json` に記事を登録します。

```json
{
    "title": "Docker",
    "file": "docker.md",
    "tags": ["コンテナ", "インフラ"]
}
```

`title` はWiki上の記事名、`file` はMarkdownファイル名です。

## Wikiリンク

Wiki内の記事へリンクする場合は、`[[記事名]]` を使用できます。

```text
[[Docker]]
```

表示名を変更することもできます。

```text
[[Docker|Dockerについて]]
```

記事内の見出しへ直接リンクすることもできます。

```text
[[Docker#概要]]
```

表示名と組み合わせる場合:

```text
[[Docker#概要|Dockerの概要を見る]]
```

存在しない記事へのWikiリンクは赤色で表示されます。

## 見出しと目次

記事内の `##` と `###` は、自動的に目次へ追加されます。

```md
## 概要

### 詳細

## 使用方法
```

PCでは画面右側に目次が表示され、現在読んでいる位置が強調されます。

同じ名前の見出しが複数ある場合は、自動的に番号が追加されます。

```text
#その他
#その他-2
#その他-3
```

## タグ

記事のタグは `articles.json` で設定します。

```json
{
    "title": "Docker",
    "file": "docker.md",
    "tags": ["Docker", "インフラ"]
}
```

タグは記事上部に表示されます。

タグをクリックすると、同じタグを持つ記事を一覧表示できます。

タグは検索対象にも含まれます。

## 検索

画面上部の検索欄からWiki内を検索できます。

検索対象は記事タイトル、本文、タグです。

検索結果には、該当した本文の一部と結果件数を表示します。
結果がない場合もメッセージで確認できます。

上下の矢印キーで候補を選び、Enterで記事を開けます。
Escapeで入力文字列を残したまま結果を閉じ、矢印キーで再び表示できます。
日本語入力の変換・確定中のEnterでは記事に移動しません。

## 関連リンク

記事内のリンクは自動的に集計され、記事下部の「関連リンク」に表示されます。

```text
→ このページから別の記事へのリンク
← 別の記事からこのページへのリンク
↗ 外部サイトへのリンク
```

同じリンクが複数回書かれていても、関連リンクでは1件にまとめられます。

## 画像

通常のMarkdown画像を使用できます。

```md
![画像の説明](./content/images/example.png)
```

画像は `content/images/` に保存すると管理しやすくなります。

HTTPS上の画像も利用できます。

```md
![外部画像](https://example.com/image.png)
```

画像の説明はキャプションとして表示されます。

キャプションが不要な場合は、説明を空にできます。

```md
![](./content/images/example.png)
```

## コード

Markdownのコードブロックを使用できます。

言語を指定すると構文がハイライトされます。

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, Wiki Kit Mini!")
}
```

コードブロックにはコピーボタンも表示されます。

Go以外にもJavaScript、TypeScript、Python、JSON、YAML、SQL、Bashなど、highlight.jsが対応する言語を利用できます。

## タイトルを変えても使えるURL

`articles.json` に固定の `id` を指定すると、記事のタイトルを変えてもURLを維持できます。
このWelcome記事のIDは `welcome`、分割記事サンプルのIDは `split-demo` です。

```json
{
    "id": "docker",
    "title": "Docker入門",
    "aliases": ["Docker"],
    "file": "docker.md",
    "tags": ["コンテナ"]
}
```

この例の記事は `?page=docker` で開けます。旧タイトルを `aliases` に残すと、以前のタイトル指定URLも使えます。
Wikiリンクにも `[[docker]]` のようにIDを指定できます。

## 通常のMarkdown

Wiki独自機能以外は、基本的に普通のMarkdownとして書けます。

```md
**太字**

*斜体*

- リスト
- リスト

> 引用

[外部リンク](https://example.com)

`インラインコード`
```

## Wikiの設定

Wiki全体の設定は `config.json` で変更できます。

```json
{
    "name": "My Wiki",
    "home": "auto",
    "notFound": "./system/not-found.md"
}
```

`name` はWiki名です。

`home` を `auto` にすると、記事数に応じてトップページが自動的に決まります。

特定の記事をトップページにする場合は、その記事名を指定できます。

```json
{
    "name": "My Wiki",
    "home": "ホーム",
    "notFound": "./system/not-found.md"
}
```

## 未作成の記事

存在しないWikiリンクを開いた場合は、未作成記事ページが表示されます。

表示内容は、

```text
system/not-found.md
```

から変更できます。

`{{title}}` を書くと、アクセスされた記事名が表示されます。

```md
# {{title}}

「{{title}}」という記事はまだ作成されていません。
```

## はじめよう

この `welcome.md` を編集して自分の記事にしても、削除して新しい記事から始めても構いません。

Wiki Kit Miniは、小規模な個人Wikiとしてシンプルに使うことを目的にしています。

好きなことをMarkdownに書いて、自分だけのWikiを作ってみてください。
