-- Back2U: 습득물 보관 장소 (소유 확인에 성공한 분실자에게만 공개)
-- Supabase Dashboard > SQL Editor에서 002 다음에 한 번 실행. 재실행해도 안전하다.
--
-- - 발견 장소(features.location, AI 매칭용)와 다른 값이다. AI/매칭/공개 목록에는 쓰지 않는다.
-- - NULL 허용: 기존 습득물과 분실물 row는 그대로 NULL로 남는다 (기존 데이터 수정 없음).
-- - RLS/권한은 001 그대로 (Backend service_role만 접근).

alter table public.items add column if not exists storage_location text;

-- PostgREST가 새 컬럼을 바로 인식하도록 스키마 캐시 갱신
notify pgrst, 'reload schema';
