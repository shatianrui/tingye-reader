alter table tingye.books add column if not exists content_version bigint;
alter table tingye.uploads add column if not exists content_version bigint;
