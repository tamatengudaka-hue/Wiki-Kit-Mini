"""Long code must scroll independently of its copy button. Same setup as ui_regressions.py."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:8080'
CODE = 'echo ' + 'very-long-command-' * 50 + '\nsecond line\n'
MARKDOWN = '# Code\n```bash\n' + CODE + '```'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'),
                                headless=True, args=['--no-sandbox'])
    context = browser.new_context(permissions=['clipboard-read', 'clipboard-write'])
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    def fixture(route):
        path = route.request.url.split('/content/', 1)[1]
        if path == 'articles.json':
            route.fulfill(json=[{'title': 'Code', 'file': 'code.md'}, {'title': 'Split', 'file': 'split/config.json'}])
        elif path == 'split/config.json':
            route.fulfill(json={'rows': [['a.md', 'b.md']]})
        elif path in ['code.md', 'split/a.md', 'split/b.md']:
            route.fulfill(body=MARKDOWN)
        else:
            route.continue_()
    context.route('**/content/**', fixture)
    for width in [320, 390, 1400]:
        page.set_viewport_size({'width': width, 'height': 900})
        for article, count in [('Code', 1), ('Split', 2)]:
            page.goto(BASE + '/?page=' + article)
            expect(page.locator('pre')).to_have_count(count)
            for index in range(count):
                pre = page.locator('pre').nth(index)
                button = page.locator('.code-copy').nth(index)
                pre.scroll_into_view_if_needed()
                before = button.bounding_box()
                assert pre.evaluate('(e) => e.scrollWidth > e.clientWidth')
                pre.evaluate('(e) => e.scrollLeft = e.scrollWidth')
                after = button.bounding_box()
                assert abs(before['x'] - after['x']) < 1, (width, article, before, after)
                assert abs(before['y'] - after['y']) < 1
                expect(button).to_be_visible()
                button.click()
                expect(button).to_have_text('コピー済み')
                assert page.evaluate('navigator.clipboard.readText()') == CODE
                pre.evaluate('(e) => e.scrollLeft = 0')
                code = pre.locator('code').bounding_box()
                assert code['y'] >= after['y'] + after['height'], 'Button overlaps first line'
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    print('PASS: single/split long code at 320/390/1400px; independent scrolling, fixed button, no overlap, complete clipboard text, no page overflow')
    browser.close()
