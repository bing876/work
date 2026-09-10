// 真实模型调用(OpenAI-compatible,Node 自带 fetch,零第三方依赖)。
// 约定:失败一律抛 ModelError(code,message,retryable),由 chat 接口转成明确报错+重试,不伪装;
// 不做自动重试(避免重复花钱),重试由用户点"重试"发起。
export class ModelError extends Error {
  constructor(code, message, retryable = true) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

export function loadModelConfig(env = process.env) {
  const timeoutMs = Number(env.MODEL_TIMEOUT_MS ?? 60000);
  const budgetTokens = Number(env.MODEL_BUDGET_TOKENS ?? 0);
  return {
    apiKey: (env.MODEL_API_KEY ?? '').trim(),
    baseUrl: (env.MODEL_BASE_URL ?? 'https://api.deepseek.com').trim().replace(/\/+$/, ''),
    name: (env.MODEL_NAME ?? 'deepseek-chat').trim() || 'deepseek-chat',
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000,
    // 累计 token 上限(含历史 prompt+completion);0 = 不限制。超限即拦并明示。
    budgetTokens: Number.isFinite(budgetTokens) && budgetTokens > 0 ? Math.floor(budgetTokens) : 0,
  };
}

const extractText = (data) => {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
  return '';
};

export async function callModel({ config, messages, maxTokens = 2000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.name, messages, temperature: 0.7, max_tokens: maxTokens }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new ModelError('MODEL_TIMEOUT', `模型调用超时(${config.timeoutMs}毫秒),可重试或调大 MODEL_TIMEOUT_MS`, true);
    throw new ModelError('MODEL_CALL_FAILED', `模型调用失败:${error instanceof Error ? error.message : '网络错误'}`, true);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const detail = await response.text().then((t) => {
      try {
        return t ? String(JSON.parse(t)?.error?.message ?? t).slice(0, 200) : '';
      } catch {
        return t.slice(0, 200);
      }
    });
    throw new ModelError('MODEL_CALL_FAILED', `模型返回异常(${response.status})${detail ? `:${detail}` : ''},可重试`, true);
  }
  const data = await response.json().catch(() => null);
  const text = extractText(data);
  if (!text) throw new ModelError('MODEL_CALL_FAILED', '模型返回为空,可重试', true);
  const usage = data?.usage ?? {};
  return {
    text,
    usage: {
      promptTokens: Number(usage.prompt_tokens ?? 0) || 0,
      completionTokens: Number(usage.completion_tokens ?? 0) || 0,
    },
  };
}
