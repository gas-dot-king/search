export default function manifest() {
  return {
    name: "러닝크루 온라인 위크",
    short_name: "러닝크루 빙고",
    description: "빙고 인증과 러닝 로또 이벤트",
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
