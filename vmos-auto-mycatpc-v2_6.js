// ==UserScript==
// @name         Vmos Auto - MyCatPC
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  Auto VMOS Pro - MyCatPC v2.6 (UI từ vsphone v9.1)
// @match        *://*.vmoscloud.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      api.mail.tm
// @connect      api.mail.gw
// ==/UserScript==
(function () {
  'use strict';

  const P = "MyCatPC@222";
  let R = false, E = "", T = "", M = "mail.tm", _mailPass = P;

  const Rq = (u, m = "GET", d = null, t = null) => new Promise((res, rej) => {
    let h = { "Content-Type": "application/json" };
    if (t) h["Authorization"] = "Bearer " + t;
    GM_xmlhttpRequest({
      method: m, url: u, headers: h,
      data: d ? JSON.stringify(d) : null,
      onload: r => { try { res(JSON.parse(r.responseText)) } catch (e) { res(r.responseText) } },
      onerror: () => rej(new Error("Lỗi mạng. Bật VPN nếu bị chặn!"))
    });
  });

  setTimeout(() => {

    // ─────────────────────────────────────────────
    //  STYLES — ported từ vsphone v9.1 panel
    // ─────────────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `
      #mfpc-sq {
        position:fixed; bottom:24px; right:24px; z-index:2147483647;
        width:50px; height:50px; border-radius:10px;
        background:linear-gradient(135deg,#00ffe7,#007bff);
        border:2px solid #fff3; cursor:pointer;
        box-shadow:0 4px 18px #00ffe755;
        font-size:22px; display:none;
        align-items:center; justify-content:center;
      }
      #mfpc-sq.show { display:flex; }
      #mfpc-wrap {
        position:fixed; bottom:24px; right:24px; z-index:2147483646;
        width:272px; font-family:'Segoe UI',sans-serif; font-size:12px;
      }
      #mfpc-wrap.hide { display:none; }
      #mfpc-panel {
        background:#0d0d0d; border:1px solid #00ffe733;
        border-radius:12px; overflow:hidden;
        box-shadow:0 8px 32px #000b,0 0 16px #00ffe718;
      }
      #mfpc-header {
        display:flex; align-items:center; justify-content:space-between;
        padding:8px 10px 7px;
        background:linear-gradient(90deg,#00ffe711,#007bff1a);
        border-bottom:1px solid #ffffff0a;
        cursor:grab; user-select:none;
      }
      #mfpc-header:active { cursor:grabbing; }
      .mfpc-ht { color:#00ffe7; font-weight:700; font-size:12px; }
      .mfpc-ha { color:#444; font-size:10px; }
      #mfpc-min-btn {
        width:24px; height:24px; background:#1a1a1a;
        border:1px solid #00ffe733; border-radius:5px;
        cursor:pointer; color:#00ffe7; font-size:13px;
        display:flex; align-items:center; justify-content:center;
        flex-shrink:0; pointer-events:all;
      }
      #mfpc-status {
        margin:7px 10px 2px; background:#111; border:1px solid #00ffe722;
        border-radius:7px; padding:5px 8px; font-size:10.5px;
        min-height:22px; font-weight:700; letter-spacing:.3px;
      }
      #mfpc-status.ready { color:#00ff88; border-color:#00ff8822; }
      #mfpc-status.run   { color:#00ffe7; border-color:#00ffe722; }
      #mfpc-status.warn  { color:#ffcc00; border-color:#ffcc0022; }
      #mfpc-actions { padding:7px 10px; display:flex; gap:6px; }
      .mfpc-btn {
        flex:1; border:none; border-radius:7px; padding:7px 4px;
        font-size:11px; font-weight:700; cursor:pointer;
        transition:filter .15s,transform .1s;
      }
      .mfpc-btn:hover:not(:disabled){filter:brightness(1.18);transform:translateY(-1px);}
      .mfpc-btn:active:not(:disabled){transform:translateY(0);}
      .mfpc-btn:disabled{opacity:.35;cursor:not-allowed;}
      #btn-start{background:linear-gradient(90deg,#00ffe7,#007bff);color:#000;}
      #btn-claim{background:linear-gradient(90deg,#059669,#10b981);color:#fff;}
      #btn-stop{flex:0 0 54px;background:#dc2626;color:#fff;display:none;}
      #btn-reset{flex:0 0 34px;background:#1a0a0a;color:#ff6666;border:1px solid #ff333322;}
      #mfpc-log {
        margin:0 10px 6px; background:#060606; border-radius:8px;
        padding:5px 7px 6px; max-height:160px; overflow-y:auto;
        border:1px solid #00ffe712;
        box-shadow:inset 0 1px 6px #000a;
      }
      #mfpc-log .l {
        display:flex; align-items:flex-start; gap:5px;
        margin-bottom:0; padding:3px 0;
        border-bottom:1px solid #ffffff07;
        opacity:0; transition:opacity .25s;
      }
      #mfpc-log .l:last-child { border-bottom:none; }
      .ok   span:last-child { color:#00ff88; }
      .warn span:last-child { color:#ffcc00; }
      .err  span:last-child { color:#ff5555; }
      .info span:last-child { color:#8888aa; }
      .hi   span:last-child { color:#00ffe7; }
      #mfpc-foot{padding:3px 10px 6px;text-align:center;font-size:9.5px;color:#2a2a2a;border-top:1px solid #ffffff06;}
      #mfpc-panel ::-webkit-scrollbar{width:3px;}
      #mfpc-panel ::-webkit-scrollbar-thumb{background:#00ffe722;border-radius:3px;}
    `;
    document.head.appendChild(css);

    // ─────────────────────────────────────────────
    //  DOM — squircle icon + main panel
    // ─────────────────────────────────────────────
    const sq = document.createElement('div');
    sq.id = 'mfpc-sq'; sq.textContent = '🐟';
    document.body.appendChild(sq);

    const wrap = document.createElement('div');
    wrap.id = 'mfpc-wrap';
    wrap.innerHTML = `
      <div id="mfpc-panel">
        <div id="mfpc-header">
          <div><div class="mfpc-ht">VMOS Auto</div><div class="mfpc-ha">MyCatPC v2.6</div></div>
          <div id="mfpc-min-btn">▬</div>
        </div>
        <div id="mfpc-status" class="ready">• Sẵn sàng</div>

        <div id="mfpc-actions">
          <button class="mfpc-btn" id="btn-start">▶ Tạo Acc</button>
          <button class="mfpc-btn" id="btn-stop">■ Dừng</button>
          <button class="mfpc-btn" id="btn-claim">★ Claim Trial</button>
          <button class="mfpc-btn" id="btn-reset">↺</button>
        </div>
        <div id="mfpc-log"></div>
        <div id="mfpc-foot">MyCatPC</div>
      </div>
    `;
    document.body.appendChild(wrap);

    // ─────────────────────────────────────────────
    //  DRAG — wrap (header) + squircle
    // ─────────────────────────────────────────────
    const header = document.getElementById('mfpc-header');
    const minBtn = document.getElementById('mfpc-min-btn');
    let dragEl = null, ox = 0, oy = 0, moved = false;

    const dStart = (el, cx, cy) => {
      dragEl = el; moved = false;
      const r = el.getBoundingClientRect(); ox = cx - r.left; oy = cy - r.top;
      document.body.style.userSelect = 'none';
    };
    const dMove = (cx, cy) => {
      if (!dragEl) return; moved = true;
      dragEl.style.left   = (cx - ox) + 'px';
      dragEl.style.top    = (cy - oy) + 'px';
      dragEl.style.right  = 'auto';
      dragEl.style.bottom = 'auto';
    };
    const dEnd = () => {
      if (dragEl === sq) {
        const jd = moved;
        setTimeout(() => { sq._justDragged = jd; setTimeout(() => { sq._justDragged = false; }, 150); }, 0);
      }
      dragEl = null; document.body.style.userSelect = '';
    };

    header.addEventListener('mousedown', e => { if (minBtn.contains(e.target)) return; dStart(wrap, e.clientX, e.clientY); });
    header.addEventListener('touchstart', e => {
      if (minBtn.contains(e.target)) return;
      if (e.touches.length === 1) { e.preventDefault(); dStart(wrap, e.touches[0].clientX, e.touches[0].clientY); }
    }, { passive: false });
    sq.addEventListener('mousedown', e => dStart(sq, e.clientX, e.clientY));
    sq.addEventListener('touchstart', e => {
      if (e.touches.length === 1) dStart(sq, e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('mousemove', e => dMove(e.clientX, e.clientY));
    document.addEventListener('mouseup', dEnd);
    document.addEventListener('touchmove', e => {
      if (!dragEl) return;
      if (dragEl === wrap) e.preventDefault();
      dMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    document.addEventListener('touchend', dEnd);
    document.addEventListener('touchcancel', dEnd);

    // ─────────────────────────────────────────────
    //  MINIMIZE / RESTORE
    // ─────────────────────────────────────────────
    let _minimized = false;
    const applyMin = m => {
      _minimized = m;
      if (m) { wrap.classList.add('hide'); sq.classList.add('show'); }
      else   { sq.classList.remove('show'); wrap.classList.remove('hide'); }
    };

    minBtn.addEventListener('click',      e => { e.stopPropagation(); applyMin(true); });
    minBtn.addEventListener('mousedown',  e => e.stopPropagation());
    minBtn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });

    sq.addEventListener('click', () => {
      if (sq._justDragged) return;
      applyMin(false);
      const r = sq.getBoundingClientRect();
      wrap.style.bottom = 'auto'; wrap.style.right = 'auto';
      wrap.style.left = Math.max(4, r.left) + 'px';
      wrap.style.top  = Math.max(4, r.top - wrap.offsetHeight - 8) + 'px';
    });

    // ─────────────────────────────────────────────
    //  LOG — badge style từ vsphone
    // ─────────────────────────────────────────────
    const LOG_META = {
      ok  : { icon: '✅', label: 'OK'   },
      warn: { icon: '⚠️',  label: 'WARN' },
      err : { icon: '❌', label: 'ERR'  },
      info: { icon: '🔄', label: 'INFO' },
      hi  : { icon: '🐟', label: 'SYS'  },
    };

    const L = (msg, t = 'info') => {
      const logEl = document.getElementById('mfpc-log');
      if (!logEl) return;
      const meta = LOG_META[t] || LOG_META.info;
      const ts   = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const row  = document.createElement('div');
      row.className = `l ${t}`;

      const badge = document.createElement('span');
      badge.style.cssText = 'flex-shrink:0;font-size:9px;padding:1px 4px;border-radius:3px;margin-top:1px;font-weight:700;letter-spacing:.4px;';
      badge.style.background = t==='ok'?'#00ff8822':t==='err'?'#ff444422':t==='warn'?'#ffcc0022':t==='hi'?'#00ffe722':'#33333388';
      badge.style.border      = t==='ok'?'1px solid #00ff8844':t==='err'?'1px solid #ff444444':t==='warn'?'1px solid #ffcc0044':t==='hi'?'1px solid #00ffe744':'1px solid #44444444';
      badge.textContent = meta.label;

      const tsSpan = document.createElement('span');
      tsSpan.style.cssText = 'flex-shrink:0;color:#444;font-size:9px;margin-top:1.5px;';
      tsSpan.textContent = ts;

      const icon = document.createElement('span');
      icon.style.cssText = 'flex-shrink:0;font-size:10px;';
      icon.textContent = meta.icon;

      const text = document.createElement('span');
      text.style.cssText = 'flex:1;min-width:0;word-break:break-word;font-size:10px;line-height:1.5;';
      text.textContent = msg;

      row.append(icon, badge, tsSpan, text);
      logEl.appendChild(row);
      logEl.scrollTop = logEl.scrollHeight;
      requestAnimationFrame(() => { row.style.opacity = '1'; });
    };

    // ─────────────────────────────────────────────
    //  STATUS BAR
    // ─────────────────────────────────────────────
    const sS = (msg, cls = 'run') => {
      const s = document.getElementById('mfpc-status');
      if (!s) return;
      s.className = cls;
      s.textContent = msg;
    };

    // ─────────────────────────────────────────────
    //  UI STATE
    // ─────────────────────────────────────────────
    const setRunning = (label) => {
      R = true;
      document.getElementById('btn-start').disabled  = true;
      document.getElementById('btn-claim').disabled  = true;
      document.getElementById('btn-reset').disabled  = true;
      document.getElementById('btn-stop').style.display = 'flex';
      sS(`⟳ ${label}`, 'run');
    };
    const setIdle = (msg = '• Sẵn sàng') => {
      R = false;
      document.getElementById('btn-start').disabled  = false;
      document.getElementById('btn-claim').disabled  = false;
      document.getElementById('btn-reset').disabled  = false;
      document.getElementById('btn-stop').style.display = 'none';
      sS(msg, 'ready');
    };

    // ─────────────────────────────────────────────
    //  HELPERS (giữ nguyên từ v2.5)
    // ─────────────────────────────────────────────
    const _randPrefix = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let r = '';
      for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
      return r + Date.now().toString(36).slice(-4);
    };

    const _checkLoginByURL = () => {
      const u = window.location.href;
      if (/\/(dashboard|home|my-vmos|profile|new-user-benefits)/.test(u)) return true;
      const logoutEl = document.querySelector('[class*="logout"],[class*="dang-xuat"],[data-action="logout"],button[onclick*="logout"]');
      if (logoutEl && logoutEl.offsetParent !== null) return true;
      const avatarEl = document.querySelector('[class*="user-avatar"],[class*="userAvatar"],[class*="avatar-user"],[class*="user-name"],[class*="userName"]');
      if (avatarEl && avatarEl.offsetParent !== null) return true;
      return false;
    };

    const cLI = async () => {
      await new Promise(r => setTimeout(r, 2000));
      let streak = 0;
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const loginBtn = Array.from(document.querySelectorAll('button,a')).find(b => {
          const t = (b.innerText || '').trim();
          return (t === 'Đăng nhập/Đăng ký' || t === 'Đăng nhập') && b.offsetParent !== null;
        });
        if (loginBtn) return false;
        if (_checkLoginByURL()) { streak++; if (streak >= 2) return true; }
        else streak = 0;
      }
      return false;
    };

    const cC = () => !!document.querySelector(
      'iframe[src*="captcha"],iframe[src*="cloudflare"],iframe[src*="challenges.cloudflare.com"],.cf-turnstile,#challenge-form,#cf-challenge-running'
    );
    const waitCaptcha = async (label = "CAPTCHA", maxMs = 300000) => {
      if (!cC()) return true;
      L(`⚠️ ${label} — giải tay đi, bot chờ...`, "err");
      const t0 = Date.now();
      while (Date.now() - t0 < maxMs) {
        await new Promise(r => setTimeout(r, 2000));
        if (!cC()) { L(`✔️ ${label} đã giải.`, "ok"); return true; }
        if ((Date.now()-t0) % 10000 < 2100) L(`⏳ Chờ ${label}...`, "err");
      }
      return false;
    };

    const refreshToken = async () => {
      try {
        L("🔄 Làm mới token mail...", "info");
        const t = await Rq(`https://api.${M}/token`, "POST", { address: E, password: _mailPass });
        if (t && t.token) { T = t.token; L("✔️ Token mới OK.", "ok"); return true; }
      } catch (_) {}
      return false;
    };

    const QC = async () => {
      let ms;
      try { ms = await Rq(`https://api.${M}/messages`, "GET", null, T); } catch (_) { return null; }
      if (ms && (ms.code === 401 || ms['hydra:description'] || ms.type === 'https://tools.ietf.org/html/rfc2616#section-10')) {
        L("⚠️ Token hết hạn, thử refresh...", "err");
        const ok = await refreshToken();
        if (!ok) return null;
        try { ms = await Rq(`https://api.${M}/messages`, "GET", null, T); } catch (_) { return null; }
      }
      if (!ms || !ms['hydra:member'] || ms['hydra:member'].length === 0) return null;
      const msgs = ms['hydra:member'].slice(0, 5);
      for (const item of msgs) {
        let msg;
        try { msg = await Rq(`https://api.${M}/messages/${item.id}`, "GET", null, T); } catch (_) { continue; }
        const b = (msg.text || "") + " " + (msg.html ? (Array.isArray(msg.html) ? msg.html.join(' ') : msg.html) : "");
        let m = b.match(/(?:mã|code|otp|verify|verification|xác\s*(?:minh|thực))[^\d]{0,30}(\d{6})/i);
        if (m) { L(`📨 "${item.subject||'no subject'}" → OTP ${m[1]}`, "ok"); return m[1]; }
        m = b.match(/\b(\d{6})\b/);
        if (m) { L(`📨 "${item.subject||'no subject'}" → OTP ${m[1]}`, "ok"); return m[1]; }
        m = b.match(/(?:mã|code|otp)[^\d]{0,15}(\d{4})/i);
        if (m) { L(`📨 "${item.subject||'no subject'}" → OTP ${m[1]}`, "ok"); return m[1]; }
      }
      L(`📭 Inbox có ${msgs.length} mail, chưa thấy OTP...`, "info");
      return null;
    };

    const pollOTP = (maxMs = 180000) => new Promise(async (resolve) => {
      const deadline = Date.now() + maxMs;
      let tick = 0;
      while (Date.now() < deadline) {
        try { const o = await QC(); if (o) { resolve(o); return; } } catch (_) {}
        tick++;
        if (tick % 5 === 0) L(`⏳ Chờ OTP... còn ${Math.round((deadline - Date.now()) / 1000)}s`, "info");
        if (tick === 45 && M === "mail.tm") {
          L("⚠️ mail.tm chậm, thử sang mail.gw...", "err");
          try {
            const d = await Rq(`https://api.mail.gw/domains`);
            if (d && d['hydra:member'] && d['hydra:member'].length > 0) {
              const newE = `${_randPrefix()}@${d['hydra:member'][0].domain}`;
              await Rq(`https://api.mail.gw/accounts`, "POST", { address: newE, password: _mailPass });
              const t = await Rq(`https://api.mail.gw/token`, "POST", { address: newE, password: _mailPass });
              if (t && t.token) { M = "mail.gw"; E = newE; T = t.token; L(`✔️ Switch sang mail.gw: ${E}`, "ok"); }
            }
          } catch (_) { L("mail.gw cũng lỗi, tiếp tục poll mail.tm...", "err"); }
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      resolve(null);
    });

    const tC = (el) => {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2 + (Math.random() * 4 - 2);
          const cy = r.top  + r.height / 2 + (Math.random() * 4 - 2);
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: cx, clientY: cy }));
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, buttons: 1 }));
          el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, clientX: cx, clientY: cy, buttons: 0 }));
          el.dispatchEvent(new MouseEvent('click',     { bubbles: true, clientX: cx, clientY: cy }));
          if (el.click) el.click();
        }, 200 + Math.random() * 150);
      } catch (e) { if (el.click) el.click(); }
    };

    const fillOTP = async (o) => {
      L("Lấy OTP: " + o, "ok");
      let inp = document.querySelectorAll('input[maxlength="1"]');
      if (inp.length >= 4) {
        for (let j = 0; j < Math.min(inp.length, o.length); j++) {
          inp[j].focus(); inp[j].value = o[j];
          inp[j].dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 100));
        }
      } else {
        let s = document.querySelector('input[placeholder*="mã"],input[type="number"],input[inputmode="numeric"]');
        if (s) {
          s.scrollIntoView({ behavior: "smooth", block: "center" });
          await new Promise(r => setTimeout(r, 200));
          s.focus(); s.value = o;
          s.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      await new Promise(r => setTimeout(r, 800));
      let c = Array.from(document.querySelectorAll('button')).find(x =>
        x.innerText.includes('Xác nhận') || x.innerText.includes('Tiếp tục') || x.innerText.includes('Confirm')
      );
      if (c) tC(c);
    };

    const AF = async () => {
      L(`Điền form với: ${E}`, "info");
      let e = ["input[type=\"email\"]","input[name=\"email\"]","input[placeholder*=\"email\"]","input[placeholder*=\"thư\"]"]
        .map(s => Array.from(document.querySelectorAll(s)).find(el => el.offsetParent!==null)).find(Boolean);
      if (!e) {
        let b = Array.from(document.querySelectorAll('button')).find(x => x.innerText && (x.innerText.includes('Đăng nhập')||x.innerText.includes('Đăng ký')));
        if (b) { tC(b); await new Promise(r => setTimeout(r, 3000)); }
        e = Array.from(document.querySelectorAll('input[type="email"],input[name="email"]')).find(el => el.offsetParent!==null);
        if (!e) throw new Error("Không tìm thấy ô email");
      }
      e.scrollIntoView({ behavior: "smooth", block: "center" });
      await new Promise(r => setTimeout(r, 200));
      e.focus(); e.value = E;
      e.dispatchEvent(new Event('input', { bubbles: true }));
      let b = document.querySelector('button[type="submit"]') ||
        Array.from(document.querySelectorAll('button')).find(x =>
          x.innerText.includes('Gửi') || x.innerText.includes('Tiếp tục') || x.innerText.includes('Đăng nhập/Đăng ký')
        );
      if (!b) throw new Error("Không tìm thấy nút Gửi");
      tC(b);
      await new Promise(r => setTimeout(r, 1500));
      L("Đang chờ OTP...", "info");

      let otpResult = null;
      const captchaWatcher = async () => {
        await new Promise(r => setTimeout(r, 3000));
        if (cC()) {
          L("⚠️ CAPTCHA phát hiện — giải tay đi, OTP đang poll ngầm...", "err");
          while (cC() && !otpResult) {
            await new Promise(r => setTimeout(r, 4000));
            if (cC() && !otpResult) L("⏳ Vẫn còn CAPTCHA...", "err");
          }
          if (!cC()) L("✔️ CAPTCHA đã giải.", "ok");
        }
      };
      const otpPoller = async () => { otpResult = await pollOTP(); };
      await Promise.all([captchaWatcher(), otpPoller()]);

      let o = otpResult;
      if (!o) {
        L("Chưa có OTP, tìm nút Gửi lại...", "err");
        let rb = Array.from(document.querySelectorAll('a,span,button,div')).find(el => {
          let txt = (el.innerText || "").toLowerCase().trim();
          return txt === 'gửi lại' || txt === 'resend';
        });
        if (rb) { tC(rb); L("Đã bấm Gửi lại. Chờ mail mới...", "ok"); await new Promise(r => setTimeout(r, 3000)); o = await pollOTP(); }
      }
      if (!o) throw new Error("Không lấy được OTP sau 3 phút.");
      if (cC()) {
        L("OTP đã có, chờ bạn giải nốt CAPTCHA...", "info");
        if (!await waitCaptcha("CAPTCHA (OTP step)")) throw new Error("Hết thời gian giải CAPTCHA.");
        await new Promise(r => setTimeout(r, 1000));
      }
      await fillOTP(o);
      L("Đang xác thực OTP (tối đa 10s)...", "info");
      let lg = false;
      for (let k = 0; k < 20; k++) {
        await new Promise(r => setTimeout(r, 500));
        if (_checkLoginByURL()) { lg = true; break; }
      }
      if (!lg) throw new Error("Sai OTP hoặc lỗi xác thực.");
    };

    const claimTrial = async () => {
      L("Chuyển sang trang Trial...", "info");
      sessionStorage.setItem('zh_step', 'claim');
      await new Promise(r => setTimeout(r, 800));
      window.location.href = 'https://cloud.vmoscloud.com/new-user-benefits';
    };

    const rF = async () => {
      const u    = window.location.href;
      const step = sessionStorage.getItem('zh_step');
      if (!u.includes('new-user-benefits') && step !== 'returning') return;

      if (u.includes('new-user-benefits')) {
        setRunning("Đang claim trial...");
        L("Đã đến trang Trial. Chờ load...", "info");
        if (cC()) {
          L("⚠️ CAPTCHA trên trang Trial — giải tay rồi tool tự tiếp...", "err");
          const ok = await waitCaptcha("CAPTCHA Trial", 300000);
          if (!ok) { L("Hết giờ giải CAPTCHA, dừng.", "err"); setIdle(); return; }
          await new Promise(r => setTimeout(r, 1500));
        }
        await new Promise(r => setTimeout(r, 3000));
        window.scrollTo(0, 300);

        let claimBtn = null;
        for (let i = 0; i < 25; i++) {
          claimBtn = Array.from(document.querySelectorAll('button,a,div[role="button"]')).find(el =>
            el.innerText && (
              el.innerText.toLowerCase().includes('claim now') ||
              el.innerText.toLowerCase().includes('nhận ngay') ||
              el.innerText.toLowerCase().includes('nhận trial') ||
              el.innerText.toLowerCase().includes('get trial')
            )
          );
          if (claimBtn) break;
          await new Promise(r => setTimeout(r, 1000));
        }
        if (!claimBtn) { L("LỖI: Không thấy nút Claim sau 25s!", "err"); sessionStorage.removeItem('zh_step'); setIdle(); return; }
        L("Thấy nút Claim — bấm...", "ok");
        tC(claimBtn);
        await new Promise(r => setTimeout(r, 2000));

        if (cC()) {
          L("⚠️ CAPTCHA sau Claim — giải tay đi...", "err");
          const ok = await waitCaptcha("CAPTCHA post-claim", 300000);
          if (!ok) { L("Hết giờ giải CAPTCHA post-claim.", "err"); setIdle(); return; }
          await new Promise(r => setTimeout(r, 1500));
        }

        let claimed = false;
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const stillBtn = Array.from(document.querySelectorAll('button,a,div[role="button"]')).find(el =>
            el.innerText && (
              el.innerText.toLowerCase().includes('claim now') ||
              el.innerText.toLowerCase().includes('nhận ngay')
            ) && el.offsetParent !== null
          );
          if (!stillBtn) { claimed = true; break; }
        }
        if (!claimed) { L("Nút Claim vẫn còn, thử lại...", "err"); if (claimBtn.offsetParent !== null) tC(claimBtn); await new Promise(r => setTimeout(r, 3000)); }
        L("✅ Claim xong! Quay lại trang chủ...", "ok");
        sessionStorage.setItem('zh_step', 'returning');
        await new Promise(r => setTimeout(r, 2000));
        window.location.href = 'https://cloud.vmoscloud.com/';

      } else if (step === 'returning') {
        L("✅ Đã về trang chủ. Reload nhận máy...", "ok");
        sessionStorage.removeItem('zh_step');
        await new Promise(r => setTimeout(r, 3000));
        location.reload();
      }
    };
    rF();

    const Cr = async () => {
      L("Đang lấy domain mail...", "info");
      let d = await Rq(`https://api.${M}/domains`);
      if (!d || !d['hydra:member'] || d['hydra:member'].length === 0) {
        M = "mail.gw"; d = await Rq(`https://api.${M}/domains`);
      }
      if (!d || !d['hydra:member']) throw new Error("Lỗi API Mail. Thử bật VPN!");
      E = `${_randPrefix()}@${d['hydra:member'][0].domain}`;
      await Rq(`https://api.${M}/accounts`, "POST", { address: E, password: P });
      let t = await Rq(`https://api.${M}/token`, "POST", { address: E, password: P });
      T = t.token;
      L("Tạo email: " + E, "ok");
    };

    const St = () => { setIdle("• Sẵn sàng"); L("Đã dừng", "err"); };

    const S = async () => {
      if (R) return;
      setRunning("Đang tạo acc...");
      const MAX_RETRY = 3;
      for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        try {
          if (attempt > 1) { L(`🔄 Thử lại lần ${attempt}/${MAX_RETRY}...`, "info"); await new Promise(r => setTimeout(r, 2000)); }
          if (await cLI()) { L("Phát hiện đã đăng nhập rồi!", "ok"); setIdle("✓ Đã có acc — bấm Claim Trial"); return; }
          L("Chưa đăng nhập. Tạo tài khoản mới...", "info");
          await Cr(); await AF();
          L("✅ Tạo acc xong! Bấm Claim Trial để nhận 2H.", "ok");
          setIdle("✓ Tạo acc xong — bấm Claim Trial");
          return;
        } catch (e) {
          L(`Lỗi lần ${attempt}: ${e.message || e}`, "err");
          if (attempt === MAX_RETRY) { setIdle(); return; }
          E = ""; T = "";
        }
      }
    };

    const Cl = async () => {
      if (R) return;
      const loginBtnNow = Array.from(document.querySelectorAll('button,a')).find(b => {
        const t = (b.innerText || '').trim();
        return (t === 'Đăng nhập/Đăng ký' || t === 'Đăng nhập') && b.offsetParent !== null;
      });
      if (loginBtnNow || !_checkLoginByURL()) { L("⚠️ Chưa đăng nhập! Bấm Tạo Acc trước.", "err"); return; }
      setRunning("Đang chuyển trang claim...");
      try { await claimTrial(); } catch (e) { L("Lỗi claim: " + (e.message || e), "err"); setIdle(); }
    };

    const reset = () => {
      St(); E = ""; T = "";
      document.getElementById('mfpc-log').innerHTML = '';
      L("reset — MyCatPC v2.6", "hi");
    };

    // ─────────────────────────────────────────────
    //  STATUS POLL
    // ─────────────────────────────────────────────
    let iCL = false;
    const sI = setInterval(async () => {
      if (!document.getElementById('mfpc-status')) { clearInterval(sI); return; }
      if (R || iCL) return;
      iCL = true;
      let bt = document.body.textContent || "";
      let hp = /\bCòn lại:\s*\d+/.test(bt) || /\bHết hạn:\s*\d+/.test(bt);
      if (hp) {
        sS("⚠️ Đã có máy ảo! Tắt tool đi.", "warn");
        document.getElementById('btn-start').disabled  = true;
        document.getElementById('btn-claim').disabled  = true;
      } else {
        document.getElementById('btn-start').disabled  = false;
        document.getElementById('btn-claim').disabled  = false;
        const loginBtnVisible = Array.from(document.querySelectorAll('button,a')).find(b => {
          const t = (b.innerText || '').trim();
          return (t === 'Đăng nhập/Đăng ký' || t === 'Đăng nhập') && b.offsetParent !== null;
        });
        const loggedIn = !loginBtnVisible && _checkLoginByURL();
        if (!loggedIn) sS("• Chưa đăng nhập — bấm Tạo Acc", "ready");
        else if (!window.location.href.includes('new-user-benefits')) sS("✓ Đã có acc — bấm Claim Trial", "ready");
        else sS("⟳ Đang ở trang Trial...", "run");
      }
      iCL = false;
    }, 2000);
    window.addEventListener('beforeunload', () => clearInterval(sI));

    // ─────────────────────────────────────────────
    //  BUTTON WIRING
    // ─────────────────────────────────────────────
    document.getElementById('btn-start').addEventListener('click', S);
    document.getElementById('btn-stop').addEventListener('click',  St);
    document.getElementById('btn-claim').addEventListener('click', Cl);
    document.getElementById('btn-reset').addEventListener('click', reset);

    L("ready — MyCatPC v2.6", "hi");

  }, 1500);
})();
