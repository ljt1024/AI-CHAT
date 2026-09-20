import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

function read(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function keysIn(value) { return [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort(); }
const frontend = read('src/app/i18n/locales/zh.json');
const backend = read('end/src/i18n/locales/zh.json');
for (const folder of ['src/app/i18n/locales', 'end/src/i18n/locales']) {
  const zh = read(`${folder}/zh.json`), en = read(`${folder}/en.json`);
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort(), `${folder}: keys differ`);
  for (const key of Object.keys(zh)) {
    assert.ok(zh[key] && en[key], `Empty translation: ${key}`);
    assert.deepEqual(keysIn(zh[key]), keysIn(en[key]), `Interpolation mismatch: ${key}`);
  }
}
for (const key of Object.keys(frontend).filter(key => key.startsWith('server.'))) {
  for (const language of ['zh', 'en']) {
    assert.equal(read(`src/app/i18n/locales/${language}.json`)[key], read(`end/src/i18n/locales/${language}.json`)[key.slice(7)], `System progress differs: ${key}`);
  }
}
function scan(folder, resources) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) { scan(path, resources); continue; }
    if (!/\.(tsx?|js)$/.test(path)) continue;
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        assert.ok(node.arguments[0].text in resources, `Missing key ${node.arguments[0].text} in ${path}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
scan('src', frontend); scan('end/src', backend);
console.log('PASS: locale keys, interpolation parameters and translation references');
