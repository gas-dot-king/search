"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, resizeImage } from "./client";

/** 인증 필요한 API를 로드하고, 미로그인/만료 시 입장 페이지로 보낸다 */
export function useApiData(path) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    try {
      const result = await api(path);
      setData(result);
      return result;
    } catch (err) {
      if (err.status === 401) router.replace("/");
      else setError(err.message);
      return null;
    }
  }, [path, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    reload();
  }, [reload, router]);

  return { data, error, reload };
}

/** 사진 선택 → 리사이즈 → 미리보기 URL 관리 */
export function usePhoto() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const clear = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError("");
  }, []);

  const pick = useCallback(async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const blob = await resizeImage(f);
      setFile(blob);
      setPreview(URL.createObjectURL(blob));
    } catch {
      setError("사진을 처리하지 못했어요. 다른 사진으로 시도해주세요.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }, []);

  return { file, preview, busy, setBusy, error, setError, pick, clear };
}
