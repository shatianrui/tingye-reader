export type RootStackParamList = {
  Tabs: undefined;
  Search: undefined;
  BookDetail: { bookId: string };
  Reader: { bookId: string; initialChapterIndex?: number };
};

export type TabParamList = {
  Discover: undefined;
  Shelf: undefined;
  Profile: undefined;
};
