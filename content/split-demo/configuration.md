## 設定ファイル

ここは2列のうち、右側のMarkdownです。
`content/split-demo/config.json` に、次の設定を記述しています。

```json
{
    "rows": [
        ["intro.md"],
        ["layout.md", "configuration.md"],
        ["tips.md"],
        ["links.md"]
    ]
}
```

### 記事一覧への登録

タイトルとタグは、通常の記事と同じように `content/articles.json` で管理します。

```json
{
    "id": "split-demo",
    "title": "分割記事サンプル",
    "file": "split-demo/config.json",
    "tags": ["Guide", "サンプル"]
}
```

`id` を変えなければ、記事のタイトルを変えても `?page=split-demo` で開けます。
