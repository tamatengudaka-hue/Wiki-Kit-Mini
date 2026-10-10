import { summarizeArticle, updateMetadata } from "./metadata.js";
import { t, initializeLanguage, localizeArticles, language } from "./i18n.js";
import { marked } from "../vendor/marked.esm.js";
import hljs from "../vendor/highlight.min.js";
import DOMPurify from "../vendor/purify.es.mjs";


// DOM・状態

const article = document.getElementById("article");
const wikiName = document.getElementById("wiki-name");

const search = document.getElementById("search");
const searchResults = document.getElementById("search-results");

const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarTags = document.getElementById("sidebar-tags");
const articleCount = document.getElementById("article-count");
const tagCount = document.getElementById("tag-count");

const tocPanel = document.getElementById("toc-panel");
const tocToggle = document.getElementById("toc-toggle");

const mobileBackdrop = document.getElementById("mobile-backdrop");

// 折り返しや画面幅に応じて、見出しを固定ヘッダーの下にスクロールする。
const siteHeader = document.querySelector(".site-header");
const headerObserver = new ResizeObserver(() => {
    document.documentElement.style.setProperty(
        "--header-height", `${siteHeader.getBoundingClientRect().height}px`
    );
});
headerObserver.observe(siteHeader);

let articleEntries = [];
let renderVersion = 0;
let searchIndex = null;
let activeSearchResult = -1;
let searchRequestId = 0;
let tocScrollHandler = null;

// 目次を非表示にする関数

function hideTableOfContents() {
    if (tocScrollHandler) {
        window.removeEventListener(
            "scroll",
            tocScrollHandler
        );

        tocScrollHandler = null;
    }

    tocPanel.innerHTML = "";
    tocPanel.hidden = true;
    tocToggle.hidden = true;

    tocPanel.classList.remove("open");
}

// Markdownレンダリング

function renderMarkdown(markdown) {
    const html = marked.parse(markdown);
    return DOMPurify.sanitize(html, {
        USE_PROFILES: {
            html: true
        }
    });
}

// URL

const params = new URLSearchParams(location.search);
const page = params.get("page");
const tag = params.get("tag");


function getHashTarget() {
    if (!location.hash) {
        return null;
    }

    const hash = location.hash.slice(1);

    try {
        return decodeURIComponent(hash);
    } catch {
        return null;
    }
}

// 内部リンクのURLを作成する関数

function createInternalUrl({
    page = null,
    tag = null,
    heading = null
} = {}) {
    const url = new URL(location.href);

    // 現在の ?page=... や ?tag=...、#見出しを引き継がない
    url.search = "";
    url.hash = "";

    if (page) {
        const target = page === "all" ? null : findArticle(articleEntries, page);
        url.searchParams.set("page", target?.id ?? target?.urlKey ?? page);
    }

    if (tag) {
        url.searchParams.set("tag", tag);
    }

    if (heading) {
        url.hash = encodeURIComponent(heading);
    }

    return url.href;
}

// 表示内容から、各ページのhead情報を更新する。
function updatePageMetadata(title, config, type = "website") {
    const params = new URLSearchParams(location.search);
    const currentPage = params.get("page");
    const url = createInternalUrl(currentPage
        ? { page: currentPage }
        : params.has("tag") ? { tag: params.get("tag") } : {});
    updateMetadata({
        title,
        siteName: config.name,
        description: summarizeArticle(article) || title,
        url,
        type
    });
}

// 設定・記事一覧

async function loadConfig() {
    const response = await fetch("./config.json");

    if (!response.ok) {
        throw new Error(t("設定ファイルの読み込みに失敗しました"));
    }

    return await response.json();
}

async function loadArticleList() {
    const response = await fetch("./content/articles.json");

    if (!response.ok) {
        throw new Error(t("記事一覧の読み込みに失敗しました"));
    }

    const articles = await response.json();
    validateArticleList(articles);
    return articles;
}

function findArticle(articles, reference) {
    return articles.find(item => item.id === reference)
        ?? articles.find(item => item.title === reference || item.sourceTitle === reference || item.aliases?.includes(reference));
}

