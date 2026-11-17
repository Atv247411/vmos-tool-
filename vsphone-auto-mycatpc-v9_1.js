// ==UserScript==
// @name         Vsphone Auto - MyCatPC
// @namespace    tool.vsphone.MyCatPC
// @version      9.1
// @description  Auto tạo tài khoản vsphone trial — MyCatPC v9.1 (fixed pass + advanced log)
// @author       MyCatPC
// @match        https://cloud.vsphone.com/*
// @match        https://vsphone.com/*
// @match        https://www.vsphone.com/*
// @match        https://*.vscloudphone.com/*
// @grant        GM_xmlhttpRequest
// @connect      api.mail.tm
// @connect      api.mail.gw
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  //  CONFIG
  // ─────────────────────────────────────────────
  const CFG = {
    defaultPassLen     : 12,
    cloudUrl           : 'https://cloud.vsphone.com/?channel=web',
    otpTimeout         : 300_000,
    captchaHardTimeout : 60_000,
    podReadyTimeout    : 60_000,
    stepDelay          : 600,
    otpBtnRetry        : 20,
  };

  // ─────────────────────────────────────────────
  //  PASSWORD — fixed default
  // ─────────────────────────────────────────────
  const DEFAULT_PASS  = 'MyCatPC@222';
  const generatePass  = () => DEFAULT_PASS;

  // ─────────────────────────────────────────────
  //  STATE
  // ─────────────────────────────────────────────
  let running   = false;
  let runId     = 0;
  let mailApi   = 'mail.tm';
  let tempEmail = '';
  let mailToken = '';
  let currentPass = '';

  const isMKPage = /^(www\.)?vsphone\.com$/i.test(location.hostname);

  // ─────────────────────────────────────────────
  //  UTILS
  // ─────────────────────────────────────────────
  const sl  = ms => new Promise(r => setTimeout(r, ms));
  const nz  = s  => (s || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

  const vis = el => {
    if (!el || !el.isConnected) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // TouchEvent-based click — fixes React/Vue synthetic handlers
  const tC = async el => {
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
    await sl(300);
    try {
      const r = el.getBoundingClientRect();
      const t = new Touch({
        identifier   : Date.now(),
        target       : el,
        clientX      : r.left + r.width / 2,
        clientY      : r.top  + r.height / 2,
        radiusX: 2.5, radiusY: 2.5, rotationAngle: 10, force: 1,
      });
      el.dispatchEvent(new TouchEvent('touchstart', { cancelable: true, bubbles: true, touches: [t], targetTouches: [t], changedTouches: [t] }));
      el.dispatchEvent(new TouchEvent('touchend',   { cancelable: true, bubbles: true, touches: [],  targetTouches: [],  changedTouches: [t] }));
    } catch (_) {}
    if (el.click) el.click();
  };

  // Vue/React-safe value setter
  const setVal = (el, v) => {
    try { el.focus(); } catch (_) {}
    try {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    } catch (_) { el.value = v; }
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  };

  const isEnabled = el =>
    el.isConnected &&
    !el.disabled &&
    el.getAttribute('aria-disabled') !== 'true' &&
    getComputedStyle(el).pointerEvents !== 'none';

  // TreeWalker text finder
  const fT = (arr, ex = false) => {
    const w = document.createTreeWalker(document.body, 4);
    let n;
    while ((n = w.nextNode())) {
      const v = n.nodeValue;
      if (!v || v.length > 120) continue;
      const p = n.parentElement;
      if (!p || p.closest('#mfpc-wrap') || p.closest('#mfpc-sq') || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)) continue;
      const t = nz(v).replace(/ ?\/ ?/g, '/');
      const hit = ex ? arr.includes(t) : arr.some(a => t.includes(a) && t.length <= a.length + 30);
      if (hit && vis(p)) return p;
    }
    return null;
  };

  const clk = el => el.closest('button,a,[role="button"]') || el;

  const sleep = ms => sl(ms);

  // ─────────────────────────────────────────────
  //  DOM FINDERS
  // ─────────────────────────────────────────────
  const LOGIN_TEXTS   = ['đăng nhập/đăng ký','đăng nhập','sign in','login','log in'];
  const OTP_TEXTS     = ['nhận mã xác minh','nhận mã xác nhận','gửi mã xác minh','gửi mã xác nhận','get verification code','send verification code','send code','get code','get otp','send otp'];
  const REG_TEXTS     = ['đăng ký và đăng nhập','đăng ký','register','create account','sign up'];
  const CONFIRM_TEXTS = ['xác nhận','đăng nhập','confirm','submit'];

  const findLoginBtn = () => { const e = fT(LOGIN_TEXTS, true); return e ? clk(e) : null; };
  const findOtpBtn   = () => { const e = fT(OTP_TEXTS);         return e ? clk(e) : null; };
  const findRegBtn   = () => {
    const e = fT(REG_TEXTS); if (e) return clk(e);
    const f = fT(CONFIRM_TEXTS, true); return f ? clk(f) : null;
  };

  const findEmailInputs = () =>
    Array.from(document.querySelectorAll(
      'input[type="email"], input[name*="email" i], input[placeholder*="mail" i], input[placeholder*="email" i], input[placeholder*="thư" i]'
    )).filter(vis);

  const findPasswordFields = () => {
    const all = Array.from(document.querySelectorAll('input[type="password"]')).filter(vis);
    if (!all.length) return { pass: null, confirm: null };
    if (all.length === 1) return { pass: all[0], confirm: null };
    const confirmField = all.find(el => {
      const h = (el.placeholder + el.name + el.id + (el.getAttribute('aria-label') || '')).toLowerCase();
      return /confirm|re.?enter|nhập lại|repeat|verify/i.test(h);
    });
    if (confirmField) return { pass: all.find(el => el !== confirmField), confirm: confirmField };
    return { pass: all[0], confirm: all[1] };
  };

  const findTermsCheckbox = () => {
    const all = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(vis);
    return all.find(el => {
      const label = document.querySelector(`label[for="${el.id}"]`) || el.closest('label') || el.parentElement;
      if (!label) return false;
      const t = nz(label.innerText || label.textContent || '');
      return /terms|agreement|điều khoản|chính sách|privacy|policy|agree/i.test(t);
    }) || null;
  };

  // v2.2 OTP regex — filters year false-positives, pins 6 digits
  const extractOtp = text => {
    const matches = [...text.matchAll(/(?<!\d)(\d{6})(?!\d)/g)].map(m => m[1]);
    const valid   = matches.filter(n => !/^(19|20)\d{2}$/.test(n));
    return valid.length > 0 ? valid[0] : (matches.length > 0 ? matches[0] : null);
  };

  const CAPTCHA_SEL = [
    'iframe[src*="captcha" i]','iframe[src*="cloudflare" i]','iframe[src*="geetest" i]',
    'iframe[src*="hcaptcha" i]','iframe[src*="recaptcha" i]',
    '.cf-turnstile','#challenge-form','#cf-challenge-running',
    '[class*="geetest" i]','[class*="turnstile" i]','[class*="recaptcha" i]',
    '[class*="aliyunCaptcha" i]','#aliyunCaptcha-window-popup',
  ].join(',');

  const hasCaptcha = () => {
    try {
      return Array.from(document.querySelectorAll(CAPTCHA_SEL)).some(el => {
        if (el.closest('#mfpc-wrap') || el.closest('#mfpc-sq') || !vis(el)) return false;
        if (el.id === 'aliyunCaptcha-window-popup' && el.classList.contains('aliyunCaptcha-hidden')) return false;
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
      });
    } catch (_) { return false; }
  };

  const findOtpInput = () => {
    const inputs = Array.from(document.querySelectorAll('input')).filter(
      i => vis(i) && !['password','checkbox','radio','hidden','submit','button','email'].includes(i.type)
    );
    return inputs.find(i => /mã xác|xác nhận|xác minh|otp|verif|code/i.test(i.placeholder + i.name + i.id))
        || inputs.find(i => i.maxLength >= 4 && i.maxLength <= 8)
        || null;
  };

  const isLoggedIn = () =>
    !!(document.querySelector('[class*="podList" i],[class*="dashboard" i],[class*="myDevice" i],[class*="device-card" i]'))
    || (!findLoginBtn() && findEmailInputs().length === 0);

  const waitForNoLogin = async (timeout = 3000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (!findLoginBtn() && findEmailInputs().length === 0) return true;
      await sl(400);
    }
    return false;
  };

  const submitForm = async el => {
    const form = el.closest('form');
    if (form && typeof form.requestSubmit === 'function') {
      try { form.requestSubmit(); return; } catch (_) {}
    }
    const submitBtn = form ? form.querySelector('button[type="submit"], input[type="submit"]') : null;
    if (submitBtn && vis(submitBtn)) { await tC(submitBtn); return; }
    await tC(el);
  };

  // ─────────────────────────────────────────────
  //  HTTP & MAIL
  // ─────────────────────────────────────────────
  const req = (url, method = 'GET', data = null, token = null) =>
    new Promise((res, rej) => {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      GM_xmlhttpRequest({
        method, url, headers,
        data     : data ? JSON.stringify(data) : null,
        timeout  : 20_000,
        onload   : r => { try { res(JSON.parse(r.responseText)); } catch (_) { res(r.responseText); } },
        onerror  : () => rej(new Error('Lỗi mạng — thử bật VPN')),
        ontimeout: () => rej(new Error('Request timeout — thử bật VPN')),
      });
    });

  const createTempMail = async () => {
    log('Lấy domain mail...', 'info');
    let domains;
    try {
      domains = await req('https://api.mail.tm/domains');
      mailApi = 'mail.tm';
    } catch (_) {
      domains = await req('https://api.mail.gw/domains');
      mailApi = 'mail.gw';
    }
    const list = domains?.['hydra:member'];
    if (!list?.length) throw new Error('Không lấy được domain mail');

    const domain  = list[0].domain;
    const user    = `mfpc_${Math.random().toString(36).slice(2, 11)}`;
    tempEmail     = `${user}@${domain}`;
    currentPass   = generatePass();

    await req(`https://api.${mailApi}/accounts`, 'POST', { address: tempEmail, password: currentPass });
    const tokenRes = await req(`https://api.${mailApi}/token`, 'POST', { address: tempEmail, password: currentPass });
    if (!tokenRes?.token) throw new Error('Không lấy được token mail');
    mailToken = tokenRes.token;

    document.getElementById('mfpc-mailrow').textContent = `📧 ${tempEmail}`;
    log(`Pass: ${currentPass}`, 'hi');
    log(`Email tạm: ${tempEmail}`, 'ok');
  };

  const refreshMailToken = async () => {
    try {
      const tokenRes = await req(`https://api.${mailApi}/token`, 'POST', { address: tempEmail, password: currentPass });
      if (tokenRes?.token) { mailToken = tokenRes.token; log('Đã làm mới token mail.', 'info'); }
    } catch (_) {}
  };

  const pollOtp = async () => {
    try {
      const msgs = await req(`https://api.${mailApi}/messages`, 'GET', null, mailToken);
      if (msgs?.['hydra:member']) {
        const list = msgs['hydra:member'];
        if (!list.length) return null;
        const full = await req(`https://api.${mailApi}/messages/${list[0].id}`, 'GET', null, mailToken);
        const html = Array.isArray(full.html) ? full.html.join(' ') : (full.html || '');
        const text = (full.text || '') + ' ' + html
          .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ');
        return extractOtp(text);
      }
    } catch (_) { await refreshMailToken(); }
    return null;
  };

  // ─────────────────────────────────────────────
  //  CLAIM TRIAL (v8_4 original flow, kept)
  // ─────────────────────────────────────────────
  async function claimTrial() {
    log('tìm Claim Now...', 'info');
    let claimBtn = null;
    const panel = document.getElementById('mfpc-wrap');

    for (let i = 0; i < 10; i++) {
      for (const el of document.querySelectorAll('button, a, div, span, [role="button"]')) {
        if (!el.offsetParent) continue;
        if (panel.contains(el)) continue;
        const t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (/^claim now$/i.test(t) || /^claim now\s*[►▶→»]/i.test(t)) { claimBtn = el; break; }
      }
      if (claimBtn) break;
      log(`lần ${i+1}: chưa thấy Claim Now, chờ 2s...`, 'warn');
      await sleep(2000);
    }

    if (!claimBtn) {
      log('⚠ Không quét được chỗ Claim Trial.', 'err');
      log('➤ Vui lòng bật VPN và tạo tài khoản mới để nhận Trial.', 'warn');
      log('➤ Nếu vẫn không được: Vsphone hiện đang hết Trial.', 'warn');
      return false;
    }

    await tC(claimBtn);
    log('đã click Claim Now ✅', 'ok');
    log('chờ modal dùng thử mở...', 'info');

    let nhanBtn = null;
    for (let i = 0; i < 10; i++) {
      await sleep(800);
      for (const el of document.querySelectorAll('button, a, [role="button"]')) {
        if (!el.offsetParent) continue;
        if (panel.contains(el)) continue;
        const t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (/nhận dùng thử/i.test(t)) { nhanBtn = el; break; }
      }
      if (nhanBtn) break;
      log(`chờ modal... (${i+1}/10)`, 'info');
    }

    if (!nhanBtn) {
      log('⚠ Không tìm thấy nút Nhận dùng thử.', 'err');
      log('➤ Vui lòng bật VPN và tạo tài khoản mới để nhận Trial.', 'warn');
      return false;
    }

    await tC(nhanBtn);
    log('đã click Nhận dùng thử ✅', 'ok');
    await sleep(2000);
    log('claim xong — reload trang...', 'hi');
    location.reload();
    return true;
  }

  // ─────────────────────────────────────────────
  //  PROVISIONING FLOW (v2.2 logic)
  // ─────────────────────────────────────────────
  const runFlow = async (id) => {
    const ck = () => { if (!running || runId !== id) throw new Error('STOP'); };
    const wt = async ms => { await sl(ms); ck(); };

    log('Tìm ô nhập email...', 'info');
    let emailInputs = findEmailInputs();
    if (!emailInputs.length) {
      const btn = findLoginBtn();
      if (btn) { await tC(btn); await wt(2000); }
      emailInputs = findEmailInputs();
      if (!emailInputs.length) throw new Error('Không tìm thấy ô nhập email');
    }

    for (const inp of emailInputs) setVal(inp, tempEmail);
    log(`Điền email: ${tempEmail}`, 'ok');
    await wt(CFG.stepDelay);

    const cb = findTermsCheckbox();
    if (cb && !cb.checked) { await tC(cb); await wt(300); log('Đã tick checkbox điều khoản', 'ok'); }

    if (!findOtpBtn()) {
      const submitBtn = Array.from(document.querySelectorAll('button[type="submit"]')).find(vis) || findLoginBtn();
      if (submitBtn) { await submitForm(submitBtn); await wt(2000); }
    }

    log('Tìm nút Nhận mã xác minh...', 'info');
    let otpClicked = false;
    for (let i = 0; i < CFG.otpBtnRetry; i++) {
      ck();
      const p = findOtpBtn();
      if (p) {
        if (!isEnabled(p)) { log(`Nút OTP disabled, chờ... (${i+1}/${CFG.otpBtnRetry})`, 'info'); await wt(500); continue; }
        await tC(p); log(`Đã click nút OTP (lần ${i+1})`, 'ok'); otpClicked = true; break;
      }
      log(`Chưa thấy nút OTP (${i+1}/${CFG.otpBtnRetry})...`, 'info');
      await wt(500);
    }
    if (!otpClicked) throw new Error('Không tìm thấy / không click được nút Nhận mã xác minh');

    log('Chờ OTP trong mail...', 'info');
    let otp = null;
    let captchaShown = false, captchaStart = 0, hintShown = false;
    const tOtp = Date.now();

    while (Date.now() - tOtp < CFG.otpTimeout) {
      await wt(2000); ck();
      const cap = hasCaptcha();
      if (cap && !captchaShown) {
        captchaShown = true; captchaStart = Date.now();
        log('⚠ CAPTCHA xuất hiện — vui lòng giải captcha thủ công.', 'warn');
        log('⏳ Tool đang chờ... sau khi giải xong sẽ tự lấy OTP và đăng nhập.', 'info');
        minimizeToIcon(true);
      } else if (!cap && captchaShown) {
        captchaShown = false; minimizeToIcon(false);
        log('✅ Captcha đã giải xong — tool tiếp tục lấy OTP và tự đăng nhập...', 'ok');
      }

      if (captchaShown && Date.now() - captchaStart > CFG.captchaHardTimeout) {
        log('⚠ Captcha chờ quá 60s — thử gửi lại mã OTP. Giải captcha xong tool tự chạy tiếp.', 'warn');
        minimizeToIcon(false); captchaShown = false;
        const retryBtn = findOtpBtn();
        if (retryBtn && isEnabled(retryBtn)) await tC(retryBtn);
        captchaStart = Date.now();
      }

      try { otp = await pollOtp(); } catch (_) {}
      if (otp) break;

      if (!hintShown && !captchaShown && Date.now() - tOtp > 25_000) {
        hintShown = true;
        log('Chưa thấy mail OTP — bấm tay nút Nhận mã, bot vẫn tự điền.', 'info');
      }
    }

    minimizeToIcon(false);
    if (!otp) throw new Error('Không lấy được OTP (timeout)');
    log(`OTP: ${otp}`, 'hi');

    const otpInput = findOtpInput();
    if (otpInput) {
      setVal(otpInput, otp);
    } else {
      const boxes = Array.from(document.querySelectorAll('input')).filter(
        i => vis(i) && i.maxLength === 1 && !['password','checkbox','radio','hidden'].includes(i.type)
      );
      if (boxes.length >= otp.length) {
        for (let j = 0; j < boxes.length && j < otp.length; j++) { setVal(boxes[j], otp[j]); await wt(80); }
      } else {
        const all = Array.from(document.querySelectorAll('input')).filter(
          i => vis(i) && !['password','checkbox','radio','hidden','email','submit','button'].includes(i.type)
        );
        const emailInputs2 = findEmailInputs();
        const fallback = all.find(i => !emailInputs2.includes(i));
        if (!fallback) throw new Error('Không tìm thấy ô nhập OTP');
        setVal(fallback, otp);
      }
    }

    const { pass: passField, confirm: confirmField } = findPasswordFields();
    if (passField)    setVal(passField,    currentPass);
    if (confirmField) setVal(confirmField, currentPass);
    await wt(CFG.stepDelay);

    const regBtn = findRegBtn();
    if (!regBtn) throw new Error('Không tìm thấy nút Đăng ký & Đăng nhập');

    await submitForm(regBtn);
    log('Đã bấm đăng ký/đăng nhập', 'ok');

    log('Chờ pod provisioning...', 'info');
    let podReady = false;
    const tPod = Date.now();
    while (Date.now() - tPod < CFG.podReadyTimeout) {
      await wt(1000); ck();
      if (await waitForNoLogin(1000)) { podReady = true; break; }
      if (document.querySelector('[class*="podReady" i],[class*="connected" i],[class*="streaming" i]')) {
        podReady = true; break;
      }
    }
    if (!podReady) { throw new Error('Pod không sẵn sàng hoặc đăng nhập thất bại'); }

    return { email: tempEmail, password: currentPass };
  };

  // ─────────────────────────────────────────────
  //  MAIN
  // ─────────────────────────────────────────────
  const start = async () => {
    if (running) return;
    running = true;
    const id = ++runId;

    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-claim').disabled = true;
    document.getElementById('btn-reset').disabled = true;
    document.getElementById('mfpc-log').innerHTML = '';

    try {
      if (isMKPage && !findLoginBtn() && !findEmailInputs().length) {
        log('Không thấy login UI — chuyển cloud...', 'info');
        location.replace(CFG.cloudUrl); return;
      }
      if (isLoggedIn()) {
        log('đã đăng nhập — tìm nút claim trial...', 'ok');
        await claimTrial();
        done(true); return;
      }

      await createTempMail();
      if (!running || runId !== id) return;
      const acc = await runFlow(id);
      log(`✅ Done! Email: ${acc.email}`, 'ok');
      await claimTrial();
      done(true);
    } catch (e) {
      if (runId !== id) return;
      log('Lỗi: ' + (e.message || String(e)), 'err');
      done(false);
    }
  };

  const stop = () => {
    running = false; runId++;
    minimizeToIcon(false);
    done(false);
  };

  function done(ok) {
    running = false;
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-claim').disabled = false;
    document.getElementById('btn-reset').disabled = false;
    if (ok) log('hoàn thành — MyCatPC', 'hi');
    else log('có lỗi — reset thử lại', 'warn');
  }

  function reset() {
    stop();
    document.getElementById('mfpc-mailrow').textContent = 'chưa có mail';
    document.getElementById('mfpc-log').innerHTML = '';
    tempEmail = ''; mailToken = '';
    log('reset — MyCatPC v9.1', 'hi');
  }

  // ─────────────────────────────────────────────
  //  UI — v8_4 shell, extended
  // ─────────────────────────────────────────────
  let _minimized = false;
  let _autoMin   = false;

  const minimizeToIcon = force => {
    if (force) { _autoMin = true;  applyMin(true);  }
    else if (_autoMin) { _autoMin = false; applyMin(false); }
  };

  const applyMin = m => {
    _minimized = m;
    const wrap = document.getElementById('mfpc-wrap');
    const sq   = document.getElementById('mfpc-sq');
    if (!wrap || !sq) return;
    if (m) { wrap.classList.add('hide'); sq.classList.add('show'); }
    else   { sq.classList.remove('show'); wrap.classList.remove('hide'); }
  };

  const LOG_META = {
    ok  : { icon: '✅', label: 'OK'   },
    warn: { icon: '⚠️',  label: 'WARN' },
    err : { icon: '❌', label: 'ERR'  },
    info: { icon: '🔄', label: 'INFO' },
    hi  : { icon: '🐟', label: 'SYS'  },
  };

  const log = (msg, t = 'info') => {
    const logEl = document.getElementById('mfpc-log');
    if (!logEl) return;

    const meta = LOG_META[t] || LOG_META.info;
    const now  = new Date();
    const ts   = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const row  = document.createElement('div');
    row.className = `l ${t}`;
    row.style.cssText = 'display:flex;align-items:flex-start;gap:5px;opacity:0;transition:opacity .25s;';

    const badge = document.createElement('span');
    badge.style.cssText = 'flex-shrink:0;font-size:9px;padding:1px 4px;border-radius:3px;margin-top:1px;font-weight:700;letter-spacing:.4px;';
    badge.style.background = t === 'ok' ? '#00ff8822' : t === 'err' ? '#ff444422' : t === 'warn' ? '#ffcc0022' : t === 'hi' ? '#00ffe722' : '#33333388';
    badge.style.border      = t === 'ok' ? '1px solid #00ff8844' : t === 'err' ? '1px solid #ff444444' : t === 'warn' ? '1px solid #ffcc0044' : t === 'hi' ? '1px solid #00ffe744' : '1px solid #44444444';
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

  const buildUI = () => {
    // ── Styles ──────────────────────────────────
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
      #mfpc-mailrow {
        margin:7px 10px 2px; background:#111; border:1px solid #00ffe722;
        border-radius:7px; padding:5px 8px; color:#00ffe7; font-size:10.5px;
        word-break:break-all; min-height:22px;
      }
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
      #btn-stop{flex:0 0 54px;background:#dc2626;color:#fff;display:none;}
      #btn-reset{flex:0 0 34px;background:#1a0a0a;color:#ff6666;border:1px solid #ff333322;}
      #btn-claim{background:linear-gradient(90deg,#ffb300,#ff6a00);color:#000;}
      #btn-claim-beta{font-size:7.5px;font-weight:800;letter-spacing:.5px;background:#0007;color:#fff9;padding:1px 4px;border-radius:3px;vertical-align:middle;margin-left:2px;text-transform:lowercase;}
      #mfpc-log {
        margin:0 10px 6px; background:#060606; border-radius:8px;
        padding:5px 7px 6px; max-height:160px; overflow-y:auto;
        border:1px solid #00ffe712;
        box-shadow:inset 0 1px 6px #000a;
      }
      #mfpc-log .l {
        margin-bottom:0; padding:3px 0;
        border-bottom:1px solid #ffffff07;
      }
      #mfpc-log .l:last-child { border-bottom:none; }
      .ok   span:last-child { color:#00ff88; }
      .warn span:last-child { color:#ffcc00; }
      .err  span:last-child { color:#ff5555; }
      .info span:last-child { color:#8888aa; }
      .hi   span:last-child { color:#00ffe7; }
      /* Acc list */
      .mfpc-empty { color:#2a2a2a; }
      #mfpc-foot{padding:3px 10px 6px;text-align:center;font-size:9.5px;color:#2a2a2a;border-top:1px solid #ffffff06;}
      #mfpc-panel ::-webkit-scrollbar{width:3px;}
      #mfpc-panel ::-webkit-scrollbar-thumb{background:#00ffe722;border-radius:3px;}
    `;
    document.head.appendChild(css);

    // ── Squircle icon ────────────────────────────
    const sq = document.createElement('div');
    sq.id = 'mfpc-sq'; sq.textContent = '🐟';
    document.body.appendChild(sq);

    // ── Main panel ───────────────────────────────
    const wrap = document.createElement('div');
    wrap.id = 'mfpc-wrap';
    wrap.innerHTML = `
      <div id="mfpc-panel">
        <div id="mfpc-header">
          <div><div class="mfpc-ht">Vsphone Auto</div><div class="mfpc-ha">MyCatPC v9.1</div></div>
          <div id="mfpc-min-btn">▬</div>
        </div>
        <div id="mfpc-mailrow">chưa có mail</div>

        <div id="mfpc-actions">
          <button class="mfpc-btn" id="btn-start">▶ Bắt đầu</button>
          <button class="mfpc-btn" id="btn-stop">■ Dừng</button>
          <button class="mfpc-btn" id="btn-claim">🎁 Claim Trial <span id="btn-claim-beta">beta</span></button>
          <button class="mfpc-btn" id="btn-reset">↺</button>
        </div>
        <div id="mfpc-log"></div>

        <div id="mfpc-foot">MyCatPC</div>
      </div>
    `;
    document.body.appendChild(wrap);

    // ── Drag (wrap) ──────────────────────────────
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
      dragEl.style.left = (cx - ox) + 'px'; dragEl.style.top = (cy - oy) + 'px';
      dragEl.style.right = 'auto'; dragEl.style.bottom = 'auto';
    };
    const dEnd = () => {
      if (dragEl === sq) { const jd = moved; setTimeout(() => { sq._justDragged = jd; setTimeout(() => { sq._justDragged = false; }, 150); }, 0); }
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

    // ── Button events ────────────────────────────
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

    document.getElementById('btn-start').addEventListener('click', start);
    document.getElementById('btn-stop').addEventListener('click', stop);
    document.getElementById('btn-reset').addEventListener('click', reset);

    document.getElementById('btn-claim').addEventListener('click', async () => {
      if (running) return;
      running = true; const id = ++runId;
      document.getElementById('btn-start').disabled = true;
      document.getElementById('btn-claim').disabled = true;
      document.getElementById('btn-reset').disabled = true;
      document.getElementById('mfpc-log').innerHTML = '';
      log('claim trial trực tiếp...', 'info');
      try { await claimTrial(); } catch (e) { log('Lỗi: ' + e.message, 'err'); }
      done(false);
    });

    // ── Stop btn visibility sync ─────────────────
    const syncStopBtn = () => {
      document.getElementById('btn-stop').style.display = running ? 'flex' : 'none';
    };
    syncStopBtn();
    log('ready — MyCatPC v9.1', 'hi');
  };

  // ─────────────────────────────────────────────
  //  BOOT
  // ─────────────────────────────────────────────
  const boot = () => {
    buildUI();
    if (isMKPage) {
      setTimeout(async () => {
        if (!findLoginBtn() && !findEmailInputs().length) {
          log('Không thấy login UI — chuyển cloud...', 'info');
          await sl(600);
          const last = +(GM_getValue('mfpc_redirect_ts', 0) || 0);
          if (Date.now() - last > 20000) {
            GM_setValue('mfpc_redirect_ts', Date.now());
            location.replace(CFG.cloudUrl);
          }
        }
      }, 1500);
    } else {
      log('Trang cloud phát hiện.', 'info');
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 1200);

})();
