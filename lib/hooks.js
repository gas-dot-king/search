"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, getToken, markSessionLost, resizeForUpload } from "./client";
import { photoReview, takenBeforeEvent, takenBeforeRecentDays } from "./photoReview";
import { UPLOAD_PERIOD, periodSettingsFromConfig, uploadPeriodNotice, uploadPeriodState } from "./period";
import { recoveryNotice, recoveryState, RECOVERY_STATES } from "./recovery";

// Keep recent page payloads in this tab only.  This makes a return visit feel
// instant without turning API responses into long-lived browser storage.
const API_CACHE_TTL_MS = 20 * 1000;
const MAX_API_CACHE_ENTRIES = 24;
const apiCache = new Map();
const pendingRequests = new Map();
const requestVersions = new Map();
const PUBLIC_CONFIG_TTL_MS = 60 * 1000;
let publicConfigCache = null;
let publicConfigPending = null;

function cacheKey(path) {
  return `${getToken() || "anonymous"}:${path}`;
}

function pruneApiCache(now = Date.now()) {
  for (const [key, entry] of apiCache) {
    if (entry.expiresAt <= now) apiCache.delete(key);
  }
  while (apiCache.size > MAX_API_CACHE_ENTRIES) {
    const oldestKey = apiCache.keys().next().value;
    if (!oldestKey) break;
    apiCache.delete(oldestKey);
  }
}

function cachedApiData(key, now = Date.now()) {
  const entry = apiCache.get(key);
  if (!entry || entry.expiresAt <= now) {
    if (entry) apiCache.delete(key);
    return null;
  }

  // Treat Map insertion order as a small LRU list.
  apiCache.delete(key);
  apiCache.set(key, entry);
  return entry.data;
}

/**
 * Fetch a protected GET response once per path/token, sharing an in-flight
 * request between hover prefetches and page mounts. `force` preserves the
 * existing reload contract after a mutation.
 */
export function prefetchApiData(path, { force = false, ttl = API_CACHE_TTL_MS } = {}) {
  const token = getToken();
  if (!token) return Promise.resolve(null);

  const key = cacheKey(path);
  // force일 때 `!force && ...`는 false가 된다. 아래 검사가 !== null이라
  // 그 false를 캐시 적중으로 오해해 요청 없이 false를 돌려주고, 호출한 쪽은
  // 그걸 데이터로 저장했다. 새로고침이 화면을 비우던 원인.
  const cached = force ? null : cachedApiData(key);
  if (cached !== null) return Promise.resolve(cached);

  const pending = pendingRequests.get(key);
  if (pending && !force) return pending.promise;

  const version = (requestVersions.get(key) || 0) + 1;
  requestVersions.set(key, version);
  const request = api(path)
    .then((data) => {
      // A forced reload may have started after this request. Never let an
      // older response replace its cache entry.
      if (requestVersions.get(key) === version) {
        apiCache.set(key, {
          data,
          expiresAt: Date.now() + Math.max(0, ttl),
        });
        pruneApiCache();
      }
      return data;
    })
    .finally(() => {
      if (pendingRequests.get(key)?.version === version) pendingRequests.delete(key);
    });

  pendingRequests.set(key, { promise: request, version });
  return request;
}

export function invalidateApiData(path) {
  if (path) apiCache.delete(cacheKey(path));
  else apiCache.clear();
}

export function setApiCacheData(path, data, ttl = API_CACHE_TTL_MS) {
  const token = getToken();
  if (!token || data == null) return;
  apiCache.set(cacheKey(path), { data, expiresAt: Date.now() + Math.max(0, ttl) });
  pruneApiCache();
}

/** Public config is shared by Nav and page-level period hooks in the same tab. */
export function fetchPublicConfig({ fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && publicConfigCache && publicConfigCache.expiresAt > now) {
    return Promise.resolve(publicConfigCache.data);
  }
  if (!fresh && publicConfigPending) return publicConfigPending;

  const query = fresh ? "?fresh=1" : "";
  const request = fetch(`/api/config${query}`, fresh ? { cache: "no-store" } : {})
    .then((response) => {
      if (!response.ok) throw new Error("설정을 불러오지 못했습니다.");
      return response.json();
    })
    .then((data) => {
      publicConfigCache = { data, expiresAt: Date.now() + PUBLIC_CONFIG_TTL_MS };
      return data;
    })
    .finally(() => {
      if (publicConfigPending === request) publicConfigPending = null;
    });

  if (!fresh) publicConfigPending = request;
  return request;
}