function validateArticleList(articles) {
    if (!Array.isArray(articles)) throw new Error(t("記事一覧は配列にしてください"));
    const references = new Map();
    for (const item of articles) {
        if (!item || typeof item.title !== "string" || !item.title.trim()
            || typeof item.file !== "string" || !item.file) {
            throw new Error(t("記事には空でない title と file が必要です"));
        }
        if (item.id !== undefined && (typeof item.id !== "string"
            || !/^[a-z0-9][a-z0-9_-]*$/.test(item.id))) {
            throw new Error(t("{title}: id は小文字の英数字・ハイフン・アンダースコアで指定してください", {title: item.title}));
        }
        if (item.aliases !== undefined && (!Array.isArray(item.aliases)
            || item.aliases.some(alias => typeof alias !== "string" || !alias.trim()))) {
            throw new Error(t("{title}: aliases は空でない文字列の配列にしてください", {title: item.title}));
        }
        if (item.translations !== undefined && (!item.translations || typeof item.translations !== "object"
            || Array.isArray(item.translations))) {
            throw new Error(t("{title}: translations は言語ごとの設定オブジェクトにしてください", {title: item.title}));
        }
        const translatedTitles = [];
        for (const translation of Object.values(item.translations ?? {})) {
            if (!translation || typeof translation !== "object" || Array.isArray(translation)
                || typeof translation.file !== "string" || !translation.file
                || (translation.title !== undefined && (typeof translation.title !== "string" || !translation.title.trim()))) {
                throw new Error(t("{title}: 翻訳には file と任意の空でない title を指定してください", {title: item.title}));
            }
            if (translation.title) translatedTitles.push(translation.title);
        }
        for (const reference of [item.title, item.id, ...(item.aliases ?? []), ...translatedTitles].filter(value => value !== undefined)) {
            if (reference === "all") throw new Error(t("{title}: all は記事一覧用の予約名です", {title: item.title}));
            if (references.has(reference) && references.get(reference) !== item) {
                throw new Error(t("記事のID・タイトル・別名が重複しています: {reference}", {reference: reference}));
            }
            references.set(reference, item);
        }
    }
}

// 記事の取得を表示・検索・関連リンクで共有する。
const articleLoads = new Map();

