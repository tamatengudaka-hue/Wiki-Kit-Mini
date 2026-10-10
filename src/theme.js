// 初回描画前に配色を決める。保存領域が使えなくてもWikiは利用できる。
(() => {
    const storageKey = "wiki-kit-mini-theme";
    const modes = ["auto", "light", "dark"];
    const labelsJa = { auto: "自動", light: "ライト", dark: "ダーク" };
    const labelsEn = { auto: "Auto", light: "Light", dark: "Dark" };
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const validMode = value => modes.includes(value) ? value : "auto";
    let mode = "auto";
    try {
        mode = validMode(localStorage.getItem(storageKey));
    } catch {
        // ストレージが禁止されている場合は、このページ内だけで選択する。
    }

    function applyTheme() {
        const theme = mode === "auto" ? (systemTheme.matches ? "dark" : "light") : mode;
        document.documentElement.dataset.theme = theme;
        const button = document.getElementById("theme-toggle");
        if (button) {
            const english = document.documentElement.lang === "en";
            const labels = english ? labelsEn : labelsJa;
            document.querySelector(".theme-prefix").textContent = english ? "Theme: " : "配色：";
            const next = modes[(modes.indexOf(mode) + 1) % modes.length];
            document.getElementById("theme-label").textContent = labels[mode];
            const description = english
                ? `Theme: ${labels[mode]}. Switch to ${labels[next]}`
                : `配色：${labels[mode]}。${labels[next]}に切り替える`;
            button.setAttribute("aria-label", description);
            button.title = description;
        }
    }

    document.addEventListener("wiki-language-ui", applyTheme);
    applyTheme();
    systemTheme.addEventListener("change", applyTheme);
    window.addEventListener("storage", event => {
        if (event.key === storageKey || event.key === null) {
            mode = validMode(event.newValue);
            applyTheme();
        }
    });
    document.addEventListener("DOMContentLoaded", () => {
        applyTheme();
        document.getElementById("theme-toggle").addEventListener("click", () => {
            mode = modes[(modes.indexOf(mode) + 1) % modes.length];
            try {
                localStorage.setItem(storageKey, mode);
            } catch {
                // 保存失敗時も配色の切り替えを続ける。
            }
            applyTheme();
        });
    });
})();
