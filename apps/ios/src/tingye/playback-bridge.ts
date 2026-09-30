import type { ReadingCursor } from './player';

type Source = {
  snapshot: () => { active: boolean; cursor?: ReadingCursor };
  subscribePlayback: (callback: () => void) => () => void;
};

// Deliver native playback positions before React reconciles the surrounding UI.
// A newly mounted chapter reads the latest position, never an old render's prop.
export function connectPlayback(source: Source, chapter: number, send: (cursor: ReadingCursor | null) => void) {
  let previous: ReadingCursor | null | undefined;
  const update = () => {
    const state = source.snapshot();
    const cursor = state.active && state.cursor?.chapter === chapter ? state.cursor : null;
    if (cursor === previous) return;
    previous = cursor;
    send(cursor);
  };
  const unsubscribe = source.subscribePlayback(update);
  update();
  return unsubscribe;
}
