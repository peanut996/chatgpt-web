import { createParser } from "eventsource-parser";
import { NextRequest } from "next/server";

const SERVER_URL = process.env.SERVER_URL
  ? process.env.SERVER_URL
  : "http://localhost:5000";

export const ask = async (req: NextRequest): Promise<Response> => {
  const params = req.nextUrl.searchParams;
  const queryString = params.toString();
  const url = `${SERVER_URL}/chat-stream?${queryString}`;
  return fetch(url, {
    method: "GET",
  });
};

async function createStream(req: NextRequest) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await ask(req);

  const readableStream = new ReadableStream({
    async start(controller) {
      let total = "";

      function onParse(event: any) {
        if (event.type === "event") {
          const data = event.data;
          // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
          if (data === "[DONE]") {
            console.log(
              "[Stream] received done, stop streaming, total text: " + total,
            );
            total = "";
            controller.close();
            return;
          }
          try {
            let queue: Uint8Array;
            if (data === "[START]") {
              console.log(
                `[Stream] received ack, start streaming, param: ${JSON.stringify(
                  getUrlParams(req.nextUrl.searchParams),
                )}`,
              );
              queue = encoder.encode("");
            } else {
              const json: ChatGPTResponse = JSON.parse(data);
              const text = json.message ? json.message : json.detail;
              if (text) {
                total += text;
              }
              queue = encoder.encode(text);
            }
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      }

      const parser = createParser(onParse);
      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });
  return readableStream;
}

export async function GET(req: NextRequest) {
  try {
    const stream: ReadableStream = await createStream(req);
    return new Response(stream);
  } catch (error) {
    console.error("[Chat Stream]", error);
  }
}

export const config = {
  runtime: "edge",
};

const getUrlParams = (params: URLSearchParams): Record<string, string> => {
  let paramsObject: Record<string, string> = {};

  for (let p of params) {
    paramsObject[decodeURIComponent(p[0])] = p[1];
  }
  return paramsObject;
};
