export const DAILY_GREETING_MESSAGES = [
  "오늘은 어떤 빙고를 채워볼까요?",
  "오늘도 가볍게 한 걸음 나가볼까요?",
  "빙고판에 오늘의 기록을 남겨보세요!",
  "오늘 하루도 슬로우러닝과 함께해요.",
  "오늘은 어떤 칸을 채워볼지 골라볼까요?",
  "작은 발걸음이 모여 빙고 한 줄을 완성해요.",
  "오늘의 러닝, 빙고판에 인증해볼까요?",
];

// 날짜(로컬 기준)마다 값이 바뀌도록, 시간대와 무관한 정수 하루 인덱스를 계산한다.
function localDayIndex(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

export function todayGreetingMessage(date = new Date()) {
  const index = localDayIndex(date) % DAILY_GREETING_MESSAGES.length;
  return DAILY_GREETING_MESSAGES[index];
}
