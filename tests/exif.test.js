import { describe, expect, it } from "vitest";
import { readPhotoMetadata, sanitizePhotoMetadata } from "../lib/exif";

// EXIF가 든 JPEG을 손으로 만들어 파서를 검증한다. 실제 폰 사진을 저장소에 넣지 않고도
// 촬영 시각·좌표를 제대로 읽는지, 이상한 입력에 무너지지 않는지 확인할 수 있다.
function buildJpeg({ make, model, dateTime, dateTimeOriginal, gps, byteOrder = "II" } = {}) {
  const little = byteOrder === "II";
  const ascii = (v) => Buffer.from(`${v}\0`, "ascii");
  const u16 = (v) => { const b = Buffer.alloc(2); little ? b.writeUInt16LE(v) : b.writeUInt16BE(v); return b; };
  const u32 = (v) => { const b = Buffer.alloc(4); little ? b.writeUInt32LE(v) : b.writeUInt32BE(v); return b; };
  const rational = (num, den) => Buffer.concat([u32(num), u32(den)]);

  // 각 IFD를 [엔트리들][다음IFD=0][바깥 데이터] 순서로 직렬화한다
  const build = (fields, dataStart) => {
    const entries = [];
    const blobs = [];
    let cursor = dataStart + 2 + fields.length * 12 + 4;
    for (const { tag, type, count, inline, data } of fields) {
      const e = Buffer.concat([u16(tag), u16(type), u32(count), inline ?? u32(cursor)]);
      entries.push(e);
      if (!inline) {
        const padded = data.length % 2 ? Buffer.concat([data, Buffer.alloc(1)]) : data;
        blobs.push(padded);
        cursor += padded.length;
      }
    }
    return { buf: Buffer.concat([u16(fields.length), ...entries, u32(0), ...blobs]), end: cursor };
  };

  // IFD0 → Exif IFD → GPS IFD 를 빈틈없이 이어 붙인다
  const ifd0Fields = [];
  if (make) ifd0Fields.push({ tag: 0x010f, type: 2, count: ascii(make).length, data: ascii(make) });
  if (model) ifd0Fields.push({ tag: 0x0110, type: 2, count: ascii(model).length, data: ascii(model) });
  if (dateTime) ifd0Fields.push({ tag: 0x0132, type: 2, count: ascii(dateTime).length, data: ascii(dateTime) });

  const totalFields = ifd0Fields.length + (dateTimeOriginal ? 1 : 0) + (gps ? 1 : 0);
  let dataCursor = 8 + 2 + totalFields * 12 + 4;
  for (const f of ifd0Fields) dataCursor += f.data.length + (f.data.length % 2);

  let exifBuf = Buffer.alloc(0);
  let exifPointer = 0;
  if (dateTimeOriginal) {
    exifPointer = dataCursor;
    const dto = ascii(dateTimeOriginal);
    const built = build([{ tag: 0x9003, type: 2, count: dto.length, data: dto }], exifPointer);
    exifBuf = built.buf;
    dataCursor = built.end;
  }

  let gpsBuf = Buffer.alloc(0);
  let gpsPointer = 0;
  if (gps) {
    gpsPointer = dataCursor;
    const latRef = Buffer.from(`${gps.latRef}\0`, "ascii");
    const lngRef = Buffer.from(`${gps.lngRef}\0`, "ascii");
    const built = build([
      { tag: 0x0001, type: 2, count: 2, inline: Buffer.concat([latRef, Buffer.alloc(2)]) },
      { tag: 0x0002, type: 5, count: 3, data: Buffer.concat(gps.lat.map(([n, d]) => rational(n, d))) },
      { tag: 0x0003, type: 2, count: 2, inline: Buffer.concat([lngRef, Buffer.alloc(2)]) },
      { tag: 0x0004, type: 5, count: 3, data: Buffer.concat(gps.lng.map(([n, d]) => rational(n, d))) },
    ], gpsPointer);
    gpsBuf = built.buf;
    dataCursor = built.end;
  }

  if (dateTimeOriginal) ifd0Fields.push({ tag: 0x8769, type: 4, count: 1, inline: u32(exifPointer) });
  if (gps) ifd0Fields.push({ tag: 0x8825, type: 4, count: 1, inline: u32(gpsPointer) });

  const ifd0 = build(ifd0Fields, 8);
  const tiff = Buffer.concat([
    Buffer.from(byteOrder, "ascii"), u16(42), u32(8),
    ifd0.buf, exifBuf, gpsBuf,
  ]);

  const payload = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
  const lenBuf = Buffer.alloc(2);
  lenBuf.writeUInt16BE(payload.length + 2, 0);
  return new Uint8Array(Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1]), lenBuf, payload,
    Buffer.from([0xff, 0xda, 0x00, 0x02, 0x00, 0xff, 0xd9]),
  ]));
}

