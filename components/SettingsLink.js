import Link from "next/link";

export default function SettingsLink({ active = false, className = "" }) {
  return (
    <Link
      href="/settings"
      className={`settings-link ${active ? "active" : ""} ${className}`.trim()}
      aria-label="설정 열기"
      aria-current={active ? "page" : undefined}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z" />
        <path d="M19.1 13.5a7.8 7.8 0 0 0 .05-1.5 7.8 7.8 0 0 0-.05-1.5l1.73-1.35-1.9-3.3-2.04.82a7.46 7.46 0 0 0-2.59-1.5L14 3h-4l-.3 2.17a7.46 7.46 0 0 0-2.59 1.5l-2.04-.82-1.9 3.3L4.9 10.5a7.8 7.8 0 0 0-.05 1.5c0 .51.02 1.01.05 1.5l-1.73 1.35 1.9 3.3 2.04-.82a7.46 7.46 0 0 0 2.59 1.5L10 21h4l.3-2.17a7.46 7.46 0 0 0 2.59-1.5l2.04.82 1.9-3.3-1.73-1.35Z" />
      </svg>
    </Link>
  );
}
