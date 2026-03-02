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

    // 如果 API 返回的都是默认值，也要尝试应用
    // siteName 可能是默认的 "Leon's 临时邮件" 或用户自定义的

    // 1. 更新 brand-text 元素（品牌名）
    if (siteName) {
      var brandEls = document.querySelectorAll('.brand-text');
      for (var i = 0; i < brandEls.length; i++) {
        var el = brandEls[i];
        var text = el.textContent || '';
        // 替换各种可能的写法
        text = text.replace(/iDing's\s*临时邮箱/g, siteName);
        // 对于 "临时邮箱 - 邮箱总览" 这样的后缀，保留后缀部分
        text = text.replace(/^临时邮箱(\s*-\s*)/, siteName + '$1');
        // 如果还有剩余的 "临时邮箱" 文本（纯占位符）
        if (text === '临时邮箱') {
          text = siteName;
        }
        el.textContent = text;
      }

      // 更新所有 topbar 品牌区域的 span（含 admin.html 等不带 brand-text class 的）
      var topbarSpans = document.querySelectorAll('.topbar .brand span');
      for (var j = 0; j < topbarSpans.length; j++) {
        var span = topbarSpans[j];
        var t = span.textContent || '';
        if (/iDing's\s*临时邮箱/.test(t) || (/临时邮箱/.test(t) && !/brand-icon/.test(span.className || ''))) {
          span.textContent = t.replace(/iDing's\s*临时邮箱/g, siteName).replace(/临时邮箱/g, siteName);
        }
      }

      // 更新 <title>
      if (document.title) {
        document.title = document.title
          .replace(/iDing's\s*临时邮箱/g, siteName)
          .replace(/临时邮箱/g, siteName);
      }

      // 更新 loading 页的 h1.title
      var h1Title = document.querySelector('h1.title');
      if (h1Title && /临时邮箱/.test(h1Title.textContent)) {
        h1Title.textContent = h1Title.textContent.replace(/临时邮箱/g, siteName);
      }

      // 更新所有 h1（登录页 "登录到临时邮箱" 等）
      var allH1 = document.querySelectorAll('h1');
      for (var k = 0; k < allH1.length; k++) {
        var h1Text = allH1[k].textContent || '';
        if (/临时邮箱/.test(h1Text)) {
          allH1[k].textContent = h1Text.replace(/临时邮箱/g, siteName);
        }
      }
    }

    // 2. 更新 GitHub 仓库链接
    var repoEls = document.querySelectorAll('#repo');
    for (var r = 0; r < repoEls.length; r++) {
      var repoEl = repoEls[r];
      if (repoUrl) {
        repoEl.href = repoUrl;
        repoEl.style.display = '';
      } else {
        // 没有配置仓库地址时隐藏 GitHub 按钮
        repoEl.style.display = 'none';
      }
    }

    // 3. 更新页脚
    var footer = document.querySelector('.global-footer');
    if (footer) {
      var year = new Date().getFullYear();
      var name = siteName || '临时邮箱';
      var ft = footerText || '简约而不简单';
      footer.textContent = '';
      footer.appendChild(document.createTextNode('\u00A9 '));
      var ys = document.createElement('span');
      ys.id = 'footer-year';
      ys.textContent = year;
      footer.appendChild(ys);
      footer.appendChild(document.createTextNode(' ' + name + ' - ' + ft));
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
