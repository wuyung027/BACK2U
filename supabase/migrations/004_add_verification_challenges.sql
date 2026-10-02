-- Back2U: 습득자가 만드는 소유 확인 질문 3개
-- Supabase Dashboard > SQL Editor에서 003 다음에 한 번 실행. 재실행해도 안전하다.
--
-- - 형식: [{"id": "q1", "question": "...", "answer_hash": "...", "salt": "..."}, ...] (정답 평문은 저장하지 않는다)
-- - 습득물(FOUND) row에만 채워진다. 분실자는 이 중 하나를 맞히면 소유 확인에 성공한다.
-- - 002의 verification_question/answer_hash/salt(분실물 단일 질문)는 예전 데이터 호환용으로 그대로 둔다.
-- - NULL 허용: 기존 row는 수정하지 않는다. RLS/권한은 001 그대로 (Backend service_role만 접근).

alter table public.items add column if not exists verification_challenges jsonb;

-- PostgREST가 새 컬럼을 바로 인식하도록 스키마 캐시 갱신
notify pgrst, 'reload schema';
