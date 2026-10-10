"""Dynamic metadata regressions. Uses the same local server/browser setup as other tests."""
import os
from urllib.parse import quote
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:8080'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    page=browser.new_page()
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def meta(key,prop=False):
        return page.locator(f'meta[{"property" if prop else "name"}="{key}"]')
    def verify(title,url,kind='website'):
        expect(page).to_have_title(title)
        expect(meta('og:title',True)).to_have_attribute('content',title)
        expect(meta('twitter:title')).to_have_attribute('content',title)
        expect(meta('og:type',True)).to_have_attribute('content',kind)
        expect(meta('og:url',True)).to_have_attribute('content',url)
        expect(page.locator('link[rel=canonical]')).to_have_attribute('href',url)
        description=meta('description').get_attribute('content')
        assert description and len(description)<=160
        expect(meta('og:description',True)).to_have_attribute('content',description)
        expect(meta('twitter:description')).to_have_attribute('content',description)
        for key in ['og:title','og:description','og:site_name','og:type','og:url','og:locale']:
            expect(meta(key,True)).to_have_count(1)
        for key in ['description','twitter:title','twitter:description','twitter:card']:
            expect(meta(key)).to_have_count(1)
        expect(page.locator('link[rel=canonical]')).to_have_count(1)
        return description
    page.goto(BASE+'/')
    description=verify('Wiki Kit Mini',BASE+'/')
    assert 'へようこそ' in description
    page.goto(BASE+'/?page=Welcome&utm_source=test#記事を追加する')
    expect(page.locator('#article h1')).to_have_text('Wiki Kit Miniへようこそ')
    description=verify('Welcome - Wiki Kit Mini',BASE+'/?page=welcome','article')
    assert 'Markdown' in description and 'コピー' not in description
    page.goto(BASE+'/?page=split-demo')
    expect(page.locator('.split-article-section')).to_have_count(5)
    description=verify('分割記事サンプル - Wiki Kit Mini',BASE+'/?page=split-demo','article')
    assert '5つのMarkdown' in description
    page.locator('#language-select').select_option('en')
    expect(page.locator('#article > h1')).to_have_text('Split article demo')
    description=verify('Split article demo - Wiki Kit Mini',BASE+'/?page=split-demo','article')
    assert 'five Markdown' in description
    expect(meta('og:locale',True)).to_have_attribute('content','en_US')
    for lang in ['ja','en','ja','en']:
        page.locator('#language-select').select_option(lang)
        expect(page.locator('#article > h1')).to_have_text('Split article demo' if lang=='en' else '分割記事サンプル')
        verify(('Split article demo' if lang=='en' else '分割記事サンプル')+' - Wiki Kit Mini',BASE+'/?page=split-demo','article')
    page.goto(BASE+'/?page=all')
    verify('All articles - Wiki Kit Mini',BASE+'/?page=all')
    page.goto(BASE+'/?tag=Guide#discard')
    verify('Tag: Guide - Wiki Kit Mini',BASE+'/?tag=Guide')
    page.goto(BASE+'/?page=Missing')
    description=verify('Missing - Wiki Kit Mini',BASE+'/?page=Missing')
    assert 'has not been created yet' in description
    print('PASS: home, article, split, list, tag, missing-page metadata; canonical IDs; language updates; singleton tags')

    # Text is sanitized by article rendering, then assigned as attributes, never as head HTML.
    page.route('**/content/articles.json',lambda r:r.fulfill(json=[{'id':'safe','title':'Quotes " <script>','file':'safe.md'}]))
    page.route('**/content/safe.md',lambda r:r.fulfill(body='# Heading\n\nText " & <script>window.injected=true</script>\n\n'+('😀' * 170)+'\n\n```text\nSECRET_CODE_ONLY\n```'))
    page.goto(BASE+'/?page=safe')
    expect(page.locator('#article h1')).to_have_text('Heading')
    description=verify('Quotes " <script> - Wiki Kit Mini',BASE+'/?page=safe','article')
    assert not page.evaluate('Boolean(window.injected)')
    assert 'SECRET_CODE_ONLY' not in description
    assert '\ud83d' not in description and len(description)==160
    page.route('**/content/safe.md',lambda r:r.fulfill(status=404,body='missing'))
    page.reload()
    expect(page.locator('#article h1')).to_have_text('Failed to load')
    verify('Failed to load - Wiki Kit Mini',BASE+'/?page=safe')
    assert not errors,errors
    print('PASS: safe attribute assignment, Unicode limit, code exclusion and error metadata')
    browser.close()
