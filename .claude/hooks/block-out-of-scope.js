// PreToolUse 훅: 이 레포에 속하지 않는 "대회 참가·기록·건의" 기능이 들어오는 것을 막는다.
//
// 배경: 다른 레포(크루 대회/기록 관리 웹)에 갔어야 할 수정이 실수로 이 레포에 적용되어
// 되돌린 이력이 있다. 사람이든 다른 에이전트든 같은 실수를 반복하지 않도록 차단한다.
//
// 정상적인 작업을 막지 않도록, 이 레포에서는 쓰이지 않는 명확한 토큰만 본다.
const BLOCKED = /race_suggestions|competition_name|competition_date|raceSuggestion/i;

// 이 규칙 자체를 설명하는 문서·설정은 토큰을 포함할 수밖에 없으므로 검사에서 제외한다.
const EXEMPT_PATH = /CLAUDE\.md$|[\\/]\.claude[\\/]/;

const REASON =
  "이 레포는 YSRC SUMMER FEST 2026 여름 이벤트 앱입니다. " +
  "대회 참가·참가 여부·기록·대회 건의 기능은 이 레포의 범위가 아니며, " +
  "별도의 크루 대회/기록 관리 레포 소관입니다. " +
  "코드를 수정하기 전에 레포를 잘못 찾은 것이 아닌지 사용자에게 확인하세요. " +
  "사용자가 이 레포가 맞다고 확인하면 CLAUDE.md의 범위 규칙을 먼저 갱신하세요. " +
  "(차단 규칙: .claude/hooks/block-out-of-scope.js)";

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return; // 입력을 못 읽으면 조용히 통과시킨다 — 훅이 작업을 막아서는 안 된다.
  }

  const toolInput = input.tool_input || {};
  const path = String(toolInput.file_path || "");
  if (EXEMPT_PATH.test(path)) return;

  const haystack = [
    path,
    toolInput.content,
    toolInput.new_string,
    JSON.stringify(toolInput.edits ?? ""),
  ]
    .filter(Boolean)
    .join("\n");

  if (!BLOCKED.test(haystack)) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: REASON,
      },
    })
  );
});
