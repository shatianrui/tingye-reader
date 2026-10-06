// End-to-end fixture (tests/e2e.cjs only; never packaged): the real reader UI
// with a local account and one imported book, so no network is needed.
import { installFetch } from './shims/expo-fetch';
import { AppRegistry } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DisplayScaleProvider } from '@ios/src/components/DisplayText';
import ReaderApplication from '@ios/src/tingye/ReaderApplication';
import { nativeLibrary } from '@ios/src/tingye/native-library';
import { parseBook } from '@ios/src/tingye/import-book';
import { samples } from '@ios/src/tingye/books';
import type { ReaderServices } from '@ios/src/tingye/reader-services';
import { File, Paths } from './shims/expo-file-system';
import { createAudioPlaylist } from './shims/expo-audio';

installFetch();
const user = { userId: 'desktop-e2e', username: '桌面验证', displayName: '桌面验证' };
let shelf: ReturnType<typeof nativeLibrary> | undefined;
const library = () => (shelf ??= nativeLibrary(user.userId));
const numerals = '一二三四五六七八九十';
const services: ReaderServices = {
  restore: async () => {
    const source = samples.find(book => book.title === '故乡') ?? samples[0];
    const text = source.chapters.map((chapter, i) => `第${numerals[i] ?? i + 1}章 ${chapter.title}\n${chapter.text}`).join('\n\n');
    const file = new File(Paths.cache, 'e2e', '故乡.txt');
    file.write(text);
    const book = await parseBook(file.uri, '故乡.txt');
    book.id = 'desktop-e2e-book';
    book.author = '鲁迅';
    await library().importBook(book);
    // A one-page text PDF exercises pdf.js import and the original-page PDF view.
    const pdf = new File(Paths.cache, 'e2e', '纸本.pdf');
    pdf.write(minimalPdf('Tingye desktop PDF'));
    const paper = await parseBook(pdf.uri, '纸本.pdf');
    paper.id = 'desktop-e2e-pdf';
    await library().importBook(paper);
    return { token: '', expiresAt: Date.now() + 86_400_000, user };
  },
  verify: async () => ({ user }),
  library: () => library(),
};

function minimalPdf(text: string) {
  const content = `BT /F1 18 Tf 20 100 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => { const at = body.length; body += `${i + 1} 0 obj\n${object}\nendobj\n`; return at; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

// Hooks for tests/e2e.cjs to drive the desktop shims directly.
Object.assign(globalThis, { __tingyeTest: { File, Paths, createAudioPlaylist } });

function Fixture() {
  return <SafeAreaProvider><DisplayScaleProvider><ReaderApplication services={services} /></DisplayScaleProvider></SafeAreaProvider>;
}
AppRegistry.registerComponent('main', () => Fixture);
AppRegistry.runApplication('main', { rootTag: document.getElementById('root') });
