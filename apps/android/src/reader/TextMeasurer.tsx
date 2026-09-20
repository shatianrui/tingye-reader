import { DisplayText as Text } from '../components/DisplayText';
import React, { useCallback, useRef, useState } from 'react';
import { TextStyle, NativeSyntheticEvent, TextLayoutEventData } from 'react-native';

export interface MeasuredLine {
  length: number; // characters in this rendered line
  height: number;
}

interface Job {
  text: string;
  style: TextStyle;
  width: number;
  resolve: (lines: MeasuredLine[]) => void;
}

/**
 * Off-screen text measurement, used to reconstruct line-wrap breakpoints the
 * way Flutter's `TextPainter.computeLineMetrics` did in the original app.
 * React Native has no direct equivalent, so we render the target text (at
 * the real font size / line height / width) into an invisible <Text> and
 * read back per-line metrics via `onTextLayout`, one job at a time from a
 * queue. Mount <TextMeasurerHost/> (the returned `host` element) once and
 * call `measure()` from the hook.
 */
export function useTextMeasurer() {
  const [job, setJob] = useState<Job | null>(null);
  const queueRef = useRef<Job[]>([]);
  const processingRef = useRef(false);

  const startNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      processingRef.current = true;
      setJob(next);
    } else {
      processingRef.current = false;
      setJob(null);
    }
  }, []);

  const measure = useCallback(
    (text: string, style: TextStyle, width: number): Promise<MeasuredLine[]> => {
      return new Promise((resolve) => {
        queueRef.current.push({ text, style, width, resolve });
        if (!processingRef.current) startNext();
      });
    },
    [startNext]
  );

  const onTextLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (!job) return;
      const lines = e.nativeEvent.lines.map((l) => ({ length: l.text.length, height: l.height }));
      job.resolve(lines);
      startNext();
    },
    [job, startNext]
  );

  const host = job ? (
    <Text
      style={[{ position: 'absolute', left: -9999, top: 0, width: job.width }, job.style]}
      onTextLayout={onTextLayout}
    >
      {job.text}
    </Text>
  ) : null;

  return { measure, host };
}
