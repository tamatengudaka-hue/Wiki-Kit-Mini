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

let searchIndex = null;
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

// 記事ルートの作成

function createArticleRoot(markdown, articles) {
    const root = document.createElement("div");

    root.innerHTML = renderMarkdown(markdown);

    createWikiLinks(root, articles);

    return root;
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
        url.searchParams.set("page", page);
    }

    if (tag) {
        url.searchParams.set("tag", tag);
    }

    if (heading) {
        url.hash = encodeURIComponent(heading);
    }

    return url.href;
}

// 設定・記事一覧

async function loadConfig() {
    const response = await fetch("./config.json");

    if (!response.ok) {
        throw new Error("設定ファイルの読み込みに失敗しました");
    }

    return await response.json();
}

async function loadArticleList() {
    const response = await fetch("./content/articles.json");

    if (!response.ok) {
        throw new Error("記事一覧の読み込みに失敗しました");
    }

    return await response.json();
}

async function buildSearchIndex(articles) {
    if (searchIndex) {
        return searchIndex;
    }

    searchIndex = await Promise.all(
        articles.map(async item => {
            const response = await fetch(
                `./content/${encodeURIComponent(item.file)}`
            );

            if (!response.ok) {
                return {
                    title: item.title,
                    content: "",
                    tags: item.tags ?? []
                };
            }

            return {
                title: item.title,
                content: await response.text(),
                tags: item.tags ?? []
            };
        })
    );

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

            const label =
                displayName?.trim()
                || (
                    heading
                        ? `${pageName}#${heading}`
                        : pageName
                );

            const exists = articles.some(
                item => item.title === pageName
            );

            const link =
                document.createElement("a");

            link.href = createInternalUrl({
                page: pageName,
                heading
            });
            link.textContent = label;

            // 関連リンク抽出にも使用
            link.classList.add("wiki-link");
            link.dataset.wikiTitle = pageName;

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

function setupSearch(articles) {
    search.addEventListener("input", async () => {
        const requestId = ++searchRequestId;
        const query =
            search.value.trim().toLowerCase();

        searchResults.innerHTML = "";

        if (!query) {
            return;
        }

        const index =
            await buildSearchIndex(articles);

        // 待機中に別の検索が始まった場合は破棄
        if (requestId !== searchRequestId) {
            return;
        }

        const matches = index.filter(item =>
            item.title.toLowerCase().includes(query)
            || item.content.toLowerCase().includes(query)
            || item.tags.some(tag =>
                tag.toLowerCase().includes(query)
            )
        );

        for (const item of matches) {
            const link = document.createElement("a");
            link.href = createInternalUrl({
                page: item.title
            });

            const title = document.createElement("strong");
            title.textContent = item.title;

            link.appendChild(title);

            const snippet = createSearchSnippet(
                item.content,
                query
            );

            if (snippet) {
                const description = document.createElement("span");
                description.className = "search-snippet";
                description.textContent = snippet;

                link.appendChild(description);
            }

            searchResults.appendChild(link);
        }
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

        button.className = "code-copy";
        button.type = "button";
        button.textContent = "コピー";

        button.addEventListener("click", async () => {
            await navigator.clipboard.writeText(
                code.textContent
            );

            button.textContent = "コピー済み";

            setTimeout(() => {
                button.textContent = "コピー";
            }, 1500);
        });

        block.appendChild(button);
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
    title.textContent = "目次";

    const list = document.createElement("ul");
    const idCounts = new Map();

    for (const heading of headings) {
        const baseId = heading.textContent.trim();
        const count = (idCounts.get(baseId) ?? 0) + 1;

        idCounts.set(baseId, count);

        const id =
            count === 1
                ? baseId
                : `${baseId}-${count}`;

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
        const headerOffset = 100;
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
    const index = await buildSearchIndex(articles);

    const current = index.find(
        item => item.title === title
    );

    if (!current) {
        return;
    }

    const links = [];

    const currentRoot = createArticleRoot(
        current.content,
        articles
    );

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

        if (!/^https?:\/\//i.test(href)) {
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

        const root = createArticleRoot(
            item.content,
            articles
        );

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

    heading.textContent = "関連リンク";

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

        externalHeading.textContent = "外部";

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
    hideTableOfContents();
    if (!config.notFound) {
        article.innerHTML = "";

        const heading = document.createElement("h1");
        heading.textContent = title;

        const message = document.createElement("p");
        message.textContent =
            "この記事はまだ作成されていません。";

        article.appendChild(heading);
        article.appendChild(message);

        document.title =
            `${title} - ${config.name}`;

        return;
    }

    const response = await fetch(config.notFound);

    if (!response.ok) {
        throw new Error(
            "未作成記事ページの読み込みに失敗しました"
        );
    }

    const markdown = await response.text();

    article.innerHTML = renderMarkdown(markdown);

    replaceTemplateTitle(title);
    createWikiLinks(article, articles);

    document.title = `${title} - ${config.name}`;
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
    const data = articles.find(
        item => item.title === title
    );

    if (!data) {
        await showNotFound(
            title,
            articles,
            config
        );

        return;
    }

    const response = await fetch(
        `./content/${encodeURIComponent(data.file)}`
    );

    if (!response.ok) {
        await showNotFound(
            title,
            articles,
            config
        );

        return;
    }

    const markdown = await response.text();

    article.innerHTML = renderMarkdown(markdown);

    createWikiLinks(article, articles);
    createArticleTags(title, articles);
    createImageCaptions();
    highlightCode();
    createCodeCopyButtons();

    await createLinkInfo(title, articles);

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

document.title = `${title} - ${config.name}`;
}


// 記事一覧

function showArticleList(articles, config) {
    hideTableOfContents();

    article.innerHTML = "";

    const title = document.createElement("h1");
    title.textContent = "記事一覧";

    const count = document.createElement("p");
    count.textContent =
        `全${articles.length}記事`;

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

    document.title =
        `記事一覧 - ${config.name}`;
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
    title.textContent = `タグ: ${tag}`;

    article.appendChild(title);

    if (matches.length === 0) {
        const message = document.createElement("p");
        message.textContent =
            "このタグの記事はありません。";

        article.appendChild(message);

        document.title =
            `タグ: ${tag} - ${config.name}`;

        return;
    }

    const count = document.createElement("p");
    count.textContent =
        `${matches.length}件の記事`;

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

    document.title =
        `タグ: ${tag} - ${config.name}`;
}


// ホーム

function showDefaultHome(articles, config) {
    hideTableOfContents();

    article.innerHTML = "";

    const title = document.createElement("h1");
    title.textContent = config.name;

    const welcome = document.createElement("p");
    welcome.textContent =
        `${config.name}へようこそ。`;

    article.appendChild(title);
    article.appendChild(welcome);

    if (articles.length === 0) {
        const message =
            document.createElement("p");

        message.textContent =
            "まだ記事はありません。";

        article.appendChild(message);

        document.title = config.name;
        return;
    }

    const count = document.createElement("p");
    count.textContent =
        `現在 ${articles.length} 件の記事があります。`;

    const heading = document.createElement("h2");
    heading.textContent = "記事";

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
        "すべての記事を見る →";

    article.appendChild(count);
    article.appendChild(heading);
    article.appendChild(list);
    article.appendChild(allArticles);

    document.title = config.name;
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
            articles[0].title,
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
        (a, b) => a.localeCompare(b, "ja")
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
}

sidebarToggle.addEventListener("click", () => {
    const open =
        sidebar.classList.toggle("open");

    tocPanel.classList.remove("open");

    mobileBackdrop.classList.toggle(
        "show",
        open
    );
});

tocToggle.addEventListener("click", () => {
    const open =
        tocPanel.classList.toggle("open");

    sidebar.classList.remove("open");

    mobileBackdrop.classList.toggle(
        "show",
        open
    );
});

mobileBackdrop.addEventListener(
    "click",
    closeMobilePanels
);


// 起動

async function main() {
    const config = await loadConfig();
    const articles = await loadArticleList();

    wikiName.textContent = config.name;

    setupSearch(articles);
    setupSidebar(articles);

    if (page === "all") {
        showArticleList(articles, config);
        return;
    }

    if (page) {
        await showArticle(
            page,
            articles,
            config
        );

        return;
    }

    if (tag) {
        showTagPage(
            tag,
            articles,
            config
        );

        return;
    }

    await showHome(articles, config);
}

main().catch(error => {
    console.error(error);

    article.innerHTML = `
        <h1>読み込みに失敗しました</h1>
        <p>Wikiを読み込めませんでした。</p>
    `;
});