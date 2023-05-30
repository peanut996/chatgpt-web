import { create } from "zustand";
import { persist } from "zustand/middleware";

import { type ChatCompletionResponseMessage } from "openai";
import { ControllerPool, requestChatStream } from "../requests";

import Locale from "../locales";
import { v4 as uuid } from "uuid";

if (!Array.prototype.at) {
  require("array.prototype.at/auto");
}

export type Message = ChatCompletionResponseMessage & {
  date: string;
  streaming?: boolean;
};

export enum SubmitKey {
  Enter = "Enter",
  CtrlEnter = "Ctrl + Enter",
  ShiftEnter = "Shift + Enter",
  AltEnter = "Alt + Enter",
  MetaEnter = "Meta + Enter",
}

export enum Theme {
  Auto = "auto",
  Dark = "dark",
  Light = "light",
}

export interface ChatConfig {
  historyMessageCount: number; // -1 means all
  compressMessageLengthThreshold: number;
  sendBotMessages: boolean; // send bot's message or not
  submitKey: SubmitKey;
  avatar: string;
  fontSize: number;
  theme: Theme;
  tightBorder: boolean;
  sendPreviewBubble: boolean;

  disablePromptHint: boolean;

  modelConfig: {
    model: string;
  };
}

export type ModelConfig = ChatConfig["modelConfig"];

export const ROLES: Message["role"][] = ["system", "user", "assistant"];

const ENABLE_GPT4 = false;

export const ALL_MODELS = [
  {
    name: "Default (GPT-3.5)",
    model: "text-davinci-002-render-sha",
    available: true,
  },
  {
    name: "Legacy (GPT-3.5)",
    model: "text-davinci-002-render-paid",
    available: true,
  },
];

export function isValidModel(name: string) {
  return ALL_MODELS.some((m) => m.name === name && m.available);
}

export function isValidNumber(x: number, min: number, max: number) {
  return typeof x === "number" && x <= max && x >= min;
}

export function filterConfig(oldConfig: ModelConfig): Partial<ModelConfig> {
  const config = Object.assign({}, oldConfig) as any;

  const validator: {
    [k in keyof ModelConfig]: (x: ModelConfig[keyof ModelConfig]) => boolean;
  } = {
    model(x) {
      return isValidModel(x as string);
    },
  };

  Object.keys(validator).forEach((k) => {
    const key = k as keyof ModelConfig;
    if (!validator[key](config[key])) {
      delete config[key];
    }
  });

  return config;
}

const DEFAULT_CONFIG: ChatConfig = {
  historyMessageCount: 4,
  compressMessageLengthThreshold: 1000,
  sendBotMessages: true as boolean,
  submitKey: SubmitKey.CtrlEnter as SubmitKey,
  avatar: "1f603",
  fontSize: 14,
  theme: Theme.Auto as Theme,
  tightBorder: false,
  sendPreviewBubble: true,

  disablePromptHint: false,

  modelConfig: {
    model: "text-davinci-002-render-sha",
  },
};

export interface ChatStat {
  tokenCount: number;
  wordCount: number;
  charCount: number;
}

export interface ChatSession {
  id: number;
  topic: string;
  memoryPrompt: string;
  context: Message[];
  messages: Message[];
  stat: ChatStat;
  lastUpdate: string;
  lastSummarizeIndex: number;
  chatId: string;
}

const DEFAULT_TOPIC = Locale.Store.DefaultTopic;
export const BOT_HELLO: Message = {
  role: "assistant",
  content: Locale.Store.BotHello,
  date: "",
};

function createEmptySession(): ChatSession {
  const createDate = new Date().toLocaleString();
  const chatId = uuid();
  return {
    chatId: chatId,
    id: Date.now(),
    topic: DEFAULT_TOPIC,
    memoryPrompt: "",
    context: [],
    messages: [],
    stat: {
      tokenCount: 0,
      wordCount: 0,
      charCount: 0,
    },
    lastUpdate: createDate,
    lastSummarizeIndex: 0,
  };
}

interface ChatStore {
  config: ChatConfig;
  sessions: ChatSession[];
  currentSessionIndex: number;
  clearSessions: () => void;
  removeSession: (index: number) => void;
  selectSession: (index: number) => void;
  newSession: () => void;
  currentSession: () => ChatSession;
  onNewMessage: (message: Message) => void;
  onUserInput: (content: string) => Promise<void>;
  summarizeSession: () => void;
  updateStat: (message: Message) => void;
  updateCurrentSession: (updater: (session: ChatSession) => void) => void;
  updateMessage: (
    sessionIndex: number,
    messageIndex: number,
    updater: (message?: Message) => void,
  ) => void;
  getMessagesWithMemory: () => Message[];
  getMemoryPrompt: () => Message;

  getConfig: () => ChatConfig;
  resetConfig: () => void;
  updateConfig: (updater: (config: ChatConfig) => void) => void;
  clearAllData: () => void;
}

function countMessages(msgs: Message[]) {
  return msgs.reduce((pre, cur) => pre + cur.content.length, 0);
}

