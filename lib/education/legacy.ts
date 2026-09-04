import { NextResponse } from "next/server";
// This branch is a separate course deployment. Retiring the legacy API prevents
// bypassing course enrollment, consent, stage checks and per-session AI limits.
export function legacyDisabled() {
  return NextResponse.json({ error: "本教学分支已停用旧版接口，请使用教育心理学课程工作台。" }, {status:410,headers:{"Cache-Control":"no-store"}});
}