function contentUrl(path, base = new URL("./content/", location.href)) {
    if (typeof path !== "string" || !path || path.trim() !== path
        || /[\\:%?#]/.test(path)
        || path.startsWith("/")
        || path.split("/").some(part => !part || part === "." || part === "..")) {
        throw new Error(t("記事のファイルパスが不正です: {path}", {path: path}));
    }
    return new URL(path.split("/").map(encodeURIComponent).join("/"), base);
}

async function fetchArticleFile(url) {
    let response;
    try {
        response = await fetch(url);
    } catch {
        throw new Error(t("{file} の読み込みに失敗しました（通信エラー）", {file: decodeURIComponent(url.pathname)}));
    }
    if (!response.ok) {
        throw new Error(t("{file} の読み込みに失敗しました（HTTP {status}）", {file: decodeURIComponent(url.pathname), status: response.status}));
    }
    return response.text();
}

function loadArticleData(item) {
    if (!articleLoads.has(item.file)) {
        const promise = (async () => {
            const url = contentUrl(item.file);
            if (url.pathname.endsWith(".md")) {
                return { split: false, rows: [[{ markdown: await fetchArticleFile(url), url }]] };
            }
            if (!url.pathname.endsWith("/config.json")) {
                throw new Error(t("記事は .md またはディレクトリ内の config.json を指定してください"));
            }
            let layout;
            const text = await fetchArticleFile(url);
            try {
                layout = JSON.parse(text);
            } catch {
                throw new Error(t("{file}: JSONの形式が不正です", {file: item.file}));
            }
            if (!layout || !Array.isArray(layout.rows) || !layout.rows.length
                || layout.rows.some(row => !Array.isArray(row) || row.length < 1 || row.length > 2)) {
                throw new Error(t("{file}: rows は1〜2ファイルの行を並べた空でない配列にしてください", {file: item.file}));
            }
            const files = layout.rows.flat();
            if (files.length > 5) {
                throw new Error(t("{file}: 分割記事は最大5ファイルです", {file: item.file}));
            }
            const urls = files.map(file => {
                const partUrl = contentUrl(file, new URL("./", url));
                if (!partUrl.pathname.endsWith(".md")) {
                    throw new Error(t("{file}: Markdown（.md）のみ指定できます", {file: item.file}));
                }
                return partUrl;
            });
            if (new Set(urls.map(url => url.href)).size !== urls.length) {
                throw new Error(t("{file}: 同じMarkdownファイルを重複して指定できません", {file: item.file}));
            }
            const parts = await Promise.all(urls.map(async url => ({
                url, markdown: await fetchArticleFile(url)
            })));
            let offset = 0;
            return { split: true, rows: layout.rows.map(row => {
                const result = parts.slice(offset, offset + row.length);
                offset += row.length;
                return result;
            }) };
        })();
        articleLoads.set(item.file, promise);
        promise.catch(() => articleLoads.delete(item.file));
    }
    return articleLoads.get(item.file);
}

function createPartRoot(part, articles, split) {
    const root = document.createElement("div");
    root.innerHTML = renderMarkdown(part.markdown);
    if (split) {
        for (const element of root.querySelectorAll("a[href], img[src]")) {
            const attribute = element.tagName === "IMG" ? "src" : "href";
            const value = element.getAttribute(attribute);
            // Wikiのクエリリンクと見出しリンクは記事URLを基準にする。
            if (value && !/^(?:[a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(value)) {
                element.setAttribute(attribute, new URL(value, part.url).href);
            }
        }
    }
    createWikiLinks(root, articles);
    return root;
}

function createIndexedRoot(item, articles) {
    const root = document.createElement("div");
    for (const part of item.parts) {
        root.appendChild(createPartRoot(part, articles, item.split));
    }
    return root;
}

async function buildSearchIndex(articles) {
    if (searchIndex) return searchIndex;
    searchIndex = Promise.all(articles.map(async item => {
        try {
            const data = await loadArticleData(item);
            const parts = data.rows.flat();
            return { ...item, split: data.split, parts,
                content: parts.map(part => part.markdown).join("\n\n"), tags: item.tags ?? [] };
        } catch (error) {
            return { ...item, parts: [], content: "", tags: item.tags ?? [], error: error.message };
        }
    }));
    return searchIndex;
}


// Wikiリンク

function createWikiLinks(root, articles) {
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const parent = node.parentElement;

                if (!parent) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (
                    parent.closest(
                        "code, pre, a, script, style"
                    )
                ) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (!node.nodeValue.includes("[[")) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const nodes = [];

    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }

    const pattern = /\[\[([^\]]+)\]\]/g;

    for (const node of nodes) {
        const text = node.nodeValue;
        const fragment = document.createDocumentFragment();

        let lastIndex = 0;
        let found = false;

        for (const match of text.matchAll(pattern)) {
            found = true;

            fragment.append(
                text.slice(lastIndex, match.index)
            );

            const content = match[1];

            const [target, displayName] =
                content.split("|", 2);

            const hashIndex = target.indexOf("#");

            const pageName = (
                hashIndex === -1
                    ? target
                    : target.slice(0, hashIndex)
            ).trim();

            const heading = (
                hashIndex === -1
                    ? ""
                    : target.slice(hashIndex + 1)
            ).trim();

            if (!pageName) {
                fragment.append(match[0]);

                lastIndex =
                    match.index + match[0].length;

                continue;
            }

            const destination = findArticle(articles, pageName);
            const resolvedTitle = destination?.title ?? pageName;
            const label =
                displayName?.trim()
                || (
                    heading
                        ? `${resolvedTitle}#${heading}`
                        : resolvedTitle
                );

            const exists = Boolean(destination);

            const link =
                document.createElement("a");

            link.href = createInternalUrl({
                page: pageName,
                heading
            });
            link.textContent = label;

            // 関連リンク抽出にも使用
            link.classList.add("wiki-link");
            link.dataset.wikiTitle = resolvedTitle;

            if (!exists) {
                link.classList.add(
                    "wiki-link-missing"
                );
            }

            fragment.appendChild(link);

            lastIndex =
                match.index + match[0].length;
        }

        if (!found) {
            continue;
        }

        fragment.append(
            text.slice(lastIndex)
        );

        node.replaceWith(fragment);
    }
}


// 検索

function createSearchSnippet(content, query) {
    const lowerContent = content.toLowerCase();
    const index = lowerContent.indexOf(query);

    if (index === -1) {
        return "";
    }

    const start = Math.max(0, index - 30);
    const end = Math.min(
        content.length,
        index + query.length + 50
    );

    let snippet = content
        .slice(start, end)
        .replace(/\s+/g, " ")
        .trim();

    if (start > 0) {
        snippet = `...${snippet}`;
    }

    if (end < content.length) {
        snippet += "...";
    }

    return snippet;
}

// 検索インデックスの構築

function clearSearchResults() {
    activeSearchResult = -1;
    searchResults.replaceChildren();
    searchResults.hidden = true;
    search.setAttribute("aria-expanded", "false");
    search.removeAttribute("aria-activedescendant");
}

function selectSearchResult(index) {
    const links = [...searchResults.querySelectorAll("a[role=option]")];
    if (!links.length) return;
    activeSearchResult = (index + links.length) % links.length;
    links.forEach((link, position) => {
        link.setAttribute("aria-selected", String(position === activeSearchResult));
    });
    const selected = links[activeSearchResult];
    search.setAttribute("aria-activedescendant", selected.id);
    // ドロップダウンだけをスクロールし、本文の位置を維持する。
    const top = selected.offsetTop;
    const bottom = top + selected.offsetHeight;
    if (top < searchResults.scrollTop) searchResults.scrollTop = top;
    else if (bottom > searchResults.scrollTop + searchResults.clientHeight) {
        searchResults.scrollTop = bottom - searchResults.clientHeight;
    }
}

function setupSearch() {
    let composing = false;
    search.addEventListener("compositionstart", () => {
        composing = true;
        searchRequestId++;
        clearSearchResults();
    });
    search.addEventListener("compositionend", () => {
        composing = false;
        search.dispatchEvent(new Event("input"));
    });
    const reopenSearch = () => {
        if (!composing && searchResults.hidden && search.value.trim()) search.dispatchEvent(new Event("input"));
    };
    search.addEventListener("focus", reopenSearch);
    search.addEventListener("click", reopenSearch);
    search.addEventListener("keydown", async event => {
        if (composing || event.isComposing || event.keyCode === 229) return;
        if (event.key === "Escape") {
            // 検索文字列を消すブラウザの既定動作を抑え、候補だけを閉じる。
            event.preventDefault();
            return;
        }
        if (searchResults.hidden && search.value.trim()
            && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            reopenSearch();
            const requestId = searchRequestId;
            await buildSearchIndex(articleEntries);
            if (requestId !== searchRequestId) return;
        }
        const links = [...searchResults.querySelectorAll("a[role=option]")];
        if (!links.length || searchResults.hidden) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            selectSearchResult(activeSearchResult === -1
                ? (event.key === "ArrowDown" ? 0 : links.length - 1)
                : activeSearchResult + (event.key === "ArrowDown" ? 1 : -1));
        } else if (event.key === "Enter") {
            event.preventDefault();
            links[activeSearchResult === -1 ? 0 : activeSearchResult].click();
        }
    });

    search.addEventListener("input", async event => {
        const requestId = ++searchRequestId;
        const query = search.value.trim().toLowerCase();
        clearSearchResults();
        if (!query || composing || event.isComposing) return;
        const index = await buildSearchIndex(articleEntries);
        if (requestId !== searchRequestId) return;
        clearSearchResults();
        const failures = index.filter(item => item.error);
        if (failures.length) {
            const warning = document.createElement("p");
            warning.textContent = failures.map(item => `${item.title}: ${item.error}`).join(" / ");
            warning.className = "search-warning";
            warning.setAttribute("role", "status");
            searchResults.appendChild(warning);
        }
        const matches = index.filter(item => !item.error && (
            item.title.toLowerCase().includes(query)
            || item.id?.toLowerCase().includes(query)
            || item.aliases?.some(alias => alias.toLowerCase().includes(query))
            || item.content.toLowerCase().includes(query)
            || item.tags.some(tag => tag.toLowerCase().includes(query))
        ));
        const options = document.createElement("div");
        options.id = "search-options";
        options.setAttribute("role", "listbox");
        options.setAttribute("aria-label", t("検索結果"));
        searchResults.appendChild(options);
        const status = document.createElement("p");
        status.className = "search-status";
        status.setAttribute("role", "status");
        status.textContent = matches.length
            ? t("{count}件の記事が見つかりました", {count: matches.length})
            : t("一致する記事が見つかりませんでした");
        searchResults.appendChild(status);
        matches.forEach((item, position) => {
            const link = document.createElement("a");
            link.href = createInternalUrl({ page: item.id ?? item.title });
            link.id = `search-option-${position}`;
            link.setAttribute("role", "option");
            link.setAttribute("aria-selected", "false");
            link.tabIndex = -1;
            link.addEventListener("pointermove", () => selectSearchResult(position));
            const title = document.createElement("strong");
            title.textContent = item.title;
            link.appendChild(title);
            const snippet = createSearchSnippet(item.content, query);
            if (snippet) {
                const description = document.createElement("span");
                description.className = "search-snippet";
                description.textContent = snippet;
                link.appendChild(description);
            }
            options.appendChild(link);
        });
        searchResults.hidden = false;
        searchResults.scrollTop = 0;
        search.setAttribute("aria-expanded", "true");
    });
}


