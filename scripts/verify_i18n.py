"""UI language regression with the running backend and deterministic saved content."""
import argparse
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--live', action='store_true', help='Also send a real model request')
parser.add_argument('--url', default='http://127.0.0.1:5175/ai')
args = parser.parse_args()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(locale='en-US', viewport={'width': 1600, 'height': 1000})
    page = context.new_page()
    errors = []
    model_urls = []
    page.on('request', lambda request: model_urls.append(request.url) if urlsplit(request.url).path == '/api/models' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url)
    page.wait_for_load_state('networkidle')
    expect(page.locator('html')).to_have_attribute('lang', 'en')
    expect(page.get_by_placeholder('Ask anything...')).to_be_visible()
    expect(page.get_by_text('0 conversations', exact=True)).to_be_visible()
    page.get_by_role('button', name='Models', exact=True).click()
    expect(page.get_by_text('DeepSeek general conversation model', exact=True)).to_be_visible()
    page.locator('h1').click()
    page.get_by_role('button', name='中文', exact=True).click()
    expect(page.get_by_placeholder('请输入你的问题...')).to_be_visible()
    expect(page.locator('html')).to_have_attribute('lang', 'zh-CN')
    page.reload()
    expect(page.get_by_placeholder('请输入你的问题...')).to_be_visible()
    file = {'fileId': '11111111-1111-4111-8111-111111111111', 'fileName': 'user-page.html', 'format': 'html', 'size': 100, 'mimeType': 'text/html', 'createdAt': ''}
    page.evaluate('''file => {
      const message = {role:'assistant',isBot:true,content:'用户原文保持不变\\n\\n```html\\n<h1>用户内容</h1>\\n```',timestamp:'2026-09-18T12:30:00Z',artifacts:[file],agentStatus:'completed',memoryMessages:0,agentSteps:[{id:'step',phase:'thought',status:'completed',output:'正在结合 0 条会话记忆分析任务。',outputTranslation:{key:'server.agent.analyzing',params:{p0:0}}}]};
      localStorage.setItem('messages',JSON.stringify([{covId:'i18n-qa',title:'User title',data:[message]}]));
      localStorage.setItem('selectCovId','i18n-qa');localStorage.setItem('isNewCov','false');
    }''', file)
    page.route('**/api/files/'+file['fileId']+'/download', lambda r: r.fulfill(status=200, content_type='text/html', body='<h1>用户文件正文</h1>'))
    page.reload()
    expect(page.locator('.agent-trace')).to_contain_text('1 步')
    page.get_by_role('button', name='EN', exact=True).click()
    expect(page.locator('.agent-trace')).to_contain_text('1 step')
    expect(page.locator('.agent-trace pre')).to_have_text('Analyzing the task with 0 conversation memory messages.')
    expect(page.get_by_text('1 conversation', exact=True)).to_be_visible()
    expect(page.get_by_text('Copy code', exact=True)).to_be_visible()
    expect(page.get_by_text('用户原文保持不变', exact=True)).to_be_visible()
    page.get_by_role('button', name='Preview user-page.html', exact=True).click()
    expect(page.get_by_role('button', name='Open fullscreen', exact=True)).to_be_visible()
    expect(page.frame_locator('.artifact-html-frame').locator('h1')).to_have_text('用户文件正文')
    page.get_by_role('button', name='中文', exact=True).click()
    expect(page.get_by_role('button', name='全屏打开', exact=True)).to_be_visible()
    expect(page.frame_locator('.artifact-html-frame').locator('h1')).to_have_text('用户文件正文')
    page.get_by_role('button', name='关闭预览', exact=True).click()
    page.get_by_role('button', name='EN', exact=True).click()
    page.get_by_role('button', name='Manage chat history', exact=True).click()
    expect(page.get_by_text('Conversation Records', exact=True)).to_be_visible()
    expect(page.get_by_text('Created At', exact=True)).to_be_visible()
    page.get_by_role('button', name='Close dialog', exact=True).click()
    sibling = context.new_page()
    sibling.goto(args.url)
    sibling.wait_for_load_state('networkidle')
    sibling.get_by_role('button', name='中文', exact=True).click()
    expect(page.locator('html')).to_have_attribute('lang', 'zh-CN')
    sibling.close()
    page.get_by_role('button', name='EN', exact=True).click()
    page.set_viewport_size({'width':390,'height':844})
    expect(page.get_by_placeholder('Ask anything...')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    # Use the same backend origin as the application's model request.
    api = urlsplit(model_urls[-1])
    agent_url = f'{api.scheme}://{api.netloc}/api/agents/run'
    english = page.request.post(agent_url, headers={'Accept-Language':'en-US'}, data={})
    assert english.status == 400 and english.json()['msg'] == 'input is required', english.text()
    chinese = page.request.post(agent_url, headers={'Accept-Language':'zh-CN'}, data={})
    assert chinese.status == 400 and chinese.json()['msg'] == 'input 不能为空', chinese.text()
    if args.live:
        live = context.new_page()
        live.goto(args.url)
        live.wait_for_load_state('networkidle')
        live.evaluate("() => { localStorage.setItem('chat.agentMode','true'); localStorage.setItem('selectedModelId','deepseek-chat'); localStorage.setItem('isNewCov','true'); localStorage.removeItem('selectCovId'); }")
        live.reload()
        expect(live.get_by_role('button', name='Agent mode', exact=True)).to_have_attribute('aria-pressed','true')
        live.get_by_placeholder('Ask anything...').fill('Use the calculator tool to calculate 12 + 30. Reply in one short English sentence.')
        with live.expect_request('**/api/agents/run') as sent:
            live.get_by_role('button', name='Send message', exact=True).click()
        assert sent.value.headers['accept-language'] == 'en-US'
        expect(live.locator('.agent-trace--completed').last).to_be_visible(timeout=180000)
        expect(live.locator('.agent-trace--completed').last).to_contain_text('calculate')
        expect(live.locator('.agent-trace--completed').last).to_contain_text('42')
        print('PASS: real model English agent request, streamed tool execution and answer')
    browser.close()
print('PASS: detection, switching, persistence, pluralization, history, code/file previews, user content preservation, cross-tab sync, mobile and backend validation')
