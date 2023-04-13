import { Message, ModelConfig, useAccessStore } from "./store";
import Locale from "./locales";
import qs from "qs";
import { KEEP_FLAG, START_FLAG } from "@/app/constant";

if (!Array.prototype.at) {
  require("array.prototype.at/auto");
}

const TIME_OUT_MS = 300000;

const EMAIL = process.env.EMAIL;

function getHeaders() {
  const accessStore = useAccessStore.getState();
  let headers: Record<string, string> = {};

  if (accessStore.enabledAccessControl()) {
    headers["access-code"] = accessStore.accessCode;
  }

  if (accessStore.token && accessStore.token.length > 0) {
    headers["token"] = accessStore.token;
  }

  return headers;
}

export async function requestChatStream(
  messages: Message[],
  options?: {
    userId?: string;
    filterBot?: boolean;
    modelConfig?: ModelConfig;
    onMessage: (message: string, done: boolean) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
  },
) {
  const controller = new AbortController();
  const reqTimeoutId = setTimeout(() => controller.abort(), TIME_OUT_MS);

  try {
    const lastMessage = messages[messages.length - 1];
    const model = options?.modelConfig?.model;
    const params: ChatGPTRequest = {
      sentence: lastMessage.content,
      model: model,
      user_id: options?.userId,
    };
    const queryString = qs.stringify(params);
    const res = await fetch(`/api/chat-stream?${queryString}`, {
      method: "GET",
      headers: {
        ...getHeaders(),
      },
      signal: controller.signal,
    });
    clearTimeout(reqTimeoutId);

    let responseText = "";

    const finish = () => {
      options?.onMessage(responseText, true);
      controller.abort();
    };

    if (res.ok) {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      options?.onController?.(controller);

      while (true) {
        // handle time out, will stop if no response in 10 secs
        const resTimeoutId = setTimeout(() => finish(), TIME_OUT_MS);
        const content = await reader?.read();
        clearTimeout(resTimeoutId);
        const text = decoder.decode(content?.value, { stream: true });
        if (text === START_FLAG) {
          responseText += "\u200b";
        } else if (text === KEEP_FLAG) {
          responseText += ".";
        } else if (text) {
          responseText += text;
        }
        const done = !content || content.done;
        options?.onMessage(responseText, false);

        if (done) {
          break;
        }
      }
      finish();
    } else if (res.status === 401) {
      console.error("Anauthorized");
      if (Locale.Error.UnauthorizedFunc && EMAIL) {
        responseText = Locale.Error.UnauthorizedFunc(EMAIL);
      } else {
        responseText = Locale.Error.Unauthorized;
      }
      finish();
    } else {
      console.error("Stream Error", res.body);
      options?.onError(new Error("Stream Error"));
    }
  } catch (err) {
    console.error("NetWork Error", err);
    options?.onError(err as Error);
  }
}
// To store message streaming controller
export const ControllerPool = {
  controllers: {} as Record<string, AbortController>,

  addController(
    sessionIndex: number,
    messageIndex: number,
    controller: AbortController,
  ) {
    const key = this.key(sessionIndex, messageIndex);
    this.controllers[key] = controller;
    return key;
  },

  stop(sessionIndex: number, messageIndex: number) {
    const key = this.key(sessionIndex, messageIndex);
    const controller = this.controllers[key];
    controller?.abort();
  },

  remove(sessionIndex: number, messageIndex: number) {
    const key = this.key(sessionIndex, messageIndex);
    delete this.controllers[key];
  },

  key(sessionIndex: number, messageIndex: number) {
    return `${sessionIndex},${messageIndex}`;
  },
};
