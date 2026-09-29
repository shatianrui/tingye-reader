import type {Chapter} from './books';
import type {Typography} from './typesetting';
import type {ReadingTheme} from './themes';
import {legacyDocument} from './original-document';
import {readerScript} from './reader-script';
export type ReaderConfig={fontSize:number;typography:Typography;colors:ReadingTheme;original:boolean;spread?:boolean;eink?:boolean};
export const scriptJson=(v:unknown)=>JSON.stringify(v).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function originalPage(chapter:Chapter,config:ReaderConfig,offset:number,fontCss='',resources:Record<string,string>={}){
 const source=chapter.document||legacyDocument(chapter);
 const hydrate=(value:string)=>value.replace(/tingye-resource:(r\d+)/g,(_,id)=>resources[id]||'');
 const doc={...source,html:hydrate(source.html),css:hydrate(source.css)};
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: file:; font-src data: file:; style-src 'unsafe-inline'; script-src 'nonce-tingye-reader'; connect-src 'none'; form-action 'none'; base-uri 'none'"><style>${fontCss}${doc.css}</style><style id="ty-reader-settings"></style></head><body><div id="ty-reader-track"><main id="ty-reader-book">${doc.html}</main></div><script nonce="tingye-reader">window.READER_INIT=${scriptJson({config,offset,length:chapter.text.length,original:!!chapter.document,fixed:doc.fixed})};${readerScript}</script></body></html>`;
}
