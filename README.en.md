# Wiki Kit Mini

[日本語](README.md) | **English**

A lightweight wiki for small personal projects, written in Markdown.

> You want a wiki, without the overhead of a large wiki system.

Create articles as Markdown files, without a database or an administration panel.
Publish the files on a static host, or run the included Go server locally.

> This project is in early development. Features and formats may change.

## Demo

[Try the live demo](https://tamatengudaka-hue.github.io/Wiki-Kit-Mini/).

## Features

- Markdown articles, with no database or build step
- Wiki links, heading links and red links for missing articles
- Full-text search with snippets, result counts and keyboard navigation
- Tags and article lists
- Automatic table of contents, with an active-heading indicator
- Related links, backlinks and external links
- Images with captions
- Syntax highlighting and code copying
- Desktop navigation/content/contents layout and mobile menus
- Optional split articles: up to five Markdown files with one or two columns per row
- Stable article IDs, title aliases and compatible legacy URLs
- Automatic, light and dark color themes
- Japanese and English UI, with optional article translations
- Page-specific descriptions, Open Graph metadata and canonical URLs
- Custom home and missing-article pages
- A small Go HTTP server

## Quick start

With Go installed, run this from the repository root:

```bash
go run server.go
```

Open `http://127.0.0.1:8080` in your browser. The server listens on localhost only.

The wiki also works on GitHub Pages, Cloudflare Pages, Nginx, Apache and other static hosts.
No build command is needed: publish the project files as they are.
Subdirectory deployments such as GitHub Pages project sites are supported.
Use HTTP hosting rather than opening `index.html` through `file://`.

Python and Playwright are used only for optional browser regression tests. Neither is needed to run the wiki.

## Directory structure

```text
.
├── index.html
├── config.json
├── server.go
├── README.md
├── README.en.md
├── content/
│   ├── articles.json
│   ├── welcome.md
│   ├── split-demo/
│   └── en/
│       ├── welcome.md
│       └── split-demo/
├── src/
│   ├── main.js
│   ├── i18n.js
│   ├── metadata.js
│   ├── theme.js
│   └── style.css
├── system/
│   ├── not-found.md
│   └── en/not-found.md
├── vendor/
├── tests/
└── THIRD_PARTY_LICENSES/
```

## Create an article

Create a file such as `content/docker.md`:

```md
# Docker

Notes about Docker.

## Overview

A platform for running applications in containers.
```

Add an entry to the array in `content/articles.json`:

```json
{
    "id": "docker",
    "title": "Docker",
    "file": "docker.md",
    "tags": ["Containers", "Infrastructure"]
}
```

`title` is the displayed article name. `file` is a path relative to `content/`.
They do not have to match. For example, a title of “Developer community” can use `community.md`.
Tags are chosen by the author and are used in article labels, tag lists and search.

`id` is optional, but recommended for stable URLs. Existing entries without IDs continue to work.

## Split articles

Open the supplied “Split article demo” from Welcome or the article list to see the layout in action.
Its Japanese files are in `content/split-demo/`, and its English files are in `content/en/split-demo/`.

A split article is a directory containing Markdown files and a `config.json`:

```text
content/proxmox/
├── config.json
├── intro.md
├── features.md
├── specs.md
└── links.md
```

Register its configuration in `content/articles.json`:

```json
{
    "id": "proxmox",
    "title": "Proxmox VE",
    "file": "proxmox/config.json",
    "tags": ["Virtualization"]
}
```

The split configuration defines the rows:

```json
{
    "rows": [
        ["intro.md"],
        ["features.md", "specs.md"],
        ["links.md"]
    ]
}
```

- One file in a row spans the full width. Two files are displayed side by side.
- Rows follow configuration order; files within a row follow left-to-right order.
- At widths of 900px or less, columns stack automatically.
- An article can use at most five files, and each row must contain one or two files.
- Empty layouts and repeated file entries are rejected.
- Markdown paths are relative to the split configuration directory. Subdirectories are supported.
- Absolute paths, external URLs, `..`, encoded paths, query strings and fragments are not allowed in the configuration.
- In split Markdown, relative images and links resolve from the Markdown file's location.
  Query links such as `?page=welcome` and heading links such as `#Overview` stay relative to the article URL.
  Single-file articles retain their original site-relative path behavior.

The registered title is displayed above the layout. Use `##` and `###` for section headings.
Headings from all parts share one table of contents, with unique IDs.
Search, tags, wiki links and related links treat all parts as one article.
Each file is rendered and sanitized independently, so Markdown constructs cannot span file boundaries.

Invalid configurations and missing files produce an error instead of a partial article.
Other broken articles do not prevent a valid article from being displayed.
Search reports unavailable articles and excludes them from its results.

## Wiki links and stable URLs

Use wiki links inside ordinary Markdown:

```text
[[Docker]]
[[Docker|About Docker]]
[[Docker#Overview]]
[[Docker#Overview|Docker overview]]
```

Missing articles appear as red links. Wiki syntax inside inline code and fenced code blocks is not converted.

A fixed ID keeps an article's URL stable when its title changes:

```json
{
    "id": "docker",
    "title": "Introduction to Docker",
    "aliases": ["Docker"],
    "file": "docker.md",
    "tags": ["Containers"]
}
```

The article URL is `?page=docker`. Generated article, tag, search and related links use the ID.
Legacy title and alias URLs still open the article and are replaced with the ID URL, preserving the heading fragment.

IDs start with a lowercase letter or digit and may contain lowercase letters, digits, hyphens and underscores.
Do not change a published ID if you want its URLs to remain stable.
Add old titles to `aliases` to keep old title-based links working.
IDs, titles and aliases must not identify different articles; `all` is reserved for the article list.

Wiki links may use an ID, current title, translated title or alias. An ID link displays the current article title unless an explicit label is supplied:

```text
[[docker]]
[[docker#Overview]]
[[docker|Container basics]]
```

Heading IDs are based on heading text. Renaming or translating a heading may change its anchor.

## Markdown, images and code

Standard Markdown supports headings, emphasis, lists, quotes, links and inline code.

```md
**Bold**
*Italic*
- List item
> Quote
[External link](https://example.com)
`Inline code`
```

Images use standard Markdown syntax. Nonempty alt text becomes a caption:

```md
![Description](./content/images/example.png)
![](./content/images/example.png)
```

HTTPS images are also supported. Wide images fit within the article; wide tables scroll independently.

Fenced code blocks support highlight.js language names, including Go, JavaScript, TypeScript, Python, JSON, YAML, SQL and Bash.
Long code lines scroll horizontally. The copy button stays fixed and copies the entire block.

## Search, tags and navigation

Search covers current-language article titles, IDs, aliases, tags and Markdown contents.
If an article has no translation for the chosen language, search uses its original version.
The index is loaded on demand and cached in the browser for the current language.

Search displays snippets, result counts and a message when nothing matches.

- Up/Down selects a result and wraps at the ends.
- Enter opens the selected result, or the first result when nothing is selected.
- Escape closes results without clearing the query.
- Tab or a click outside the search field closes results.
- Focus, click or an arrow key can reopen results for the current query.
- Enter during IME composition does not navigate.

Click a tag to open its article list, for example `?tag=Guide`.
Article tags are author-provided and are not automatically translated.

The navigation panel includes Home, All articles, tags, article/tag counts and a Language selector.
On mobile, open it with the menu button. The Contents button opens the heading list.
Selecting a heading closes the contents panel and scrolls below the fixed header.

Related links group outgoing wiki links, incoming backlinks and external URLs, removing duplicates.
When there are many links, wiki and external links are shown in separate groups.

## Site configuration

Edit the root `config.json`:

```json
{
    "name": "My Wiki",
    "home": "auto",
    "language": "en",
    "notFound": "./system/not-found.md",
    "notFoundTranslations": {
        "en": "./system/en/not-found.md"
    }
}
```

- `name`: the site name used in the header and page titles.
- `home`: `auto` shows an overview for zero or multiple articles and opens the only article when there is one.
  You can also use an article ID, title or alias.
- `language`: the initial language, `ja` or `en`. Missing or unsupported values fall back to Japanese.
  A visitor's previously saved language takes priority. Browser language is not used to choose the default.
- `notFound`: the Markdown template for articles that do not exist.
- `notFoundTranslations`: optional language-specific missing-article templates. When absent, the original template is used.

Visitors can switch language from the navigation menu. The interface and article are updated without changing the article URL.
The choice is saved in localStorage when available. If storage is blocked, switching still works for the current page.
Site names, author tags and untranslated article contents remain as written.

The theme button cycles through Auto, Light and Dark. Auto follows the OS/browser color scheme.
An explicit selection overrides the OS preference and is saved in the browser.

## Article translations

Translations are optional. Add an entry under `translations` for each version you provide:

```json
{
    "id": "docker",
    "title": "Docker入門",
    "file": "docker.md",
    "translations": {
        "en": {
            "title": "Introduction to Docker",
            "file": "en/docker.md"
        }
    },
    "tags": ["Containers"]
}
```

The translation's `file` is required; its `title` is optional and defaults to the original title.
Paths are relative to `content/`. A split translation can point to its own directory/config.json.
The five-file and two-column limits apply to every language version.

If no translation is declared for the selected language, the original article is displayed.
A declared translation that fails to load produces an error, rather than silently hiding the problem.
The same article ID is used in every language, and translated titles are recognized by wiki links.
Search uses the selected version of each article; tags remain article-level metadata.
No automatic translation service or API key is required.

The supplied Welcome and split demo both have English translations.

## Page metadata

JavaScript updates the page title, description, Open Graph title/description/site name/type/URL/locale,
X (Twitter) summary-card title/description, and canonical URL for the current home, article, article list or tag page.
Missing-article and error views update their metadata as well.

Descriptions are generated from the rendered contents and limited to 160 Unicode code points.
Headings, fenced code, copy buttons, tags and related links are excluded.
Split articles use all their parts, and language changes update descriptions from the translated contents.
Canonical URLs use stable article IDs and omit heading fragments and unrelated query parameters.
Repeated updates do not create duplicate tags.

These updates happen after JavaScript runs in the browser.
Social crawlers that do not execute JavaScript receive the initial metadata in `index.html`.
Reliable per-article social cards require static HTML generation or server-rendered metadata separately.

## Custom missing-article pages

Edit `system/not-found.md`, or the template selected for the current language:

```md
# {{title}}

The article “{{title}}” has not been created yet.

[Back to all articles](?page=all)
```

`{{title}}` is inserted as text, so names from the URL are not executed as HTML.
Use query-relative links for compatibility with subdirectory hosting.

## Browser regression tests

With Python Playwright and Chromium available, start the Go server from the repository root and run:

```bash
python3 tests/split_articles.py
python3 tests/ui_regressions.py
python3 tests/code_blocks.py
python3 tests/themes.py
python3 tests/navigation_search.py
python3 tests/languages.py
python3 tests/metadata.py
```

The default Chromium executable is `/usr/bin/chromium`; override it with `CHROMIUM_PATH` if needed.
Tests use local browser request fixtures where appropriate and do not rewrite article files.
These are development tools, not runtime dependencies.

## Security and scope

Marked parses Markdown, DOMPurify sanitizes the resulting HTML, and wiki links are created with DOM APIs.
This project is intended for small personal wikis, technical notes, hobby projects and small shared documentation sites.
It is not designed for unrestricted public editing, user management, permission systems or revision history.
For large collections or a multi-user editing platform, consider a larger wiki system.

## Dependencies and license

Marked, highlight.js and DOMPurify are vendored in `vendor/`, so normal use does not require an external CDN.
Their licenses are included in `THIRD_PARTY_LICENSES/`.

Wiki Kit Mini is licensed under the MIT License. See [LICENSE](LICENSE).

Copyright © 2026 tamatengudaka-hue.

## Status

Early development. Behavior and formats may change as the project evolves.
