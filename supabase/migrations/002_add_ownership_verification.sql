-- Back2U: 비공개 단서 기반 소유 확인 (Ownership Verification)
-- Supabase Dashboard > SQL Editor에서 001 다음에 한 번 실행. 재실행해도 안전하다.
--
-- - 정답 평문은 저장하지 않는다. Backend가 salt + SHA-256 해시만 저장한다.
-- - 기존 row는 모두 NULL로 남으며, 소유 확인 정보가 없는 분실물로 취급된다.
-- - RLS/권한은 001 그대로 (Backend service_role만 접근).

alter table public.items add column if not exists verification_question    text;
alter table public.items add column if not exists verification_answer_hash text;
alter table public.items add column if not exists verification_salt        text;
alter table public.items add column if not exists verified_found_item_id   uuid;
alter table public.items add column if not exists verified_at              timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'items_verified_found_item_id_fkey' and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      add constraint items_verified_found_item_id_fkey
      foreign key (verified_found_item_id) references public.items (id) on delete set null;
  end if;
end $$;

-- PostgREST가 새 컬럼을 바로 인식하도록 스키마 캐시 갱신
notify pgrst, 'reload schema';
