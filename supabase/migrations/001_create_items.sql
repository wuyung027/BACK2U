-- Back2U MVP: items 테이블 + 습득물 사진 private bucket
-- Supabase Dashboard > SQL Editor에서 한 번 실행. 재실행해도 안전하다.
--
-- 접근 정책
-- - Backend(FastAPI)만 Service Role/secret 키로 접근한다. (RLS 우회)
-- - RLS를 켜고 정책을 만들지 않으므로 anon/authenticated(브라우저)는 읽기/쓰기 불가.
-- - 사진은 private bucket에 두고, Backend가 만든 만료 시간 있는 Signed URL로만 노출한다.

create table if not exists public.items (
  id                uuid primary key default gen_random_uuid(),
  type              text not null,
  raw_text          text,
  features          jsonb not null default '{}'::jsonb,
  image_path        text,            -- Storage object path: {item_id}/{random}.{ext}
  original_filename text,            -- 표시용. 경로에는 사용하지 않는다.
  created_at        timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_type_check' and conrelid = 'public.items'::regclass) then
    alter table public.items add constraint items_type_check check (type in ('LOST', 'FOUND'));
  end if;
end $$;

create index if not exists items_type_created_at_idx on public.items (type, created_at desc);

alter table public.items enable row level security;

revoke all on table public.items from anon, authenticated;
grant all on table public.items to service_role;

-- Storage: private bucket (jpg/png/webp, 최대 20MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('found-items', 'found-items', false, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
