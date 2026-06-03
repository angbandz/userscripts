// ==UserScript==
// @name         RYM → slskd Search
// @namespace    https://mindserv.org/userscripts
// @version      1.0.0
// @description  Adiciona botão no Rate Your Music para buscar artista/álbum no slskd.
// @author       Leonardo
// @match        https://rateyourmusic.com/release/*
// @match        https://www.rateyourmusic.com/release/*
// @match        https://*.rateyourmusic.com/release/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @connect      slskd.mindserv.org
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const CFG = {
    slskdBaseUrl: "https://slskd.mindserv.org",
    apiKeyStorageName: "slskd_api_key",
    buttonId: "rym-slskd-search-button",
  };

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[“”"]/g, "")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getDirectTextOnly(element) {
    if (!element) return "";

    return Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join(" ");
  }

  function firstText(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const text = cleanText(el?.textContent);
      if (text) return text;
    }

    return "";
  }

  function getAlbumTitle() {
    const albumTitleEl = document.querySelector(".album_title");

    if (albumTitleEl) {
      const direct = cleanText(getDirectTextOnly(albumTitleEl));
      if (direct) return direct;

      const clone = albumTitleEl.cloneNode(true);
      clone
        .querySelectorAll("a, .artist, .album_artist, .release_artist")
        .forEach((el) => el.remove());

      const clonedText = cleanText(clone.textContent)
        .replace(/\bby\s+.+$/i, "")
        .trim();

      if (clonedText) return clonedText;
    }

    const heading = firstText([
      "h1 .album_title",
      "h1",
      "[class*='album_title']",
    ]);

    if (heading) {
      return cleanText(heading)
        .replace(/\bby\s+.+$/i, "")
        .replace(/\s+-\s+Rate Your Music.*$/i, "")
        .trim();
    }

    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    if (ogTitle) {
      return cleanText(ogTitle)
        .replace(/\s+by\s+.+$/i, "")
        .replace(/\s+-\s+Rate Your Music.*$/i, "")
        .trim();
    }

    return cleanText(document.title)
      .replace(/\s+by\s+.+$/i, "")
      .replace(/\s+-\s+Rate Your Music.*$/i, "")
      .trim();
  }

  function getArtistName() {
    const selectors = [
      ".album_title a[href*='/artist/']",
      ".album_artist a[href*='/artist/']",
      ".release_artist a[href*='/artist/']",
      "a[href*='/artist/']",
    ];

    for (const selector of selectors) {
      const text = cleanText(document.querySelector(selector)?.textContent);
      if (text && !/^rate your music$/i.test(text)) return text;
    }

    const source =
      document.querySelector(".album_title")?.textContent ||
      document.querySelector('meta[property="og:title"]')?.content ||
      document.title;

    const byMatch = String(source || "").match(/\bby\s+(.+?)(?:\s+-\s+Rate Your Music|\s+\(|$)/i);
    if (byMatch?.[1]) return cleanText(byMatch[1]);

    return "";
  }

  function getSearchQuery() {
    const artist = getArtistName();
    const album = getAlbumTitle();

    return cleanText(`${artist} ${album}`)
      .replace(/\bRate Your Music\b/gi, "")
      .replace(/\bRYM\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getApiKey() {
    let apiKey = GM_getValue(CFG.apiKeyStorageName, "");

    if (!apiKey) {
      apiKey = prompt("Cole a API key do slskd:", "") || "";
      apiKey = apiKey.trim();

      if (apiKey) {
        GM_setValue(CFG.apiKeyStorageName, apiKey);
      }
    }

    return apiKey;
  }

  function setApiKey() {
    const current = GM_getValue(CFG.apiKeyStorageName, "");
    const next = prompt("API key do slskd:", current) || "";
    const clean = next.trim();

    if (clean) {
      GM_setValue(CFG.apiKeyStorageName, clean);
      alert("API key salva para o RYM → slskd.");
    }
  }

  function postSearch(query, button) {
    const apiKey = getApiKey();

    if (!apiKey) {
      alert("Sem API key. Busca cancelada.");
      return;
    }

    console.log("[RYM → slskd] album:", getAlbumTitle());
    console.log("[RYM → slskd] artist:", getArtistName());
    console.log("[RYM → slskd] query:", query);

    button.textContent = "Enviando…";

    GM_xmlhttpRequest({
      method: "POST",
      url: `${CFG.slskdBaseUrl.replace(/\/$/, "")}/api/v0/searches`,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      data: JSON.stringify({ searchText: query }),
      onload: (response) => {
        console.log("[RYM → slskd] status:", response.status);
        console.log("[RYM → slskd] response:", response.responseText);

        if (response.status >= 200 && response.status < 300) {
          button.textContent = "✓ enviado";
          setTimeout(() => {
            button.textContent = "Buscar no slskd";
          }, 1600);
          return;
        }

        button.textContent = "Erro slskd";
        alert(`slskd respondeu HTTP ${response.status}.\n\nBusca: ${query}\n\nVeja o console.`);
      },
      onerror: (error) => {
        console.error("[RYM → slskd] erro:", error);
        button.textContent = "Erro slskd";
        alert("Erro ao chamar o slskd. Veja o console.");
      },
    });
  }

  function createButton() {
    const button = document.createElement("button");
    button.id = CFG.buttonId;
    button.type = "button";
    button.textContent = "Buscar no slskd";
    button.title = "Clique: busca no slskd. Clique direito: copia a busca.";

    Object.assign(button.style, {
      position: "fixed",
      right: "18px",
      bottom: "18px",
      zIndex: "2147483647",
      padding: "10px 14px",
      borderRadius: "8px",
      border: "1px solid rgba(255,255,255,.25)",
      background: "#1f2937",
      color: "#fff",
      fontSize: "13px",
      fontWeight: "700",
      cursor: "pointer",
      boxShadow: "0 4px 18px rgba(0,0,0,.35)",
      opacity: "0.95",
    });

    button.addEventListener("click", () => {
      const query = getSearchQuery();

      if (!query || query.length < 2) {
        alert("Não consegui montar a busca do RYM.");
        return;
      }

      postSearch(query, button);
    });

    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const query = getSearchQuery();
      GM_setClipboard(query);
      console.log("[RYM → slskd] query copiada:", query);
      alert(`Busca copiada:\n\n${query}`);
    });

    return button;
  }

  function injectButton() {
    if (!document.body) return;
    if (document.getElementById(CFG.buttonId)) return;
    document.body.appendChild(createButton());
  }

  GM_registerMenuCommand("Configurar API key do slskd", setApiKey);
  GM_registerMenuCommand("Copiar busca montada do RYM", () => {
    const query = getSearchQuery();
    GM_setClipboard(query);
    alert(`Busca copiada:\n\n${query}`);
  });

  injectButton();

  new MutationObserver(injectButton).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
