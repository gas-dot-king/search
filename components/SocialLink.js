export default function SocialLink({ href, label, type }) {
  return (
    <a
      href={href}
      className={`settings-link social-link social-${type}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} 열기`}
    >
      {type === "instagram" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <span className="social-carrot-icon" aria-hidden="true">🥕</span>
      )}
    </a>
  );
}
