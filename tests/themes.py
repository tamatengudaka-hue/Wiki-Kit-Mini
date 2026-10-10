"""Theme persistence, OS preferences, layout and dark-palette browser checks."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:8080'
KEY = 'wiki-kit-mini-theme'

def luminance(hex_color):
    rgb = [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    channels = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    return sum(a*b for a, b in zip(channels, [.2126, .7152, .0722]))

def contrast(a, b):
    x, y = sorted([luminance(a), luminance(b)])
    return (y + .05) / (x + .05)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'),
                                headless=True, args=['--no-sandbox'])
    context = browser.new_context(color_scheme='dark')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE)
    expect(page.locator('#article h1')).to_have_text('Wiki Kit Miniへようこそ')
    expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
    expect(page.locator('#theme-label')).to_have_text('自動')
    page.emulate_media(color_scheme='light')
    expect(page.locator('html')).to_have_attribute('data-theme', 'light')
    page.locator('#theme-toggle').click()
    expect(page.locator('#theme-label')).to_have_text('ライト')
    page.emulate_media(color_scheme='dark')
    expect(page.locator('html')).to_have_attribute('data-theme', 'light')
    page.locator('#theme-toggle').click()
    expect(page.locator('#theme-label')).to_have_text('ダーク')
    expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
    page.reload()
    expect(page.locator('#theme-label')).to_have_text('ダーク')
    expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
    expect(page.locator('#theme-toggle')).to_have_attribute('aria-label', '配色：ダーク。自動に切り替える')
    page.emulate_media(color_scheme='light')
    expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
    palette = page.evaluate('''() => {
        const css = getComputedStyle(document.documentElement);
        return Object.fromEntries(['text', 'muted', 'link', 'missing', 'subtle-text', 'surface', 'code-surface', 'code-text',
            'syntax-keyword', 'syntax-string', 'syntax-number', 'syntax-title', 'syntax-type', 'syntax-builtin',
            'syntax-variable', 'syntax-comment', 'syntax-meta'].map(k => [k, css.getPropertyValue('--' + k).trim()]));
    }''')
    for name in ['text', 'muted', 'link', 'missing', 'subtle-text']:
        assert contrast(palette[name], palette['surface']) >= 4.5, name
    for name in ['code-text'] + [n for n in palette if n.startswith('syntax-')]:
        assert contrast(palette[name], palette['code-surface']) >= 4.5, name
    for width in [320, 390, 600, 768, 900, 901, 1400]:
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        expect(page.locator('#theme-toggle')).to_be_visible()
    page.set_viewport_size({'width': 390, 'height': 844})
    page.locator('#search').fill('Markdown')
    expect(page.locator('#search-results strong')).to_have_text(['Welcome', '分割記事サンプル'])
    assert page.locator('#search').evaluate('(e) => getComputedStyle(e).color') == 'rgb(230, 233, 239)'
    page.keyboard.press('Escape')
    page.locator('#toc-toggle').click()
    assert page.locator('#toc-panel').evaluate('(e) => getComputedStyle(e).backgroundColor') == 'rgb(23, 27, 33)'
    page.keyboard.press('Escape')
    page.screenshot(path='/tmp/wiki-dark-mobile.png')
    page.set_viewport_size({'width': 1400, 'height': 900})
    page.screenshot(path='/tmp/wiki-dark-desktop.png')
    other = context.new_page()
    other.goto(BASE)
    expect(other.locator('#theme-label')).to_have_text('ダーク')
    page.locator('#theme-toggle').click()
    expect(page.locator('#theme-label')).to_have_text('自動')
    expect(page.locator('html')).to_have_attribute('data-theme', 'light')
    expect(other.locator('#theme-label')).to_have_text('自動')
    page.evaluate('localStorage.clear()')
    expect(other.locator('#theme-label')).to_have_text('自動')
    assert not errors, errors
    print('PASS: automatic OS changes, manual override, reload persistence, tab sync, 7 viewport widths, dark search/TOC, text contrast >=4.5:1')

    blocked = browser.new_context(color_scheme='dark')
    blocked.add_init_script('''Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });''')
    tab = blocked.new_page()
    tab.on('pageerror', lambda error: errors.append(str(error)))
    tab.goto(BASE)
    expect(tab.locator('#article h1')).to_have_text('Wiki Kit Miniへようこそ')
    expect(tab.locator('html')).to_have_attribute('data-theme', 'dark')
    tab.locator('#theme-toggle').click()
    expect(tab.locator('html')).to_have_attribute('data-theme', 'light')
    invalid = browser.new_context(color_scheme='dark')
    invalid.add_init_script(f"localStorage.setItem('{KEY}', 'invalid');")
    tab = invalid.new_page()
    tab.goto(BASE)
    expect(tab.locator('#theme-label')).to_have_text('自動')
    expect(tab.locator('html')).to_have_attribute('data-theme', 'dark')
    assert not errors, errors
    print('PASS: unavailable localStorage and invalid saved preference do not break the app')
    browser.close()
