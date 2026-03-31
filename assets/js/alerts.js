(function () {
  'use strict';

  const STORAGE_KEY = 'deliverydash_alerts_v1';

  const DEFAULT_KEYWORDS = ['مشكلة', 'تأخير', 'رفض', 'عاجل', 'لا يرد'];

  const Alerts = {};

  let _keywords = DEFAULT_KEYWORDS.slice();
  let _activeAlertsByOrderId = {}; // { [orderId]: Alert }
  const _containers = new Set();

  function _isSupabaseEnabled() {
    return Boolean(window.SupabaseClient && typeof SupabaseClient.isConfigured === 'function' && SupabaseClient.isConfigured());
  }

  function _runAsync(fn) {
    Promise.resolve()
      .then(fn)
      .catch(() => {});
  }

  function _logAudit() {}

  // ملاحظة: الصوت يحتاج عادةً إلى تفاعل المستخدم (سياسة المتصفح).
  let _audioCtx = null;
  let _soundUnlocked = false;

  function _getAudioContext() {
    if (_audioCtx) return _audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
    return _audioCtx;
  }

  function _unlockSoundOnce() {
    if (_soundUnlocked) return;
    _soundUnlocked = true;

    const ctx = _getAudioContext();
    if (!ctx) return;

    // محاولة تشغيل/استئناف الـ AudioContext عند أول تفاعل
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  function _setupSoundUnlockListener() {
    // تفعيل الصوت مرة واحدة عند أول click.
    const handler = () => {
      _unlockSoundOnce();
      document.removeEventListener('click', handler, true);
      document.removeEventListener('touchstart', handler, true);
    };

    document.addEventListener('click', handler, true);
    document.addEventListener('touchstart', handler, true);
  }

  function _playAlertBeep() {
    const ctx = _getAudioContext();
    if (!ctx) return;

    // حتى لو لم يتم unlock بشكل مسبق، سنحاول الاستئناف.
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t0);
    master.connect(ctx.destination);
    master.gain.exponentialRampToValueAtTime(1.0, t0 + 0.01);
    master.gain.exponentialRampToValueAtTime(0.001, t0 + 0.60);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4200, t0);
    filter.Q.value = 0.8;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 30;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    filter.connect(comp);
    comp.connect(master);

    function voice(freq, startTime, dur, peak){
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      const g = ctx.createGain();
      const a = Math.max(0.006, Math.min(0.02, dur * 0.08));
      const p = Math.max(0.10, Math.min(0.28, peak || 0.22));
      g.gain.setValueAtTime(0.0001, startTime);
      g.gain.exponentialRampToValueAtTime(p, startTime + a);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
      osc.connect(g).connect(filter);
      osc.start(startTime);
      osc.stop(startTime + dur + 0.02);
    }

    const d = 0.48;
    voice(880.00, t0, d, 0.32);
    voice(1108.73, t0, d, 0.30);
    voice(1318.51, t0, d, 0.28);
    voice(1760.00, t0 + 0.04, 0.30, 0.20);
    voice(2093.00, t0 + 0.06, 0.22, 0.14);
  }

  function _getSupportNumber() {
    const v = typeof window.SUPPORT_WHATSAPP_NUMBER === 'string' ? window.SUPPORT_WHATSAPP_NUMBER.trim() : '';
    return v;
  }

  function _openSupportWhatsApp(alert) {
    const supportNumber = _getSupportNumber();
    if (!supportNumber) return false;

    const orderId = alert && alert.orderId ? String(alert.orderId) : '';
    const keyword = alert && alert.keyword ? String(alert.keyword) : '';
    const snippet = alert && alert.snippet ? String(alert.snippet) : '';

    const text = `طلب تدخل عاجل\nرقم الطلب: ${orderId}\nالسبب: ${keyword}\nالملخص: ${snippet}\nرابط التفاصيل: ${window.location.origin}${window.location.pathname.replace(/[^/]+$/, '')}order-details.html?id=${encodeURIComponent(orderId)}`;
    const url = Utils.toWhatsAppLink(supportNumber, text);
    if (!url || url === '#') return false;

    try {
      window.open(url, 'support-whatsapp', 'width=430,height=720,noopener,noreferrer');
      return true;
    } catch {
      return false;
    }
  }

  function _persist() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(_activeAlertsByOrderId));
  }

  function _loadPersisted() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = Utils.safeJsonParse(raw, null);
    if (!parsed || typeof parsed !== 'object') return;
    _activeAlertsByOrderId = parsed;
  }

  async function _loadKeywords() {
    const sb = _isSupabaseEnabled() ? SupabaseClient.getClient() : null;
    if (sb) {
      try {
        const res = await sb
          .from('keywords')
          .select('keyword, is_active')
          .eq('is_active', true)
          .order('keyword', { ascending: true });

        if (!res.error) {
          const items = Array.isArray(res.data) ? res.data : [];
          const list = items.map((r) => (r && r.keyword ? String(r.keyword).trim() : '')).filter(Boolean);
          if (list.length) {
            _keywords = Array.from(new Set(list));
            return;
          }
        }
      } catch {}
    }

    try {
      const res = await fetch('assets/data/keywords.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load keywords.json');
      const data = await res.json();
      if (!data || !Array.isArray(data.keywords)) throw new Error('Invalid keywords.json format');
      _keywords = data.keywords.filter(Boolean);
    } catch {
      _keywords = DEFAULT_KEYWORDS.slice();
    }
  }

  function _renderToContainer(container) {
    const activeAlerts = Object.values(_activeAlertsByOrderId)
      .filter((a) => a && !a.resolvedAt)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (!activeAlerts.length) {
      container.innerHTML = '';
      return;
    }

    const html = activeAlerts
      .map((alert) => {
        const orderId = Utils.escapeHtml(alert.orderId);
        const keyword = Utils.escapeHtml(alert.keyword);
        const snippet = Utils.escapeHtml(alert.snippet || '');
        const when = Utils.formatDateTime(alert.createdAt);

        return `
          <div class="alert alert-danger d-flex justify-content-between align-items-start gap-2" role="alert">
            <div>
              <div class="fw-bold">تنبيه: كلمة مفتاحية (${keyword})</div>
              <div class="small mt-1">طلب رقم <span class="fw-semibold">${orderId}</span> • ${when}</div>
              <div class="small mt-2 text-dark">${snippet}</div>
            </div>
            <div class="d-flex flex-column gap-2">
              <a class="btn btn-light btn-sm border" href="order-details.html?id=${encodeURIComponent(alert.orderId)}">تفاصيل</a>
              <button class="btn btn-warning btn-sm" data-action="intervene" data-order-id="${orderId}">
                طلب تدخل
              </button>
              <button class="btn btn-outline-light btn-sm border" data-action="resolve-alert" data-order-id="${orderId}">
                تم حل المشكلة
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    container.classList.add('alerts-area');
    container.innerHTML = html;
  }

  function _renderAll() {
    _containers.forEach((el) => _renderToContainer(el));
  }

  function _findKeyword(text) {
    const msg = String(text || '').trim();
    if (!msg) return null;

    return _keywords.find((k) => msg.includes(k)) || null;
  }

  Alerts.init = async () => {
    _loadPersisted();
    await _loadKeywords();
    _setupSoundUnlockListener();

    if (window.Realtime) {
      Realtime.on(Realtime.Events.MESSAGE_RECEIVED, ({ orderId, message }) => {
        Alerts.checkMessageForAlert(orderId, message);
      });

      // استمع لأحداث حلّ التنبيه القادمة من باقي العملاء عبر Realtime
      Realtime.on(Realtime.Events.ALERT_RESOLVED, ({ orderId, alert: incomingAlert }) => {
        const key = String(orderId || '');
        if (!key) return;
        const localAlert = _activeAlertsByOrderId[key];
        if (!localAlert || localAlert.resolvedAt) return;
        localAlert.resolvedAt = Utils.nowIso();
        try {
          const byName = incomingAlert && incomingAlert.resolvedByName ? String(incomingAlert.resolvedByName).trim() : '';
          if (byName) localAlert.resolvedByName = byName;
        } catch {}
        _persist();
        _renderAll();
      });
    }

    _renderAll();
  };

  Alerts.setContainer = (containerEl) => {
    if (!containerEl) return;

    if (!_containers.has(containerEl)) {
      _containers.add(containerEl);

      // Delegation: أزرار حل المشكلة
      containerEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="resolve-alert"]');
        if (!btn) return;
        const orderId = btn.getAttribute('data-order-id');
        try {
          if (window.Auth && typeof Auth.getSession === 'function') {
            Auth.getSession()
              .then((s) => {
                const nm = s && s.name ? String(s.name).trim() : '';
                Alerts.resolve(orderId, nm || null);
              })
              .catch(() => { Alerts.resolve(orderId); });
          } else {
            Alerts.resolve(orderId);
          }
        } catch {
          Alerts.resolve(orderId);
        }
      });

      containerEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="intervene"]');
        if (!btn) return;
        const orderId = btn.getAttribute('data-order-id');
        const alert = Alerts.getActiveAlert(orderId);
        _openSupportWhatsApp(alert);
      });
    }

    _renderToContainer(containerEl);
  };

  Alerts.hasActiveAlert = (orderId) => {
    const key = String(orderId);
    return Boolean(_activeAlertsByOrderId[key] && !_activeAlertsByOrderId[key].resolvedAt);
  };

  Alerts.getActiveAlert = (orderId) => {
    const key = String(orderId);
    const alert = _activeAlertsByOrderId[key];
    if (!alert || alert.resolvedAt) return null;
    return alert;
  };

  Alerts.getAlert = (orderId) => {
    const key = String(orderId);
    return _activeAlertsByOrderId[key] || null;
  };

  Alerts.createAlert = (orderId, keyword, text) => {
    const key = String(orderId);

    // لا ننشئ تنبيه جديد إذا كان هناك تنبيه فعّال لنفس الطلب.
    if (Alerts.hasActiveAlert(key)) return;

    const createdAt = Utils.nowIso();
    const alert = {
      id: `a-${Date.now()}`,
      orderId: key,
      keyword,
      snippet: Utils.truncate(text, 120),
      createdAt,
      resolvedAt: null,
    };

    _activeAlertsByOrderId[key] = alert;
    _persist();
    _renderAll();

    // الصوت يعمل مرة واحدة عند وقوع الحدث (إنشاء تنبيه جديد)
    _playAlertBeep();

    _logAudit('alert_created', { orderId: key, keyword, text: Utils.truncate(text, 220) });

    if (window.Realtime) {
      Realtime.emit(Realtime.Events.ALERT_CREATED, { alert });
    }
  };

  Alerts.resolve = (orderId) => {
    const key = String(orderId);
    let alert = _activeAlertsByOrderId[key];
    if (!alert) {
      alert = {
        id: `m-${Date.now()}`,
        orderId: key,
        keyword: null,
        snippet: '',
        createdAt: Utils.nowIso(),
        resolvedAt: null,
      };
      _activeAlertsByOrderId[key] = alert;
    }
    if (alert.resolvedAt) return;

    alert.resolvedAt = Utils.nowIso();
    try {
      const meta = arguments.length > 1 ? arguments[1] : null;
      let byName = '';
      if (typeof meta === 'string') byName = meta;
      else if (meta && typeof meta === 'object' && meta.byName) byName = String(meta.byName);
      byName = String(byName || '').trim();
      if (byName) alert.resolvedByName = byName;
    } catch {}
    _persist();
    _renderAll();

    (async function () {
      try {
        if (!window.SupabaseClient || typeof SupabaseClient.isConfigured !== 'function' || !SupabaseClient.isConfigured()) return;
        const sb = SupabaseClient.getClient();
        if (!sb) return;
        const hasSession = sb.auth && typeof sb.auth.getSession === 'function' ? (await sb.auth.getSession()) : null;
        const ok = hasSession && hasSession.data && hasSession.data.session;
        if (!ok) return;
        await sb.rpc('tracking_log_resolution', { p_order_id: Number(key) });
      } catch (e) {}
    })();

    _logAudit('alert_resolved', { orderId: key, keyword: alert.keyword || null });

    if (window.Realtime) {
      Realtime.emit(Realtime.Events.ALERT_RESOLVED, { orderId: key, alert });
      if (typeof Realtime.broadcast === 'function') {
        // بثّ الحدث لكل العملاء المتصلين لكي تختفي البطاقة عندهم أيضًا
        Realtime.broadcast('alert_resolved', { orderId: key });
      }
    }
  };

  Alerts.checkMessageForAlert = (orderId, message) => {
    if (!message || message.type !== 'text') return;

    const keyword = _findKeyword(message.text);
    if (!keyword) return;

    Alerts.createAlert(orderId, keyword, message.text);
  };

  window.Alerts = Alerts;
})();
