import "./globals.css";

export const metadata = {
  title: "러닝크루 온라인 위크",
  description: "빙고 인증 + 달리기 로또 이벤트",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
