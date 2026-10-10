function setMeta(attribute, key, content) {
    const matches = [...document.head.querySelectorAll(`meta[${attribute}]`)]
        .filter(element => element.getAttribute(attribute) === key);
    const element = matches.shift() ?? document.createElement("meta");
    element.setAttribute(attribute, key);
    element.setAttribute("content", content);
    if (!element.isConnected) document.head.appendChild(element);
    // Updating repeatedly must not leave conflicting duplicate tags.
    for (const duplicate of matches) duplicate.remove();
}

export function summarizeArticle(root) {
    const content = root.cloneNode(true);
    for (const element of content.querySelectorAll(
        "h1, h2, h3, h4, h5, h6, pre, script, style, .article-tags, .article-links, figcaption"
    )) element.remove();
    const paragraphs = [...content.querySelectorAll("p")]
        .map(element => element.textContent.trim()).filter(Boolean);
    return (paragraphs.join(" ") || content.textContent).replace(/\s+/g, " ").trim();
}

export function updateMetadata({ title, description, siteName, url, type = "website" }) {
    const text = Array.from(String(description).replace(/\s+/g, " ").trim());
    const summary = text.length > 160 ? text.slice(0, 159).join("").trimEnd() + "…" : text.join("");
    const canonicalUrl = new URL(url);
    canonicalUrl.hash = "";
    document.title = title;
    setMeta("name", "description", summary);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", summary);
    setMeta("property", "og:site_name", siteName);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", canonicalUrl.href);
    setMeta("property", "og:locale", document.documentElement.lang === "en" ? "en_US" : "ja_JP");
    setMeta("name", "twitter:card", "summary");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", summary);
    const links = [...document.head.querySelectorAll('link[rel="canonical"]')];
    const canonical = links.shift() ?? document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = canonicalUrl.href;
    if (!canonical.isConnected) document.head.appendChild(canonical);
    for (const duplicate of links) duplicate.remove();
}
