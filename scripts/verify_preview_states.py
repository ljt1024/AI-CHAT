"""Exercise preview UI against previously generated live backend files.
Usage: python3 scripts/verify_preview_states.py /path/to/artifacts.json
"""
import json
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright, expect

artifact_path = Path(sys.argv[1])
artifacts = json.loads(artifact_path.read_text())
output_dir = artifact_path.parent
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(locale='zh-CN', viewport={"width": 1600, "height": 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:5175/ai')
    page.evaluate('''(files) => {
      localStorage.setItem('messages', JSON.stringify([{covId:'preview-qa-state', covTitle:'Preview QA', data:[{role:'assistant',isBot:true,content:'已生成文件。',artifacts:files}]}]));
      localStorage.setItem('selectCovId','preview-qa-state');
      localStorage.setItem('isNewCov','false');
    }''', artifacts)
    page.reload()
    page.wait_for_load_state('networkidle')
    panel = page.locator('.artifact-preview')
    pdf = next(file for file in artifacts if file['format'] == 'pdf')
    ppt = next(file for file in artifacts if file['format'] == 'pptx')
    open_ppt = page.get_by_role('button', name=f'预览 {ppt["fileName"]}', exact=True)
    page.route(f'**/api/files/{ppt["previewFileId"]}/download', lambda route: route.fulfill(status=404, content_type='application/json', body='{"msg":"file missing"}'))
    open_ppt.click()
    expect(panel.get_by_role('alert')).to_be_visible(timeout=30000)
    page.unroute(f'**/api/files/{ppt["previewFileId"]}/download')
    panel.get_by_role('button', name='重新加载', exact=True).click()
    expect(panel.locator('canvas')).to_be_visible(timeout=30000)
    panel.get_by_role('button', name='放大', exact=True).click()
    expect(panel.get_by_role('button', name='适应宽度', exact=True)).to_have_text('125%')
    expect(panel.locator('canvas')).to_be_visible()
    panel.get_by_role('button', name='适应宽度', exact=True).click()
    select = panel.get_by_role('combobox')
    for file in [pdf, ppt, pdf, ppt]:
        select.select_option(file['fileId'])
    expect(panel.locator('canvas')).to_be_visible(timeout=30000)
    page.screenshot(path=str(output_dir / 'desktop-fixed.png'))
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(500)
    expect(panel.locator('.artifact-preview-loading')).to_have_count(0, timeout=30000)
    expect(panel.locator('canvas')).to_be_visible()
    expect(page.locator('.messages-content')).to_be_hidden()
    page.screenshot(path=str(output_dir / 'mobile-fixed.png'))
    panel.get_by_role('button', name='下一页', exact=True).click()
    expect(panel.locator('nav span')).to_have_text('2 / 2')
    expect(panel.locator('canvas')).to_be_visible()
    page.screenshot(path=str(output_dir / 'mobile-page2-fixed.png'))
    page.keyboard.press('Escape')
    expect(panel).to_have_count(0)
    expect(page.locator('.messages-content')).to_be_visible()
    page.set_viewport_size({"width": 1600, "height": 1000})
    open_ppt.click()
    expect(panel.locator('canvas')).to_be_visible()
    page.get_by_text('新开对话', exact=True).click()
    expect(panel).to_have_count(0)
    assert not errors, errors
    print(f'PASS: error/retry, zoom, rapid switching, mobile redraw/close, conversation isolation. Evidence: {output_dir}')
    browser.close()
