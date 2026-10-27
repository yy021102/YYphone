import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeApiEndpoint, parseApiEndpoint } from './apiEndpoint';

test('API address paste formatting is cleaned without rewriting routes or query signatures', () => {
  for (const value of [
    'https://api.deepseek.com', ' https://api.deepseek.com ', '“https://api.deepseek.com”',
    '`https://api.deepseek.com`', '<https://api.deepseek.com>', '\u200Ehttps://api.deepseek.com\u2060',
    'https：／／api.deepseek.com', 'h\u200Bttps://api.\u200Fdeepseek.com',
  ]) {
    assert.equal(normalizeApiEndpoint(value), 'https://api.deepseek.com');
    assert.equal(parseApiEndpoint(value).origin, 'https://api.deepseek.com');
  }
  const route = '/V1/Route／Name?signature=Ab%2fCd&text=：&text=／&opaque=\u200B';
  assert.equal(normalizeApiEndpoint(`“https：//proxy.invalid${route}”`), `https://proxy.invalid${route}`);
  assert.equal(normalizeApiEndpoint('http://localhost:8000/v1'), 'http://localhost:8000/v1');
});

test('invalid or unsafe API addresses are still rejected without exposing their content', () => {
  for (const value of ['api.deepseek.com', '地址：https://api.deepseek.com', 'javascript:alert(1)',
    'file:///private', 'https://user:PRIVATE_KEY@proxy.invalid', 'https://']) {
    assert.throws(() => parseApiEndpoint(value), error => error instanceof Error && /HTTP/.test(error.message) && !error.message.includes('PRIVATE_KEY'));
  }
});
