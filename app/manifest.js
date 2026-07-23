export default function manifest() {
  return {
    name: "양산 슬로우러닝 온라인 위크",
    short_name: "양산 슬로우러닝",
    description: "빙고 인증, 러닝 로또와 행사 안내",
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
