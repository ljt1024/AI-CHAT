"""Live browser check for incremental step rendering. Calls the configured model API.

python3 scripts/verify_step_stream.py --url http://127.0.0.1:5175/ai
"""
import argparse
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:5175/ai')
parser.add_argument('--model', default='deepseek-chat')
args = parser.parse_args()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    try:
        page = browser.new_page(locale='zh-CN')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.url)
        page.wait_for_load_state('networkidle')
        page.evaluate('(model) => localStorage.setItem("selectedModelId", model)', args.model)
        page.reload()
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='智能体模式', exact=True).click()
        page.evaluate('''() => {
          window.stepSamples = {};
          const observer = new MutationObserver(() => {
            document.querySelectorAll('.agent-trace--running li[data-status="running"]').forEach(el => {
              const id = el.dataset.stepId;
              const text = el.querySelector('pre').textContent;
              const samples = window.stepSamples[id] ||= {phase: el.dataset.phase, updates: []};
              if (text && samples.updates.at(-1)?.text !== text) {
                samples.updates.push({time: performance.now(), text});
              }
            });
          });
          observer.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true});
        }''')
        page.locator('textarea').fill('请先用一句话说明执行计划，然后调用写作智能体写一个200字的小故事，最后简短总结。')
        page.locator('textarea').press('Enter')
        expect(page.locator('.agent-trace--running')).to_be_visible(timeout=15000)
        expect(page.locator('.agent-trace--completed')).to_be_visible(timeout=180000)
        samples = page.evaluate('Object.values(window.stepSamples)')
        for phase in ['thought', 'action', 'observation']:
            candidates = [item for item in samples if item['phase'] == phase and len(item['updates']) > 1]
            assert candidates, f'No incremental {phase} rendering: {samples}'
            sample = max(candidates, key=lambda item: len(item['updates']))
            elapsed = sample['updates'][-1]['time'] - sample['updates'][0]['time']
            print(f'PASS: {phase}: {len(sample["updates"])} visible updates over {elapsed:.0f}ms', flush=True)
        assert not errors, errors
        expect(page.locator('.agent-trace li[data-status="running"]')).to_have_count(0)
        page.screenshot(path='/tmp/agent-step-stream.png', full_page=True)
        print('PASS: all step phases grew while the run was still in progress; no browser errors', flush=True)
    finally:
        browser.close()