// タグ

function createArticleTags(title, articles) {
    const data = articles.find(
        item => item.title === title
    );

    if (!data?.tags?.length) {
        return;
    }

    const h1 = article.querySelector("h1");

    if (!h1) {
        return;
    }

    const container = document.createElement("div");
    container.className = "article-tags";

    for (const tag of data.tags) {
        const element = document.createElement("a");

        element.className = "article-tag";
        element.href = createInternalUrl({
            tag
        });
        element.textContent = tag;

        container.appendChild(element);
    }

    h1.insertAdjacentElement("afterend", container);
}


// 画像

function createImageCaptions() {
    const images = article.querySelectorAll("img");

    for (const image of images) {
        if (!image.alt) {
            continue;
        }

        const figure = document.createElement("figure");
        figure.className = "article-image";

        const caption = document.createElement("figcaption");
        caption.textContent = image.alt;

        image.replaceWith(figure);

        figure.appendChild(image);
        figure.appendChild(caption);
    }
}


// 横幅の広い表は記事全体ではなく表の中でスクロールする。
function createTableContainers() {
    for (const table of article.querySelectorAll("table")) {
        const container = document.createElement("div");
        container.className = "article-table";
        container.tabIndex = 0;
        container.setAttribute("role", "region");
        container.setAttribute("aria-label", t("表（横にスクロールできます）"));
        table.replaceWith(container);
        container.appendChild(table);
    }
}

