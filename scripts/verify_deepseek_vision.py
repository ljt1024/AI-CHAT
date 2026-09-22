"""Live DeepSeek Files API, chat, agent and image-memory check (billable)."""
import argparse
from playwright.sync_api import sync_playwright, expect
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:5175/ai')
args = parser.parse_args()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(locale='zh-CN')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    fixture = browser.new_page(viewport={'width':600,'height':400})
    fixture.set_content('<body style="background:white;font:60px sans-serif;text-align:center"><p>TEST 42</p><div style="margin:auto;width:120px;height:120px;background:#19a453;border-radius:50%"></div></body>')
    png = fixture.screenshot()
    fixture.close()
    page.goto(args.url)
    page.wait_for_load_state('networkidle')
    page.get_by_role('button', name='切换模型', exact=True).click()
    page.get_by_role('button', name='多模态', exact=True).click()
    page.locator('.modelCard').filter(has_text='DeepSeek Flash').click()
    page.locator('textarea').click()
    assert page.locator('input[type=file]').get_attribute('accept') == 'image/jpeg,image/png,image/gif,image/webp'
    for agent in [False, True]:
        if agent:
            page.get_by_role('button', name='开启新对话', exact=True).click()
            page.get_by_role('button', name='智能体模式', exact=True).click()
        with page.expect_response('**/api/files/upload', timeout=150000) as uploaded:
            page.locator('input[type=file]').set_input_files({'name':'vision-test.png','mimeType':'image/png','buffer':png})
        assert uploaded.value.status == 200, uploaded.value.text()
        data = uploaded.value.json()['data']
        assert data['providerFileId'].startswith('file-')
        assert data['storageProvider'] == 'local'
        page.locator('textarea').fill('请说出图片中的文字、形状和颜色，简短回答。')
        endpoint = '**/api/agents/run' if agent else '**/api/chat/completions'
        with page.expect_request(endpoint) as sent:
            page.get_by_role('button', name='发送消息', exact=True).click()
        body = sent.value.post_data_json
        if agent:
            assert body['fileIds'] == [data['fileId']]
            expect(page.locator('.agent-trace--completed').last).to_be_visible(timeout=180000)
        else:
            assert any(part.get('file_id') == data['providerFileId'] for part in body['messages'][-1]['content'])
        expect(page.get_by_role('button', name='停止生成', exact=True)).to_have_count(0, timeout=180000)
        expect(page.locator('.messages-content')).to_contain_text('42')
        page.reload()
        page.locator('textarea').fill('刚才图片中的形状是什么颜色？简短回答。')
        page.get_by_role('button', name='发送消息', exact=True).click()
        expect(page.get_by_role('button', name='停止生成', exact=True)).to_have_count(0, timeout=180000)
        expect(page.locator('.messages-content')).to_contain_text('绿')
        print('PASS: agent' if agent else 'PASS: chat', 'upload, file reference, image recognition and follow-up after reload')
    assert not errors, errors
    browser.close()
