"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CONTACT_NAME,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_LINK,
  KAKAO_CONTACT_URL,
} from "@/lib/contact";

export default function Footer() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const modalRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [...(modalRef.current?.querySelectorAll('a[href], button:not([disabled])') || [])];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <footer className="app-footer">
        <button
          ref={triggerRef}
          type="button"
          className="footer-contact"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="contact-dialog"
          onClick={() => setOpen(true)}
        >
          문의하기
        </button>
        <p className="app-version">v2.1</p>
        <p className="app-copyright">
          Copyright by <Link href="/admin">gas_king</Link>
        </p>
      </footer>

      {open && (
        <div className="contact-modal-bg" onClick={() => setOpen(false)}>
          <section
            ref={modalRef}
            id="contact-dialog"
            className="contact-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="contact-modal-heading">
              <div>
                <h2 id="contact-title">문의하기</h2>
                <p>편한 방법으로 연락해주세요.</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="contact-close"
                onClick={() => setOpen(false)}
                aria-label="문의 창 닫기"
              >
                ×
              </button>
            </div>

            <a
              className="contact-option kakao"
              href={KAKAO_CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="contact-icon" aria-hidden="true">💬</span>
              <span>
                <strong>카카오톡 오픈채팅</strong>
                <small>채팅방에서 바로 문의하기</small>
              </span>
              <span aria-hidden="true">›</span>
            </a>

            <a className="contact-option phone" href={CONTACT_PHONE_LINK}>
              <span className="contact-icon" aria-hidden="true">☎</span>
              <span>
                <strong>{CONTACT_PHONE_DISPLAY}</strong>
                <small>{CONTACT_NAME}에게 전화하기</small>
              </span>
              <span aria-hidden="true">›</span>
            </a>
          </section>
        </div>
      )}
    </>
  );
}
