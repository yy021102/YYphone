import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { DOMParser as XmlDOMParser } from '@xmldom/xmldom';
import { epubChapterText, epubPath, readEpub } from './epubImport';

Object.defineProperty(globalThis, 'DOMParser', { configurable: true, value: class {
  parseFromString(source: string, type: string) {
    return new XmlDOMParser({ errorHandler: { warning() {}, error(message) { throw new Error(message); }, fatalError(message) { throw new Error(message); } } }).parseFromString(source, type);
  }
} });
const chapter = (body: string) => `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>内部标题</title></head><body>${body}</body></html>`;
async function fixture(change?: (zip: JSZip) => void) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>');
  zip.file('OPS/book.opf', '<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>雨后的书店</dc:title></metadata><manifest><item id="b" href="Text/b.xhtml" media-type="application/xhtml+xml"/><item id="a" href="Text/%E7%AC%AC%E4%B8%80%E7%AB%A0.xhtml#start" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="a"/><itemref idref="nav"/><itemref idref="b"/></spine></package>');
  zip.file('OPS/Text/第一章.xhtml', chapter('<h1>第一章</h1><p>雨停了。<em>她</em>推开门。</p><p>下次<br/>再见。</p><script>不能导入的脚本</script><style>不能导入的样式</style><img src="https://never-fetch.invalid/image.jpg"/>'));
  zip.file('OPS/Text/b.xhtml', chapter('<h1>第二章</h1><p>两个人各自挑了一本书。</p>'));
  zip.file('OPS/nav.xhtml', chapter('<nav>不应混进正文的目录</nav>'));
  change?.(zip);
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return { bytes, size: bytes.length, arrayBuffer: async () => bytes.buffer as ArrayBuffer };
}

test('EPUB imports title and text in spine order, preserves paragraphs and skips navigation/scripts/resources', async () => {
  const book = await readEpub(await fixture());
  assert.equal(book.title, '雨后的书店');
  assert.ok(book.text.indexOf('第一章') < book.text.indexOf('第二章'));
  assert.match(book.text, /雨停了。她推开门。\n\n下次\n再见。/);
  for (const hidden of ['不能导入的脚本', '不能导入的样式', '不应混进正文的目录', 'never-fetch.invalid', '内部标题']) assert.ok(!book.text.includes(hidden));
  assert.equal(epubChapterText(chapter('<p>你好&nbsp;世界</p><p hidden="hidden">隐藏</p>')), '你好 世界');
});

test('EPUB 2 without a navigation document and safe parent-relative chapter paths are supported', async () => {
  const book = await readEpub(await fixture(zip => zip.file('OPS/book.opf', '<package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata/><manifest><item id="b" href="../OPS/Text/b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="b"/></spine></package>')));
  assert.equal(book.title, ''); assert.match(book.text, /第二章/);
  assert.equal(epubPath('OPS/book.opf', 'Text/a%20b.xhtml#part'), 'OPS/Text/a b.xhtml');
  for (const path of ['../../escape.xhtml', 'https://external.invalid/chapter', '//external.invalid/chapter', '%2Fabsolute.xhtml', '..%2F..%2Fescape']) assert.throws(() => epubPath('OPS/book.opf', path));
});

test('damaged, missing, image-only and encrypted books fail clearly without a partial book', async () => {
  await assert.rejects(readEpub({ size: 4, arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer }), /不完整/);
  await assert.rejects(readEpub(await fixture(zip => zip.remove('META-INF/container.xml'))), /缺少/);
  await assert.rejects(readEpub(await fixture(zip => zip.remove('OPS/Text/b.xhtml'))), /缺少/);
  await assert.rejects(readEpub(await fixture(zip => {
    zip.file('OPS/Text/第一章.xhtml', chapter('<img src="a.jpg"/>'));
    zip.file('OPS/Text/b.xhtml', chapter('<img src="b.jpg"/>'));
  })), /没有可读取的文字/);
  await assert.rejects(readEpub(await fixture(zip => zip.file('META-INF/encryption.xml', '<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptedData><enc:CipherData><enc:CipherReference URI="OPS/Text/b.xhtml"/></enc:CipherData></enc:EncryptedData></encryption>'))), /加密保护/);
});

test('archive limits are checked before expanding oversized content', async () => {
  await assert.rejects(readEpub({ size: 21 * 1024 * 1024, arrayBuffer: async () => { throw new Error('Must not read oversized file'); } }), /20 MB/);
  const file = await fixture(), view = new DataView(file.bytes.buffer);
  let central = -1;
  for (let i = 0; i < file.bytes.length - 46; i++) if (view.getUint32(i, true) === 0x02014b50) { central = i; break; }
  assert.ok(central >= 0); view.setUint32(central + 24, 80 * 1024 * 1024, true);
  await assert.rejects(readEpub(file), /解压后过大/);
});
