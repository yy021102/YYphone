import { normalizeReadingText } from './wechatReading';

export const MAX_EPUB_BYTES = 20 * 1024 * 1024;
const MAX_TEXT = 8 * 1024 * 1024;

/** Reject oversized expanded archives before asking the ZIP library to decompress. */
function inspectArchive(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw new Error('EPUB 文件不完整，无法读取。');
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true), expanded = 0;
  if (!count || count > 4000 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || offset + size > end)
    throw new Error('EPUB 结构不受支持，或书内文件过多。');
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('EPUB 目录损坏。');
    if (view.getUint16(offset + 8, true) & 1) throw new Error('这本 EPUB 已加密，请使用无加密的版本。');
    expanded += view.getUint32(offset + 24, true);
    if (expanded > 64 * 1024 * 1024) throw new Error('这本 EPUB 解压后过大，请使用体积较小的版本。');
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  if (offset > end) throw new Error('EPUB 目录损坏。');
}

export function epubPath(base: string, href: string): string {
  let path: string;
  try { path = decodeURIComponent(href.split(/[?#]/)[0]); } catch { throw new Error('EPUB 中的章节路径无效。'); }
  if (/^(?:[a-z][a-z\d+.-]*:|\/|\\)/i.test(path) || path.includes('\\') || path.includes('\0')) throw new Error('EPUB 包含不支持的外部章节路径。');
  const parts = base ? base.split('/').slice(0, -1) : [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!parts.length) throw new Error('EPUB 章节路径超出书籍目录。'); parts.pop(); }
    else parts.push(part);
  }
  return parts.join('/');
}

const elements = (node: Document | Element, name: string) => Array.from(node.getElementsByTagNameNS('*', name));
function xml(source: string, label: string): Document {
  // XML parsing stays detached; no book HTML, scripts or linked resources enter the page.
  const known: Record<string, string> = { nbsp: '&#160;', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', copy: '©', reg: '®', ensp: ' ', emsp: ' ' };
  const cleaned = source.replace(/<!DOCTYPE[^>]*(?:\[[\s\S]*?\]\s*)?>/gi, '')
    .replace(/&(nbsp|ndash|mdash|hellip|lsquo|rsquo|ldquo|rdquo|copy|reg|ensp|emsp);/g, (_, entity: string) => known[entity]);
  const doc = new DOMParser().parseFromString(cleaned, 'application/xml');
  if (elements(doc, 'parsererror').length || !doc.documentElement) throw new Error(`无法读取 EPUB 的${label}，请检查书籍文件是否完整。`);
  return doc;
}

export function epubChapterText(source: string): string {
  const doc = xml(source, '章节');
  const body = elements(doc, 'body')[0];
  if (!body) return '';
  const blocks = new Set(['p', 'div', 'section', 'article', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'pre']);
  const ignored = new Set(['script', 'style', 'noscript', 'template', 'iframe', 'object', 'svg', 'head']);
  const out: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === 3 || node.nodeType === 4) { out.push((node.nodeValue ?? '').replace(/[\t\r\n ]+/g, ' ')); return; }
    if (node.nodeType !== 1) return;
    const element = node as Element, name = element.localName.toLowerCase();
    if (ignored.has(name) || element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return;
    if (name === 'br') { out.push('\n'); return; }
    if (blocks.has(name)) out.push('\n\n');
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
    if (blocks.has(name)) out.push('\n\n');
  };
  visit(body);
  return normalizeReadingText(out.join('').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n'));
}

/** EPUB 2/3 text import in spine order, reusing the existing local reader. */
export async function readEpub(file: Pick<File, 'size' | 'arrayBuffer'>): Promise<{ title: string; text: string }> {
  if (!file.size || file.size > MAX_EPUB_BYTES) throw new Error('EPUB 请使用非空且不超过 20 MB 的文件。');
  const bytes = new Uint8Array(await file.arrayBuffer()); inspectArchive(bytes);
  const { default: JSZip } = await import('jszip');
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try { zip = await JSZip.loadAsync(bytes); } catch { throw new Error('无法解压 EPUB，请检查文件是否损坏或加密。'); }
  const read = async (path: string) => {
    const entry = zip.file(path);
    if (!entry) throw new Error(`EPUB 缺少书内文件：${path}`);
    const data = await entry.async('uint8array');
    if (data.byteLength > MAX_TEXT) throw new Error('EPUB 单个章节过大，请使用较小的版本。');
    return new TextDecoder('utf-8').decode(data);
  };
  const container = xml(await read('META-INF/container.xml'), '容器信息');
  const root = elements(container, 'rootfile')[0]?.getAttribute('full-path');
  if (!root) throw new Error('EPUB 缺少书籍目录信息。');
  const packagePath = epubPath('', root), opf = xml(await read(packagePath), '目录');
  const manifest = elements(opf, 'manifest')[0], spine = elements(opf, 'spine')[0];
  if (!manifest || !spine) throw new Error('EPUB 缺少章节阅读顺序。');
  const items = new Map(elements(manifest, 'item').map(item => [item.getAttribute('id'), item]));
  const encrypted = new Set<string>();
  if (zip.file('META-INF/encryption.xml')) {
    const encryption = xml(await read('META-INF/encryption.xml'), '加密信息');
    for (const ref of elements(encryption, 'CipherReference')) encrypted.add(epubPath('', ref.getAttribute('URI') ?? ''));
  }
  const chapters: string[] = []; let length = 0;
  for (const ref of elements(spine, 'itemref')) {
    if (ref.getAttribute('linear') === 'no') continue;
    const item = items.get(ref.getAttribute('idref'));
    if (!item) throw new Error('EPUB 章节目录引用不完整。');
    if ((item.getAttribute('properties') ?? '').split(/\s+/).includes('nav')) continue;
    const type = item.getAttribute('media-type');
    if (type !== 'application/xhtml+xml' && type !== 'text/html') continue;
    const href = item.getAttribute('href'); if (!href) throw new Error('EPUB 缺少章节路径。');
    const path = epubPath(packagePath, href);
    if (encrypted.has(path)) throw new Error('这本 EPUB 的正文受加密保护，请使用无加密的版本。');
    const text = epubChapterText(await read(path));
    if (!text) continue;
    length += text.length;
    if (length > MAX_TEXT) throw new Error('EPUB 正文过长，请分卷后导入。');
    chapters.push(text);
  }
  if (!chapters.length) throw new Error('这本 EPUB 没有可读取的文字正文，暂不支持纯图片书。');
  return { title: elements(opf, 'title')[0]?.textContent?.trim() || '', text: chapters.join('\n\n') };
}
