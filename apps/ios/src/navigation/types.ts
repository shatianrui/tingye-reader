export type RootStackParamList = {
  Tabs: undefined;
  Search: undefined;
  BookDetail: { bookId: string };
  Reader: { bookId: string; initialChapterIndex?: number; listen?: boolean };
};

export type TabParamList = {
  Discover: undefined;
  Shelf: undefined;
  Profile: undefined;
};
