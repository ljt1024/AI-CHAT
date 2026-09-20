"""Real model + browser check that HTML renders before the tool finishes.
python3 scripts/verify_live_preview.py --url http://127.0.0.1:5175/ai
"""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:5175/ai')
parser.add_argument('--model', default='deepseek-chat')
args = parser.parse_args()
output = Path(tempfile.mkdtemp(prefix='live-preview-qa-'))
print(f'Evidence: {output}', flush=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width':1600,'height':1000}, accept_downloads=True)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url)
    page.evaluate('''model => {localStorage.setItem('selectedModelId',model);localStorage.setItem('chat.agentMode','true');}''', args.model)
    page.reload()
    page.wait_for_load_state('networkidle')
    page.evaluate('''() => {
      window.previewFrames=[];
      new MutationObserver(() => {
        const frame=document.querySelector('.artifact-html-frame');
        const draft=document.querySelector('.artifact-preview-status--generating');
        if(frame && draft && document.querySelector('.agent-trace--running')) {
          const value=frame.getAttribute('srcdoc');
          if(value && window.previewFrames.at(-1)!==value) window.previewFrames.push(value);
        }
      }).observe(document.body,{subtree:true,attributes:true,childList:true});
    }''')
    page.locator('textarea').fill('请调用export_html工具生成一个可下载的独立HTML项目计划网页，title为“实时项目计划”。先写HTML主体标题“实时项目计划”，再逐个写需求、设计、开发、测试四个section，每个section含中文说明和三条检查事项。页面使用内联CSS，米白背景、深蓝标题和绿色状态标记，不用JavaScript、不用外部资源。请直接调用工具生成实际页面，最终只简短回答。')
    page.locator('textarea').press('Enter')
    panel = page.locator('.artifact-preview')
    expect(panel.locator('.artifact-preview-status--generating')).to_be_visible(timeout=180000)
    expect(panel.get_by_role('link',name='下载原文件')).to_have_count(0)
    page.wait_for_function('window.previewFrames.length >= 3', timeout=180000)
    expect(page.frame_locator('.artifact-html-frame').get_by_role('heading',name='实时项目计划',exact=True)).to_be_visible(timeout=180000)
    expect(page.locator('.agent-trace--running')).to_be_visible()
    page.screenshot(path=str(output/'during.png'))
    expect(page.locator('.agent-trace--completed')).to_be_visible(timeout=180000)
    expect(panel.locator('.artifact-preview-status')).to_have_count(0)
    frame = page.frame_locator('.artifact-html-frame')
    expect(frame.get_by_role('heading',name='实时项目计划',exact=True)).to_be_visible(timeout=30000)
    assert frame.locator('section').count() >= 4
    frames = page.evaluate('window.previewFrames')
    assert len(frames) >= 3
    visible_versions = page.evaluate('''() => [...new Set(window.previewFrames.map(source => {const doc = new DOMParser().parseFromString(source, 'text/html');return [...doc.querySelectorAll('h1,h2,p,li')].map(el => el.textContent).join('');}).filter(Boolean))]''')
    assert len(visible_versions) >= 2, 'No incremental visible body content'
    print(f'PASS: {len(visible_versions)} distinct visible body snapshots before completion', flush=True)
    print(f'PASS: {len(frames)} distinct HTML frames while agent is running', flush=True)
    with page.expect_download() as download_info:
        panel.get_by_role('link',name='下载原文件',exact=True).click()
    file = download_info.value
    file.save_as(output/file.suggested_filename)
    assert file.failure() is None
    text = (output/file.suggested_filename).read_text()
    assert '实时项目计划' in text
    page.screenshot(path=str(output/'complete.png'))
    artifact = page.evaluate('JSON.parse(localStorage.getItem("messages"))[0].data.at(-1).artifacts[0]')
    (output/'artifact.json').write_text(json.dumps(artifact,ensure_ascii=False,indent=2))
    page.reload()
    page.get_by_role('button',name=f'预览 {artifact["fileName"]}',exact=True).click()
    expect(frame.get_by_role('heading',name='实时项目计划',exact=True)).to_be_visible(timeout=30000)
    panel.get_by_role('button',name='全屏打开',exact=True).click()
    page.wait_for_function('!!document.fullscreenElement')
    expect(frame.get_by_role('heading',name='实时项目计划',exact=True)).to_be_visible()
    panel.get_by_role('button',name='退出全屏',exact=True).click()
    page.set_viewport_size({'width':390,'height':844})
    expect(frame.get_by_role('heading',name='实时项目计划',exact=True)).to_be_visible()
    page.screenshot(path=str(output/'mobile.png'))
    assert not errors, errors
    browser.close()
print(f'PASS: saved download, refresh, fullscreen, mobile. Evidence: {output}', flush=True)
