"use client";

import Link from "next/link";
import { currentLottoRound, parseLottoRounds } from "@/lib/lotto";

/** 로또 응모 장수와 추첨 현황. 뽑기 자체는 추첨 화면에서 한다. */
export default function LottoCard({ settings }) {
  return (
    <>
      <label>1인 최대 응모 장수</label>
      <div className="rule-box" style={{ marginTop: 0 }}>
        🎟️ 1인당 <b>2장</b>으로 고정되어 있습니다.
      </div>

      <label>추첨 번호 (1의 자리·소수점 첫째·둘째, 총 3자리)</label>
      {/* 뽑기·차수 진행은 모두 추첨 화면에서 한다. 여기서는 현재 상태만 보여준다. */}
      <LottoStatus digits={settings.winning_numbers || ""} rounds={settings.lotto_rounds || ""} />
      <Link className="btn primary draw-stage-link" href="/admin/draw">
        🎰 무작위 번호 추첨 (큰 화면)
      </Link>
    </>
  );
}

function LottoStatus({ digits, rounds }) {
  const pastRounds = parseLottoRounds(rounds);
  const round = currentLottoRound(rounds);
  const complete = digits.length === 3;

  return (
    <div>
      <div className="winning-digits" style={{ justifyContent: "flex-start", margin: "8px 0" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`winning-digit ${i < digits.length ? "" : "pending"}`}>
            {i < digits.length ? digits[i] : "?"}
          </span>
        ))}
      </div>
      <p className="hint">
        {complete
          ? `${round}차 추첨 번호 ${digits[0]}.${digits.slice(1)}km`
          : `${round}차 추첨 진행 중 · ${3 - digits.length}자리 남음`}
        {pastRounds.length > 0 && ` · 1등 없이 넘어간 차수 ${pastRounds.length}회`}
      </p>
    </div>
  );
}
