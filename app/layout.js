import "./globals.css";

export const metadata = {
  title: "양산 슬로우러닝 온라인 위크",
  description: "빙고 인증 + 달리기 로또 이벤트",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