const LOCAL_KEY = "chat-next-web-store";

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [createEmptySession()],
      currentSessionIndex: 0,
      config: {
        ...DEFAULT_CONFIG,
      },

      clearSessions() {
        set(() => ({
          sessions: [createEmptySession()],
          currentSessionIndex: 0,
        }));
      },

      resetConfig() {
        set(() => ({ config: { ...DEFAULT_CONFIG } }));
      },

      getConfig() {
        return get().config;
      },

      updateConfig(updater) {
        const config = get().config;
        updater(config);
        set(() => ({ config }));
      },

      selectSession(index: number) {
        set({
          currentSessionIndex: index,
        });
      },

      removeSession(index: number) {
        set((state) => {
          let nextIndex = state.currentSessionIndex;
          const sessions = state.sessions;

          if (sessions.length === 1) {
            return {
              currentSessionIndex: 0,
              sessions: [createEmptySession()],
            };
          }

          sessions.splice(index, 1);

          if (nextIndex === index) {
            nextIndex -= 1;
          }

          return {
            currentSessionIndex: nextIndex,
            sessions,
          };
        });
      },

      newSession() {
        set((state) => ({
          currentSessionIndex: 0,
          sessions: [createEmptySession()].concat(state.sessions),
        }));
      },

      currentSession() {
        let index = get().currentSessionIndex;
        const sessions = get().sessions;

        if (index < 0 || index >= sessions.length) {
          index = Math.min(sessions.length - 1, Math.max(0, index));
          set(() => ({ currentSessionIndex: index }));
        }

        const session = sessions[index];

        return session;
      },

      onNewMessage(message) {
        get().updateCurrentSession((session) => {
          session.lastUpdate = new Date().toLocaleString();
        });
        get().updateStat(message);
        get().summarizeSession();
      },

      async onUserInput(content) {
        const userMessage: Message = {
          role: "user",
          content,
          date: new Date().toLocaleString(),
        };

        const botMessage: Message = {
          content: "",
          role: "assistant",
          date: new Date().toLocaleString(),
          streaming: true,
        };

        // get recent messages
        const recentMessages = get().getMessagesWithMemory();
        const sendMessages = recentMessages.concat(userMessage);
        const sessionIndex = get().currentSessionIndex;
        const messageIndex = get().currentSession().messages.length + 1;
        const chatId = get().currentSession().chatId;

        // save user's and bot's message
        get().updateCurrentSession((session) => {
          session.messages.push(userMessage);
          session.messages.push(botMessage);
        });

        // make request
        console.log("[User Input] ", sendMessages);
        requestChatStream(sendMessages, {
          onMessage(content, done) {
            // stream response
            if (done) {
              botMessage.streaming = false;
              botMessage.content = content;
              get().onNewMessage(botMessage);
              ControllerPool.remove(sessionIndex, messageIndex);
            } else {
              botMessage.content = content;
              set(() => ({}));
            }
          },
          onError(error) {
            botMessage.content += "\n\n" + Locale.Store.Error;
            botMessage.streaming = false;
            set(() => ({}));
            ControllerPool.remove(sessionIndex, messageIndex);
          },
          onController(controller) {
            // collect controller for stop/retry
            let messageIndex = get().currentSession().messages.length;
            ControllerPool.addController(
              sessionIndex,
              messageIndex,
              controller,
            );
          },
          filterBot: !get().config.sendBotMessages,
          modelConfig: get().config.modelConfig,
          userId: chatId,
        });
      },

      getMemoryPrompt() {
        const session = get().currentSession();

        return {
          role: "system",
          content: Locale.Store.Prompt.History(session.memoryPrompt),
          date: "",
        } as Message;
      },

      getMessagesWithMemory() {
        const session = get().currentSession();
        const config = get().config;
        const n = session.messages.length;

        const context = session.context.slice();

        if (session.memoryPrompt && session.memoryPrompt.length > 0) {
          const memoryPrompt = get().getMemoryPrompt();
          context.push(memoryPrompt);
        }

        const recentMessages = context.concat(
          session.messages.slice(Math.max(0, n - config.historyMessageCount)),
        );

        return recentMessages;
      },

      updateMessage(
        sessionIndex: number,
        messageIndex: number,
        updater: (message?: Message) => void,
      ) {
        const sessions = get().sessions;
        const session = sessions.at(sessionIndex);
        const messages = session?.messages;
        updater(messages?.at(messageIndex));
        set(() => ({ sessions }));
      },

      summarizeSession() {
        const session = get().currentSession();
        session.topic = session.messages[session.messages.length - 1].content;
      },

      updateStat(message) {
        get().updateCurrentSession((session) => {
          session.stat.charCount += message.content.length;
          // TODO: should update chat count and word count
        });
      },

      updateCurrentSession(updater) {
        const sessions = get().sessions;
        const index = get().currentSessionIndex;
        updater(sessions[index]);
        set(() => ({ sessions }));
      },

      clearAllData() {
        if (confirm(Locale.Store.ConfirmClearAll)) {
          localStorage.clear();
          location.reload();
        }
      },
    }),
    {
      name: LOCAL_KEY,
      version: 1.1,
      migrate(persistedState, version) {
        const state = persistedState as ChatStore;

        if (version === 1) {
          state.sessions.forEach((s) => (s.context = []));
        }

        return state;
      },
    },
  ),
);
