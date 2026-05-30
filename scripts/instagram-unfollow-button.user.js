// ==UserScript==
// @name         Instagram - Botão para deixar de seguir em massa
// @namespace    mindserv.instagram.unfollow
// @version      1.0.0
// @description  Adiciona um painel com botão para deixar de seguir contas na tela de Following/Seguindo do Instagram.
// @author       Leonardo + ChatGPT
// @match        https://www.instagram.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const CFG = {
    delayAfterFollowingClick: 900,
    delayAfterConfirmClick: 3500,
    delayAfterScroll: 1200,
    maxPerRun: 40,
  };

  let running = false;
  let paused = false;
  let stopped = false;
  let totalUnfollowed = 0;
  let lastStatus = 'Pronto. Abra sua lista de Seguindo/Following.';

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const normalize = (s) => (s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const visible = (el) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      !el.disabled
    );
  };

  const followingTexts = new Set([
    'following',
    'requested',
    'seguindo',
    'solicitado',
    'solicitada',
  ]);

  const confirmTexts = new Set([
    'unfollow',
    'deixar de seguir',
    'cancel request',
    'cancelar solicitação',
    'cancelar pedido',
  ]);

  function setStatus(text) {
    lastStatus = text;
    const status = document.querySelector('#ig-unfollow-status');
    if (status) status.textContent = text;
  }

  function setCounter() {
    const counter = document.querySelector('#ig-unfollow-counter');
    if (counter) counter.textContent = String(totalUnfollowed);
  }

  function getDialog() {
    return document.querySelector('div[role="dialog"]') || null;
  }

  function getSearchScope() {
    return getDialog() || document.body;
  }

  function getScrollableContainer() {
    const dialog = getDialog();
    const root = dialog || document.body;

    const candidates = [...root.querySelectorAll('div, main, section')]
      .filter(el => {
        const style = window.getComputedStyle(el);
        return (
          el.scrollHeight > el.clientHeight + 80 &&
          ['auto', 'scroll'].includes(style.overflowY)
        );
      })
      .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));

    return candidates[0] || document.scrollingElement || document.documentElement;
  }

  function findFollowingButton() {
    const scope = getSearchScope();

    const buttons = [...scope.querySelectorAll('button')]
      .filter(visible)
      .filter(btn => {
        const txt = normalize(btn.innerText || btn.textContent);
        return followingTexts.has(txt);
      });

    return buttons[0] || null;
  }

  function findConfirmButton() {
    const buttons = [...document.querySelectorAll('button')]
      .filter(visible)
      .filter(btn => {
        const txt = normalize(btn.innerText || btn.textContent);
        return confirmTexts.has(txt);
      });

    const inDialog = buttons.find(btn => btn.closest('div[role="dialog"]'));
    return inDialog || buttons[0] || null;
  }

  async function scrollFollowingList() {
    const scroller = getScrollableContainer();

    if (scroller === document.scrollingElement || scroller === document.documentElement) {
      window.scrollBy(0, Math.floor(window.innerHeight * 0.85));
    } else {
      scroller.scrollTop += Math.floor(scroller.clientHeight * 0.85);
    }

    await sleep(CFG.delayAfterScroll);
  }

  async function waitWhilePaused() {
    while (paused && !stopped) {
      setStatus('Pausado.');
      await sleep(500);
    }
  }

  async function runUnfollow() {
    if (running) return;

    running = true;
    paused = false;
    stopped = false;

    setStatus('Iniciando...');
    setCounter();

    let actionsThisRun = 0;
    let emptyRounds = 0;

    try {
      while (!stopped && actionsThisRun < CFG.maxPerRun) {
        await waitWhilePaused();
        if (stopped) break;

        const btn = findFollowingButton();

        if (!btn) {
          emptyRounds += 1;
          setStatus(`Nenhum botão "Seguindo/Following" visível. Rolando lista... (${emptyRounds}/5)`);
          await scrollFollowingList();

          if (emptyRounds >= 5) {
            setStatus('Não achei mais botões visíveis. Abra/role a lista de Seguindo e tente novamente.');
            break;
          }

          continue;
        }

        emptyRounds = 0;

        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(400);

        setStatus('Clicando em Seguindo/Following...');
        btn.click();

        await sleep(CFG.delayAfterFollowingClick);

        const confirm = findConfirmButton();

        if (!confirm) {
          setStatus('Não encontrei o botão de confirmação. Pulando este item.');
          await sleep(1000);
          continue;
        }

        setStatus('Confirmando deixar de seguir...');
        confirm.click();

        totalUnfollowed += 1;
        actionsThisRun += 1;
        setCounter();

        setStatus(`Feito: ${totalUnfollowed}. Nesta rodada: ${actionsThisRun}/${CFG.maxPerRun}.`);
        await sleep(CFG.delayAfterConfirmClick);
      }

      if (actionsThisRun >= CFG.maxPerRun) {
        setStatus(`Limite da rodada atingido (${CFG.maxPerRun}). Espere um pouco antes de rodar de novo.`);
      }
    } catch (err) {
      console.error('[IG Unfollow]', err);
      setStatus(`Erro: ${err.message || err}`);
    } finally {
      running = false;
      paused = false;
      stopped = false;
    }
  }

  function stopRun() {
    stopped = true;
    paused = false;
    setStatus('Parando...');
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    setStatus(paused ? 'Pausado.' : 'Retomando...');
  }

  function makeButton(text, bg, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.type = 'button';
    btn.style.cssText = `
      border: 0;
      border-radius: 10px;
      padding: 8px 10px;
      color: white;
      background: ${bg};
      cursor: pointer;
      font-weight: 700;
      font-size: 12px;
      margin: 3px;
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function injectPanel() {
    if (document.querySelector('#ig-unfollow-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'ig-unfollow-panel';
    panel.style.cssText = `
      position: fixed;
      right: 14px;
      bottom: 14px;
      z-index: 2147483647;
      width: 290px;
      background: rgba(18, 18, 18, 0.94);
      color: white;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 16px;
      padding: 12px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 12px 34px rgba(0,0,0,0.45);
    `;

    const title = document.createElement('div');
    title.textContent = 'Instagram Unfollow';
    title.style.cssText = `
      font-size: 14px;
      font-weight: 800;
      margin-bottom: 6px;
    `;

    const info = document.createElement('div');
    info.innerHTML = `
      <div style="font-size:12px; opacity:.85; line-height:1.35;">
        Abra seu perfil → clique em <b>Seguindo</b> → rode por rodadas pequenas.
      </div>
      <div style="font-size:12px; margin-top:6px;">
        Total nesta aba: <b id="ig-unfollow-counter">0</b>
      </div>
      <div id="ig-unfollow-status" style="font-size:11px; opacity:.78; margin-top:6px; min-height:30px; line-height:1.35;">
        ${lastStatus}
      </div>
    `;

    const controls = document.createElement('div');
    controls.style.cssText = 'margin-top:8px; display:flex; flex-wrap:wrap; gap:4px;';

    controls.appendChild(makeButton('Começar', '#d62976', runUnfollow));
    controls.appendChild(makeButton('Pausar/Retomar', '#5851db', togglePause));
    controls.appendChild(makeButton('Parar', '#555', stopRun));

    const small = document.createElement('div');
    small.style.cssText = 'font-size:10px; opacity:.65; margin-top:8px; line-height:1.3;';
    small.textContent = `Limite: ${CFG.maxPerRun} por rodada. Delay: ${CFG.delayAfterConfirmClick / 1000}s.`;

    panel.appendChild(title);
    panel.appendChild(info);
    panel.appendChild(controls);
    panel.appendChild(small);

    document.body.appendChild(panel);
  }

  function boot() {
    injectPanel();

    const observer = new MutationObserver(() => {
      injectPanel();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
