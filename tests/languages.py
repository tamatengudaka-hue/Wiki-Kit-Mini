"""Language configuration, UI and article translations. Same browser setup as other tests."""
import os
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:8080'
KEY = 'wiki-kit-mini-language'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1400,'height':900},locale='ja-JP')
    state = {'language':'en', 'hold':False, 'bad':False, 'holdConfig':True}
    held = []
    held_config = []
    def fixture(route):
        path = urlsplit(route.request.url).path
        if path == '/config.json' and state['holdConfig']:
            held_config.append(route)
        elif path == '/config.json':
            route.fulfill(json={'name':'Wiki Kit Mini','home':'auto','language':state['language'],
                                'notFound':'./system/not-found.md','notFoundTranslations':{'en':'./system/en/not-found.md'}})
        elif path == '/content/articles.json' and state['bad']:
            route.fulfill(json=[{'id':'bad','title':'Broken','file':'bad.md','translations':[]}])
        elif path == '/content/articles.json' and state.get('fallback'):
            route.fulfill(json=[{'id':'plain','title':'未翻訳記事','file':'plain.md','tags':['作者タグ']}])
        elif path == '/content/plain.md':
            route.fulfill(body='# 未翻訳の本文\nOriginal-only phrase')
        elif path == '/content/en/welcome.md' and state['hold']:
            held.append(route)
        else:
            route.continue_()
    context.route('**/*',fixture)
    page = context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def switch(lang):
        page.locator('#language-select').select_option(lang)
        expect(page.locator('html')).to_have_attribute('lang',lang)
    page.goto(BASE+'/?page=welcome',wait_until='domcontentloaded')
    expect(page.locator('.site-header')).to_be_hidden()
    state['holdConfig']=False
    for route in held_config:
        route.fulfill(json={'name':'Wiki Kit Mini','home':'auto','language':'en',
                            'notFound':'./system/not-found.md','notFoundTranslations':{'en':'./system/en/not-found.md'}})
    expect(page.locator('#article h1')).to_have_text('Welcome to Wiki Kit Mini')
    expect(page.locator('.site-header')).to_be_visible()
    expect(page.locator('#search')).to_have_attribute('placeholder','Search articles...')
    expect(page.locator('.header-articles')).to_have_text('All articles')
    expect(page.locator('#theme-label')).to_have_text('Auto')
    expect(page.locator('.code-copy').first).to_have_text('Copy')
    expect(page.locator('.toc-title')).to_have_text('Contents')
    expect(page.locator('#theme-toggle')).to_have_attribute('aria-label','Theme: Auto. Switch to Light')
    page.locator('#search').fill('No database')
    expect(page.locator('#search-results strong')).to_have_text('Welcome')
    expect(page.locator('.search-status')).to_have_text('1 matching article')
    page.keyboard.press('Escape')
    switch('ja')
    expect(page.locator('#article h1')).to_have_text('Wiki Kit Miniへようこそ')
    expect(page).to_have_url(BASE+'/?page=welcome')
    page.locator('#search').fill('No database')
    expect(page.locator('.search-status')).to_have_text('一致する記事が見つかりませんでした')
    page.keyboard.press('Escape')
    expect(page.locator('#theme-label')).to_have_text('自動')
    page.reload()
    expect(page.locator('#article h1')).to_have_text('Wiki Kit Miniへようこそ')
    switch('en')
    expect(page.locator('#article h1')).to_have_text('Welcome to Wiki Kit Mini')
    page.goto(BASE+'/?page=split-demo')
    expect(page.locator('#article > h1')).to_have_text('Split article demo')
    expect(page.locator('.split-article-section')).to_have_count(5)
    expect(page.locator('.article-links')).to_contain_text('Welcome')
    page.locator('#search').fill('two columns')
    expect(page.locator('#search-results strong')).to_have_text('Split article demo')
    page.locator('#search').press('ArrowDown')
    page.locator('#search').press('Enter')
    expect(page).to_have_url(BASE+'/?page=split-demo')
    expect(page.locator('.split-article-section')).to_have_count(5)
    switch('ja')
    expect(page.locator('#article > h1')).to_have_text('分割記事サンプル')
    expect(page).to_have_url(BASE+'/?page=split-demo')
    switch('en')
    expect(page.locator('#article > h1')).to_have_text('Split article demo')
    page.goto(BASE+'/?page=all')
    expect(page.locator('#article h1')).to_have_text('All articles')
    expect(page.locator('.article-list-title')).to_have_text(['Welcome','Split article demo'])
    page.goto(BASE+'/?tag=Guide')
    expect(page.locator('#article h1')).to_have_text('Tag: Guide')
    page.goto(BASE+'/?page=Missing')
    expect(page.locator('#article')).to_contain_text('has not been created yet')
    switch('ja')
    expect(page.locator('#article')).to_contain_text('まだ作成されていません')
    print('PASS: config language overrides browser locale, live UI/article switching, stable URLs, persistence, search language, translated split/list/tag/missing pages')

    # The select must remain available and the layout must not overflow on mobile.
    page.set_viewport_size({'width':320,'height':844})
    page.goto(BASE+'/?page=split-demo')
    expect(page.locator('.split-article-section')).to_have_count(5)
    page.locator('#sidebar-toggle').click()
    expect(page.locator('#language-select')).to_be_visible()
    switch('en')
    expect(page.locator('#article > h1')).to_have_text('Split article demo')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='/tmp/wiki-english-mobile.png')
    page.set_viewport_size({'width':1400,'height':900})
    state['hold']=True
    page.goto(BASE+'/?page=welcome',wait_until='domcontentloaded')
    expect(page.locator('#language-select')).to_have_value('en')
    switch('ja')
    expect(page.locator('#article h1')).to_have_text('Wiki Kit Miniへようこそ')
    for route in held: route.fulfill(body='# Stale English response')
    state['hold']=False
    expect(page.locator('#article h1')).to_have_text('Wiki Kit Miniへようこそ')
    print('PASS: mobile selector/layout and stale responses during language changes')

    state['fallback']=True
    switch('en')
    page.goto(BASE+'/?page=plain')
    expect(page.locator('#article h1')).to_have_text('未翻訳の本文')
    expect(page.locator('.article-tag')).to_have_text('作者タグ')
    expect(page.locator('.header-articles')).to_have_text('All articles')
    state.pop('fallback')
    other=context.new_page();other.goto(BASE+'/?page=all')
    switch('ja')
    expect(other.locator('#article h1')).to_have_text('記事一覧')
    print('PASS: untranslated article fallback, original tags and cross-tab language sync')
    state['bad']=True
    switch('en')
    page.goto(BASE)
    expect(page.locator('#article h1')).to_have_text('Failed to load')
    expect(page.locator('#article p')).to_contain_text('translations must be an object')
    state['bad']=False
    assert not errors,errors

    # Missing/unsupported defaults use Japanese, even with an English browser locale.
    for value in [None,'fr']:
        state['language']=value
        fresh=browser.new_context(locale='en-US');fresh.route('**/*',fixture)
        tab=fresh.new_page();tab.goto(BASE+'/?page=welcome')
        expect(tab.locator('html')).to_have_attribute('lang','ja')
        expect(tab.locator('#article h1')).to_have_text('Wiki Kit Miniへようこそ')
        fresh.close()
    blocked=browser.new_context();blocked.route('**/*',fixture)
    blocked.add_init_script('Object.defineProperty(window,"localStorage",{get(){throw new Error("blocked")}})')
    tab=blocked.new_page();tab.goto(BASE+'/?page=welcome')
    expect(tab.locator('#article h1')).to_have_text('Wiki Kit Miniへようこそ')
    tab.locator('#language-select').select_option('en')
    expect(tab.locator('#article h1')).to_have_text('Welcome to Wiki Kit Mini')
    expect(tab).to_have_url(BASE+'/?page=welcome')
    print('PASS: unsupported/default language fallback, invalid translation diagnostics and storage-blocked live switching')
    browser.close()
