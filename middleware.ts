import {NextRequest, NextResponse} from "next/server";
import md5 from "spark-md5";
import {SALT} from "@/app/api/access";



const validateAccessCode = (token: string | null ): boolean => {
    if (!SALT) {
        return true;
    }
    try {
        if (!token) {
            return false;
        }
        const [invitationCode, hashPart] = token.split("-");
        const hash = md5.hash(invitationCode + SALT).trim().substring(0, 10);
        return hash === hashPart;
    } catch (e) {
        console.error("[Auth] validate access code error:", e);
        return false;
    }
}

const accessCodeTip = "Please go settings page and fill your access code. " +
    "You can donate to the bot to get your access code.\n\n" +
    "🔮请前往设置页面并填写您的访问码, 成为bot捐赠用户方可获得访问码。\n\n" +
    "🤖  https://bit.ly/3I3TSSo"
export const config = {
    matcher: ["/api/openai", "/api/chat-stream"],
};

export function middleware(req: NextRequest) {
    const accessCode = req.headers.get("access-code");
    console.log("[Auth] got access code:", accessCode);
    const isValidAccessCode = validateAccessCode(accessCode);
    console.log("[Auth] is valid access code: ", isValidAccessCode);
    if (!isValidAccessCode) {
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
