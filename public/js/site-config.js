/**
 * 站点配置加载器 —— 从 /api/site-config 获取环境变量配置，动态更新页面 DOM
 * 覆盖所有硬编码的站点名称、GitHub 链接、页脚文字等
 * 只需在页面中引入此脚本即可自动生效
 */
(function () {
  'use strict';

  // 缓存键
  var CACHE_KEY = 'mf:site-config';
  var CACHE_TTL = 5 * 60 * 1000; // 5 分钟

  /**
   * 从缓存或 API 获取站点配置
   */
  function fetchSiteConfig(callback) {
    try {
      var cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed._ts && Date.now() - parsed._ts < CACHE_TTL) {
          callback(parsed);
          return;
        }
      }
    } catch (_) { }

    fetch('/api/site-config', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject('fail'); })
      .then(function (cfg) {
        cfg._ts = Date.now();
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (_) { }
        callback(cfg);
      })
      .catch(function () { /* 静默失败，保留原始 HTML */ });
  }

  /**
   * 将站点配置应用到当前页面 DOM
   */
  function applySiteConfig(cfg) {
    var siteName = cfg.siteName || '';
    var repoUrl = cfg.repoUrl || '';
    var footerText = cfg.footerText || '';

    if (!siteName && !repoUrl && !footerText) return;

    // 1. 更新 brand-text 元素
    if (siteName) {
      var brandEls = document.querySelectorAll('.brand-text');
      for (var i = 0; i < brandEls.length; i++) {
        var el = brandEls[i];
        var text = el.textContent || '';
        // 替换 "iDing's临时邮箱" 或类似文字
        text = text.replace(/iDing's\s*临时邮箱/g, siteName);
        text = text.replace(/临时邮箱/g, siteName);
        el.textContent = text;
      }

      // 更新管理页标题区的 span（admin.html 的品牌标题不带 class）
      var topbarSpans = document.querySelectorAll('.topbar .brand span');
      for (var j = 0; j < topbarSpans.length; j++) {
        var span = topbarSpans[j];
        if (!span.className && span.textContent) {
          var t = span.textContent;
          if (/iDing's\s*临时邮箱/.test(t) || /临时邮箱/.test(t)) {
            span.textContent = t.replace(/iDing's\s*临时邮箱/g, siteName).replace(/临时邮箱/g, siteName);
          }
        }
      }

      // 更新 <title>
      if (document.title) {
        document.title = document.title
          .replace(/iDing's\s*临时邮箱/g, siteName)
          .replace(/临时邮箱/g, siteName);
      }

      // 更新 loading 页的 h1.title
      var h1 = document.querySelector('h1.title');
      if (h1 && /临时邮箱/.test(h1.textContent)) {
        h1.textContent = h1.textContent.replace(/临时邮箱/g, siteName);
      }

      // 更新登录页的 h1（"登录到临时邮箱"）
      var allH1 = document.querySelectorAll('h1');
      for (var k = 0; k < allH1.length; k++) {
        var h1Text = allH1[k].textContent || '';
        if (/临时邮箱/.test(h1Text)) {
          allH1[k].textContent = h1Text.replace(/临时邮箱/g, siteName);
        }
      }
    }

    // 2. 更新 GitHub 仓库链接
    var repoEl = document.getElementById('repo');
    if (repoEl) {
      if (repoUrl) {
        repoEl.href = repoUrl;
        repoEl.style.display = '';
      } else {
        // 没有配置仓库地址时隐藏 GitHub 按钮
        repoEl.style.display = 'none';
      }
    }

    // 3. 更新页脚
    if (footerText || siteName) {
      var footer = document.querySelector('.global-footer');
      if (footer) {
        var year = new Date().getFullYear();
        var name = siteName || "iDing's  临时邮箱";
        var ft = footerText || '简约而不简单';
        var yearSpan = footer.querySelector('#footer-year');
        footer.textContent = '';
        footer.appendChild(document.createTextNode('\u00A9 '));
        var ys = document.createElement('span');
        ys.id = 'footer-year';
        ys.textContent = year;
        footer.appendChild(ys);
        footer.appendChild(document.createTextNode(' ' + name + ' - ' + ft));
      }
    }
  }

  // 页面加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { fetchSiteConfig(applySiteConfig); });
  } else {
    fetchSiteConfig(applySiteConfig);
  }

  // 暴露给其他模块调用（例如 app.js 动态加载模板后）
  window.__applySiteConfig = function () { fetchSiteConfig(applySiteConfig); };
})();
