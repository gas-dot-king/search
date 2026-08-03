import { serializeEventGuide } from "./event";
import { EDITABLE_KEYS } from "./settings";
import {
  demoConfirmFourLine,
  demoDeleteCellPhoto,
  demoDeleteLottoEntry,
  demoDeleteUser,
  demoDrawRecoveryDigit,
  demoDrawNumbers,
  demoNextLottoRound,
  demoResetBoard,
  demoResetDraw,
  demoResetUserPin,
  demoRenameUser,
  demoSetSetting,
  demoUnconfirmFourLine,
} from "./demo";

/** 데모 모드 관리자 명령. 운영 라우트와 같은 요청 모양을 유지한다. */
export function demoAdminAction(body) {
  switch (body.action) {
    case "draw_recovery_digit":
      return demoDrawRecoveryDigit();

    case "set_setting":
      if (!EDITABLE_KEYS.includes(body.key) || body.key === "upload_start" || body.key === "upload_end") {
        return { error: "수정할 수 없는 설정입니다.", status: 400 };
      }
      return demoSetSetting(body.key, body.key === "event_guide" ? serializeEventGuide(body.value) : body.value);

    case "draw_numbers":
      return demoDrawNumbers();

    case "next_lotto_round":
      return demoNextLottoRound();

    case "reset_draw":
      return demoResetDraw();

    case "reset_user_pin":
      return demoResetUserPin(String(body.userId || ""));

    case "rename_user": {
      const nickname = String(body.nickname || "").trim();
      if (nickname.length < 1 || nickname.length > 12) {
        return { error: "닉네임은 1~12자로 입력해주세요.", status: 400 };
      }
      return demoRenameUser(String(body.userId || ""), nickname);
    }

    case "set_upload_period": {
      const start = String(body.start || "");
      const end = String(body.end || "");
      if (
        Number.isNaN(new Date(start).getTime())
        || Number.isNaN(new Date(end).getTime())
        || new Date(start) >= new Date(end)
      ) {
        return { error: "업로드 시작과 마감 시각을 올바르게 입력해주세요.", status: 400 };
      }
      demoSetSetting("upload_start", start);
      return demoSetSetting("upload_end", end);
    }

    case "reset_board":
      return demoResetBoard(String(body.userId || ""));

    case "delete_user":
      return demoDeleteUser(String(body.userId || ""));

    case "delete_cell_photo":
      return demoDeleteCellPhoto(body.cellId);

    case "delete_lotto_entry":
      return demoDeleteLottoEntry(body.entryId);

    case "confirm_four_line":
      return demoConfirmFourLine(String(body.userId || ""));

    case "unconfirm_four_line":
      return demoUnconfirmFourLine(String(body.userId || ""));

    case "retry_cleanup":
      return { ok: true, pending: false, cleanup: { pending: 0, stuck: 0, oldest: null, samples: [] } };

    default:
      return { error: "알 수 없는 요청입니다.", status: 400 };
  }
}
