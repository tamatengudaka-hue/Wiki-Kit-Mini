"""Stable article URLs and keyboard-search regressions. Same setup as other browser tests."""
import os
from urllib.parse import quote, urlsplit
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:8080'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'),
                                headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 844})
    state = {'title': 'Original title', 'held': False}
    held = []
    def articles():
        return state.get('articles', [
            {'id': 'guide', 'title': state['title'], 'aliases': ['Old title'], 'file': 'guide.md', 'tags': ['Guide']},
            {'id': 'split', 'title': 'Split', 'file': 'split/config.json', 'tags': ['Guide']},
            {'title': 'Legacy', 'file': 'legacy.md'},
        ])
    def fixture(route):
        path = urlsplit(route.request.url).path
        if path == '/config.json':
            route.fulfill(json={'name': 'Test Wiki', 'home': 'guide', 'notFound': './system/not-found.md'})
        elif path == '/content/articles.json':
            route.fulfill(json=articles())
        elif path == '/content/split/config.json':
            route.fulfill(json={'rows': [['a.md', 'b.md']]})
        elif path == '/content/guide.md':
            route.fulfill(body='# Guide\n## Section\nShared text [[split]]\n## search-option-0\nReserved heading')
        elif path.startswith('/content/split/'):
            if state['held']:
                held.append(route)
            else:
                route.fulfill(body='## Split section\nShared text [[guide]] [[Old title]]')
        elif path == '/content/legacy.md':
            route.fulfill(body='# Legacy\nShared text [[Old title#Section]]')
        else:
            route.continue_()
    context.route('**/*', fixture)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/?page=guide')
    expect(page).to_have_title('Original title - Test Wiki')
    expect(page.locator('.article-links')).to_contain_text('Split')
    expect(page.locator('.article-links')).to_contain_text('Legacy')
    expect(page.locator('#article .wiki-link').first).to_have_attribute('href', BASE + '/?page=split')
    for reference in ['Original title', 'Old title']:
        page.goto(BASE + '/?page=' + quote(reference) + '#Section')
        expect(page).to_have_url(BASE + '/?page=guide#Section')
        expect(page.locator('#Section')).to_be_visible()
    state['title'] = 'Renamed guide'
    page.goto(BASE + '/?page=guide')
    expect(page).to_have_title('Renamed guide - Test Wiki')
    page.goto(BASE + '/?page=split')
    expect(page.locator('#article > h1')).to_have_text('Split')
    expect(page.locator('#article .wiki-link').first).to_have_text('Renamed guide')
    expect(page.locator('#article .wiki-link').first).to_have_attribute('href', BASE + '/?page=guide')
    page.goto(BASE + '/?page=Old%20title')
    expect(page).to_have_url(BASE + '/?page=guide')
    page.goto(BASE + '/?page=Legacy')
    expect(page.locator('#article h1')).to_have_text('Legacy')
    expect(page.locator('#article .wiki-link')).to_have_attribute('href', BASE + '/?page=guide#Section')
    page.goto(BASE + '/?page=all')
    expect(page.locator('.article-list-title')).to_have_text(['Renamed guide', 'Split', 'Legacy'])
    expect(page.locator('.article-list-title').first).to_have_attribute('href', BASE + '/?page=guide')
    page.goto(BASE + '/?tag=Guide')
    expect(page.locator('#article li a').first).to_have_attribute('href', BASE + '/?page=guide')
    page.goto(BASE)
    expect(page).to_have_title('Renamed guide - Test Wiki')
    expect(page).to_have_url(BASE + '/')
    print('PASS: ID URLs survive rename; legacy title/alias/heading links, ID Wiki links, backlinks, tag/list links, ID home and ID-less articles')

    search = page.locator('#search')
    search.fill('does-not-exist')
    expect(page.locator('.search-status')).to_have_text('一致する記事が見つかりませんでした')
    expect(search).to_have_attribute('aria-expanded', 'true')
    search.press('Enter')
    expect(page).to_have_url(BASE + '/')
    search.fill('Shared')
    expect(page.locator('#search-results strong')).to_have_text(['Renamed guide', 'Split', 'Legacy'])
    expect(page.locator('.search-status')).to_have_text('3件の記事が見つかりました')
    before = page.evaluate('scrollY')
    search.press('ArrowDown')
    expect(search).to_have_attribute('aria-activedescendant', 'search-option-0')
    expect(page.locator('#search-option-0')).to_have_attribute('aria-selected', 'true')
    expect(page.locator('[id="search-option-0"]')).to_have_count(1)
    search.press('ArrowDown')
    expect(search).to_have_attribute('aria-activedescendant', 'search-option-1')
    search.press('ArrowUp')
    expect(search).to_have_attribute('aria-activedescendant', 'search-option-0')
    search.press('ArrowUp')
    expect(search).to_have_attribute('aria-activedescendant', 'search-option-2')
    assert page.evaluate('scrollY') == before
    search.press('ArrowDown')
    search.press('ArrowDown')
    search.press('Enter')
    expect(page).to_have_url(BASE + '/?page=split')
    expect(page.locator('#article > h1')).to_have_text('Split')
    search.fill('Old title')
    expect(page.locator('#search-results strong').first).to_have_text('Renamed guide')
    search.press('Enter')
    expect(page).to_have_url(BASE + '/?page=guide')
    expect(page).to_have_title('Renamed guide - Test Wiki')
    search.fill('Shared')
    expect(page.locator('#search-results a')).to_have_count(3)
    search.press('ArrowDown')
    search.press('Escape')
    expect(search).to_have_attribute('aria-expanded', 'false')
    assert search.get_attribute('aria-activedescendant') is None
    expect(search).to_have_value('Shared')
    search.press('ArrowDown')
    expect(page.locator('#search-results a')).to_have_count(3)
    search.press('Tab')
    expect(page.locator('#search-results')).to_be_hidden()
    search.fill('Shared')
    expect(page.locator('#search-results a')).to_have_count(3)
    search.evaluate('(e) => e.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter",isComposing:true,bubbles:true}))')
    expect(page).to_have_url(BASE + '/?page=guide')
    search.evaluate('(e) => {e.value="Split";e.dispatchEvent(new InputEvent("input",{isComposing:true,bubbles:true}));}')
    expect(page.locator('#search-results')).to_be_hidden()
    search.evaluate('(e) => e.dispatchEvent(new CompositionEvent("compositionend",{bubbles:true}))')
    expect(page.locator('#search-results strong')).to_have_text(['Renamed guide', 'Split'])
    print('PASS: empty results, counts, keyboard selection/wrapping, Enter navigation, alias search, Escape/Tab dismissal and Japanese IME')

    state['held'] = True
    page.goto(BASE + '/?page=guide', wait_until='domcontentloaded')
    search.fill('Shared')
    search.fill('no-match')
    search.fill('')
    for route in held:
        route.fulfill(body='## Split section\nShared')
    state['held'] = False
    expect(page.locator('.article-links')).to_be_visible()
    expect(page.locator('#search-results')).to_be_empty()
    assert not errors, errors
    print('PASS: clearing query during delayed indexing does not restore stale results; no browser errors')

    state['articles'] = [{'id': f'r{i}', 'title': f'Result {i}', 'file': 'guide.md'} for i in range(25)]
    page.goto(BASE + '/?page=all')
    search.fill('Shared')
    expect(page.locator('#search-results a')).to_have_count(25)
    before = page.evaluate('scrollY')
    search.press('ArrowUp')
    expect(search).to_have_attribute('aria-activedescendant', 'search-option-24')
    assert page.locator('#search-results').evaluate('(e) => e.scrollTop > 0')
    result = page.locator('#search-option-24').bounding_box()
    dropdown = page.locator('#search-results').bounding_box()
    assert result['y'] >= dropdown['y']
    assert result['y'] + result['height'] <= dropdown['y'] + dropdown['height'] + 1
    assert page.evaluate('scrollY') == before
    search.press('Enter')
    expect(page).to_have_url(BASE + '/?page=r24')
    expect(page).to_have_title('Result 24 - Test Wiki')
    print('PASS: last keyboard candidate stays visible in a scrollable 25-result dropdown; article scroll position is unchanged')

    base_article = {'id': 'one', 'title': 'First', 'file': 'guide.md'}
    cases = [
        ([base_article, {'id': 'one', 'title': 'Second', 'file': 'legacy.md'}], '重複'),
        ([base_article, {'id': 'two', 'title': 'one', 'file': 'legacy.md'}], '重複'),
        ([base_article, {'id': 'two', 'title': 'Second', 'aliases': ['First'], 'file': 'legacy.md'}], '重複'),
        ([{'id': 'all', 'title': 'First', 'file': 'guide.md'}], '予約名'),
        ([{'id': 'Bad ID', 'title': 'First', 'file': 'guide.md'}], 'id は'),
        ([{'id': 'one', 'title': 'First', 'aliases': 'bad', 'file': 'guide.md'}], 'aliases'),
    ]
    for entries, message in cases:
        state['articles'] = entries
        page.goto(BASE + '/?page=guide')
        expect(page.locator('#article h1')).to_have_text('読み込みに失敗しました')
        expect(page.locator('#article p')).to_contain_text(message)
    print('PASS: ambiguous references, reserved IDs and invalid metadata are diagnosed')
    browser.close()
