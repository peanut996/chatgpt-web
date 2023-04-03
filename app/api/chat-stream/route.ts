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

  return new ReadableStream({
    async start(controller) {
      function onParse(event: any) {
        if (event.type === "event") {
          const data = event.data;
          // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            let queue: Uint8Array;
            if (data === "[START]") {
              queue = encoder.encode("");
            } else {
              const json: ChatGPTResponse = JSON.parse(data);
              const text = json.message ? json.message : json.detail;
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
