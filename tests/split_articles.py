"""Browser regression tests. Run a server on :8080, then python3 tests/split_articles.py.
Requires Python Playwright and Chromium (CHROMIUM_PATH overrides /usr/bin/chromium).
Fixtures are served by browser request interception; checkout content is untouched.
"""
import json
import os
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:8080'
ROWS = [['intro.md'], ['features.md', 'specs.md'], ['links.md', 'extra.md']]
ARTICLES = [
    {'title': 'Welcome', 'file': 'welcome.md', 'tags': ['Guide']},
    {'title': 'Split', 'file': 'split/config.json', 'tags': ['Guide']},
]
PARTS = {
    'intro.md': '## Same\nIntro [[Welcome]]\n<script>window.injected=true</script>',
    'features.md': '## Same\nFeatures needlefeatures',
    'specs.md': '## Same-2\nSpecs needlespecs\n![diagram](images/a.svg)\n[relative](docs/info.html)',
    'links.md': '## Links\n[Example](https://example.com)\n```js\nlet a = 1;\n```',
    'extra.md': '## Extra\nneedleextra',
}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'),
                                headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1400, 'height': 900})
    state = {'config': {'rows': ROWS}, 'missing': False}
    fetched = []

    def fixture(route):
        path = route.request.url.split('/content/', 1)[1]
        fetched.append(path)
        if path == 'articles.json':
            route.fulfill(json=ARTICLES)
        elif path == 'split/config.json':
            route.fulfill(body=state.get('raw') or json.dumps(state['config']), content_type='application/json')
        elif path == 'split/features.md' and state['missing']:
            route.fulfill(status=404, body='not found')
        elif path.startswith('split/') and path[6:] in PARTS:
            route.fulfill(body=PARTS[path[6:]], content_type='text/plain')
        elif path == 'split/images/a.svg':
            route.fulfill(body='<svg xmlns="http://www.w3.org/2000/svg"/>', content_type='image/svg+xml')
        else:
            route.continue_()

    context.route('**/content/**', fixture)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/?page=Split')
    expect(page.locator('#article > h1')).to_have_text('Split')
    expect(page.locator('.split-article-section')).to_have_count(5)
    expect(page.locator('.article-tag')).to_have_text('Guide')
    headings = page.locator('.split-article h2').evaluate_all('(els) => els.map(e => e.id)')
    assert headings == ['Same', 'Same-2', 'Same-2-2', 'Links', 'Extra'], headings
    assert page.locator('.split-article-row').nth(1).evaluate('(e) => getComputedStyle(e).gridTemplateColumns').count(' ') == 1
    assert page.locator('.split-article img').get_attribute('src') == BASE + '/content/split/images/a.svg'
    assert page.get_by_role('link', name='relative', exact=True).get_attribute('href') == BASE + '/content/split/docs/info.html'
    assert not page.evaluate('Boolean(window.injected)')
    expect(page.locator('.article-links')).to_contain_text('Welcome')
    expect(page.locator('.article-links')).to_contain_text('Example')
    expect(page.locator('pre code.hljs')).to_have_count(1)
    for query in ['needlefeatures', 'needlespecs', 'needleextra']:
        page.locator('#search').fill(query)
        expect(page.locator('#search-results strong')).to_have_text('Split')
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.locator('.split-article-row').nth(1).evaluate('(e) => getComputedStyle(e).gridTemplateColumns').count(' ') == 0
    assert page.locator('.split-article-section').nth(2).bounding_box()['y'] > page.locator('.split-article-section').nth(1).bounding_box()['y']
    page.goto(BASE + '/?page=Welcome')
    expect(page.locator('#article h1')).to_have_text('Wiki Kit Miniへようこそ')
    expect(page.locator('.article-links')).to_contain_text('Split')
    page.goto(BASE + '/?tag=Guide')
    expect(page.locator('#article li')).to_have_count(2)
    page.goto(BASE + '/?page=all')
    expect(page.locator('.article-list-title')).to_have_count(2)
    assert not errors, errors
    print('PASS: 5-file article, order, desktop/mobile layout, search, tags, links/backlinks, unique headings, relative assets, sanitization, single article')

    cases = [
        ({'rows': [['intro.md']] * 6}, '最大5ファイル'),
        ({'rows': [['intro.md', 'features.md', 'specs.md']]}, '1〜2ファイル'),
        ({'rows': []}, '空でない配列'),
        ({'rows': [['intro.md'], ['intro.md']]}, '重複'),
        ({'rows': [['../welcome.md']]}, 'ファイルパスが不正'),
        ({'rows': [['%2e%2e/welcome.md']]}, 'ファイルパスが不正'),
        ({'rows': [['https://example.com/a.md']]}, 'ファイルパスが不正'),
        ({'rows': [['/welcome.md']]}, 'ファイルパスが不正'),
        ({'rows': [[None]]}, 'ファイルパスが不正'),
        ({'rows': [['a.html']]}, 'Markdown'),
        ({'rows': 'bad'}, 'rows'),
    ]
    for config, message in cases:
        state['config'] = config
        fetched.clear()
        page.goto(BASE + '/?page=Split')
        expect(page.locator('#article h1')).to_have_text('読み込みに失敗しました')
        expect(page.locator('#article p')).to_contain_text(message)
        assert fetched == ['articles.json', 'split/config.json'], fetched
    state['raw'] = '{invalid json'
    page.goto(BASE + '/?page=Split')
    expect(page.locator('#article p')).to_contain_text('JSONの形式が不正')
    state.pop('raw')
    state['config'] = {'rows': ROWS}
    state['missing'] = True
    page.goto(BASE + '/?page=Split')
    expect(page.locator('#article p')).to_contain_text('features.md')
    expect(page.locator('#article p')).to_contain_text('HTTP 404')
    expect(page.locator('.split-article-section')).to_have_count(0)
    page.goto(BASE + '/?page=Welcome')
    expect(page.locator('#article h1')).to_have_text('Wiki Kit Miniへようこそ')
    page.locator('#search').fill('Welcome')
    expect(page.locator('#search-results strong')).to_have_text('Welcome')
    expect(page.locator('#search-results .search-warning')).to_contain_text('features.md')
    print('PASS: invalid layouts/paths rejected before Markdown fetch; missing files diagnosed; failed articles do not block valid articles')
    browser.close()
