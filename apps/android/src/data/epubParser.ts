import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type { Chapter } from '../types/models';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['item', 'itemref', 'navPoint', 'li'].includes(name),
});

function resolvePath(basePath: string, href: string): string {
  const clean = href.split('#')[0];
  if (!basePath) return clean;
  const baseDir = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/') + 1) : '';
  const combined = (baseDir + clean).split('/');
  const out: string[] = [];
  for (const part of combined) {
    if (part === '.' || part === '') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/**
 * Very small HTML/XHTML -> plain text converter mirroring the Dart
 * `_htmlToPlainText` used by the original app: strips <head>, turns
 * <h1-6>/</p>/<br> into line breaks, strips remaining tags, unescapes
 * a handful of HTML entities. Images/styles are intentionally not rendered.
 */
export function htmlToPlainText(html: string): string {
  let text = html.replace(/<head[\s\S]*?<\/head>/gi, '');
  text = text.replace(/<(h[1-6])[^>]*>/gi, '\n');
  text = text.replace(/<\/(h[1-6])>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.join('\n');
}

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

async function loadZip(assetModule: number): Promise<JSZip> {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return JSZip.loadAsync(base64, { base64: true });
}

async function readText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`EPUB missing file: ${path}`);
  return file.async('string');
}

export async function parseEpub(assetModule: number): Promise<Chapter[]> {
  const zip = await loadZip(assetModule);

  const containerXml = await readText(zip, 'META-INF/container.xml');
  const container = xmlParser.parse(containerXml);
  const opfPath: string =
    container?.container?.rootfiles?.rootfile?.['@_full-path'] ??
    container?.container?.rootfiles?.rootfile?.[0]?.['@_full-path'];
  if (!opfPath) throw new Error('EPUB container.xml missing rootfile');

  const opfXml = await readText(zip, opfPath);
  const opf = xmlParser.parse(opfXml);
  const pkg = opf.package;

  const rawItems = pkg.manifest.item as any[];
  const manifest: Record<string, ManifestItem> = {};
  for (const it of rawItems) {
    manifest[it['@_id']] = {
      id: it['@_id'],
      href: it['@_href'],
      mediaType: it['@_media-type'],
      properties: it['@_properties'],
    };
  }

  const spineRefs = (pkg.spine.itemref as any[]).map((r) => r['@_idref'] as string);
  const spineHrefs = spineRefs
    .map((id) => manifest[id])
    .filter((it): it is ManifestItem => !!it)
    .map((it) => resolvePath(opfPath, it.href));

  // Prefer a real table of contents (EPUB3 nav doc, or EPUB2 NCX) so chapter
  // titles match the book's own TOC; fall back to one chapter per spine item.
  const navItem = Object.values(manifest).find((it) => it.properties?.includes('nav'));
  const ncxItem = Object.values(manifest).find((it) => it.mediaType === 'application/x-dtbncx+xml');

  type TocEntry = { title: string; href: string };
  let toc: TocEntry[] = [];

  if (navItem) {
    const navPath = resolvePath(opfPath, navItem.href);
    const navHtml = await readText(zip, navPath);
    toc = extractNavToc(navHtml, navPath);
  } else if (ncxItem) {
    const ncxPath = resolvePath(opfPath, ncxItem.href);
    const ncxXml = await readText(zip, ncxPath);
    toc = extractNcxToc(ncxXml, ncxPath);
  }

  if (toc.length === 0) {
    // Fallback: one chapter per spine document, title guessed from content.
    const chapters: Chapter[] = [];
    for (let i = 0; i < spineHrefs.length; i++) {
      const html = await readText(zip, spineHrefs[i]);
      const text = htmlToPlainText(html);
      chapters.push({ title: guessTitle(text, i), content: text });
    }
    return chapters;
  }

  const chapters: Chapter[] = [];
  for (const entry of toc) {
    try {
      const html = await readText(zip, entry.href);
      const text = htmlToPlainText(html);
      chapters.push({ title: entry.title || guessTitle(text, chapters.length), content: text });
    } catch {
      // Referenced doc missing from the archive — skip it rather than fail the whole book.
    }
  }
  return chapters;
}

function guessTitle(text: string, index: number): string {
  const firstLine = text.split('\n').find((l) => l.trim().length > 0);
  if (firstLine && firstLine.length <= 40) return firstLine.trim();
  return `第 ${index + 1} 章`;
}

function extractNavToc(navHtml: string, navPath: string): { title: string; href: string }[] {
  // Grab the first <ol>...</ol> (the nav TOC list) and pull out <a href>text</a> pairs.
  const olMatch = navHtml.match(/<ol[\s\S]*?<\/ol>/i);
  const scope = olMatch ? olMatch[0] : navHtml;
  const entries: { title: string; href: string }[] = [];
  const anchorRe = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(scope)) !== null) {
    const href = resolvePath(navPath, m[1]);
    const title = htmlToPlainText(m[2]).replace(/\n/g, ' ').trim();
    entries.push({ title, href });
  }
  return entries;
}

function extractNcxToc(ncxXml: string, ncxPath: string): { title: string; href: string }[] {
  const parsed = xmlParser.parse(ncxXml);
  const navMap = parsed?.ncx?.navMap;
  const entries: { title: string; href: string }[] = [];
  const walk = (navPoint: any) => {
    if (!navPoint) return;
    const list = Array.isArray(navPoint) ? navPoint : [navPoint];
    for (const np of list) {
      const label = np?.navLabel?.text;
      const src = np?.content?.['@_src'];
      if (label && src) {
        entries.push({ title: String(label).trim(), href: resolvePath(ncxPath, src) });
      }
      if (np?.navPoint) walk(np.navPoint);
    }
  };
  walk(navMap?.navPoint);
  return entries;
}
