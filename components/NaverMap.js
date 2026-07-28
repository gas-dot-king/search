"use client";

import { useEffect, useRef, useState } from "react";

const KEY_ID = process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID;

let sdkLoader = null;

/**
 * 네이버 지도 SDK를 문서당 한 번만 내려받고, 이후 호출은 같은 Promise를 공유한다.
 * 실패한 로드는 loader를 비워 다음 방문에서 다시 시도할 수 있게 한다.
 */
function loadNaverMaps() {
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  if (sdkLoader) return sdkLoader;

  sdkLoader = new Promise((resolve, reject) => {
    // 콘솔에 등록되지 않은 도메인에서는 스크립트가 정상 응답한 뒤 이 콜백만 호출된다.
    window.navermap_authFailure = () => reject(new Error("네이버 지도 인증에 실패했습니다."));

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(KEY_ID)}`;
    script.onload = () =>
      window.naver?.maps
        ? resolve(window.naver.maps)
        : reject(new Error("네이버 지도를 불러오지 못했습니다."));
    script.onerror = () => reject(new Error("네이버 지도를 불러오지 못했습니다."));
    document.head.appendChild(script);
  }).catch((error) => {
    sdkLoader = null;
    throw error;
  });

  return sdkLoader;
}

// 장소 이름은 관리자가 입력한 값이라 innerHTML로 들어가기 전에 반드시 이스케이프한다.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

const PIN_HEIGHT = 38;

/**
 * 네이버 지도에서 장소를 검색했을 때처럼 핀 아래에 이름표를 붙인 마커.
 * 앵커는 (0,0)으로 두고 CSS transform으로 핀 끝을 좌표에 맞춘다.
 * 이름 길이에 따라 너비가 달라져도 가운데 정렬이 유지된다.
 */
function markerContent(venue) {
  const name = venue ? `<span class="map-poi-name">${escapeHtml(venue)}</span>` : "";
  return `
    <div class="map-poi">
      <svg class="map-poi-pin" width="26" height="${PIN_HEIGHT}" viewBox="0 0 26 38" aria-hidden="true">
        <path d="M13 0C5.8 0 0 5.8 0 13c0 9.4 11.6 23.3 12.1 23.9a1.2 1.2 0 0 0 1.8 0C14.4 36.3 26 22.4 26 13 26 5.8 20.2 0 13 0z" fill="#e11d48"/>
        <circle cx="13" cy="13" r="5" fill="#fff"/>
      </svg>
      ${name}
    </div>
  `;
}

/**
 * 행사장 위치 지도. 좌표나 키가 없으면 아무것도 그리지 않아,
 * 호출자가 기존 지도 링크만 노출하도록 둔다.
 */
export default function NaverMap({ lat, lng, venue }) {
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let cancelled = false;
    let map = null;

    // 지도 로딩 횟수가 곧 과금 단위라, 화면에 들어올 때만 SDK를 받는다.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        loadNaverMaps()
          .then((maps) => {
            if (cancelled || !containerRef.current) return;
            const center = new maps.LatLng(lat, lng);
            map = new maps.Map(containerRef.current, {
              center,
              zoom: 16,
              logoControl: false,
              mapDataControl: false,
              scaleControl: false,
              // 페이지를 스크롤하다 지도 위에서 확대되는 것을 막는다.
              scrollWheel: false,
            });
            new maps.Marker({
              position: center,
              map,
              title: venue || "",
              icon: { content: markerContent(venue), anchor: new maps.Point(0, 0) },
            });
          })
          .catch(() => {
            if (!cancelled) setFailed(true);
          });
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
      map?.destroy?.();
    };
  }, [lat, lng, venue]);

  if (failed) {
    return (
      <p className="event-map-error" role="status">
        지도를 불러오지 못했어요. 아래 링크로 확인해주세요.
      </p>
    );
  }

  return <div ref={containerRef} className="event-map" aria-label={`${venue || "행사장"} 위치 지도`} />;
}

export const isNaverMapConfigured = Boolean(KEY_ID);
