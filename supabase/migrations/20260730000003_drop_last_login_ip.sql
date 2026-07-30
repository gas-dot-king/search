-- 접속 IP는 화면에도 표시하지 않고 보관할 이유도 없어 컬럼째 제거한다.
-- (로그인 남용 차단용 요청 제한은 IP를 해시로만 잠깐 쓰고 저장하지 않는다)
alter table users drop column if exists last_login_ip;
