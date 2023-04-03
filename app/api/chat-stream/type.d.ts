interface ChatContext {
  sender: "user" | "bot";

  message?: string;
}

interface ChatGPTRequest {
  sentence: string;
  user_id?: string;

  model?: string;
}

interface ChatGPTResponse {
  message: string;
  detail: string;
}
