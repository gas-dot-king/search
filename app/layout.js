import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";
import Footer from "@/components/Footer";
import RecoveryOverlay from "@/components/RecoveryOverlay";

export const metadata = {
  title: "YSRC SUMMER FEST 2026 — 온라인 위크 이벤트",
  description: "빙고 인증, 러닝 로또, 28일 챌린지와 오프라인 행사",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "YSRC SUMMER FEST 2026" },
  icons: { apple: "/icon.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e11d48",
};

const themeScript = `
  (() => {
    try {
      const theme = localStorage.getItem("ow_theme");
      const isDark = theme === "dark";
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
      const syncThemeColor = () => {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", isDark ? "#0f172a" : "#e11d48");
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", syncThemeColor, { once: true });
      } else {
        syncThemeColor();
      }
    } catch {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <InstallPrompt />
        <RecoveryOverlay />
        {children}
        <Footer />
      </body>
    </html>
  );
}
