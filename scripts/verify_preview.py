"""Live model/browser QA for PDF + PowerPoint preview.
python3 scripts/verify_preview.py --url http://127.0.0.1:5175/ai
"""
import argparse
import json
from pathlib import Path
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader
import fitz

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:5175/ai')
parser.add_argument('--model', default='deepseek-chat')
args = parser.parse_args()
output_dir = Path(tempfile.mkdtemp(prefix='agent-preview-qa-'))
print(f'Evidence: {output_dir}', flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    try:
        page = browser.new_page(viewport={"width": 1600, "height": 1000}, accept_downloads=True)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.url)
        page.wait_for_load_state('networkidle')
        page.evaluate('(model) => { localStorage.setItem("selectedModelId", model); localStorage.setItem("chat.agentMode", "true"); }', args.model)
        page.reload()
        page.wait_for_load_state('networkidle')
        page.locator('textarea').fill('请实际生成两个文件，直接调用工具即可：1.PDF，标题“项目预览报告”，正文“设计费用1200元，开发费用3400元，总预算4600元。”；2.PowerPoint（pptx），标题“项目预览演示”，严格两页：第一页标题“项目预算”，两条要点“设计费用1200元”“开发费用3400元”；第二页标题“验收计划”，两条要点“完成前后端联调”“验证下载与预览”。最后简短回答。')
        page.locator('textarea').press('Enter')
        expect(page.locator('.artifact-preview')).to_be_visible(timeout=180000)
        print('PASS: preview opened automatically on artifact', flush=True)
        expect(page.locator('.agent-artifact')).to_have_count(2, timeout=180000)
        expect(page.locator('.agent-trace--completed')).to_be_visible(timeout=180000)
        artifacts = page.evaluate('JSON.parse(localStorage.getItem("messages"))[0].data.at(-1).artifacts')
        assert {file['format'] for file in artifacts} == {'pdf', 'pptx'}, artifacts
        panel = page.locator('.artifact-preview')
        for file in artifacts:
            page.get_by_role('button', name=f'预览 {file["fileName"]}', exact=True).click()
            expect(panel.locator('canvas')).to_be_visible(timeout=30000)
            assert panel.locator('canvas').evaluate('(c) => c.width > 0 && c.height > 0')
            with page.expect_download() as download_info:
                panel.get_by_role('link', name='下载原文件').click()
            download = download_info.value
            assert download.failure() is None
            target = output_dir / download.suggested_filename
            download.save_as(target)
            if file['format'] == 'pdf':
                text = '\n'.join(pdf_page.extract_text() for pdf_page in PdfReader(target).pages)
                assert all(word in text for word in ['设计', '1200', '3400', '4600']), text
                page.screenshot(path=str(output_dir / 'pdf-panel.png'))
            else:
                assert file['pageCount'] == 2
                with zipfile.ZipFile(target) as archive:
                    slides = [ET.fromstring(archive.read(f'ppt/slides/slide{i}.xml')) for i in [1, 2]]
                    contents = [''.join(slide.itertext()) for slide in slides]
                    assert '项目预算' in contents[0] and '验收计划' in contents[1], contents
                response = page.request.get(f'http://localhost:3001/api/files/{file["previewFileId"]}/download')
                assert response.ok
                preview_path = output_dir / 'slides-preview.pdf'
                preview_path.write_bytes(response.body())
                doc = fitz.open(preview_path)
                assert len(doc) == 2
                assert '项目预算' in doc[0].get_text() and '验收计划' in doc[1].get_text()
                for i, pdf_page in enumerate(doc):
                    pdf_page.get_pixmap(matrix=fitz.Matrix(2, 2)).save(str(output_dir / f'slide-{i + 1}.png'))
                page.screenshot(path=str(output_dir / 'ppt-panel.png'))
                panel.get_by_role('button', name='下一页', exact=True).click()
                expect(panel.locator('nav span')).to_have_text('2 / 2')
                expect(panel.locator('canvas')).to_be_visible()
                expect(panel.get_by_role('button', name='下一页', exact=True)).to_be_disabled()
                page.screenshot(path=str(output_dir / 'ppt-page2.png'))
        page.get_by_role('button', name='关闭预览', exact=True).click()
        expect(panel).to_have_count(0)
        page.reload()
        page.wait_for_load_state('networkidle')
        ppt = next(file for file in artifacts if file['format'] == 'pptx')
        page.get_by_role('button', name=f'预览 {ppt["fileName"]}', exact=True).click()
        expect(panel.locator('canvas')).to_be_visible(timeout=30000)
        print('PASS: PDF/PPT download, matching preview, pagination and refresh', flush=True)
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(500)
        expect(panel.locator('.artifact-preview-loading')).to_have_count(0, timeout=30000)
        expect(panel.locator('canvas')).to_be_visible(timeout=30000)
        page.screenshot(path=str(output_dir / 'mobile.png'))
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Mobile page overflow'
        page.get_by_role('button', name='关闭预览', exact=True).click()
        expect(page.locator('textarea')).to_be_visible()
        assert not errors, errors
        (output_dir / 'artifacts.json').write_text(json.dumps(artifacts, ensure_ascii=False, indent=2))
        print(f'PASS: mobile preview/close and no browser errors. Evidence: {output_dir}', flush=True)
    finally:
        browser.close()
