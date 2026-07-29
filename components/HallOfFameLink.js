import Link from "next/link";

export default function HallOfFameLink({ active = false, className = "" }) {
  return (
    <Link
      href="/hall"
      className={`settings-link hall-link ${active ? "active" : ""} ${className}`.trim()}
      aria-label="명예의 전당 열기"
      aria-current={active ? "page" : undefined}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h10v5.5a5 5 0 0 1-10 0V4Z" />
        <path d="M17 5.5h3v1.6a3.4 3.4 0 0 1-3.4 3.4" />
        <path d="M7 5.5H4v1.6a3.4 3.4 0 0 0 3.4 3.4" />
        <path d="M12 14.5V17" />
        <path d="M8.5 20.5h7l-.6-2.1a1.1 1.1 0 0 0-1.05-.8h-3.7a1.1 1.1 0 0 0-1.05.8l-.6 2.1Z" />
      </svg>
    </Link>
  );
}
