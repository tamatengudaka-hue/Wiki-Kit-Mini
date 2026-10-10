"""UI regressions: run with the same server and dependencies as split_articles.py."""
import os
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:8080'
LONG = 'LongHeading' * 40
TABLE = '|' + '|'.join(['Column'] * 16) + '|\n|' + '|'.join(['---'] * 16) + '|\n|' + '|'.join(['value'] * 16) + '|'
TEXT = f'## wiki-name\n[[Welcome]]\n![](big.svg)\n\n{TABLE}\n\n## {LONG}\n' + ('Paragraph content.\n\n' * 30) + '\n## Bottom\nEnd.'
ARTICLES = [{'title': 'Split', 'file': 'split/config.json'}, {'title': 'Welcome', 'file': 'welcome.md'}]

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'),
                                headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1400, 'height': 900})
    state = {'hold': False, 'abort': False}
    held = []
    def fixtures(route):
        path = urlsplit(route.request.url).path
        path = path.removeprefix('/wiki')
        if path == '/content/articles.json':
            route.fulfill(json=state.get('articles', ARTICLES))
        elif path == '/config.json':
            route.fulfill(json={'name': 'Wiki Kit Mini', 'home': 'Split', 'notFound': './system/not-found.md'})
        elif path == '/content/split/config.json':
            route.fulfill(json={'rows': [['a.md', 'b.md']]})
        elif path == '/content/split/a.md' and state['abort']:
            route.abort()
        elif path in ['/content/split/a.md', '/content/split/b.md']:
            route.fulfill(body=TEXT, content_type='text/plain')
        elif path == '/content/split/big.svg':
            route.fulfill(body='<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="100"/>', content_type='image/svg+xml')
        elif path == '/content/welcome.md' and state['hold']:
            held.append(route)
        elif path == '/content/welcome.md':
            route.fulfill(body='# Welcome\n![](/content/split/big.svg)')
        elif route.request.url.startswith(BASE + '/wiki/'):
            route.fulfill(response=route.fetch(url=BASE + path))
        else:
            route.continue_()
    context.route('**/*', fixtures)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/?page=Split')
    expect(page.locator('.split-article-section')).to_have_count(2)
    expect(page.locator('.article-links')).to_contain_text('→ Welcome')
    assert '↗ Welcome' not in page.locator('.article-links').inner_text()
    expect(page.locator('[id="wiki-name"]')).to_have_count(1)
    expect(page.locator('.split-article h2').first).to_have_attribute('id', 'wiki-name-2')
    for width in [320, 375, 390, 600, 768, 900, 901, 1024, 1400]:
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        assert page.locator('.article-table').first.bounding_box()['width'] <= page.locator('.split-article-section').first.bounding_box()['width']
        if width == 320:
            assert page.locator('.article-table').first.evaluate('(e) => e.scrollWidth > e.clientWidth')
        if width <= 600:
            assert page.locator('#search').bounding_box()['width'] >= width - 40
    page.set_viewport_size({'width': 390, 'height': 844})
    page.locator('#toc-toggle').click()
    expect(page.locator('#toc-toggle')).to_have_attribute('aria-expanded', 'true')
    page.locator('#toc-panel a').nth(2).click()
    expect(page.locator('#toc-toggle')).to_have_attribute('aria-expanded', 'false')
    assert 'show' not in page.locator('#mobile-backdrop').get_attribute('class')
    page.wait_for_function('''() => {
        const h = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        const top = h.getBoundingClientRect().top;
        const bottom = document.querySelector('.site-header').getBoundingClientRect().bottom;
        return top >= bottom && top < bottom + 25;
    }''')
    page.locator('#sidebar-toggle').click()
    page.keyboard.press('Escape')
    expect(page.locator('#sidebar-toggle')).to_have_attribute('aria-expanded', 'false')
    page.locator('#toc-toggle').click()
    page.set_viewport_size({'width': 1400, 'height': 900})
    page.set_viewport_size({'width': 390, 'height': 844})
    expect(page.locator('#toc-toggle')).to_have_attribute('aria-expanded', 'false')
    page.locator('#search').fill('Welcome')
    expect(page.locator('#search-results strong')).to_have_text(['Split', 'Welcome'])
    page.keyboard.press('Escape')
    expect(page.locator('#search-results')).to_be_empty()
    page.wait_for_function('''() => getComputedStyle(document.querySelector('#toc-panel')).visibility === 'hidden' ''' )
    page.locator('#search').focus()
    page.keyboard.press('Tab')
    assert page.evaluate('document.activeElement.closest("#sidebar, #toc-panel") === null')
    page.evaluate('scrollTo({top: 0, behavior: "instant"})')
    page.screenshot(path='/tmp/wiki-mobile-after.png')
    page.goto(BASE + '/?page=Welcome')
    expect(page.locator('#article img')).to_be_visible()
    assert page.locator('#article img').bounding_box()['width'] <= page.locator('#article').bounding_box()['width']
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    print('PASS: 9 viewport widths, long headings, wide tables, uncaptioned images, internal links, reserved IDs, mobile TOC/menus, Escape, resize, sticky-header anchors')

    # An unrelated article still loading must not block the current article's TOC or title.
    state['hold'] = True
    page.goto(BASE + '/?page=Split', wait_until='domcontentloaded')
    expect(page.locator('#toc-panel a').first).to_be_attached()
    expect(page).to_have_title('Split - Wiki Kit Mini')
    page.locator('#search').fill('Welcome')
    page.locator('#search').fill('not-a-match')
    page.locator('#search').fill('')
    for route in held:
        route.fulfill(body='# Welcome')
    state['hold'] = False
    expect(page.locator('.article-links')).to_contain_text('Welcome')
    expect(page.locator('#search-results')).to_be_empty()
    print('PASS: delayed related article leaves TOC/title usable; stale searches do not restore cleared results')

    page.goto(BASE + '/wiki/?page=Split')
    expect(page.locator('.split-article-section')).to_have_count(2)
    expect(page.locator('.article-links')).to_contain_text('Welcome')
    expect(page.locator('.split-article img').first).to_have_attribute('src', BASE + '/wiki/content/split/big.svg')
    expect(page.locator('a.wiki-link').first).to_have_attribute('href', BASE + '/wiki/?page=Welcome')
    state['articles'] = [{'title': f'Welcome {i}', 'file': 'welcome.md'} for i in range(25)]
    page.goto(BASE + '/?page=all')
    page.locator('#search').fill('Welcome')
    expect(page.locator('#search-results a')).to_have_count(25)
    assert page.locator('#search-results').bounding_box()['y'] + page.locator('#search-results').bounding_box()['height'] <= 844
    assert page.locator('#search-results').evaluate('(e) => e.scrollHeight > e.clientHeight')
    page.mouse.click(5, 200)
    expect(page.locator('#search-results')).to_be_empty()
    state.pop('articles')
    print('PASS: many search results stay within viewport and dismiss outside; closed mobile panels cannot receive keyboard focus')
    assert not errors, errors
    state['abort'] = True
    page.goto(BASE + '/?page=Split')
    expect(page.locator('#article p')).to_contain_text('a.md')
    expect(page.locator('#article p')).to_contain_text('通信エラー')
    print('PASS: subdirectory hosting and network-error diagnostics')
    browser.close()
