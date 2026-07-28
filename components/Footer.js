"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="app-footer">
      <p className="app-version">v2.0</p>
      <p className="app-copyright">
        Copyright by <Link href="/admin">gas_king</Link>
      </p>
    </footer>
  );
}
