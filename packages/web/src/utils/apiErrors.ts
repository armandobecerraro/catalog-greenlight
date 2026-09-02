/** Agent calls (Gemini + ClickHouse Cloud) can take ~3 minutes under load. */
export const AGENT_FETCH_TIMEOUT_MS = 240_000;

export type ApiErrorCode = 'gemini_billing' | 'clickhouse_waking' | 'timeout' | 'network' | 'generic';

const ERROR_I18N_KEY: Record<ApiErrorCode, string> = {
  gemini_billing: 'errors.geminiBilling',
  clickhouse_waking: 'errors.clickhouseWaking',
  timeout: 'errors.timeout',
  network: 'errors.network',
  generic: 'errors.generic'
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly raw?: string;
  readonly timeoutMs?: number;

  constructor(
    code: ApiErrorCode,
    message: string,
    status?: number,
    raw?: string,
    timeoutMs?: number
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.raw = raw;
    this.timeoutMs = timeoutMs;
  }
}

function combinedErrorText(status: number, body: string, parsedMessage?: string): string {
  return `${status} ${parsedMessage ?? ''} ${body}`.toLowerCase();
}

function isGeminiBillingError(status: number, text: string): boolean {
  return (
    status === 429 ||
    /resource_exhausted|resource exhausted|429|quota|billing|prepayment|rate.?limit|too many requests/i.test(
      text
    )
  );
}

function isClickHouseWakingError(status: number, text: string): boolean {
  if (status === 503) return true;
  return /initializ|still starting|api is still starting|waking|service unavailable/i.test(text);
}

export function parseHttpError(status: number, body: string): ApiError {
  let parsedMessage: string | undefined;
  let parsedCode: string | undefined;

  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string; code?: string };
    parsedMessage = parsed.error ?? parsed.message;
    parsedCode = parsed.code;
  } catch {
    /* plain-text body */
  }

  const message = parsedMessage?.trim() || body.trim() || `HTTP ${status}`;
  const text = combinedErrorText(status, body, parsedMessage);

  if (parsedCode === 'gemini_billing' || isGeminiBillingError(status, text)) {
    return new ApiError('gemini_billing', message, status, body);
  }
  if (parsedCode === 'clickhouse_waking' || isClickHouseWakingError(status, text)) {
    return new ApiError('clickhouse_waking', message, status, body);
  }

  return new ApiError('generic', message, status, body);
}

export function timeoutError(timeoutMs = AGENT_FETCH_TIMEOUT_MS): ApiError {
  return new ApiError(
    'timeout',
    `Request timed out after ${timeoutMs / 1000}s`,
    undefined,
    undefined,
    timeoutMs
  );
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function formatApiError(t: TranslateFn, err: unknown, fallbackKey?: string): string {
  if (err instanceof ApiError) {
    if (err.code === 'timeout') {
      const seconds = (err.timeoutMs ?? AGENT_FETCH_TIMEOUT_MS) / 1000;
      return t(ERROR_I18N_KEY.timeout, { seconds });
    }
    return t(ERROR_I18N_KEY[err.code]);
  }

  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return t(ERROR_I18N_KEY.network);
  }

  if (err instanceof Error && err.message) {
    const text = err.message.toLowerCase();
    if (isGeminiBillingError(0, text)) return t(ERROR_I18N_KEY.gemini_billing);
    if (isClickHouseWakingError(0, text)) return t(ERROR_I18N_KEY.clickhouse_waking);
    if (/timed out|timeout|abort/i.test(text)) {
      return t(ERROR_I18N_KEY.timeout, { seconds: AGENT_FETCH_TIMEOUT_MS / 1000 });
    }
    return err.message;
  }

  return fallbackKey ? t(fallbackKey) : t(ERROR_I18N_KEY.generic);
}
