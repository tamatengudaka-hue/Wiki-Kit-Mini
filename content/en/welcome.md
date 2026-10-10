# Welcome to Wiki Kit Mini

Wiki Kit Mini is a lightweight personal wiki built with Markdown. No database or build step is required.

Try [[split-demo|the split article demo]] to see how several Markdown files can form one article.

## Add an article

Create a Markdown file inside `content/`, then register it in `content/articles.json`.

For example, create `content/docker.md`:

```md
# Docker

Notes about Docker.

## Overview

A platform for running applications in containers.
```

Register the article:

```json
{
    "id": "docker",
    "title": "Docker",
    "file": "docker.md",
    "tags": ["Containers", "Infrastructure"]
}
```

The title and filename do not have to match. Tags are chosen by the author.

## Wiki links

Use an article's fixed ID or title to link to it. IDs keep links stable when titles change.

```text
[[docker]]
[[docker|About Docker]]
[[docker#Overview]]
[[docker#Overview|Docker overview]]
```

Links to articles that do not exist are shown in red. Wiki syntax inside code blocks and inline code stays unchanged.

## Headings and contents

Level-two and level-three headings create an automatic table of contents.
On mobile, use the Contents button. Repeated headings receive unique IDs.

```md
## Overview
### Details
## Usage
```

## Tags

Click an article's tags to view other articles with the same tag.
Tags also appear in the sidebar and are included in search.

## Search

Search the titles, IDs, aliases, tags and contents of articles in the current display language.
Untranslated articles use their original contents.

Use Up and Down to select a result, Enter to open it, and Escape to close the results without clearing your query.
Search shows the number of matches or a message when no articles match.

## Related links

Related links collect outgoing wiki links, backlinks from other articles, and external links.
Repeated links are listed once. Split articles are treated as one article.

## Images

Use ordinary Markdown images. An image's alt text becomes its caption.

```md
![Image description](./content/images/example.png)
![](./content/images/example.png)
```

In split articles, relative image and link paths are resolved from each Markdown file's directory.
In single-file articles, relative paths keep the original site-relative behavior.

## Code

Code blocks support syntax highlighting and copying.
Long lines scroll horizontally while the copy button stays in place.

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, Wiki Kit Mini!")
}
```

## Stable article URLs

Set an `id` in `articles.json` to keep an article's URL unchanged when its title changes.
Add old titles to `aliases` to preserve title-based links.

```json
{
    "id": "docker",
    "title": "Introduction to Docker",
    "aliases": ["Docker"],
    "file": "docker.md"
}
```

The article remains available at `?page=docker`.

## Markdown basics

```md
**Bold**
*Italic*
- List item
> Quote
[External link](https://example.com)
`Inline code`
```

Rendered Markdown is sanitized before it is displayed.

## Site settings

The root `config.json` controls the site name, home page and initial UI language.

```json
{
    "name": "My Wiki",
    "home": "auto",
    "language": "en",
    "notFound": "./system/not-found.md"
}
```

With `home` set to `auto`, a single article becomes the home page; multiple articles show an overview.
You can also set `home` to a specific article ID or title.

Use the theme button to switch between Auto, Light and Dark. The Language setting in the navigation menu switches between English and Japanese. Your choices are saved in your browser when storage is available.

## Article translations

Translations are optional. Add their file and title to an article's `translations` object.
The article's ID and URL stay the same in every language.

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
    }
}
```

## Missing articles

Missing articles use the configured Markdown template. `{{title}}` inserts the requested name as safe text.
A language-specific template can be configured with `notFoundTranslations`.

## Start writing

Edit the supplied articles or create your own. Use a single Markdown file for ordinary articles, and [[split-demo]] when you need a more flexible layout.
