// 인증 사진의 촬영 정보(EXIF)를 읽는다.
//
// 앱은 사진을 캔버스로 다시 그려서 올리기 때문에 저장되는 파일에는 EXIF가 남지 않는다.
// 그래서 리사이즈하기 "전" 원본에서 필요한 값만 뽑아 따로 기록한다.
// 사진 자체에는 위치 정보를 남기지 않으면서 운영진만 검토에 쓸 수 있게 하려는 구조다.
//
// 외부 라이브러리 없이 JPEG APP1(Exif) 세그먼트만 최소한으로 해석한다.

const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

const TAG = {
  MAKE: 0x010f,
  MODEL: 0x0110,
  DATE_TIME: 0x0132,
  EXIF_IFD: 0x8769,
  GPS_IFD: 0x8825,
  DATE_TIME_ORIGINAL: 0x9003,
  DATE_TIME_DIGITIZED: 0x9004,
  OFFSET_TIME_ORIGINAL: 0x9011,
  GPS_LAT_REF: 0x0001,
  GPS_LAT: 0x0002,
  GPS_LNG_REF: 0x0003,
  GPS_LNG: 0x0004,
};

/** JPEG 바이트열에서 Exif APP1 세그먼트의 TIFF 시작 위치를 찾는다 */
function findTiffStart(view, bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return -1; // SOI 아님
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return -1; // 마커 정렬이 깨졌다
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return -1; // 이미지 데이터 시작 — 더 볼 것 없음
    const size = view.getUint16(offset + 2, false);
    if (size < 2) return -1;
    if (marker === 0xe1 && offset + 4 + 6 <= bytes.length) {
      const header = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (header === "Exif" && bytes[offset + 8] === 0 && bytes[offset + 9] === 0) return offset + 10;
    }
    offset += 2 + size;
  }
  return -1;
}

function readValue(view, tiffStart, entryOffset, little) {
  const type = view.getUint16(entryOffset + 2, little);
  const count = view.getUint32(entryOffset + 4, little);
  const size = TYPE_SIZES[type];
  if (!size) return null;

  const total = size * count;
  if (total > 4 * 1024) return null; // 비정상적으로 큰 값은 무시
  const valueOffset = total <= 4 ? entryOffset + 8 : tiffStart + view.getUint32(entryOffset + 8, little);
  if (valueOffset < 0 || valueOffset + total > view.byteLength) return null;

  if (type === 2) {
    let text = "";
    for (let i = 0; i < count; i += 1) {
      const code = view.getUint8(valueOffset + i);
      if (code === 0) break;
      text += String.fromCharCode(code);
    }
    return text.trim();
  }
  if (type === 3) return view.getUint16(valueOffset, little);
  if (type === 4) return view.getUint32(valueOffset, little);
  if (type === 5 || type === 10) {
    const values = [];
    for (let i = 0; i < count; i += 1) {
      const at = valueOffset + i * 8;
      const numerator = type === 5 ? view.getUint32(at, little) : view.getInt32(at, little);
      const denominator = type === 5 ? view.getUint32(at + 4, little) : view.getInt32(at + 4, little);
      values.push(denominator === 0 ? 0 : numerator / denominator);
    }
    return count === 1 ? values[0] : values;
  }
  return null;
}

function readIfd(view, tiffStart, ifdOffset, little, wanted) {
  const found = {};
  if (ifdOffset + 2 > view.byteLength) return found;
  const count = view.getUint16(ifdOffset, little);
  if (count > 512) return found; // 손상된 데이터 방어
  for (let i = 0; i < count; i += 1) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    if (!wanted.includes(tag)) continue;
    found[tag] = readValue(view, tiffStart, entry, little);
  }
  return found;
}

/** 도·분·초 배열과 방향(N/S/E/W)을 십진 좌표로 바꾼다 */
function toDecimalDegrees(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const [degrees, minutes, seconds] = dms;
  if (![degrees, minutes, seconds].every((n) => Number.isFinite(n))) return null;
  const value = degrees + minutes / 60 + seconds / 3600;
  if (!Number.isFinite(value)) return null;
  const signed = /^[SW]$/i.test(String(ref || "")) ? -value : value;
  return Math.round(signed * 1e6) / 1e6; // 약 10cm 단위면 충분하다
}

/**
 * "2026:08:01 07:12:33" → "2026-08-01T07:12:33" (시간대 정보는 EXIF에 없다)
 * EXIF 원본은 콜론으로 구분하지만, 서버가 되돌려 받는 값은 이미 하이픈이므로 둘 다 받는다.
 */
