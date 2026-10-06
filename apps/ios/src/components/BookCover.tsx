import { DisplayText as Text } from './DisplayText';
import React, {useState} from 'react';
import { StyleSheet, View } from 'react-native';
import {Image} from 'expo-image';
import type { Book } from '../types/models';
import { InkMountains } from './Ink';
import { brand } from '../theme/tokens';

interface Props {
  book: Book;
  width: number;
  height: number;
}

const LABEL_PAPER = '#EFE8D8';
const LABEL_EDGE = '#CFC5B1';
const MOON = '#E9E1CE';
const LATIN = /[A-Za-z]/;

/** Local original cover; books without artwork get a thread-bound (线装) cover with a 题签 title label. */
export default function BookCover({ book, width, height }: Props) {
  const [c1, c2] = book.coverColors;
  const [failedUri,setFailedUri]=useState<string>();
  const radius = Math.max(2, Math.round(width * 0.025));
  if(book.coverUri&&failedUri!==book.coverUri)return (
    <View style={{width,height,borderRadius:radius,overflow:'hidden',backgroundColor:brand.paper}}>
      <Image key={book.coverUri} source={{uri:book.coverUri}} style={{width,height}}
        contentFit="contain" cachePolicy="memory" recyclingKey={book.id+book.coverUri}
        accessibilityLabel={`${book.title}封面`} onError={()=>setFailedUri(book.coverUri)} />
    </View>
  );
  const inset = Math.round(width * 0.09);
  const glyph = Math.max(10, Math.round(width * 0.15));
  const labelWidth = Math.round(glyph * 1.55);
  const labelHeight = Math.round(height * 0.6);
  // Chinese titles run top to bottom on the label; Latin titles stay horizontal.
  const vertical = !LATIN.test(book.title);
  const fits = Math.max(1, Math.floor((labelHeight - glyph * 0.6) / (glyph * 1.12)));
  const chars = [...book.title.replace(/\s+/g, '')];
  const column = (chars.length > fits ? [...chars.slice(0, fits - 1), '︙'] : chars).join('\n');
  const stitches = Math.max(3, Math.floor(height / 26));
  return (
    <View style={[styles.container, { width, height, borderRadius: radius, backgroundColor: c1, borderColor: c2 }]}>
      <View style={{ position: 'absolute', right: inset, top: inset, width: Math.round(width * 0.26), height: Math.round(width * 0.26), borderRadius: width, backgroundColor: MOON, opacity: 0.9 }} />
      <InkMountains width="100%" height={Math.round(height * 0.34)} color={brand.paper} strength={1.6} style={styles.mountains} />
      {vertical ? (
        <View style={[styles.label, { left: inset, top: inset, width: labelWidth, height: labelHeight }]}>
          <Text numberOfLines={fits} style={{ fontFamily: brand.brush, fontSize: glyph, lineHeight: Math.round(glyph * 1.12), color: brand.ink, textAlign: 'center' }}>{column}</Text>
        </View>
      ) : (
        <View style={[styles.label, { left: inset, top: inset, right: inset + Math.round(width * 0.1), paddingHorizontal: 4, paddingVertical: 3 }]}>
          <Text numberOfLines={3} style={{ fontSize: Math.round(width * 0.11), fontWeight: '700', color: brand.ink }}>{book.title}</Text>
        </View>
      )}
      {!!book.author && <Text numberOfLines={1} style={[styles.author, { left: inset, right: inset, bottom: Math.round(inset * 0.8), fontSize: Math.max(8, Math.round(width * 0.095)) }]}>{book.author}</Text>}
      <View style={[styles.binding, { right: Math.max(3, Math.round(width * 0.05)) }]}>
        {Array.from({ length: stitches }, (_, i) => <View key={i} style={styles.stitch} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  mountains: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  label: {
    position: 'absolute',
    backgroundColor: LABEL_PAPER,
    borderWidth: 1,
    borderColor: LABEL_EDGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  author: { position: 'absolute', color: '#E3DBC9' },
  binding: { position: 'absolute', top: 0, bottom: 0, width: 1, justifyContent: 'space-evenly' },
  stitch: { width: 1, height: 7, backgroundColor: 'rgba(244,239,228,0.5)' },
});
