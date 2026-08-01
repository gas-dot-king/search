"use client";

/**
 * 접었다 펴는 관리자 카드.
 * 관리자 화면이 길어져 자주 안 쓰는 편집 영역은 접어 두고, 필요할 때만 편다.
 * <details>를 쓰면 브라우저가 열림/닫힘과 키보드 조작을 알아서 처리한다.
 */
export default function CollapsibleCard({ title, hint, badge, defaultOpen = false, children }) {
  return (
    <details className="card admin-collapsible" open={defaultOpen}>
      <summary className="admin-collapsible-summary">
        <span className="admin-collapsible-title">{title}</span>
        {badge != null && <span className="admin-collapsible-badge">{badge}</span>}
        <span className="admin-collapsible-mark" aria-hidden="true" />
      </summary>
      {hint && <p className="hint admin-collapsible-hint">{hint}</p>}
      <div className="admin-collapsible-body">{children}</div>
    </details>
  );
}
