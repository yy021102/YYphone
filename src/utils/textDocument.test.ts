import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { decodeTextDocument, readTextDocument } from './textDocument';

test('TXT imports preserve Chinese, paragraph breaks and common UTF BOM encodings', async () => {
  assert.equal(await readTextDocument(new File(['\uFEFF第一段\r\n\r\n第二段'], '设定.txt')), '第一段\n\n第二段');
  const le = Uint8Array.from([0xff, 0xfe, 0x2d, 0x4e, 0x87, 0x65]);
  const be = Uint8Array.from([0xfe, 0xff, 0x4e, 0x2d, 0x65, 0x87]);
  assert.equal(decodeTextDocument(le.buffer), '中文'); assert.equal(decodeTextDocument(be.buffer), '中文');
  assert.equal(decodeTextDocument(Uint8Array.from([0xd6, 0xd0, 0xce, 0xc4]).buffer), '中文');
});

test('Word imports extract real DOCX paragraphs as text without executing markup or truncating content', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>第一段 &amp; 原样</w:t></w:r></w:p><w:p><w:r><w:t>' + '很长的人设'.repeat(1200) + '</w:t></w:r></w:p></w:body></w:document>');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const text = await readTextDocument(new File([Uint8Array.from(bytes)], '人设.docx'));
  assert(text.startsWith('第一段 & 原样\n\n')); assert(text.endsWith('很长的人设')); assert(text.length > 5000);
  assert(!text.includes('<w:document'));
});

test('unsupported, damaged, empty and oversized documents fail without yielding replacement text', async () => {
  await assert.rejects(readTextDocument(new File(['binary'], '旧文档.doc')), /另存为 .docx/);
  await assert.rejects(readTextDocument(new File(['binary'], '文件.pdf')), /TXT/);
  await assert.rejects(readTextDocument(new File(['broken'], '损坏.docx')), /无法读取/);
  await assert.rejects(readTextDocument(new File(['   '], '空.txt')), /没有可导入/);
  await assert.rejects(readTextDocument({ name: '过大.txt', size: 21 * 1024 * 1024 } as File), /20 MB/);
});
