import Link from "next/link";
import Nav from "@/components/Nav";
import { FAQ_ITEMS } from "@/lib/faq";

export const metadata = {
  title: "자주 하는 질문 | YSRC SUMMER FEST 2026",
  description: "YSRC SUMMER FEST 2026 빙고 인증과 이벤트 자주 하는 질문",
};

export default function FaqPage() {
  return (
    <main className="wrap faq-page">
      <Nav />
      <section className="faq-hero">
        <p className="faq-kicker">YSRC QUICK GUIDE</p>
        <h1>자주 하는 질문</h1>
        <p>빙고 인증 규칙이 헷갈릴 때 여기서 빠르게 확인해보세요.</p>
      </section>

      <section className="faq-list" aria-label="자주 하는 질문 목록">
        {FAQ_ITEMS.map((item, index) => (
          <details className="faq-item" key={item.question} open={index === 0}>
            <summary><span>Q{index + 1}</span>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>

      <Link href="/board" className="btn primary faq-back-button">빙고판으로 돌아가기</Link>
    </main>
  );
}
