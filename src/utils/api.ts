import type { AppSettings, ChatMessage, TokenUsage } from "../types/chat";

const API_BASE = "/api";

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string, usage?: TokenUsage) => void;
  onError: (error: Error) => void;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("socialmind-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ============================================================
// AI Chat
// ============================================================

export async function streamChatCompletion(
  messages: ChatMessage[], settings: AppSettings, callbacks: StreamCallbacks, signal?: AbortSignal
): Promise<void> {
  const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
  if (settings.systemPrompt) apiMessages.unshift({ role: "system" as const, content: settings.systemPrompt });

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ model: settings.model, messages: apiMessages, stream: true, temperature: settings.temperature, top_p: settings.topP, max_tokens: settings.maxTokens }),
      signal,
    });
    if (!response.ok) {
      const errorBody = await response.text();
      let errorMsg: string;
      try { const parsed = JSON.parse(errorBody); errorMsg = parsed.error?.message || parsed.error || parsed.message || errorBody; } catch { errorMsg = errorBody; }
      throw new Error(`API Error (${response.status}): ${errorMsg}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body reader available");
    const decoder = new TextDecoder();
    let fullText = "", buffer = "";
    let usage: TokenUsage | undefined;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") { callbacks.onDone(fullText, usage); return; }
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices?.[0]?.delta?.content) { fullText += parsed.choices[0].delta.content; callbacks.onToken(parsed.choices[0].delta.content); }
          if (parsed.usage) { usage = { promptTokens: parsed.usage.prompt_tokens || 0, completionTokens: parsed.usage.completion_tokens || 0, totalTokens: parsed.usage.total_tokens || 0 }; }
        } catch { /* skip */ }
      }
    }
    callbacks.onDone(fullText, usage);
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function chatCompletion(messages: ChatMessage[], settings: AppSettings): Promise<{ content: string; usage?: TokenUsage }> {
  const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
  if (settings.systemPrompt) apiMessages.unshift({ role: "system" as const, content: settings.systemPrompt });
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ model: settings.model, messages: apiMessages, temperature: settings.temperature, top_p: settings.topP, max_tokens: settings.maxTokens, stream: false }),
  });
  if (!response.ok) throw new Error(`API Error (${response.status}): ${await response.text()}`);
  const data = await response.json();
  return { content: data.choices?.[0]?.message?.content || "", usage: data.usage ? { promptTokens: data.usage.prompt_tokens || 0, completionTokens: data.usage.completion_tokens || 0, totalTokens: data.usage.total_tokens || 0 } : undefined };
}

// ============================================================
// Auth API — consolidated: POST /api/auth, GET /api/auth
// ============================================================

export async function authGetNonce(): Promise<{ nonce: string }> {
  const response = await fetch(`${API_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "nonce" }),
  });
  if (!response.ok) throw new Error("Failed to get nonce");
  return response.json();
}

export async function authWalletLogin(address: string, signature: string, message: string, nonce: string) {
  const response = await fetch(`${API_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "wallet", address, signature, message, nonce }),
  });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Wallet login failed"); }
  return response.json();
}


export async function authGetMe() {
  const response = await fetch(`${API_BASE}/auth`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error("Not authenticated");
  return response.json();
}

// ============================================================
// Agent API — consolidated: /api/agent?action=config|posts|post-now
// ============================================================

export async function getAgentConfig() {
  const response = await fetch(`${API_BASE}/agent?action=config`, {
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
  });
  if (!response.ok) throw new Error("Failed to fetch agent config");
  return response.json();
}

export async function saveAgentConfig(config: unknown) {
  const response = await fetch(`${API_BASE}/agent?action=config`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error("Failed to save agent config");
  return response.json();
}

export async function updateAgentConfig(updates: unknown) {
  const response = await fetch(`${API_BASE}/agent?action=config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error("Failed to update agent config");
  return response.json();
}

export async function getPostHistory(limit = 50, offset = 0) {
  const response = await fetch(`${API_BASE}/agent?action=posts&limit=${limit}&offset=${offset}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error("Failed to fetch post history");
  return response.json();
}

export async function postNow(platform?: string, content?: string) {
  const response = await fetch(`${API_BASE}/agent?action=post-now`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ platform, content }),
  });
  if (!response.ok) { const err = await response.json().catch(() => ({ error: "Post failed" })); throw new Error(err.error || "Failed to post"); }
  return response.json();
}

/**
 * Trigger the auto-posting engine for the current user.
 * Called by the dashboard's auto-post scheduler.
 * force=true skips time-slot checks, minInterval prevents double-posting.
 */
export async function triggerAutoPost(force = false, minIntervalMs = 1800000) {
  const response = await fetch(
    `${API_BASE}/cron?force=${force}&minInterval=${minIntervalMs}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    }
  );
  if (!response.ok) return null;
  return response.json();
}

// ============================================================
// Social API — consolidated: /api/social?action=connect|disconnect|status|callback
// ============================================================

export async function connectPlatform(platform: string) {
  const response = await fetch(`${API_BASE}/social?action=connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ platform }),
  });
  if (!response.ok) { const err = await response.json().catch(() => ({ error: "Connection failed" })); throw new Error(err.error || "Failed to initiate connection"); }
  return response.json();
}

export async function disconnectPlatform(platform: string) {
  const response = await fetch(`${API_BASE}/social?action=disconnect`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ platform }),
  });
  if (!response.ok) throw new Error("Failed to disconnect platform");
  return response.json();
}

export async function getSocialStatus(live = false) {
  const url = live ? `${API_BASE}/social?action=status&live=true` : `${API_BASE}/social?action=status`;
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error("Failed to get social status");
  return response.json();
}

export async function pollConnectionStatus(platform: string, intervalMs = 3000, maxAttempts = 40): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try { const status = await getSocialStatus(true); if (status[platform]?.connected) return true; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

// ============================================================
// Image Library API
// ============================================================

export async function uploadImage(file: File): Promise<{ id: string; url: string; name: string }> {
  // Convert file to base64
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:image/...;base64, prefix
    };
    reader.readAsDataURL(file);
  });

  const response = await fetch(`${API_BASE}/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ name: file.name, data: base64, mimeType: file.type }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Failed to upload image");
  }
  return response.json();
}

export async function listImages(): Promise<{ images: Array<{ id: string; url: string; name: string; uploadedAt: number }> }> {
  const response = await fetch(`${API_BASE}/images`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
  });
  if (!response.ok) return { images: [] };
  return response.json();
}

export async function deleteImage(id: string): Promise<void> {
  await fetch(`${API_BASE}/images?id=${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
}
