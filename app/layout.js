import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata = {
  title: "양산 슬로우러닝 온라인 위크",
  description: "빙고 인증, 러닝 로또와 행사 안내",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "양산 슬로우러닝 온라인 위크" },
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