function normalizeDateTime(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  // 0000:00:00 같은 빈 값을 쓰는 기기가 있다
  if (year === "0000" || month === "00" || day === "00") return null;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

/**
 * JPEG 바이트열에서 검토에 쓸 값만 뽑는다.
 * EXIF가 없거나 형식이 깨졌으면 null을 돌려준다 — 스크린샷·카톡으로 받은 사진이 여기 해당한다.
 */
export function readPhotoMetadata(bytes) {
  if (!bytes || bytes.length < 4) return null;
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  let tiffStart;
  try {
    tiffStart = findTiffStart(view, data);
  } catch {
    return null;
  }
  if (tiffStart < 0 || tiffStart + 8 > data.length) return null;

  const byteOrder = view.getUint16(tiffStart, false);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return null;
  const little = byteOrder === 0x4949;
  if (view.getUint16(tiffStart + 2, little) !== 42) return null;

  const meta = {};
  try {
    const ifd0 = readIfd(view, tiffStart, tiffStart + view.getUint32(tiffStart + 4, little), little, [
      TAG.MAKE, TAG.MODEL, TAG.DATE_TIME, TAG.EXIF_IFD, TAG.GPS_IFD,
    ]);

    if (ifd0[TAG.MAKE]) meta.make = String(ifd0[TAG.MAKE]).slice(0, 60);
    if (ifd0[TAG.MODEL]) meta.model = String(ifd0[TAG.MODEL]).slice(0, 60);

    let takenAt = normalizeDateTime(ifd0[TAG.DATE_TIME]);
    let offset = null;

    if (Number.isFinite(ifd0[TAG.EXIF_IFD])) {
      const exif = readIfd(view, tiffStart, tiffStart + ifd0[TAG.EXIF_IFD], little, [
        TAG.DATE_TIME_ORIGINAL, TAG.DATE_TIME_DIGITIZED, TAG.OFFSET_TIME_ORIGINAL,
      ]);
      // 촬영 시각이 가장 믿을 만하고, 없으면 저장 시각 → 파일 시각 순으로 내려간다
      takenAt = normalizeDateTime(exif[TAG.DATE_TIME_ORIGINAL])
        || normalizeDateTime(exif[TAG.DATE_TIME_DIGITIZED])
        || takenAt;
      const rawOffset = String(exif[TAG.OFFSET_TIME_ORIGINAL] || "").trim();
      if (/^[+-]\d{2}:\d{2}$/.test(rawOffset)) offset = rawOffset;
    }
    if (takenAt) meta.takenAt = takenAt;
    if (offset) meta.utcOffset = offset;

    if (Number.isFinite(ifd0[TAG.GPS_IFD])) {
      const gps = readIfd(view, tiffStart, tiffStart + ifd0[TAG.GPS_IFD], little, [
        TAG.GPS_LAT_REF, TAG.GPS_LAT, TAG.GPS_LNG_REF, TAG.GPS_LNG,
      ]);
      const lat = toDecimalDegrees(gps[TAG.GPS_LAT], gps[TAG.GPS_LAT_REF]);
      const lng = toDecimalDegrees(gps[TAG.GPS_LNG], gps[TAG.GPS_LNG_REF]);
      if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        meta.lat = lat;
        meta.lng = lng;
      }
    }
  } catch {
    return null; // 손상된 EXIF 때문에 업로드가 막히면 안 된다
  }

  return Object.keys(meta).length > 0 ? meta : null;
}

/** 서버가 받은 값을 그대로 믿지 않고, 아는 필드만 형식 검사해서 통과시킨다 */
export function sanitizePhotoMetadata(input) {
  if (!input || typeof input !== "object") return null;
  const meta = {};

  const takenAt = normalizeDateTime(input.takenAt);
  if (takenAt) meta.takenAt = takenAt;

  const offset = String(input.utcOffset || "").trim();
  if (/^[+-]\d{2}:\d{2}$/.test(offset)) meta.utcOffset = offset;

  for (const key of ["make", "model"]) {
    const text = String(input[key] ?? "").trim();
    if (text) meta[key] = text.slice(0, 60);
  }

  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    meta.lat = Math.round(lat * 1e6) / 1e6;
    meta.lng = Math.round(lng * 1e6) / 1e6;
  }

  return Object.keys(meta).length > 0 ? meta : null;
}
