"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, resizeImage } from "./client";
import { UPLOAD_PERIOD, periodSettingsFromConfig, uploadPeriodNotice, uploadPeriodState } from "./period";

// Keep recent page payloads in this tab only.  This makes a return visit feel
// instant without turning API responses into long-lived browser storage.
const API_CACHE_TTL_MS = 20 * 1000;
const MAX_API_CACHE_ENTRIES = 24;
const apiCache = new Map();
const pendingRequests = new Map();
const requestVersions = new Map();

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
  const cached = !force && cachedApiData(key);
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
      if (err.status === 401) router.replace("/");
      else if (mountedRef.current && requestId === requestIdRef.current) setError(err.message);
      return null;
    }
  }, [path, router]);

  // Explicit reloads are used after mutations, so they intentionally bypass
  // the short cache while still updating it for the next navigation.
  const reload = useCallback(() => load({ force: true }), [load]);

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

  return { data, error, reload, setData };
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
    fetch("/api/config")
      .then((response) => {
        if (!response.ok) throw new Error("설정을 불러오지 못했습니다.");
        return response.json();
      })
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
  const state = uploadPeriodState(settings, new Date(now));
  return {
    config,
    loading: false,
    state,
    open: state === UPLOAD_PERIOD.OPEN,
    notice: uploadPeriodNotice(settings, new Date(now)),
  };
}

/** 사진 선택 → 리사이즈 → 미리보기 URL 관리 */
export function usePhoto() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    setPreview(null);
    setBusy(false);
    setError("");
  }, []);

  const pick = useCallback(async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const input = e.target;
    const generation = ++generationRef.current;
    setBusy(true);
    setError("");
    try {
      const blob = await resizeImage(f);
      if (generation !== generationRef.current) return;
      const nextPreview = URL.createObjectURL(blob);
      setFile(blob);
      setPreview(nextPreview);
    } catch {
      if (generation === generationRef.current) {
        setError("사진을 처리하지 못했어요. 다른 사진으로 시도해주세요.");
      }
    } finally {
      if (generation === generationRef.current) setBusy(false);
      input.value = "";
    }
  }, []);

  return { file, preview, busy, setBusy, error, setError, pick, clear };
}