// コード

function highlightCode() {
    const blocks = article.querySelectorAll("pre code");

    for (const block of blocks) {
        hljs.highlightElement(block);
    }
}

function createCodeCopyButtons() {
    const blocks = article.querySelectorAll("pre");

    for (const block of blocks) {
        const code = block.querySelector("code");

        if (!code) {
            continue;
        }

        const button = document.createElement("button");

        const version = renderVersion;
        button.className = "code-copy";
        button.type = "button";
        button.textContent = t("コピー");

        button.addEventListener("click", async () => {
            await navigator.clipboard.writeText(
                code.textContent
            );

            if (version !== renderVersion) return;
            button.textContent = t("コピー済み");

            setTimeout(() => {
                button.textContent = t("コピー");
            }, 1500);
        });

        // スクロールする本文とボタンを別要素にして、ボタンを右上に固定する。
        const container = document.createElement("div");
        container.className = "code-block";
        block.replaceWith(container);
        container.append(block, button);
    }
}


// 目次

function createTableOfContents() {
    const headings = [
        ...article.querySelectorAll("h2, h3")
    ];

    hideTableOfContents();

    if (headings.length === 0) {
        return;
    }

    tocPanel.hidden = false;
    tocToggle.hidden = false;

    const title = document.createElement("div");
    title.className = "toc-title";
    title.textContent = t("目次");

    const list = document.createElement("ul");
    const usedIds = new Set(
        [...document.querySelectorAll("[id]")]
            .filter(element => !headings.includes(element))
            .map(element => element.id)
    );

    for (const heading of headings) {
        const baseId = heading.textContent.trim() || "section";
        let id = baseId;
        let count = 1;
        while (usedIds.has(id) || id === "search-options" || /^search-option-\d+$/.test(id)) {
            id = `${baseId}-${++count}`;
        }
        usedIds.add(id);

        heading.id = id;

        const item = document.createElement("li");
        item.className =
            `toc-${heading.tagName.toLowerCase()}`;

        const link = document.createElement("a");

        link.href = `#${encodeURIComponent(id)}`;
        link.textContent = heading.textContent;

        item.appendChild(link);
        list.appendChild(item);
    }

    tocPanel.appendChild(title);
    tocPanel.appendChild(list);

    const links = [
        ...tocPanel.querySelectorAll("a")
    ];

    tocScrollHandler = () => {
        const headerOffset = siteHeader.getBoundingClientRect().bottom + 16;
        let activeIndex = 0;

        // 画面上部を通過した最後の見出しを選択
        headings.forEach((heading, index) => {
            if (
                heading.getBoundingClientRect().top
                <= headerOffset
            ) {
                activeIndex = index;
            }
        });

        // 最下部では最後の見出しを選択
        const atBottom =
            window.scrollY + window.innerHeight
            >= document.documentElement.scrollHeight - 2;

        if (atBottom) {
            activeIndex = headings.length - 1;
        }

        links.forEach((link, index) => {
            link.classList.toggle(
                "active",
                index === activeIndex
            );
        });
    };

    window.addEventListener(
        "scroll",
        tocScrollHandler,
        { passive: true }
    );

    tocScrollHandler();
}


// 関連リンク

