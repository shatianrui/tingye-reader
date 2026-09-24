create table if not exists tingye.backups (
 user_id uuid not null references tingye.accounts(id) on delete cascade,
 id text not null, revision uuid not null, title text not null, author text not null,
 format text not null, color text not null, object_path text not null unique,
 object_size bigint not null, sha256 text not null,
 chapter integer not null, position integer not null, progress_updated_at bigint not null,
 backup_at timestamptz not null default now(), primary key(user_id,id)
);
create table if not exists tingye.backup_uploads (
 id uuid primary key, user_id uuid not null references tingye.accounts(id) on delete cascade,
 book_id text not null, base_revision uuid, object_path text not null unique,
 object_size bigint not null, sha256 text not null, expires_at timestamptz not null
);
revoke all on tingye.backups, tingye.backup_uploads from public;
alter table tingye.backups enable row level security;
alter table tingye.backup_uploads enable row level security;
create table if not exists tingye.backup_garbage (
 object_path text primary key, user_id uuid not null references tingye.accounts(id) on delete cascade,
 retire_at timestamptz not null
);
revoke all on tingye.backup_garbage from public;
alter table tingye.backup_garbage enable row level security;
