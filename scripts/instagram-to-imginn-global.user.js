// ==UserScript==
// @name         Instagram links para Imginn - Global exceto Instagram
// @namespace    mindserv.instagram.imginn.direct.global
// @version      4.1.0
// @description  Converte cliques em links do Instagram para URLs diretas do Imginn em qualquer site, exceto no próprio Instagram.
// @author       Leonardo + ChatGPT
// @match        *://*/*
// @exclude      *://instagram.com/*
// @exclude      *://www.instagram.com/*
// @exclude      *://*.instagram.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const IMG_INN_HOST = 'imginn.com';

  function cleanHost(hostname) {
    return String(hostname || '')
      .replace(/^www\./i, '')
      .toLowerCase();
  }

  function isInstagramHost(hostname) {
    return cleanHost(hostname) === 'instagram.com';
  }

  function safeUrl(raw, base = location.href) {
    try {
      return new URL(raw, base);
    } catch {
      return null;
    }
  }

  function decodeDeep(value) {
    if (!value) return value;

    let out = String(value);

    for (let i = 0; i < 5; i++) {
      try {
        const decoded = decodeURIComponent(out);
        if (decoded === out) break;
        out = decoded;
      } catch {
        break;
      }
    }

    return out;
  }

  function extractInstagramUrlFromText(text) {
    if (!text) return null;

    const decoded = decodeDeep(text);

    const match = decoded.match(
      /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>\\)]+/i
    );

    if (!match) return null;

    return safeUrl(match[0]);
  }

  function extractRealInstagramUrl(rawHref) {
    if (!rawHref) return null;

    const direct = safeUrl(rawHref);
    if (!direct) return null;

    // Link direto: https://www.instagram.com/usuario/
    if (isInstagramHost(direct.hostname)) {
      return direct;
    }

    // Buscadores, agregadores e redirecionadores costumam esconder o destino em parâmetros.
    const paramNames = [
      'q',
      'url',
      'u',
      'uddg',
      'to',
      'target',
      'r',
      'redirect',
      'redirect_url',
      'adurl',
      'dest',
      'destination',
      'go',
      'out',
      'link',
      'href',
    ];

    for (const name of paramNames) {
      const value = direct.searchParams.get(name);
      if (!value) continue;

      const decoded = decodeDeep(value);

      const candidate = safeUrl(decoded);
      if (candidate && isInstagramHost(candidate.hostname)) {
        return candidate;
      }

      const embedded = extractInstagramUrlFromText(decoded);
      if (embedded && isInstagramHost(embedded.hostname)) {
        return embedded;
      }
    }

    // Fallback: acha URL do Instagram dentro do href inteiro.
    const embedded = extractInstagramUrlFromText(rawHref);
    if (embedded && isInstagramHost(embedded.hostname)) {
      return embedded;
    }

    return null;
  }

  function getPathParts(url) {
    return url.pathname
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .split('/')
      .filter(Boolean);
  }

  function isReservedInstagramPath(firstPart) {
    const reserved = new Set([
      '',
      'accounts',
      'direct',
      'explore',
      'create',
      'challenge',
      'about',
      'developer',
      'legal',
      'privacy',
      'terms',
      'help',
      'api',
      'web',
      'ajax',
      'graphql',
      'oauth',
      'emails',
      'archive',
    ]);

    return reserved.has(String(firstPart || '').toLowerCase());
  }

  function normalizeInstagramUsername(username) {
    return String(username || '')
      .trim()
      .replace(/^@/, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }

  function buildImginnDirectUrl(instagramUrl) {
    if (!instagramUrl || !isInstagramHost(instagramUrl.hostname)) return null;

    const parts = getPathParts(instagramUrl);
    const firstPart = parts[0]?.toLowerCase() || '';

    if (isReservedInstagramPath(firstPart)) return null;

    // Perfil:
    // instagram.com/usuario/ -> imginn.com/usuario/
    if (parts.length === 1) {
      const username = normalizeInstagramUsername(parts[0]);
      if (!username) return null;

      return `https://${IMG_INN_HOST}/${encodeURIComponent(username)}/`;
    }

    // Post:
    // instagram.com/p/CODIGO/ -> imginn.com/p/CODIGO/
    if (firstPart === 'p' && parts[1]) {
      return `https://${IMG_INN_HOST}/p/${encodeURIComponent(parts[1])}/`;
    }

    // Reel:
    // instagram.com/reel/CODIGO/ -> imginn.com/reel/CODIGO/
    if ((firstPart === 'reel' || firstPart === 'reels') && parts[1]) {
      return `https://${IMG_INN_HOST}/reel/${encodeURIComponent(parts[1])}/`;
    }

    // Stories:
    // instagram.com/stories/usuario/id/ -> imginn.com/stories/usuario/id/
    if (firstPart === 'stories' && parts.length >= 2) {
      return `https://${IMG_INN_HOST}/stories/${parts
        .slice(1)
        .map(encodeURIComponent)
        .join('/')}/`;
    }

    // Fallback conservador:
    // se for /usuario/alguma-coisa, usa o perfil.
    const username = normalizeInstagramUsername(parts[0]);
    if (!username) return null;

    return `https://${IMG_INN_HOST}/${encodeURIComponent(username)}/`;
  }

  function findClosestAnchor(start) {
    let el = start;

    while (el && el !== document.documentElement) {
      if (el.tagName && el.tagName.toLowerCase() === 'a' && el.href) {
        return el;
      }

      el = el.parentElement;
    }

    return null;
  }

  function openTarget(url, event) {
    const newTab =
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.button === 1 ||
      event.type === 'auxclick';

    if (newTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    window.location.href = url;
  }

  function handleClick(event) {
    const anchor = findClosestAnchor(event.target);
    if (!anchor) return;

    const instagramUrl = extractRealInstagramUrl(anchor.href);
    if (!instagramUrl) return;

    const imginnUrl = buildImginnDirectUrl(instagramUrl);
    if (!imginnUrl) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    openTarget(imginnUrl, event);
  }

  function markLinks() {
    const links = document.querySelectorAll('a[href]');

    for (const a of links) {
      const instagramUrl = extractRealInstagramUrl(a.href);
      if (!instagramUrl) continue;

      const imginnUrl = buildImginnDirectUrl(instagramUrl);
      if (!imginnUrl) continue;

      a.dataset.igToImginnDirect = imginnUrl;
      a.title = `Abrir direto no Imginn: ${imginnUrl}`;
    }
  }

  function boot() {
    markLinks();

    const observer = new MutationObserver(() => {
      markLinks();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
  }

  document.addEventListener('click', handleClick, true);
  document.addEventListener('auxclick', handleClick, true);

  document.addEventListener(
    'mousedown',
    event => {
      if (event.button === 1) {
        handleClick(event);
      }
    },
    true
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