async function createLinkInfo(title, articles) {
    const version = renderVersion;
    const index = await buildSearchIndex(articles);

    if (version !== renderVersion) return;
    const current = index.find(
        item => item.title === title
    );

    if (!current) {
        return;
    }

    const links = [];

    const currentRoot = createIndexedRoot(current, articles);

    // この記事から他の記事へのWikiリンク
    const outgoingWikiLinks =
        currentRoot.querySelectorAll(
            "a.wiki-link:not(.wiki-link-missing)"
        );

    for (const element of outgoingWikiLinks) {
        const linkedTitle =
            element.dataset.wikiTitle;

        links.push({
            type: "wiki",
            direction: "out",
            label: linkedTitle,
            href: createInternalUrl({
                page: linkedTitle
            })
        });
    }

    // 外部リンク
    for (
        const element
        of currentRoot.querySelectorAll("a")
    ) {
        const href =
            element.getAttribute("href") ?? "";

        if (element.classList.contains("wiki-link")
            || !/^https?:\/\//i.test(href)
            || new URL(href).origin === location.origin) {
            continue;
        }

        links.push({
            type: "external",
            label:
                element.textContent.trim()
                || href,
            href
        });
    }

    // 他の記事からこの記事へのリンク
    for (const item of index) {
        if (item.title === title) {
            continue;
        }

        const root = createIndexedRoot(item, articles);

        const linksHere = [
            ...root.querySelectorAll(
                "a.wiki-link:not(.wiki-link-missing)"
            )
        ].some(
            link =>
                link.dataset.wikiTitle === title
        );

        if (!linksHere) {
            continue;
        }

        links.push({
            type: "wiki",
            direction: "in",
            label: item.title,
            href: createInternalUrl({
                page: item.title
            })
        });
    }

    const uniqueLinks = links.filter(
        (link, index, array) =>
            index === array.findIndex(item =>
                item.type === link.type
                && item.direction === link.direction
                && item.href === link.href
            )
    );

    if (uniqueLinks.length === 0) {
        return;
    }

    const section =
        document.createElement("section");

    section.className = "article-links";

    const heading =
        document.createElement("h2");

    heading.textContent = t("関連リンク");

    section.appendChild(heading);

    if (uniqueLinks.length < 8) {
        section.appendChild(
            createLinkList(uniqueLinks)
        );

        article.appendChild(section);
        return;
    }

    const wikiLinks = uniqueLinks.filter(
        link => link.type === "wiki"
    );

    const externalLinks = uniqueLinks.filter(
        link => link.type === "external"
    );

    if (wikiLinks.length > 0) {
        const wikiHeading =
            document.createElement("h3");

        wikiHeading.textContent = "Wiki";

        section.appendChild(wikiHeading);
        section.appendChild(
            createLinkList(wikiLinks)
        );
    }

    if (externalLinks.length > 0) {
        const externalHeading =
            document.createElement("h3");

        externalHeading.textContent = t("外部");

        section.appendChild(externalHeading);
        section.appendChild(
            createLinkList(externalLinks)
        );
    }

    article.appendChild(section);
}

function createLinkList(links) {
    const list = document.createElement("ul");

    for (const data of links) {
        const item = document.createElement("li");
        const link = document.createElement("a");

        link.href = data.href;

        if (data.type === "external") {
            link.textContent = `↗ ${data.label}`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        } else if (data.direction === "out") {
            link.textContent = `→ ${data.label}`;
        } else {
            link.textContent = `← ${data.label}`;
        }

        item.appendChild(link);
        list.appendChild(item);
    }

    return list;
}


// 未作成記事

async function showNotFound(
    title,
    articles,
    config
) {
    const version = renderVersion;
    hideTableOfContents();
    if (!config.notFound) {
        article.innerHTML = "";

        const heading = document.createElement("h1");
        heading.textContent = title;

        const message = document.createElement("p");
        message.textContent =
            t("この記事はまだ作成されていません。");

        article.appendChild(heading);
        article.appendChild(message);

        updatePageMetadata(`${title} - ${config.name}`, config);

        return;
    }

    const response = await fetch(config.notFound);

    if (!response.ok) {
        throw new Error(
            t("未作成記事ページの読み込みに失敗しました")
        );
    }

    const markdown = await response.text();
    if (version !== renderVersion) return;
    article.innerHTML = renderMarkdown(markdown);

    replaceTemplateTitle(title);
    createWikiLinks(article, articles);

    updatePageMetadata(`${title} - ${config.name}`, config);
}

// テンプレート内のタイトルを置換

function replaceTemplateTitle(title) {
    const walker = document.createTreeWalker(
        article,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const parent = node.parentElement;

                if (!parent) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (parent.closest("code, pre, script, style")) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (!node.nodeValue.includes("{{title}}")) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const nodes = [];

    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }

    for (const node of nodes) {
        node.nodeValue = node.nodeValue.replaceAll(
            "{{title}}",
            title
        );
    }
}


// 通常の記事

