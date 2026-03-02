/**
 * 静态资源管理器模块
 * @module assets/manager
 */

import { resolveAuthPayload } from '../middleware/auth.js';

/**
 * 获取站点配置
 * @param {object} env - 环境变量
 * @returns {object} 站点配置
 */
function getSiteConfig(env) {
  return {
    siteName: env.SITE_NAME || "Leon's 临时邮件",
    footerText: env.FOOTER_TEXT || '简约而不简单',
    repoUrl: env.REPO_URL || '',
    hasGuestPassword: !!(env.GUEST_PASSWORD)
  };
}

/**
 * 将站点配置注入到 HTML 文本中
 * 替换所有硬编码的站点名称、页脚文字、仓库链接
 * @param {string} html - 原始 HTML
 * @param {object} env - 环境变量
 * @returns {string} 注入后的 HTML
 */
function injectSiteConfig(html, env) {
  const cfg = getSiteConfig(env);
  let result = html;

  // 替换页面标题中的站点名称
  result = result.replace(/iDing's临时邮箱/g, cfg.siteName);
  result = result.replace(/iDing's  临时邮箱/g, cfg.siteName);
  result = result.replace(/>临时邮箱</g, `>${cfg.siteName}<`);

  // 替换 <title> 中的 "临时邮箱" (不带 > < 的情况)
  result = result.replace(/<title>登录 - 临时邮箱<\/title>/g, `<title>登录 - ${cfg.siteName}</title>`);
  result = result.replace(/<title>加载中 - 临时邮箱<\/title>/g, `<title>加载中 - ${cfg.siteName}</title>`);
  result = result.replace(/<title>临时邮箱<\/title>/g, `<title>${cfg.siteName}</title>`);

  // 替换登录页的 h1
  result = result.replace(/登录到临时邮箱/g, `登录到${cfg.siteName}`);

  // 替换 loading 页面的标题
  result = result.replace(/<h1 class="title">临时邮箱<\/h1>/g, `<h1 class="title">${cfg.siteName}</h1>`);

  // 替换页脚
  result = result.replace(
    /iDing's  临时邮箱 - 简约而不简单/g,
    `${cfg.siteName} - ${cfg.footerText}`
  );
  // 兜底: 如果上面没替换完
  result = result.replace(
    /简约而不简单/g,
    cfg.footerText
  );

  // 替换占位符中的 iDing 品牌
  result = result.replace(/例如：iDing 支持团队/g, `例如：${cfg.siteName}`);

  // 登录页访客提示：如果没有配置 GUEST_PASSWORD，则隐藏访客提示
  if (!cfg.hasGuestPassword) {
    result = result.replace(
      /<div[^>]*style="[^"]*font-size:12px[^"]*"[^>]*>[\s\S]*?账号：guest[\s\S]*?<\/div>/g,
      ''
    );
  }

  // 替换 GitHub 仓库链接
  if (cfg.repoUrl) {
    result = result.replace(
      /href="https:\/\/github\.com\/idinging\/freemail"/g,
      `href="${cfg.repoUrl}"`
    );
  } else {
    // 没有配置 repoUrl 时，隐藏 GitHub 按钮
    result = result.replace(
      /<a\s+id="repo"[^>]*>[\s\S]*?<\/a>/g,
      ''
    );
  }

  return result;
}

/**
 * 将 Response 的 HTML 内容替换后返回新的 Response
 * @param {Response} resp - 原始响应
 * @param {object} env - 环境变量
 * @param {object} [extraHeaders] - 额外的 headers
 * @returns {Promise<Response>} 替换后的响应
 */
async function injectSiteConfigToResponse(resp, env, extraHeaders = {}) {
  try {
    const text = await resp.text();
    const injected = injectSiteConfig(text, env);
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      ...extraHeaders
    };
    return new Response(injected, { headers, status: resp.status });
  } catch (_) {
    return resp;
  }
}

/**
 * 静态资源管理器
 */
export class AssetManager {
  constructor() {
    this.allowedPaths = new Set([
      '/',
      '/index.html',
      '/login',
      '/login.html',
      '/admin.html',
      '/html/mailboxes.html',
      '/mailboxes.html',
      '/mailbox.html',
      '/html/mailbox.html',
      '/templates/app.html',
      '/templates/footer.html',
      '/templates/loading.html',
      '/templates/loading-inline.html',
      '/templates/toast.html',
      '/app.js',
      '/app.css',
      '/admin.js',
      '/admin.css',
      '/login.js',
      '/login.css',
      '/mailbox.js',
      '/mock.js',
      '/favicon.svg',
      '/route-guard.js',
      '/app-router.js',
      '/app-mobile.js',
      '/app-mobile.css',
      '/mailbox.css',
      '/auth-guard.js',
      '/storage.js'
    ]);

    this.allowedPrefixes = [
      '/assets/',
      '/pic/',
      '/templates/',
      '/public/',
      '/js/',
      '/css/',
      '/html/'
    ];

    this.protectedPaths = new Set([
      '/admin.html',
      '/admin',
      '/admin/',
      '/mailboxes.html',
      '/html/mailboxes.html',
      '/mailbox.html',
      '/mailbox',
      '/mailbox/'
    ]);

    this.guestOnlyPaths = new Set([
      '/login',
      '/login.html'
    ]);
  }

  isPathAllowed(pathname) {
    if (this.allowedPaths.has(pathname)) {
      return true;
    }
    return this.allowedPrefixes.some(prefix => pathname.startsWith(prefix));
  }

  isProtectedPath(pathname) {
    return this.protectedPaths.has(pathname);
  }

  isGuestOnlyPath(pathname) {
    return this.guestOnlyPaths.has(pathname);
  }

  async handleAssetRequest(request, env, mailDomains) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const JWT_TOKEN = env.JWT_TOKEN || env.JWT_SECRET || '';

    if (!this.isPathAllowed(pathname)) {
      return await this.handleIllegalPath(request, env, JWT_TOKEN);
    }

    if (this.isProtectedPath(pathname)) {
      const authResult = await this.checkProtectedPathAuth(request, JWT_TOKEN, url);
      if (authResult) return authResult;
    }

    if (this.isGuestOnlyPath(pathname)) {
      const guestResult = await this.checkGuestOnlyPath(request, JWT_TOKEN, url);
      if (guestResult) return guestResult;
    }

    if (!env.ASSETS || !env.ASSETS.fetch) {
      return Response.redirect(new URL('/login.html', url).toString(), 302);
    }

    const mappedRequest = this.handlePathMapping(request, url);

    if (pathname === '/' || pathname === '/index.html') {
      return await this.handleIndexPage(mappedRequest, env, mailDomains, JWT_TOKEN);
    }

    if (pathname === '/admin.html') {
      return await this.handleAdminPage(mappedRequest, env, JWT_TOKEN);
    }

    if (pathname === '/mailbox.html' || pathname === '/html/mailbox.html') {
      return await this.handleMailboxPage(mappedRequest, env, JWT_TOKEN);
    }
    if (pathname === '/mailboxes.html' || pathname === '/html/mailboxes.html') {
      return await this.handleAllMailboxesPage(mappedRequest, env, JWT_TOKEN);
    }

    // 对所有 HTML 页面和模板注入站点配置
    const isHtmlPage = pathname.endsWith('.html') || pathname === '/login' || pathname === '/admin';
    if (isHtmlPage) {
      const resp = await env.ASSETS.fetch(mappedRequest);
      return await injectSiteConfigToResponse(resp, env);
    }

    return env.ASSETS.fetch(mappedRequest);
  }

  async handleIllegalPath(request, env, JWT_TOKEN) {
    const url = new URL(request.url);
    const payload = await resolveAuthPayload(request, JWT_TOKEN);

    if (payload !== false) {
      if (payload.role === 'mailbox') {
        return Response.redirect(new URL('/html/mailbox.html', url).toString(), 302);
      } else {
        return Response.redirect(new URL('/', url).toString(), 302);
      }
    }

    return Response.redirect(new URL('/templates/loading.html', url).toString(), 302);
  }

  async checkProtectedPathAuth(request, JWT_TOKEN, url) {
    const payload = await resolveAuthPayload(request, JWT_TOKEN);

    if (!payload) {
      const loading = new URL('/templates/loading.html', url);
      if (url.pathname.includes('mailbox')) {
        loading.searchParams.set('redirect', '/html/mailbox.html');
      } else {
        loading.searchParams.set('redirect', '/admin.html');
      }
      return Response.redirect(loading.toString(), 302);
    }

    if (url.pathname.includes('mailbox')) {
      if (payload.role !== 'mailbox') {
        return Response.redirect(new URL('/', url).toString(), 302);
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return Response.redirect(new URL('/html/mailbox.html', url).toString(), 302);
      }
    } else {
      const isAllowed = (payload.role === 'admin' || payload.role === 'guest' || payload.role === 'mailbox');
      if (!isAllowed) {
        return Response.redirect(new URL('/', url).toString(), 302);
      }
    }

    return null;
  }

  async checkGuestOnlyPath(request, JWT_TOKEN, url) {
    const payload = await resolveAuthPayload(request, JWT_TOKEN);

    if (payload !== false) {
      return Response.redirect(new URL('/', url).toString(), 302);
    }

    return null;
  }

  handlePathMapping(request, url) {
    let targetUrl = url.toString();

    if (url.pathname === '/login') {
      targetUrl = new URL('/login.html', url).toString();
    }

    if (url.pathname === '/admin') {
      targetUrl = new URL('/html/admin.html', url).toString();
    }
    if (url.pathname === '/admin.html') {
      targetUrl = new URL('/html/admin.html', url).toString();
    }

    if (url.pathname === '/mailbox') {
      targetUrl = new URL('/html/mailbox.html', url).toString();
    }
    if (url.pathname === '/mailbox.html') {
      targetUrl = new URL('/html/mailbox.html', url).toString();
    }
    if (url.pathname === '/mailboxes.html') {
      targetUrl = new URL('/html/mailboxes.html', url).toString();
    }

    return new Request(targetUrl, request);
  }

  async handleIndexPage(request, env, mailDomains, JWT_TOKEN) {
    const url = new URL(request.url);
    const payload = await resolveAuthPayload(request, JWT_TOKEN);

    if (payload && payload.role === 'mailbox') {
      return Response.redirect(new URL('/html/mailbox.html', url).toString(), 302);
    }

    const resp = await env.ASSETS.fetch(request);

    try {
      const text = await resp.text();

      // 注入邮件域名
      let injected = text.replace(
        '<meta name="mail-domains" content="">',
        `<meta name="mail-domains" content="${mailDomains.join(',')}">`
      );

      // 注入站点配置
      injected = injectSiteConfig(injected, env);

      return new Response(injected, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      });
    } catch (_) {
      return resp;
    }
  }

  async handleAdminPage(request, env, JWT_TOKEN) {
    const url = new URL(request.url);
    const payload = await resolveAuthPayload(request, JWT_TOKEN);

    if (!payload) {
      const loadingReq = new Request(
        new URL('/templates/loading.html?redirect=%2Fadmin.html', url).toString(),
        request
      );
      const loadingResp = await env.ASSETS.fetch(loadingReq);
      return await injectSiteConfigToResponse(loadingResp, env);
    }

    const isAllowed = (payload.role === 'admin' || payload.role === 'guest' || payload.role === 'mailbox');
    if (!isAllowed) {
      return Response.redirect(new URL('/', url).toString(), 302);
    }

    const resp = await env.ASSETS.fetch(request);
    return await injectSiteConfigToResponse(resp, env);
  }

  async handleMailboxPage(request, env, JWT_TOKEN) {
    const url = new URL(request.url);
    const payload = await resolveAuthPayload(request, JWT_TOKEN);

    if (!payload) {
      const loadingReq = new Request(
        new URL('/templates/loading.html?redirect=%2Fhtml%2Fmailbox.html', url).toString(),
        request
      );
      const loadingResp = await env.ASSETS.fetch(loadingReq);
      return await injectSiteConfigToResponse(loadingResp, env);
    }

    if (payload.role !== 'mailbox') {
      if (payload.role === 'admin' || payload.role === 'guest') {
        return Response.redirect(new URL('/', url).toString(), 302);
      } else {
        return Response.redirect(new URL('/login.html', url).toString(), 302);
      }
    }

    const resp = await env.ASSETS.fetch(request);
    return await injectSiteConfigToResponse(resp, env);
  }

  async handleAllMailboxesPage(request, env, JWT_TOKEN) {
    const url = new URL(request.url);
    const payload = await resolveAuthPayload(request, JWT_TOKEN);
    if (!payload) {
      const loadingReq = new Request(
        new URL('/templates/loading.html?redirect=%2Fhtml%2Fmailboxes.html', url).toString(),
        request
      );
      const loadingResp = await env.ASSETS.fetch(loadingReq);
      return await injectSiteConfigToResponse(loadingResp, env);
    }
    const isStrictAdmin = (payload.role === 'admin' && (payload.username === '__root__' || payload.username));
    const isGuest = (payload.role === 'guest');
    if (!isStrictAdmin && !isGuest) {
      return Response.redirect(new URL('/', url).toString(), 302);
    }
    const resp = await env.ASSETS.fetch(request);
    return await injectSiteConfigToResponse(resp, env);
  }

  addAllowedPath(path) {
    this.allowedPaths.add(path);
  }

  addAllowedPrefix(prefix) {
    this.allowedPrefixes.push(prefix);
  }

  removeAllowedPath(path) {
    this.allowedPaths.delete(path);
  }

  isApiPath(pathname) {
    return pathname.startsWith('/api/') || pathname === '/receive';
  }

  getAccessLog(request) {
    const url = new URL(request.url);
    return {
      timestamp: new Date().toISOString(),
      method: request.method,
      path: url.pathname,
      userAgent: request.headers.get('User-Agent') || '',
      referer: request.headers.get('Referer') || '',
      ip: request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For') ||
        request.headers.get('X-Real-IP') || 'unknown'
    };
  }
}

/**
 * 创建默认的资源管理器实例
 * @returns {AssetManager} 资源管理器实例
 */
export function createAssetManager() {
  return new AssetManager();
}
