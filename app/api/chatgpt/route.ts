import { NextRequest, NextResponse } from "next/server";

const SERVER_URL = "https://api-chatgpt.peanut996.cn";
export const ask = async (req: NextRequest): Promise<Response> => {
  console.log("ready to get");
  const params = req.nextUrl.searchParams;
  const queryString = params.toString();
  const url = `${SERVER_URL}/chat?${queryString}`;
  return fetch(url, {
    method: "GET",
  });
};
async function makeRequest(req: NextRequest) {
  try {
    const res = await ask(req);
    return new Response(res.body);
  } catch (e) {
    console.error("[OpenAI] ", req.body, e);
    return NextResponse.json(
      {
        error: true,
        msg: JSON.stringify(e),
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET(req: NextRequest) {
  return makeRequest(req);
}
