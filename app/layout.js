import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata = {
  title: "러닝크루 온라인 위크",
  description: "빙고 인증과 러닝 로또 이벤트",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "러닝크루 빙고" },
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
