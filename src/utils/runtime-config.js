/**
 * 运行时配置健康检查工具
 * @module utils/runtime-config
 */

const REQUIRED_BINDINGS = ['TEMP_MAIL_DB', 'MAIL_EML'];
const REQUIRED_ENV_VARS = ['MAIL_DOMAIN', 'ADMIN_PASSWORD', 'JWT_TOKEN'];

function hasNonEmptyString(value) {
  return typeof value === 'string' ? value.trim().length > 0 : !!value;
}

function normalizePublicValue(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return '[binding]';
}

export function inspectRuntimeConfig(env = {}) {
  const missingRequiredKeys = [];

  for (const key of REQUIRED_BINDINGS) {
    if (!env[key]) {
      missingRequiredKeys.push(key);
    }
  }

  for (const key of REQUIRED_ENV_VARS) {
    if (!hasNonEmptyString(env[key])) {
      missingRequiredKeys.push(key);
    }
  }

  const normalizedDomains = String(env.MAIL_DOMAIN || '')
    .split(/[,\s]+/)
    .map(d => d.trim())
    .filter(Boolean);

  if (normalizedDomains.length === 0 && !missingRequiredKeys.includes('MAIL_DOMAIN')) {
    missingRequiredKeys.push('MAIL_DOMAIN');
  }

  return {
    ok: missingRequiredKeys.length === 0,
    missingRequiredKeys,
    required: {
      bindings: [...REQUIRED_BINDINGS],
      envVars: [...REQUIRED_ENV_VARS]
    },
    snapshot: {
      MAIL_DOMAIN: normalizePublicValue(env.MAIL_DOMAIN),
      ADMIN_PASSWORD: hasNonEmptyString(env.ADMIN_PASSWORD) ? '[set]' : '',
      JWT_TOKEN: hasNonEmptyString(env.JWT_TOKEN) ? '[set]' : '',
      TEMP_MAIL_DB: env.TEMP_MAIL_DB ? '[bound]' : '',
      MAIL_EML: env.MAIL_EML ? '[bound]' : ''
    }
  };
}

export function buildRuntimeConfigErrorResponse(runtimeConfig) {
  const payload = {
    success: false,
    code: 'RUNTIME_CONFIG_MISSING',
    message: 'Worker 运行时配置不完整，关键变量/绑定缺失。',
    missing: runtimeConfig.missingRequiredKeys,
    required: runtimeConfig.required,
    action: [
      '请前往 Cloudflare Dashboard → Workers & Pages → 你的 Worker → Settings → Variables and Secrets',
      '确认 TEMP_MAIL_DB (D1) 与 MAIL_EML (R2) 绑定存在',
      '确认 MAIL_DOMAIN / ADMIN_PASSWORD / JWT_TOKEN 已配置且非空',
      '若使用 Git 集成部署，请检查是否误改 Worker 名称，导致发布到新脚本'
    ]
  };

  return Response.json(payload, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}

export function buildRuntimeConfigHealthResponse(runtimeConfig) {
  return Response.json({
    success: runtimeConfig.ok,
    ...runtimeConfig
  }, {
    status: runtimeConfig.ok ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}
