interface ChatContext {
  sender: "user" | "bot";

  message?: string;
}

interface ChatGPTRequest {
  sentence: string;
  user_id?: string;
}

interface ChatGPTResponse {
  message: string;
  detail: string;
}
