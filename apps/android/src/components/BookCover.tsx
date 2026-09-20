import { DisplayText as Text } from './DisplayText';
import React, {useState} from 'react';
import { StyleSheet, View } from 'react-native';
import {Image} from 'expo-image';
import type { Book } from '../types/models';

interface Props {
  book: Book;
  width: number;
  height: number;
}

/** Local original cover; books without artwork keep the title/author fallback. */
export default function BookCover({ book, width, height }: Props) {
  const [c1, c2] = book.coverColors;
  const [failedUri,setFailedUri]=useState<string>();
  const radius = Math.min(20, Math.max(10, Math.round(width * 0.16)));
  if(book.coverUri&&failedUri!==book.coverUri)return (
    <View style={{width,height,borderRadius:radius,overflow:'hidden',backgroundColor:'#F4F0E6'}}>
      <Image key={book.coverUri} source={{uri:book.coverUri}} style={{width,height}}
        contentFit="contain" cachePolicy="memory" recyclingKey={book.id+book.coverUri}
        accessibilityLabel={`${book.title}封面`} onError={()=>setFailedUri(book.coverUri)} />
    </View>
  );
  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: c1,
          borderColor: c2,
        },
      ]}
    >
      <View
        style={[
          styles.accent,
          {
            backgroundColor: c2,
            width: Math.round(width * 0.6),
            height: Math.round(width * 0.6),
            borderRadius: Math.round(width * 0.3),
            right: -Math.round(width * 0.2),
            top: -Math.round(width * 0.2),
          },
        ]}
      />
      <Text
        style={[
          styles.title,
          { color: '#FFF8EA', fontSize: Math.round(width * 0.16) },
        ]}
        numberOfLines={4}
      >
        {book.title}
      </Text>
      <Text
        style={[
          styles.author,
          { color: '#FFF8EA', fontSize: Math.round(width * 0.115) },
        ]}
        numberOfLines={1}
      >
        {book.author}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    padding: 10,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    opacity: 0.55,
  },
  title: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  author: {
    opacity: 0.88,
  },
});
