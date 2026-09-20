const { AsyncLocalStorage } = require('node:async_hooks');
const { createInstance } = require('i18next');
const { z } = require('zod');
const zh = require('./locales/zh.json');
const en = require('./locales/en.json');
const context = new AsyncLocalStorage();
const instances = {};
for (const language of ['zh', 'en']) {
  const instance = createInstance();
  instance.init({ resources: { zh: { translation: zh }, en: { translation: en } },
    lng: language, fallbackLng: 'zh', initAsync: false, keySeparator: false,
    interpolation: { escapeValue: false, prefix: '{', suffix: '}' } });
  instances[language] = instance;
}
function negotiateLanguage(header = '') {
  const choices = String(header).split(',').map((part, index) => {
    const [tag, ...parameters] = part.trim().split(';');
    const q = parameters.find(value => value.trim().startsWith('q='));
    return { tag, quality: q ? Number(q.trim().slice(2)) : 1, index };
  }).filter(item => Number.isFinite(item.quality) && item.quality > 0 && item.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const { tag } of choices) {
    if (/^en(?:-|$)/i.test(tag)) return 'en';
    if (/^zh(?:-|$)/i.test(tag)) return 'zh';
  }
  return 'zh';
}
const getLanguage = () => context.getStore() || 'zh';
const validationLocales = { zh: z.locales.zhCN(), en: z.locales.en() };
z.config({ customError: issue => validationLocales[getLanguage()].localeError(issue) });
const withLanguage = (language, callback) => context.run(negotiateLanguage(language), callback);
const t = (key, params) => instances[getLanguage()].t(key, params);
function languageMiddleware(req, res, next) {
  const language = negotiateLanguage(req.headers['accept-language']);
  res.setHeader('Content-Language', language === 'zh' ? 'zh-CN' : 'en');
  res.vary('Accept-Language');
  withLanguage(language, next);
}
module.exports = { t, getLanguage, withLanguage, negotiateLanguage, languageMiddleware };
