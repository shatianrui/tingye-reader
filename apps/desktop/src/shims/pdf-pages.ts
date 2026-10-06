// Same contract as the iOS PDFKit module: one string per page, with the same
// page and length limits, so imported PDFs keep their original-page layout.
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import { File } from './expo-file-system';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', document.baseURI).href;

export async function readPDFPages(uri: string): Promise<string[]> {
  const task = pdfjs.getDocument({ data: await new File(uri).bytes(), isEvalSupported: false });
  try {
    let pdf;
    try { pdf = await task.promise; } catch { throw new Error('无法打开 PDF，请确认文件未加密。'); }
    if (pdf.numPages < 1 || pdf.numPages > 2000) throw new Error('PDF 页数无效或超过 2000 页，请拆分导入。');
    const pages: string[] = [];
    let total = 0;
    for (let index = 1; index <= pdf.numPages; index++) {
      const content = await (await pdf.getPage(index)).getTextContent();
      const text = content.items.map(item => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join('');
      total += text.length;
      if (total > 4_000_000) throw new Error('正文超过 400 万字，请拆分导入。');
      pages.push(text);
    }
    return pages;
  } finally { void task.destroy(); }
}
