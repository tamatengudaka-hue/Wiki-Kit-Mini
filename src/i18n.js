const english = {
    "読み込み中...": "Loading...",
    "{title}: translations は言語ごとの設定オブジェクトにしてください": "{title}: translations must be an object keyed by language.",
    "{title}: 翻訳には file と任意の空でない title を指定してください": "{title}: each translation needs a file and an optional nonempty title.",
    "設定ファイルの読み込みに失敗しました": "Failed to load site configuration.",
    "記事一覧の読み込みに失敗しました": "Failed to load the article index.",
    "記事一覧は配列にしてください": "The article index must be an array.",
    "記事には空でない title と file が必要です": "Each article needs a nonempty title and file.",
    "記事は .md またはディレクトリ内の config.json を指定してください": "Use a .md file or a directory/config.json for each article.",
    "検索結果": "Search results",
    "一致する記事が見つかりませんでした": "No matching articles found.",
    "表（横にスクロールできます）": "Table (scroll horizontally)",
    "コピー": "Copy",
    "コピー済み": "Copied",
    "目次": "Contents",
    "関連リンク": "Related links",
    "外部": "External",
    "この記事はまだ作成されていません。": "This article has not been created yet.",
    "未作成記事ページの読み込みに失敗しました": "Failed to load the missing-article page.",
    "記事一覧": "All articles",
    "このタグの記事はありません。": "No articles have this tag.",
    "まだ記事はありません。": "There are no articles yet.",
    "記事": "Articles",
    "すべての記事を見る →": "View all articles →",
    "読み込みに失敗しました": "Failed to load",
    "ホーム": "Home",
    "ナビゲーション": "Navigation",
    "タグ": "Tags",
    "Wiki情報": "Wiki information",
    "記事を検索...": "Search articles...",
    "記事を検索": "Search articles",
    "メニューを開く": "Open navigation",
    "目次を開く": "Open contents",
    "表示言語": "Language",
    "{title}: id は小文字の英数字・ハイフン・アンダースコアで指定してください": "{title}: use lowercase letters, numbers, hyphens or underscores for id.",
    "{title}: aliases は空でない文字列の配列にしてください": "{title}: aliases must be an array of nonempty strings.",
    "{title}: all は記事一覧用の予約名です": "{title}: all is reserved for the article index.",
    "記事のID・タイトル・別名が重複しています: {reference}": "Duplicate article ID, title or alias: {reference}",
    "記事のファイルパスが不正です: {path}": "Invalid article file path: {path}",
    "{file} の読み込みに失敗しました（通信エラー）": "Failed to load {file} (network error).",
    "{file} の読み込みに失敗しました（HTTP {status}）": "Failed to load {file} (HTTP {status}).",
    "{file}: JSONの形式が不正です": "{file}: invalid JSON.",
    "{file}: rows は1〜2ファイルの行を並べた空でない配列にしてください": "{file}: rows must be a nonempty array of rows containing 1–2 files.",
    "{file}: 分割記事は最大5ファイルです": "{file}: split articles support at most 5 files.",
    "{file}: Markdown（.md）のみ指定できます": "{file}: only Markdown (.md) files are allowed.",
    "{file}: 同じMarkdownファイルを重複して指定できません": "{file}: duplicate Markdown files are not allowed.",
    "{count}件の記事が見つかりました": "{count} matching articles",
    "全{count}記事": "{count} articles in total",
    "タグ: {tag}": "Tag: {tag}",
    "{count}件の記事": "{count} articles",
    "{name}へようこそ。": "Welcome to {name}.",
    "現在 {count} 件の記事があります。": "There are currently {count} articles."
};
const supported = ["ja", "en"];
const storageKey = "wiki-kit-mini-language";
let current = "ja";
let defaultLanguage = "ja";
export const language = () => current;
export function t(key, values = {}) {
    let text = current === "en" ? (english[key] ?? key) : key;
    if (current === "en" && values.count === 1) {
        text = text.replace(/\barticles\b/g, "article").replace("There are currently", "There is currently");
    }
    return text.replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match));
}
function updateInterface() {
    document.documentElement.lang = current;
    document.documentElement.removeAttribute("data-language-pending");
    for (const element of document.querySelectorAll("[data-i18n]")) element.textContent = t(element.dataset.i18n);
    for (const element of document.querySelectorAll("[data-i18n-placeholder]")) element.placeholder = t(element.dataset.i18nPlaceholder);
    for (const element of document.querySelectorAll("[data-i18n-label]")) element.setAttribute("aria-label", t(element.dataset.i18nLabel));
    document.getElementById("language-select").value = current;
    document.dispatchEvent(new Event("wiki-language-ui"));
}
function setLanguage(value) {
    const next = supported.includes(value) ? value : defaultLanguage;
    if (next === current) return;
    current = next;
    updateInterface();
    document.dispatchEvent(new Event("wiki-language-change"));
}
export function initializeLanguage(config) {
    defaultLanguage = supported.includes(config.language) ? config.language : "ja";
    current = defaultLanguage;
    try {
        const saved = localStorage.getItem(storageKey);
        if (supported.includes(saved)) current = saved;
    } catch { /* The selection still works in memory. */ }
    updateInterface();
    document.getElementById("language-select").addEventListener("change", event => {
        try { localStorage.setItem(storageKey, event.target.value); } catch { /* Optional persistence. */ }
        setLanguage(event.target.value);
    });
    window.addEventListener("storage", event => {
        if (event.key === storageKey || event.key === null) setLanguage(event.newValue);
    });
}
export function localizeArticles(articles) {
    return articles.map(item => {
        const translation = item.translations?.[current];
        return {
            ...item,
            sourceTitle: item.title,
            urlKey: item.id ?? item.title,
            title: translation?.title ?? item.title,
            file: translation?.file ?? item.file,
            // Links in any supported language continue to identify the same article.
            aliases: [...new Set([...(item.aliases ?? []), item.title,
                ...Object.values(item.translations ?? {}).map(value => value.title).filter(Boolean)])]
        };
    });
}
