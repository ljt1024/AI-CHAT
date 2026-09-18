"""Live browser smoke test; uses the backend's configured model API (billable).

Usage: python3 scripts/verify_agents.py --url http://127.0.0.1:5175/ai
Requires: pip install playwright && playwright install chromium
Start frontend/backend separately before running.
"""
import argparse
import uuid
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:5174/ai')
parser.add_argument('--model', default='deepseek-reasoner')
args = parser.parse_args()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    try:
        page = browser.new_page()
        errors = []
        streams = []
        requests = []
        page.on('request', lambda request: requests.append(request.post_data_json)
                if request.url.endswith('/api/agents/run') else None)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('response', lambda response: streams.append(response.headers.get('content-type', ''))
                if response.url.endswith('/api/agents/run') else None)
        page.goto(args.url)
        page.wait_for_load_state('networkidle')
        page.evaluate('(model) => localStorage.setItem("selectedModelId", model)', args.model)
        page.reload()
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='智能体模式', exact=True).click()
        code = '紫竹' + uuid.uuid4().hex[:8]

        def send(text):
            page.locator('textarea').fill(text)
            page.locator('textarea').press('Enter')

        def completed(count):
            expect(page.locator('.agent-trace--completed')).to_have_count(count, timeout=150000)
            expect(page.locator('textarea')).to_be_enabled()
            assert page.locator('.agent-trace--failed').count() == 0

        send(f'请调用计算工具计算6*7，并记住我的测试代号是{code}。简短回答。')
        expect(page.locator('.agent-trace--running')).to_be_visible(timeout=15000)
        completed(1)
        trace = page.locator('.agent-trace').last
        expect(trace).to_have_attribute('open', '')
        expect(trace).to_contain_text('calculate')
        expect(trace).to_contain_text('观察')
        expect(page.locator('.message.bot').last).to_contain_text('42')
        print('PASS: browser ReAct tool execution, SSE, visible trace', flush=True)

        page.reload()
        page.wait_for_load_state('networkidle')
        send('我之前告诉你的测试代号是什么？只回答代号。')
        completed(2)
        expect(page.locator('.message.bot').last).to_contain_text(code)
        expect(page.locator('.agent-trace').last).to_contain_text('已读取 2 条会话记忆')
        print('PASS: reload and multi-turn memory', flush=True)

        page.reload()
        page.wait_for_load_state('networkidle')
        page.locator('.message.bot').last.locator('button.retry').first.click()
        expect(page.locator('.agent-trace--running')).to_be_visible(timeout=15000)
        completed(2)
        expect(page.locator('.agent-trace').last).to_contain_text('已读取 2 条会话记忆')
        expect(page.locator('.message.bot').last).to_contain_text(code)
        assert requests[-1]['turnId'] == requests[-2]['turnId']
        print('PASS: regeneration after reload reuses turn ID without duplicating memory', flush=True)

        send('请委派规划智能体，写一份详细的多智能体系统实施计划，至少列出30个步骤。')
        expect(page.locator('.agent-trace--running')).to_be_visible(timeout=15000)
        page.get_by_role('button', name='停止生成', exact=True).click()
        expect(page.locator('.agent-trace--cancelled')).to_be_visible()
        expect(page.locator('textarea')).to_be_enabled()
        expect(page.locator('.agent-trace [data-status="running"]')).to_have_count(0)
        send('我的测试代号是什么？只回答代号。')
        completed(3)
        expect(page.locator('.message.bot').last).to_contain_text(code)
        expect(page.locator('.agent-trace').last).to_contain_text('已读取 4 条会话记忆')
        assert streams and all('text/event-stream' in value for value in streams), streams
        assert not errors, errors
        page.screenshot(path='/tmp/agent-browser-smoke.png', full_page=True)
        print('PASS: cancel, subsequent request, memory unchanged, no browser errors', flush=True)
    finally:
        browser.close()
