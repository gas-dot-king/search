export default function manifest() {
  return {
    name: "YSRC SUMMER FEST 2026 — 온라인 위크 이벤트",
    short_name: "YSRC SUMMER FEST",
    description: "빙고 인증, 러닝 로또, 28일 챌린지와 행사 안내",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f7",
    theme_color: "#e11d48",
    lang: "ko",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}
