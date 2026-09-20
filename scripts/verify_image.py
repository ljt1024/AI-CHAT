"""Real browser -> LangGraph -> Qwen-Image-2.0 generation (one billable image)."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:5175/ai')
args = parser.parse_args()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(locale='zh-CN', viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(args.url)
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('button', name='文生图', exact=True)).to_have_count(0)
    page.get_by_role('button', name='切换模型', exact=True).click()
    page.locator('.modelCard').filter(has_text='Qwen-Image-2.0').click()
    page.locator('textarea').click()
    expect(page.locator('.modelName')).to_have_text('Qwen-Image-2.0')
    page.get_by_role('button', name='文生图', exact=True).click()
    expect(page.get_by_role('button', name='智能体模式', exact=True)).to_have_count(0)
    box = page.locator('textarea')
    expect(box).to_have_value('请使用 Qwen-Image-2.0 生成一张图片：')
    box.fill('一只窗边的小橘猫，温暖阳光，水彩插画')
    with page.expect_request('**/api/agents/run') as sent:
        page.get_by_role('button', name='发送消息', exact=True).click()
    assert sent.value.post_data_json['model'] == 'qwen-image-2.0'
    expect(page.locator('.artifact-preview')).to_be_visible(timeout=90000)
    expect(page.locator('.artifact-preview-status')).to_contain_text('生成', timeout=90000)
    expect(page.locator('.artifact-generated-image')).to_be_visible(timeout=240000)
    assert page.locator('.artifact-generated-image').evaluate('(img) => img.complete && img.naturalWidth === 1024')
    expect(page.locator('.agent-trace--completed')).to_be_visible(timeout=90000)
    expect(page.locator('.agent-trace--completed')).to_contain_text('generate_image')
    page.screenshot(path='/tmp/qwen-image-browser.png', full_page=True)
    with page.expect_download() as info:
        page.locator('.agent-artifact button').last.click()
    downloaded = info.value
    assert downloaded.suggested_filename.endswith('.png')
    assert Path(downloaded.path()).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
    page.get_by_role('button', name='全屏打开', exact=True).click()
    expect(page.locator('.artifact-preview')).to_have_class('artifact-preview is-fullscreen')
    page.get_by_role('button', name='退出全屏', exact=True).click()
    page.reload()
    page.locator('.agent-artifact button').first.click()
    expect(page.locator('.artifact-generated-image')).to_be_visible(timeout=15000)
    page.get_by_role('button', name='EN', exact=True).click()
    expect(page.get_by_role('button', name='Create image', exact=True)).to_be_visible()
    page.set_viewport_size({'width': 390, 'height': 844})
    page.get_by_role('button', name='Close preview', exact=True).click()
    expect(page.get_by_role('button', name='Create image', exact=True)).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    browser.close()
print('PASS: real image generation, streamed progress, preview, PNG download, fullscreen, history, English and mobile')