async function showArticle(
    title,
    articles,
    config
) {
    const version = renderVersion;
    const data = findArticle(articles, title);

    if (!data) {
        await showNotFound(
            title,
            articles,
            config
        );

        return;
    }

    title = data.title;
    if (page && data.id && page !== data.id) {
        history.replaceState(null, "", createInternalUrl({ page: data.id, heading: getHashTarget() }));
    }
    const loaded = await loadArticleData(data);
    if (version !== renderVersion) return;
    article.replaceChildren();
    if (loaded.split) {
        const heading = document.createElement("h1");
        heading.textContent = title;
        article.appendChild(heading);
        const layout = document.createElement("div");
        layout.className = "split-article";
        for (const parts of loaded.rows) {
            const row = document.createElement("div");
            row.className = "split-article-row";
            row.classList.toggle("split-article-two-columns", parts.length === 2);
            for (const part of parts) {
                const section = createPartRoot(part, articles, true);
                section.className = "split-article-section";
                row.appendChild(section);
            }
            layout.appendChild(row);
        }
        article.appendChild(layout);
    } else {
        article.appendChild(createPartRoot(loaded.rows[0][0], articles, false));
    }
    createArticleTags(title, articles);
    createImageCaptions();
    createTableContainers();
    highlightCode();
    createCodeCopyButtons();

    // 別の記事の索引読み込みを待たずに目次と見出しリンクを利用可能にする。
    createTableOfContents();

    const hashTarget = getHashTarget();

    if (hashTarget) {
        const target = document.getElementById(hashTarget);

        if (target) {
            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }

    updatePageMetadata(`${title} - ${config.name}`, config, page ? "article" : "website");
    await createLinkInfo(title, articles);
}


// 記事一覧

function showArticleList(articles, config) {
    hideTableOfContents();

    article.innerHTML = "";

    const title = document.createElement("h1");
    title.textContent = t("記事一覧");

    const count = document.createElement("p");
    count.textContent =
        t("全{count}記事", {count: articles.length});

    const list = document.createElement("div");
    list.className = "article-list";

    for (const item of articles) {
        const entry = document.createElement("div");
        entry.className = "article-list-item";

        const link = document.createElement("a");

        link.className = "article-list-title";
        link.href = createInternalUrl({
            page: item.title
        });
        link.textContent = item.title;

        entry.appendChild(link);

        if (item.tags?.length > 0) {
            const tags =
                document.createElement("div");

            tags.className = "article-list-tags";

            for (const tag of item.tags) {
                const tagLink =
                    document.createElement("a");

                tagLink.href = createInternalUrl({
                    tag
                });

                tagLink.textContent = tag;

                tags.appendChild(tagLink);
            }

            entry.appendChild(tags);
        }

        list.appendChild(entry);
    }

    article.appendChild(title);
    article.appendChild(count);
    article.appendChild(list);

    updatePageMetadata(`${t("記事一覧")} - ${config.name}`, config);
}


// タグページ

function showTagPage(tag, articles, config) {
    hideTableOfContents();
    
    const matches = articles.filter(item =>
        (item.tags ?? []).some(
            itemTag =>
                itemTag.toLowerCase()
                === tag.toLowerCase()
        )
    );

    article.innerHTML = "";

    const title = document.createElement("h1");
    title.textContent = t("タグ: {tag}", {tag: tag});

    article.appendChild(title);

    if (matches.length === 0) {
        const message = document.createElement("p");
        message.textContent =
            t("このタグの記事はありません。");

        article.appendChild(message);

        updatePageMetadata(`${t("タグ: {tag}", {tag})} - ${config.name}`, config);

        return;
    }

    const count = document.createElement("p");
    count.textContent =
        t("{count}件の記事", {count: matches.length});

    const list = document.createElement("ul");

    for (const item of matches) {
        const listItem =
            document.createElement("li");

        const link =
            document.createElement("a");

        link.href = createInternalUrl({
            page: item.title
        });

        link.textContent = item.title;

        listItem.appendChild(link);
        list.appendChild(listItem);
    }

    article.appendChild(count);
    article.appendChild(list);

    updatePageMetadata(`${t("タグ: {tag}", {tag})} - ${config.name}`, config);
}


// ホーム

function showDefaultHome(articles, config) {
    hideTableOfContents();

    article.innerHTML = "";

    const title = document.createElement("h1");
    title.textContent = config.name;

    const welcome = document.createElement("p");
    welcome.textContent =
        t("{name}へようこそ。", {name: config.name});

    article.appendChild(title);
    article.appendChild(welcome);

    if (articles.length === 0) {
        const message =
            document.createElement("p");

        message.textContent =
            t("まだ記事はありません。");

        article.appendChild(message);

        updatePageMetadata(config.name, config);
        return;
    }

    const count = document.createElement("p");
    count.textContent =
        t("現在 {count} 件の記事があります。", {count: articles.length});

    const heading = document.createElement("h2");
    heading.textContent = t("記事");

    const list = document.createElement("ul");
    list.className = "home-article-list";

    for (const item of articles.slice(0, 5)) {
        const listItem =
            document.createElement("li");

        const link =
            document.createElement("a");

            link.href = createInternalUrl({
                page: item.title
            });

        link.textContent = item.title;

        listItem.appendChild(link);
        list.appendChild(listItem);
    }

    const allArticles =
        document.createElement("a");

    allArticles.className = "home-all-articles";
    allArticles.href = createInternalUrl({
        page: "all"
    });
    allArticles.textContent =
        t("すべての記事を見る →");

    article.appendChild(count);
    article.appendChild(heading);
    article.appendChild(list);
    article.appendChild(allArticles);

    updatePageMetadata(config.name, config);
}

async function showHome(articles, config) {
    // 指定記事をホームとして使用
    if (
        config.home
        && config.home !== "auto"
    ) {
        await showArticle(
            config.home,
            articles,
            config
        );

        return;
    }

    // 1記事ならそのまま表示
    if (articles.length === 1) {
        await showArticle(
            articles[0].id ?? articles[0].title,
            articles,
            config
        );

        return;
    }

    showDefaultHome(articles, config);
}


// サイドバー

function setupSidebar(articles) {
    const tags = [
        ...new Set(
            articles.flatMap(
                item => item.tags ?? []
            )
        )
    ].sort(
        (a, b) => a.localeCompare(b, language())
    );

    articleCount.textContent = articles.length;
    tagCount.textContent = tags.length;

    sidebarTags.innerHTML = "";

    for (const tag of tags) {
        const link = document.createElement("a");

        link.href = createInternalUrl({
            tag
        });

        link.textContent = tag;

        sidebarTags.appendChild(link);
    }
}

// モバイルメニュー

function closeMobilePanels() {
    sidebar.classList.remove("open");
    tocPanel.classList.remove("open");
    mobileBackdrop.classList.remove("show");
    sidebarToggle.setAttribute("aria-expanded", "false");
    tocToggle.setAttribute("aria-expanded", "false");
}

sidebarToggle.addEventListener("click", () => {
    const open =
        sidebar.classList.toggle("open");

    tocPanel.classList.remove("open");
    sidebarToggle.setAttribute("aria-expanded", String(open));
    tocToggle.setAttribute("aria-expanded", "false");

    mobileBackdrop.classList.toggle(
        "show",
        open
    );
});

tocToggle.addEventListener("click", () => {
    const open =
        tocPanel.classList.toggle("open");

    sidebar.classList.remove("open");
    tocToggle.setAttribute("aria-expanded", String(open));
    sidebarToggle.setAttribute("aria-expanded", "false");

    mobileBackdrop.classList.toggle(
        "show",
        open
    );
});

mobileBackdrop.addEventListener(
    "click",
    closeMobilePanels
);


tocPanel.addEventListener("click", event => {
    if (event.target.closest("a")) closeMobilePanels();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !event.isComposing && event.keyCode !== 229) {
        const toggle = tocPanel.classList.contains("open") ? tocToggle
            : sidebar.classList.contains("open") ? sidebarToggle : null;
        closeMobilePanels();
        toggle?.focus();
        searchRequestId++;
        clearSearchResults();
    }
});

