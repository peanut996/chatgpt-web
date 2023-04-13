import { createParser } from "eventsource-parser";
import { NextRequest } from "next/server";
import { FLAG } from "@/app/constant";
import { ALL_MODELS } from "@/app/store";

const SERVER_URL = process.env.SERVER_URL
  ? process.env.SERVER_URL
  : "http://localhost:5000";

const DOWNGRADE_MODE = process.env.DOWNGRADE;

const getHeaders = () => {
  const clientId = process.env.CLIENT_ID || "client_id";
  const clientSecret = process.env.CLIENT_SECRET || "client_secret";
  return {
    "CF-Access-Client-Id": clientId,
    "CF-Access-Client-Secret": clientSecret,
  };
};

export const ask = async (param: string): Promise<Response> => {
  if (DOWNGRADE_MODE) {
    let obj = JSON.parse(param);
    obj["model"] = ALL_MODELS[0].model;
    param = JSON.stringify(obj);
  }
  const url = `${SERVER_URL}/chat-stream`;
  return fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...getHeaders(),
    },
    method: "POST",
    body: param,
  });
};

async function createStream(req: NextRequest) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const param = await concatStringStream(req.body!);
  const res = await ask(param);

  const readableStream = new ReadableStream({
    async start(controller) {
      let total = "";

      function onParse(event: any) {
        if (event.type === "event") {
          const data = event.data;
          // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
          if (data === "[DONE]") {
            console.log(
              `[Stream] received done event, stop streaming, , param: ${param},  answer: ${total}`,
            );
            total = "";
            controller.close();
            return;
          }
          try {
            let queue: Uint8Array;
            if (data === "[START]") {
              console.log(
                `[Stream] received start event, start streaming, param: ${param}`,
              );
              queue = encoder.encode(FLAG);
            } else if (data === "[KEEP]") {
              console.log(
                `[Stream] received keep event, keep streaming, param: ${param}`,
              );
              queue = encoder.encode(FLAG);
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

export async function POST(req: NextRequest) {
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

const concatStringStream = async (stream: ReadableStream): Promise<string> => {
  let result = "";
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return result;
    }
    result += decoder.decode(value, { stream: true });
  }
};
