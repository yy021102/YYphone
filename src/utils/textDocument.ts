export const TEXT_DOCUMENT_ACCEPT = '.txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export function decodeTextDocument(bytes: ArrayBuffer): string {
  const prefix = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (prefix[0] === 0xff && prefix[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (prefix[0] === 0xfe && prefix[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('gb18030').decode(bytes); }
}

/** Text extraction only. Never render document HTML or fetch its linked images. */
export async function readTextDocument(file: File, includeHyperlinks = false): Promise<string> {
  if (/\.doc$/i.test(file.name)) throw new Error('旧版 .doc 请先用 Word 另存为 .docx 后导入。');
  if (!/\.(?:txt|docx)$/i.test(file.name)) throw new Error('请选择 TXT 或 Word（.docx）文件。');
  if (!file.size || file.size > MAX_DOCUMENT_BYTES) throw new Error('请选择非空且不超过 20 MB 的文档。');
  const arrayBuffer = await file.arrayBuffer();
  let text: string;
  if (/\.txt$/i.test(file.name)) text = decodeTextDocument(arrayBuffer);
  else {
    const { default: mammoth } = await import('mammoth/mammoth.browser');
    try {
      text = (await mammoth.extractRawText({ arrayBuffer })).value;
      if (includeHyperlinks) {
        const html = await mammoth.convertToHtml({ arrayBuffer }, {
          externalFileAccess: false, includeEmbeddedStyleMap: false,
          convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
        });
        const document = new DOMParser().parseFromString(html.value, 'text/html');
        const links = [...document.querySelectorAll('a[href]')].flatMap(anchor => {
          const href = anchor.getAttribute('href')?.trim() ?? '';
          const label = anchor.textContent?.trim().replace(/[:：]\s*$/, '') ?? '';
          return /^https?:\/\//i.test(href) && label && !text.includes(href) ? [`${label}: ${href}`] : [];
        });
        if (links.length) text += '\n' + [...new Set(links)].join('\n');
      }
    } catch { throw new Error('无法读取此 Word 文档，请确认文件完整，且为 .docx 格式。'); }
  }
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!text) throw new Error('文档中没有可导入的文字。');
  return text;
}