/** 인증 필요한 API를 로드하고, 미로그인/만료 시 입장 페이지로 보낸다 */
export function useApiData(path) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const load = useCallback(async ({ force = false } = {}) => {
    const requestId = ++requestIdRef.current;
    setError("");
    try {
      const result = await prefetchApiData(path, { force });
      if (mountedRef.current && requestId === requestIdRef.current) setData(result);
      return result;
    } catch (err) {
      if (err.status === 401) {
        // 토큰을 들고 있었는데 거부당했다면 다른 기기 로그인·만료·관리자 초기화 중 하나다.
        if (getToken()) {
          markSessionLost();
          clearToken();
        }
        router.replace("/");
      }
      else if (mountedRef.current && requestId === requestIdRef.current) setError(err.message);
      return null;
    }
  }, [path, router]);

  // Explicit reloads are used after mutations, so they intentionally bypass
  // the short cache while still updating it for the next navigation.
  const reload = useCallback(() => load({ force: true }), [load]);

  const setCachedData = useCallback((updater) => {
    setData((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      setApiCacheData(path, next);
      return next;
    });
  }, [path]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    load();
  }, [load, router]);

  return { data, error, reload, setData: setCachedData };
}

// 기간 경계(8/1 06:00, 8/14 18:00)를 지나면 새로고침 없이도 화면이 풀리도록 주기적으로 다시 계산한다.
const PERIOD_TICK_MS = 30 * 1000;

/**
 * 업로드·응모 가능 기간 상태.
 * 최종 차단은 서버가 하므로, 설정을 못 불러온 경우에는 화면을 잠그지 않고 열어 둔다.
 * (일시적인 네트워크 오류로 기간 중인 사용자가 막히는 쪽이 더 나쁘다)
 */
export function useUploadPeriod() {
  const [config, setConfig] = useState(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    fetchPublicConfig()
      .then((data) => active && setConfig(data))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), PERIOD_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  if (!config) {
    return { config: null, loading: !failed, state: null, open: failed, notice: "" };
  }

  const settings = periodSettingsFromConfig(config);
  const current = new Date(now);
  const state = uploadPeriodState(settings, current);
  const recovery = recoveryState(config.recovery, current);
  const recoveryActive = recovery === RECOVERY_STATES.ACTIVE;
  return {
    config,
    loading: false,
    state,
    recoveryState: recovery,
    recoveryActive,
    open: state === UPLOAD_PERIOD.OPEN && !recoveryActive,
    notice: recoveryActive ? recoveryNotice(config.recovery, recovery) : uploadPeriodNotice(settings, current),
  };
}

/**
 * 사진 선택 → 리사이즈 → 미리보기 URL 관리.
 *
 * uploadStart를 주면 이벤트 시작 전에 찍은 사진을 받지 않는다.
 * recentOnly를 켜면 오늘·어제(한국 시간) 찍은 사진만 받는다 — 빙고 인증 규칙이다.
 * 서버도 같은 검사를 하지만, 여기서 먼저 막아야 회원이 큰 사진을 올리고 나서 거절당하지 않는다.
 */
export function usePhoto({ uploadStart = null, recentOnly = false } = {}) {
  const [file, setFile] = useState(null);
  // 빙고 그리드에서 쓸 축소본. 만들지 못하면 null이고, 그때는 원본만 올린다.
  const [thumb, setThumb] = useState(null);
  // 원본에서 뽑아 둔 촬영 정보(시각·좌표·기기). EXIF가 없으면 null.
  const [meta, setMeta] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 이벤트 시작 전에 찍어 거절된 사진 — 화면이 팝업으로 이유를 알려 준다.
  const [rejected, setRejected] = useState(null);
  const generationRef = useRef(0);

  useEffect(() => () => {
    generationRef.current += 1;
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const clear = useCallback(() => {
    generationRef.current += 1;
    setFile(null);
    setThumb(null);
    setMeta(null);
    setPreview(null);
    setBusy(false);
    setError("");
    setRejected(null);
  }, []);

  const dismissRejected = useCallback(() => setRejected(null), []);

  const pick = useCallback(async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const input = e.target;
    const generation = ++generationRef.current;
    setBusy(true);
    setError("");
    try {
      const { full, thumb: small, meta: photoMeta } = await resizeForUpload(f);
      if (generation !== generationRef.current) return;

      // 규칙상 인증이 될 수 없는 사진은 올리기 전에 되돌려보낸다.
      // 기간 전 촬영을 먼저 본다 — 둘 다 걸릴 때 더 근본적인 이유를 알려주는 쪽이 낫다.
      const reason = takenBeforeEvent(photoMeta, uploadStart) ? "before_event"
        : recentOnly && takenBeforeRecentDays(photoMeta) ? "too_old"
        : null;
      if (reason) {
        setRejected({
          reason,
          takenLabel: photoReview(photoMeta, null, uploadStart).takenLabel,
          uploadStart,
        });
        return;
      }

      const nextPreview = URL.createObjectURL(full);
      setFile(full);
      setThumb(small);
      setMeta(photoMeta);
      setPreview(nextPreview);
    } catch {
      if (generation === generationRef.current) {
        setError("사진을 처리하지 못했어요. 다른 사진으로 시도해주세요.");
      }
    } finally {
      if (generation === generationRef.current) setBusy(false);
      input.value = "";
    }
  }, [uploadStart, recentOnly]);

  return {
    file, thumb, meta, preview, busy, setBusy, error, setError, pick, clear,
    rejected, dismissRejected,
  };
}
