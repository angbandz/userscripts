// ==UserScript==
// @name         RYM + Redacted → slskd search buttons
// @namespace    mindserv-rym-red-slskd
// @version      1.0.0
// @description  Adds slskd search buttons for artist, album, and artist + album on RYM album pages and Redacted subscribed collage updates.
// @match        https://rateyourmusic.com/release/*
// @match        https://www.rateyourmusic.com/release/*
// @match        https://redacted.sh/userhistory.php?action=subscribed_collages*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @connect      slskd.mindserv.org
// ==/UserScript==

(() => {
  "use strict";

  const CONFIG = {
    slskdBase: "https://slskd.mindserv.org",
    responseLimit: 100,
    fileLimit: 10000,
    openAfterSearch: true,
    fallbackOpenUrl: "https://slskd.mindserv.org/searches",
  };

  const STORAGE_KEYS = {
    apiKey: "slskd_api_key",
  };

  const STYLE_ID = "rym-red-slskd-style";
  const MARK_ATTR = "data-slskd-injected";
  const RYM_DONE_ATTR = "data-rym-slskd-done";

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function removeInjectedButtonText(text) {
    return cleanText(
      String(text || "")
        .replace(/🔎\s*slskd\s*artista\s*\+\s*álbum/gi, "")
        .replace(/🔎\s*slskd\s*artista/gi, "")
        .replace(/🔎\s*slskd\s*álbum/gi, "")
        .replace(/🔎\s*slskd/gi, "")
        .replace(/enviando\.\.\./gi, "")
    );
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function cleanArtistText(rawArtist) {
    let artist = removeInjectedButtonText(rawArtist);

    const byMatch = artist.match(/^.+?\s+by\s+(.+)$/i);
    if (byMatch) artist = byMatch[1];

    return cleanText(artist);
  }

  function cleanAlbumText(rawAlbum, artist) {
    let album = removeInjectedButtonText(rawAlbum);
    const artistClean = cleanText(artist);

    if (!album) return "";

    if (artistClean) {
      const escapedArtist = escapeRegExp(artistClean);

      album = album.replace(new RegExp(`\\s+by\\s+${escapedArtist}\\s*$`, "i"), "");
      album = album.replace(new RegExp(`^${escapedArtist}\\s*[-–—:]\\s*`, "i"), "");
    }

    album = album.replace(/\s+by\s+[^-–—|/]+$/i, "");

    return cleanText(album);
  }

  function joinArtistAlbum(artist, album) {
    return cleanText(`${cleanText(artist)} ${cleanText(album)}`);
  }

  function getApiKey() {
    return GM_getValue(STORAGE_KEYS.apiKey, "");
  }

  function setApiKey(apiKey) {
    GM_setValue(STORAGE_KEYS.apiKey, apiKey);
  }

  function deleteApiKey() {
    GM_deleteValue(STORAGE_KEYS.apiKey);
  }

  function notify(title, text) {
    try {
      GM_notification({ title, text, timeout: 3500 });
    } catch {
      console.log(`[${title}] ${text}`);
    }
  }

  function promptForApiKey() {
    const current = getApiKey();

    const input = window.prompt(
      [
        "Cole sua API key do slskd.",
        "",
        "Ela será salva no storage privado do userscript manager.",
        "Não será gravada em cookie do RYM nem do Redacted.",
      ].join("\n"),
      current || ""
    );

    if (input === null) return "";

    const cleaned = cleanText(input);

    if (!cleaned) {
      alert("API key vazia. Nada foi salvo.");
      return "";
    }

    if (cleaned.length < 16) {
      alert("Essa API key parece curta demais.");
      return "";
    }

    setApiKey(cleaned);
    notify("slskd", "API key salva.");

    return cleaned;
  }

  function getOrAskApiKey() {
    return getApiKey() || promptForApiKey();
  }

  function registerMenuCommands() {
    GM_registerMenuCommand("Configurar API key do slskd", () => {
      promptForApiKey();
    });

    GM_registerMenuCommand("Apagar API key do slskd", () => {
      if (!window.confirm("Apagar a API key salva do slskd?")) return;

      deleteApiKey();
      notify("slskd", "API key apagada.");
    });

    GM_registerMenuCommand("Testar API key do slskd", () => {
      const apiKey = getOrAskApiKey();
      if (!apiKey) return;

      GM_xmlhttpRequest({
        method: "GET",
        url: `${CONFIG.slskdBase.replace(/\/$/, "")}/api/v0/searches`,
        headers: { "X-API-Key": apiKey },
        timeout: 30000,
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) {
            alert("API key OK.");
          } else {
            alert(`Teste falhou. HTTP ${res.status}`);
          }
        },
        onerror: () => alert("Erro de rede ao testar a API key."),
        ontimeout: () => alert("Timeout ao testar a API key."),
      });
    });
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .slskd-inline-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 8px;
        padding: 2px 7px;
        border: 1px solid #777;
        border-radius: 7px;
        background: #1f1f1f;
        color: #f2f2f2;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.3;
        cursor: pointer;
        vertical-align: middle;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .slskd-inline-btn:hover {
        background: #333;
        border-color: #aaa;
      }

      .slskd-inline-btn[disabled] {
        opacity: 0.6;
        cursor: wait;
      }

      .slskd-redacted-btn {
        font-size: 10px;
        padding: 1px 6px;
        margin-left: 6px;
        border-radius: 5px;
      }

      .slskd-rym-combined-btn,
      .slskd-redacted-combined-btn {
        margin-left: 6px;
      }

      .slskd-fallback-box {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 999999;
        padding: 8px;
        border: 1px solid #555;
        border-radius: 10px;
        background: rgba(18, 18, 18, 0.94);
        box-shadow: 0 3px 18px rgba(0,0,0,.4);
      }

      .slskd-fallback-box .slskd-inline-btn {
        display: flex;
        width: 100%;
        margin: 4px 0;
        justify-content: center;
      }
    `;

    document.head.appendChild(style);
  }

  function isVisibleElement(el) {
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  }

  function searchSlskd(searchText, button) {
    const query = cleanText(searchText);

    if (!query) {
      alert("Não consegui detectar texto para buscar.");
      return;
    }

    const apiKey = getOrAskApiKey();
    if (!apiKey) return;

    const oldText = button?.textContent;

    if (button) {
      button.disabled = true;
      button.textContent = "enviando...";
    }

    const payload = {
      searchText: query,
      responseLimit: CONFIG.responseLimit,
      fileLimit: CONFIG.fileLimit,
      filterResponses: true,
    };

    GM_xmlhttpRequest({
      method: "POST",
      url: `${CONFIG.slskdBase.replace(/\/$/, "")}/api/v0/searches`,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      data: JSON.stringify(payload),
      timeout: 30000,
      onload: (res) => {
        if (button) {
          button.disabled = false;
          button.textContent = oldText;
        }

        if (res.status === 401 || res.status === 403) {
          const replace = window.confirm(
            `O slskd recusou a API key. HTTP ${res.status}.\n\nApagar a chave salva e informar outra?`
          );

          if (replace) {
            deleteApiKey();
            promptForApiKey();
          }

          return;
        }

        if (res.status < 200 || res.status >= 300) {
          alert(`slskd retornou HTTP ${res.status}\n\n${res.responseText || "(sem corpo)"}`);
          return;
        }

        let searchId = null;

        try {
          const data = JSON.parse(res.responseText);
          searchId = data?.id || null;
        } catch {}

        notify("Busca enviada ao slskd", query);

        if (CONFIG.openAfterSearch) {
          const base = CONFIG.slskdBase.replace(/\/$/, "");
          const target = searchId
            ? `${base}/searches/${encodeURIComponent(searchId)}`
            : CONFIG.fallbackOpenUrl;

          window.open(target, "_blank", "noopener,noreferrer");
        }
      },
      onerror: () => {
        if (button) {
          button.disabled = false;
          button.textContent = oldText;
        }

        alert("Erro de rede ao chamar o slskd.");
      },
      ontimeout: () => {
        if (button) {
          button.disabled = false;
          button.textContent = oldText;
        }

        alert("Timeout ao chamar o slskd.");
      },
    });
  }

  function makeButton(label, searchText, extraClass = "") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `slskd-inline-btn ${extraClass}`.trim();
    btn.textContent = label;
    btn.title = `Buscar no slskd: ${searchText}`;

    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      searchSlskd(searchText, btn);
    });

    return btn;
  }

  function insertButtonBesideElement(targetEl, button) {
    if (!targetEl || !targetEl.parentNode) return false;

    targetEl.setAttribute(MARK_ATTR, "1");
    targetEl.insertAdjacentElement("afterend", button);

    return true;
  }

  function insertButtonAfterReference(referenceEl, button) {
    if (!referenceEl || !referenceEl.parentNode) return false;

    referenceEl.insertAdjacentElement("afterend", button);
    return true;
  }

  // ─────────────────────────────────────────────
  // RYM album pages
  // ─────────────────────────────────────────────

  function findRymAlbumElement() {
    const selectors = [
      "h1.album_title",
      ".album_title",
      "[class*='album_title']",
      ".release_title",
      "[class*='release_title']",
    ];

    for (const selector of selectors) {
      const candidates = [...document.querySelectorAll(selector)];

      for (const el of candidates) {
        const text = cleanText(el.textContent);

        if (
          text &&
          isVisibleElement(el) &&
          !el.hasAttribute(MARK_ATTR) &&
          !/rate your music/i.test(text)
        ) {
          return el;
        }
      }
    }

    for (const el of [...document.querySelectorAll("h1")]) {
      const text = cleanText(el.textContent);

      if (
        text &&
        isVisibleElement(el) &&
        !el.hasAttribute(MARK_ATTR) &&
        !/\sby\s/i.test(text) &&
        !/rate your music/i.test(text)
      ) {
        return el;
      }
    }

    return null;
  }

  function findRymArtistElement() {
    const selectors = [
      ".album_artist a",
      ".release_pri_artist_credit a",
      ".release_artist a",
      "[class*='artist_credit'] a",
      "a[href^='/artist/']",
      "a[href*='rateyourmusic.com/artist/']",
    ];

    for (const selector of selectors) {
      const candidates = [...document.querySelectorAll(selector)];

      for (const el of candidates) {
        const text = cleanText(el.textContent);

        if (text && isVisibleElement(el) && !el.hasAttribute(MARK_ATTR)) {
          return el;
        }
      }
    }

    return null;
  }

  function getRymFallbackFromMeta() {
    const ogTitle = cleanText(
      document.querySelector('meta[property="og:title"]')?.content || ""
    );

    const match = ogTitle.match(/^(.+?)\s+by\s+(.+)$/i);

    if (match) {
      return {
        album: cleanText(match[1]),
        artist: cleanText(match[2]),
      };
    }

    return { album: "", artist: "" };
  }

  function createRymFallbackBox(artist, album) {
    if (document.querySelector(".slskd-fallback-box")) return;

    const box = document.createElement("div");
    box.className = "slskd-fallback-box";

    if (artist) box.appendChild(makeButton("🔎 slskd artista", artist));
    if (album) box.appendChild(makeButton("🔎 slskd álbum", album));
    if (artist && album) {
      box.appendChild(makeButton("🔎 slskd artista + álbum", joinArtistAlbum(artist, album)));
    }

    if (box.children.length > 0) document.body.appendChild(box);
  }

  function injectRymButtons() {
    injectStyle();

    if (document.body?.getAttribute(RYM_DONE_ATTR) === "1") return;

    const albumEl = findRymAlbumElement();
    const artistEl = findRymArtistElement();
    const fallback = getRymFallbackFromMeta();

    const artistText = cleanArtistText(artistEl?.textContent || fallback.artist);
    const albumText = cleanAlbumText(albumEl?.textContent || fallback.album, artistText);
    const combinedText = joinArtistAlbum(artistText, albumText);

    let insertedAny = false;
    let albumButton = null;

    if (artistEl && artistText) {
      insertedAny = insertButtonBesideElement(
        artistEl,
        makeButton("🔎 slskd artista", artistText)
      ) || insertedAny;
    }

    if (albumEl && albumText) {
      albumButton = makeButton("🔎 slskd álbum", albumText);
      insertedAny = insertButtonBesideElement(albumEl, albumButton) || insertedAny;
    }

    if (albumButton && artistText && albumText) {
      insertButtonAfterReference(
        albumButton,
        makeButton("🔎 slskd artista + álbum", combinedText, "slskd-rym-combined-btn")
      );
    }

    if (!insertedAny) createRymFallbackBox(artistText, albumText);
    if (insertedAny) document.body.setAttribute(RYM_DONE_ATTR, "1");

    console.log("RYM → slskd:", {
      artist: artistText,
      album: albumText,
      combined: combinedText,
      hasApiKey: Boolean(getApiKey()),
    });
  }

  // ─────────────────────────────────────────────
  // Redacted subscribed collage updates
  // ─────────────────────────────────────────────

  function isRedactedSubscribedCollagesPage() {
    if (!location.hostname.includes("redacted.sh")) return false;
    if (!location.pathname.endsWith("/userhistory.php")) return false;

    const params = new URLSearchParams(location.search);
    return params.get("action") === "subscribed_collages";
  }

  function cleanRedactedText(rawText) {
    return removeInjectedButtonText(rawText)
      .replace(/\s*\[\s*hide\s*\]\s*$/i, "")
      .replace(/\s*\[\s*show\s*\]\s*$/i, "")
      .replace(/\s*\[\s*catch up\s*\]\s*$/i, "")
      .replace(/\s*\[\s*subscribe\s*\]\s*$/i, "")
      .replace(/\s*\[\s*unsubscribe\s*\]\s*$/i, "")
      .trim();
  }

  function injectRedactedTorrentGroupButtons() {
    const groups = [
      ...document.querySelectorAll("table.torrent_table tr.group.discog .group_info strong"),
    ];

    let injected = 0;

    for (const group of groups) {
      if (group.hasAttribute(MARK_ATTR)) continue;

      const artistLink = group.querySelector(
        'a[href^="artist.php?id="], a[href*="/artist.php?id="]'
      );
      const albumLink = group.querySelector(
        'a[href^="torrents.php?id="], a[href*="/torrents.php?id="]'
      );

      const artist = cleanRedactedText(artistLink?.textContent || "");
      const album = cleanRedactedText(albumLink?.textContent || "");
      const combined = joinArtistAlbum(artist, album);

      let lastInserted = null;

      if (artistLink && artist && !artistLink.hasAttribute(MARK_ATTR)) {
        artistLink.setAttribute(MARK_ATTR, "1");
        const artistButton = makeButton("🔎 slskd artista", artist, "slskd-redacted-btn");
        artistLink.insertAdjacentElement("afterend", artistButton);
        injected++;
      }

      if (albumLink && album && !albumLink.hasAttribute(MARK_ATTR)) {
        albumLink.setAttribute(MARK_ATTR, "1");
        const albumButton = makeButton("🔎 slskd álbum", album, "slskd-redacted-btn");
        albumLink.insertAdjacentElement("afterend", albumButton);
        lastInserted = albumButton;
        injected++;
      }

      if (lastInserted && artist && album) {
        lastInserted.insertAdjacentElement(
          "afterend",
          makeButton("🔎 slskd artista + álbum", combined, "slskd-redacted-btn slskd-redacted-combined-btn")
        );
        injected++;
      }

      if (artist || album) group.setAttribute(MARK_ATTR, "1");
    }

    return injected;
  }

  function injectRedactedButtons() {
    injectStyle();
    if (!isRedactedSubscribedCollagesPage()) return;

    const torrentButtons = injectRedactedTorrentGroupButtons();

    if (torrentButtons) {
      console.log("RED → slskd:", {
        torrentButtons,
        collageButtons: 0,
        hasApiKey: Boolean(getApiKey()),
      });
    }
  }

  // ─────────────────────────────────────────────
  // Router
  // ─────────────────────────────────────────────

  function runInjector() {
    if (location.hostname.includes("rateyourmusic.com")) {
      injectRymButtons();
      return;
    }

    if (isRedactedSubscribedCollagesPage()) {
      injectRedactedButtons();
    }
  }

  registerMenuCommands();

  setTimeout(runInjector, 500);
  setTimeout(runInjector, 1500);
  setTimeout(runInjector, 3000);

  const observer = new MutationObserver(() => {
    runInjector();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
