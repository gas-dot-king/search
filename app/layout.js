import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata = {
  title: "YSRC SUMMER FEST 2026 — 온라인 위크 이벤트",
  description: "빙고 인증, 러닝 로또, 28일 챌린지와 오프라인 행사",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "YSRC SUMMER FEST 2026" },
  icons: { apple: "/icon.png" },
};

export const viewport = { themeColor: "#e11d48" };

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
