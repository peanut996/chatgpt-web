import { NextRequest, NextResponse } from "next/server";
import { ACCESS_CODES } from "./app/api/access";
import md5 from "spark-md5";


const accessCodeTip = "Please go settings page and fill your access code. " +
    "You can donate to the bot to get your access code.\n\n" +
    "🔮请前往设置页面并填写您的访问码, 成为bot捐赠用户方可获得访问码。\n\n" +
    "🤖  https://bit.ly/3I3TSSo"
export const config = {
  matcher: ["/api/openai", "/api/chat-stream"],
};

export function middleware(req: NextRequest) {
  const accessCode = req.headers.get("access-code");
  const hashedCode = md5.hash(accessCode ?? "").trim();

  console.log("[Auth] allowed hashed codes length: "+ ACCESS_CODES.size);
  console.log("[Auth] got access code:", accessCode);
  console.log("[Auth] hashed access code:", hashedCode);

  if (ACCESS_CODES.size > 0 && !ACCESS_CODES.has(hashedCode)) {
    return NextResponse.json(
      {
        error: true,
        needAccessCode: true,
        msg: accessCodeTip,
      },
      {
        status: 401,
      },
    );
  }

  return NextResponse.next({
    request: {
      headers: req.headers,
    },
  });
}
