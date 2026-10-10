## Configuration

This is the right column. `content/en/split-demo/config.json` defines this layout:

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

### Registering a translated article

The title, fixed ID and tags are managed in `content/articles.json`.

```json
{
    "id": "split-demo",
    "title": "分割記事サンプル",
    "file": "split-demo/config.json",
    "translations": {
        "en": {
            "title": "Split article demo",
            "file": "en/split-demo/config.json"
        }
    },
    "tags": ["Guide", "サンプル"]
}
```

Both versions use the same URL: `?page=split-demo`.