describe("사진 촬영 정보 읽기", () => {
  it("촬영 시각과 기기 정보를 읽는다", () => {
    const meta = readPhotoMetadata(buildJpeg({
      make: "Apple", model: "iPhone 15 Pro",
      dateTime: "2026:08:01 07:00:00",
      dateTimeOriginal: "2026:08:01 06:42:11",
    }));
    expect(meta).toMatchObject({
      make: "Apple",
      model: "iPhone 15 Pro",
      takenAt: "2026-08-01T06:42:11", // 촬영 시각이 파일 시각보다 우선한다
    });
  });

  it("촬영 시각이 없으면 파일 시각으로 내려간다", () => {
    const meta = readPhotoMetadata(buildJpeg({ dateTime: "2026:08:02 21:05:09" }));
    expect(meta.takenAt).toBe("2026-08-02T21:05:09");
  });

  it("GPS 좌표를 십진수로 바꾼다 (양산 근처)", () => {
    const meta = readPhotoMetadata(buildJpeg({
      dateTimeOriginal: "2026:08:01 06:42:11",
      gps: {
        latRef: "N", lat: [[35, 1], [19, 1], [4152, 100]],
        lngRef: "E", lng: [[129, 1], [1, 1], [2532, 100]],
      },
    }));
    expect(meta.lat).toBeCloseTo(35.3282, 3);
    expect(meta.lng).toBeCloseTo(129.0237, 3);
  });

  it("남반구·서반구는 음수로 바꾼다", () => {
    const meta = readPhotoMetadata(buildJpeg({
      gps: {
        latRef: "S", lat: [[33, 1], [51, 1], [0, 1]],
        lngRef: "W", lng: [[70, 1], [39, 1], [0, 1]],
      },
    }));
    expect(meta.lat).toBeCloseTo(-33.85, 2);
    expect(meta.lng).toBeCloseTo(-70.65, 2);
  });

  it("빅엔디안(MM) 사진도 읽는다", () => {
    const meta = readPhotoMetadata(buildJpeg({ byteOrder: "MM", make: "Canon", dateTime: "2026:08:03 10:00:00" }));
    expect(meta).toMatchObject({ make: "Canon", takenAt: "2026-08-03T10:00:00" });
  });

  it("EXIF가 없는 사진(스크린샷·카톡 사진)은 null", () => {
    const plain = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x02, 0x00, 0xff, 0xd9]);
    expect(readPhotoMetadata(plain)).toBe(null);
  });

  it("빈 값·잘린 파일·JPEG이 아닌 데이터에 무너지지 않는다", () => {
    expect(readPhotoMetadata(null)).toBe(null);
    expect(readPhotoMetadata(new Uint8Array([]))).toBe(null);
    expect(readPhotoMetadata(new Uint8Array([0xff, 0xd8]))).toBe(null);
    expect(readPhotoMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(null); // PNG
    const truncated = buildJpeg({ dateTimeOriginal: "2026:08:01 06:42:11" }).slice(0, 20);
    expect(() => readPhotoMetadata(truncated)).not.toThrow();
  });

  it("0000:00:00 같은 빈 촬영 시각은 버린다", () => {
    expect(readPhotoMetadata(buildJpeg({ dateTime: "0000:00:00 00:00:00" }))).toBe(null);
  });
});

describe("서버가 받은 촬영 정보 검사", () => {
  it("아는 필드만 통과시킨다", () => {
    expect(sanitizePhotoMetadata({
      takenAt: "2026-08-01T06:42:11",
      make: "Apple",
      model: "iPhone 15 Pro",
      lat: 35.328146,
      lng: 129.023699,
      utcOffset: "+09:00",
      전송된쓰레기: "무시돼야 함",
    })).toEqual({
      takenAt: "2026-08-01T06:42:11",
      utcOffset: "+09:00",
      make: "Apple",
      model: "iPhone 15 Pro",
      lat: 35.328146,
      lng: 129.023699,
    });
  });

  it("범위를 벗어난 좌표는 버린다", () => {
    expect(sanitizePhotoMetadata({ lat: 999, lng: 1 })).toBe(null);
    expect(sanitizePhotoMetadata({ lat: 35, lng: 999 })).toBe(null);
    expect(sanitizePhotoMetadata({ lat: "북쪽", lng: "동쪽" })).toBe(null);
  });

  it("형식이 어긋난 시각과 시간대는 버린다", () => {
    expect(sanitizePhotoMetadata({ takenAt: "어제 아침" })).toBe(null);
    expect(sanitizePhotoMetadata({ takenAt: "2026-08-01T06:42:11", utcOffset: "한국" }))
      .toEqual({ takenAt: "2026-08-01T06:42:11" });
  });

  it("긴 문자열은 잘라서 저장한다", () => {
    const meta = sanitizePhotoMetadata({ make: "가".repeat(200) });
    expect(meta.make.length).toBe(60);
  });

  it("아무 값도 없으면 null — 빈 객체를 남기지 않는다", () => {
    expect(sanitizePhotoMetadata({})).toBe(null);
    expect(sanitizePhotoMetadata(null)).toBe(null);
    expect(sanitizePhotoMetadata("문자열")).toBe(null);
  });
});