document.addEventListener("pointerdown", event => {
    if (!event.target.closest(".search-area")) {
        searchRequestId++;
        clearSearchResults();
    }
});

document.addEventListener("focusin", event => {
    if (!event.target.closest(".search-area")) {
        searchRequestId++;
        clearSearchResults();
    }
});

window.matchMedia("(max-width: 900px)").addEventListener("change", closeMobilePanels);

// 起動

function displayError(error) {
    console.error(error);
    document.documentElement.removeAttribute("data-language-pending");
    hideTableOfContents();
    const heading = document.createElement("h1");
    heading.textContent = t("読み込みに失敗しました");
    const message = document.createElement("p");
    message.textContent = error.message;
    article.replaceChildren(heading, message);
    updatePageMetadata(`${heading.textContent} - ${wikiName.textContent}`, { name: wikiName.textContent });
}

async function renderPage(config, baseArticles) {
    const version = ++renderVersion;
    searchRequestId++;
    searchIndex = null;
    clearSearchResults();
    const restoreFocus = sidebar.classList.contains("open")
        && document.activeElement.id === "language-select";
    closeMobilePanels();
    if (restoreFocus) sidebarToggle.focus();
    hideTableOfContents();
    articleEntries = localizeArticles(baseArticles);
    const loading = document.createElement("p");
    loading.textContent = t("読み込み中...");
    article.replaceChildren(loading);
    updatePageMetadata(`${loading.textContent} - ${config.name}`, config);
    wikiName.textContent = config.name;
    setupSidebar(articleEntries);
    config = { ...config, notFound: config.notFoundTranslations?.[language()] ?? config.notFound };
    try {
        if (page === "all") showArticleList(articleEntries, config);
        else if (page) await showArticle(page, articleEntries, config);
        else if (tag) showTagPage(tag, articleEntries, config);
        else await showHome(articleEntries, config);
    } catch (error) {
        if (version === renderVersion) displayError(error);
    }
}

async function main() {
    const config = await loadConfig();
    initializeLanguage(config);
    const articles = await loadArticleList();
    setupSearch();
    document.addEventListener("wiki-language-change", () => renderPage(config, articles));
    await renderPage(config, articles);
}

main().catch(displayError);
