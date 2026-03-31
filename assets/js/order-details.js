(function () {
  'use strict';

  const OrderDetailsPage = {};

  const els = {
    orderId: null,
    status: null,
    customerName: null,
    agentName: null,
    agentPhone: null,
    customerPhone: null,
    pageName: null,
    pageWhatsApp: null,
    pageGroupId: null,
    awaiting: null,
    lastMessage: null,
    updatedAt: null,
    whatsApp: null,
    call: null,
    customerWhatsApp: null,
    customerCall: null,

    conversation: null,
    detailsAlert: null,

    sendForm: null,
    msgRecipient: null,
    msgText: null,
    sendAlert: null,
    sendBtn: null,
    btnAttachImage: null,
    btnAttachAudio: null,
    fileImage: null,
    fileAudio: null,
    audioRecordUI: null,
    audioRecordStatus: null,
    btnStopRecording: null,
    btnSendRecording: null,
    btnCancelRecording: null,
    audioRecordPreviewWrap: null,
    audioRecordPreview: null,

    timelineList: null,

    orderAlertCard: null,
    orderAlertContent: null,
    orderAlertResolve: null,
    orderAlertIntervene: null,
  };

  let currentOrderId = null;

  function _showError(msg) {
    if (!els.detailsAlert) return;
    els.detailsAlert.textContent = msg;
    els.detailsAlert.classList.remove('d-none');
  }

  function _hideError() {
    if (!els.detailsAlert) return;
    els.detailsAlert.classList.add('d-none');
    els.detailsAlert.textContent = '';
  }

  function _lastMessageSummary(order) {
    const conv = Array.isArray(order.conversation) ? order.conversation : [];
    if (!conv.length) return '—';

    const last = conv[conv.length - 1];
    if (last.type === 'text') return last.text || '—';
    if (last.type === 'image') return 'صورة';
    if (last.type === 'audio') return 'تسجيل صوتي';
    return 'رسالة';
  }

  function _statusBadge(status) {
    const s = String(status || '').trim();
    const map = {
      'معلق': 'warning',
      'قيد التنفيذ': 'primary',
      'جاري التوصيل': 'primary',
      'رفض عند الوصول': 'danger',
      'تم التسليم': 'success',
      'مشكلة': 'danger',
      'مرفوض': 'dark',
      'ملغي': 'secondary',
    };
    const color = map[s] || 'light';
    const isKnown = Object.prototype.hasOwnProperty.call(map, s);
    const textClass = color === 'light' ? 'text-dark' : '';
    const weight = isKnown ? '' : 'fw-bold';
    return `<span class="badge text-bg-${color} ${textClass} ${weight} badge-status">${Utils.escapeHtml(s || '—')}</span>`;
  }

  function _statusSummary(order) {
    const s = String(order.status || '').trim();
    const showRejected = Boolean(order.rejectedOnArrival) && s !== 'رفض عند الوصول';
    const showPriceChanged = Boolean(order.priceChanged) && !s.includes('تعديل سعر');
    const parts = [_statusBadge(order.status)];
    if (showRejected) parts.push('<span class="badge text-bg-danger">رفض عند الوصول</span>');
    if (showPriceChanged) parts.push('<span class="badge text-bg-warning text-dark">تعديل سعر</span>');
    return parts.join(' ');
  }

  // تشغيل صوت بسيط (تجريبي) لمقاطع الصوت.
  let audioCtx = null;
  function _getAudioCtx() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function _playDemoAudio(durationSec = 1.2) {
    const ctx = _getAudioCtx();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = 520;

    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const t0 = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.15, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

    osc.start(t0);
    osc.stop(t0 + durationSec + 0.05);
  }

  function _ensureIntlPhone(phone) {
    const d = String(phone || '').replace(/[^0-9]/g, '');
    if (!d) return '';
    if (d.startsWith('00')) return d.slice(2);
    const sup = String(window.SUPPORT_WHATSAPP_NUMBER || '').replace(/[^0-9]/g, '');
    let cc = '';
    if (sup && sup.length > 9) cc = sup.slice(0, sup.length - 9);
    if (!cc) cc = '962';
    if (d.startsWith(cc)) return d;
    if (d.startsWith('0')) return cc + d.replace(/^0+/, '');
    if (d.length <= 9) return cc + d;
    return d;
  }

  function _normalizeWaTo(value) {
    const s = String(value || '').trim();
    if (!s) return '';
    if (/@g\.us$/i.test(s)) return s;
    if (/@c\.us$/i.test(s)) return s.replace(/[^0-9]/g, '');
    return _ensureIntlPhone(s);
  }

  function _resolveWaTo(order, rec) {
    if (!order) return '';
    const r = String(rec || 'agent');
    if (r === 'agent') return _normalizeWaTo(order.agentPhone || '');
    if (r === 'customer') return _normalizeWaTo(order.customerPhone || '');
    if (r === 'page') {
      const pg = String(order.pageWhatsApp || '').trim();
      if (!/@g\.us$/i.test(pg)) return '';
      return _normalizeWaTo(pg);
    }
    return '';
  }

  function _escapeAndLinkifyText(input) {
    const raw = String(input || '');
    if (!raw) return '';
    const re = /https?:\/\/[^\s]+/gi;
    let out = '';
    let last = 0;
    raw.replace(re, (m, idx) => {
      const offset = Number(idx) || 0;
      if (offset > last) out += Utils.escapeHtml(raw.slice(last, offset));
      const href = String(m || '');
      const safeHref = Utils.escapeHtml(href);
      const safeText = Utils.escapeHtml(href);
      out += `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"><span class="chat__ltr">${safeText}</span></a>`;
      last = offset + href.length;
      return m;
    });
    if (last < raw.length) out += Utils.escapeHtml(raw.slice(last));
    return out;
  }

  function _shouldPreviewImageUrl(url) {
    const u = String(url || '');
    if (!u) return false;
    if (/amazonaws\.com\/ultramsgmedia\//i.test(u)) return true;
    if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(u)) return true;
    return false;
  }

  function _renderConversation(order) {
    if (!els.conversation) return;

    const conv = Array.isArray(order.conversation) ? order.conversation : [];

    if (!conv.length) {
      els.conversation.innerHTML = '<div class="text-center text-muted py-3">لا توجد رسائل.</div>';
      return;
    }

    const html = conv
      .map((m) => {
        const from = String(m.from || '');
        const isMine = (from !== 'tracking');
        const alignClass = isMine ? 'chat__msg chat__msg--me' : 'chat__msg';
        const byName = (from === 'tracking' && m && m.byName) ? String(m.byName) : '';
        const fromLabel = (from === 'agent') ? 'المندوب'
          : (from === 'customer') ? 'العميل'
            : (from === 'tracking') ? (byName ? `قسم المتابعة (${byName})` : 'قسم المتابعة')
              : 'الصفحة';
        const meta = `${fromLabel} • ${Utils.formatDateTime(m.ts)}`;

        let body = '';
        if (m.type === 'text') {
          let txt = String(m.text || '');
          if (!txt.trim() && m && typeof m.src === 'string' && /^https?:\/\//i.test(m.src)) {
            txt = String(m.src);
          }
          const urls = (txt.match(/https?:\/\/[^\s]+/gi) || []).map((x) => String(x || '').trim()).filter(Boolean);
          const onlyUrl = urls.length === 1 && txt.trim() === urls[0];
          if (onlyUrl && _shouldPreviewImageUrl(urls[0])) {
            const u = urls[0];
            const safeU = Utils.escapeHtml(u);
            body = `
              <div class="chat__bubble chat__bubble--media chat__bubble--image-only">
                <a href="${safeU}" target="_blank" rel="noopener noreferrer">
                  <img src="${safeU}" class="img-fluid rounded border" alt="صورة" onerror="this.style.display='none';var fb=this.parentElement&&this.parentElement.parentElement?this.parentElement.parentElement.querySelector('[data-fallback]'):null;if(fb)fb.classList.remove('d-none');" />
                </a>
                <div class="small mt-2 d-none" data-fallback>
                  <a href="${safeU}" target="_blank" rel="noopener noreferrer"><span class="chat__ltr">${safeU}</span></a>
                </div>
              </div>
            `;
          } else {
            body = `<div class="chat__bubble chat__bubble--text">${_escapeAndLinkifyText(txt)}</div>`;
          }
        } else if (m.type === 'image') {
          const cap = String(m.text || '').trim();
          body = `
            <div class="chat__bubble chat__bubble--media chat__bubble--image-only">
              <a href="${Utils.escapeHtml(m.src || '')}" target="_blank" rel="noopener">
                <img src="${Utils.escapeHtml(m.src || '')}" class="img-fluid rounded border" alt="صورة" />
              </a>
              ${cap ? `<div class="chat__caption mt-2">${_escapeAndLinkifyText(cap)}</div>` : ''}
            </div>
          `;
        } else if (m.type === 'audio') {
          const duration = Number(m.durationSec || 5);
          if (m.src) {
            body = `
              <div class="chat__bubble">
                <div class="small text-secondary mb-2">تسجيل صوتي</div>
                <audio controls preload="none" src="${Utils.escapeHtml(m.src)}"></audio>
              </div>
            `;
          } else {
            body = `
              <div class="chat__bubble">
                <div class="d-flex align-items-center justify-content-between gap-2">
                  <div>
                    <div class="small text-secondary">تسجيل صوتي</div>
                    <div class="fw-semibold">مدة تقريبية: ${Utils.escapeHtml(duration)} ث</div>
                  </div>
                  <button class="btn btn-primary btn-sm" type="button" data-action="play-audio" data-duration="${Utils.escapeHtml(duration)}">
                    تشغيل
                  </button>
                </div>
              </div>
            `;
          }
        } else {
          body = `<div class="chat__bubble">رسالة غير مدعومة</div>`;
        }

        return `
          <div class="${alignClass}">
            ${body}
            <div class="chat__meta">${Utils.escapeHtml(meta)}</div>
          </div>
        `;
      })
      .join('');

    els.conversation.innerHTML = html;

    // تشغيل المقاطع الصوتية التجريبية
    els.conversation.querySelectorAll('[data-action="play-audio"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = Number(btn.getAttribute('data-duration') || 5);
        _playDemoAudio(Math.min(Math.max(d, 1), 10));
      });
    });

    // اسكرول لآخر رسالة
    els.conversation.scrollTop = els.conversation.scrollHeight;
  }

  function _isRelevantChange(t) {
    const status = String((t && t.status) || '');
    const note = String((t && t.note) || '');

    if (status.includes('مرفوض') || note.includes('رفض عند الوصول') || note.includes('رفض')) return true;
    if (note.includes('تعديل سعر') || status.includes('تعديل سعر')) return true;
    return false;
  }

  function _renderTimeline(order) {
    if (!els.timelineList) return;

    const timeline = (Array.isArray(order.timeline) ? order.timeline : []).filter(_isRelevantChange);
    try {
      const orderId = order && order.id != null ? String(order.id) : '';
      const a = (window.Alerts && typeof Alerts.getAlert === 'function') ? Alerts.getAlert(orderId) : null;
      if (a && a.resolvedAt) {
        const issue = (a && a.keyword) ? String(a.keyword).trim() : ((a && a.snippet) ? String(a.snippet).trim() : '');
        const byName = (a && a.resolvedByName) ? String(a.resolvedByName).trim() : '';
        timeline.push({ status: 'تم حل المشكلة', ts: a.resolvedAt, note: 'تم حل المشكلة', issue, byName });
      }
    } catch {}

    if (!timeline.length) {
      els.timelineList.innerHTML = '<li class="timeline__item text-muted">لا يوجد خط زمني.</li>';
      return;
    }

    const html = timeline
      .slice()
      .sort((a, b) => (a.ts || '').localeCompare(b.ts || ''))
      .map((t) => {
        const isResolved = String((t && t.status) || '') === 'تم حل المشكلة';
        const itemClass = isResolved ? 'timeline__item timeline__item--resolved' : 'timeline__item';
        const titleClass = isResolved ? 'timeline__title text-success' : 'timeline__title';
        const when = Utils.escapeHtml(Utils.formatDateTime(t.ts));
        const whenHtml = isResolved
          ? `<span class="chat__ltr fw-bold">${when}</span>`
          : `<span class="chat__ltr">${when}</span>`;

        const byNameRaw = t && typeof t.byName === 'string' ? t.byName.trim() : '';
        const byNameHtml = byNameRaw ? ` <span class="text-muted">(${Utils.escapeHtml(byNameRaw)})</span>` : '';
        const issueRaw = t && typeof t.issue === 'string' ? t.issue.trim() : '';
        const issueHtml = issueRaw ? ` <span class="text-muted">(<code>${Utils.escapeHtml(issueRaw)}</code>)</span>` : '';
        const titleHtml = isResolved
          ? `${Utils.escapeHtml(t.status || '—')}${byNameHtml}${issueHtml}`
          : `${Utils.escapeHtml(t.status || '—')}`;
        return `
          <li class="${itemClass}">
            <div class="${titleClass}">${titleHtml}</div>
            <div class="timeline__meta mt-1">${whenHtml}</div>
            <div class="small mt-2 text-muted">${Utils.escapeHtml(t.note || '')}</div>
          </li>
        `;
      })
      .join('');

    els.timelineList.innerHTML = html;
  }

  function _getSupportNumber() {
    const v = typeof window.SUPPORT_WHATSAPP_NUMBER === 'string' ? window.SUPPORT_WHATSAPP_NUMBER.trim() : '';
    return v;
  }

  function _openSupportWhatsAppAlert(alert) {
    const supportNumber = _getSupportNumber();
    if (!supportNumber) return false;

    const orderId = alert && alert.orderId ? String(alert.orderId) : '';
    const keyword = alert && alert.keyword ? String(alert.keyword) : '';
    const snippet = alert && alert.snippet ? String(alert.snippet) : '';

    const base = window.location.origin + window.location.pathname.replace(/[^/]+$/, '');
    const detailsUrl = `${base}order-details.html?id=${encodeURIComponent(orderId)}`;
    const text = `طلب تدخل عاجل\nرقم الطلب: ${orderId}\nالسبب: ${keyword}\nالملخص: ${snippet}\nرابط التفاصيل: ${detailsUrl}`;

    try {
      const url = Utils.toWhatsAppLink(supportNumber, text);
      if (!url || url === '#') return false;
      window.open(url, 'support-whatsapp', 'width=430,height=720,noopener,noreferrer');
      return true;
    } catch {
      return false;
    }
  }

  function _renderOrderAlert(order) {
    if (!els.orderAlertCard || !els.orderAlertContent) return;

    const orderId = order && order.id != null ? String(order.id) : '';
    const alert = (window.Alerts && typeof Alerts.getActiveAlert === 'function') ? Alerts.getActiveAlert(orderId) : null;
    const anyAlert = (window.Alerts && typeof Alerts.getAlert === 'function') ? Alerts.getAlert(orderId) : null;
    const resolved = Boolean(anyAlert && anyAlert.resolvedAt);
    const show = Boolean(alert) || (Boolean(order && order.hasIssue) && !resolved);

    els.orderAlertCard.classList.toggle('d-none', !show);
    if (!show) return;

    const keyword = alert && alert.keyword ? String(alert.keyword) : '';
    const snippet = alert && alert.snippet ? String(alert.snippet) : '';
    const createdAt = alert && alert.createdAt ? String(alert.createdAt) : '';

    if (alert) {
      els.orderAlertContent.innerHTML = `
        <div class="alert alert-danger mb-0" role="alert">
          <div class="fw-bold">تنبيه: كلمة مفتاحية (${Utils.escapeHtml(keyword || '—')})</div>
          <div class="small mt-1">طلب رقم <span class="fw-semibold">${Utils.escapeHtml(orderId)}</span> • ${Utils.escapeHtml(Utils.formatDateTime(createdAt))}</div>
          <div class="small mt-2 text-body">${Utils.escapeHtml(snippet || '')}</div>
        </div>
      `;
    } else {
      els.orderAlertContent.innerHTML = `
        <div class="alert alert-warning mb-0" role="alert">
          <div class="fw-bold">تنبيه</div>
          <div class="small mt-2 text-body">تم تعليم الطلب كمشكلة.</div>
        </div>
      `;
    }

    if (els.orderAlertIntervene) {
      els.orderAlertIntervene.classList.toggle('d-none', !_getSupportNumber() || !alert);
    }
  }

  function _render(order) {
    _hideError();

    Utils.setText(els.orderId, order.id);
    if (els.status) {
      els.status.innerHTML = _statusSummary(order);
    }
    Utils.setText(els.customerName, order.customerName || '—');
    Utils.setText(els.customerPhone, order.customerPhone || '—');
    if (els.customerWhatsApp) {
      const p = order.customerPhone;
      els.customerWhatsApp.href = p ? Utils.toWhatsAppLink(p, `بخصوص الطلب رقم ${order.id}`) : '#';
      els.customerWhatsApp.classList.toggle('d-none', !p);
    }
    if (els.customerCall) {
      const p = order.customerPhone;
      els.customerCall.href = p ? Utils.toTelLink(p) : '#';
      els.customerCall.classList.toggle('d-none', !p);
    }
    Utils.setText(els.agentName, order.agentName || '—');
    Utils.setText(els.agentPhone, order.agentPhone || '—');
    Utils.setText(els.pageName, order.pageName || '—');
    if (els.pageWhatsApp) {
      const groupId = String(order.pageWhatsApp || '').trim();
      const okGroup = Boolean(groupId) && /@g\.us$/i.test(groupId);
      els.pageWhatsApp.href = okGroup ? Utils.toWhatsAppLink(groupId, `بخصوص الطلب رقم ${order.id}`) : '#';
      try {
        if (okGroup) els.pageWhatsApp.setAttribute('title', groupId);
        else els.pageWhatsApp.removeAttribute('title');
      } catch {}
      els.pageWhatsApp.classList.toggle('disabled', !okGroup);
      els.pageWhatsApp.classList.toggle('opacity-50', !okGroup);
      if (!okGroup) {
        els.pageWhatsApp.setAttribute('aria-disabled', 'true');
        els.pageWhatsApp.setAttribute('tabindex', '-1');
      } else {
        els.pageWhatsApp.removeAttribute('aria-disabled');
        els.pageWhatsApp.removeAttribute('tabindex');
      }
    }
    if (els.pageGroupId) {
      const groupId = String(order.pageWhatsApp || '').trim();
      const okGroup = Boolean(groupId) && /@g\.us$/i.test(groupId);
      Utils.setText(els.pageGroupId, okGroup ? groupId : '—');
    }
    if (els.awaiting) {
      Utils.setText(els.awaiting, order.awaitingPageReply ? 'نعم' : 'لا');
    }
    Utils.setText(els.lastMessage, _lastMessageSummary(order));
    Utils.setText(els.updatedAt, Utils.formatDateTime(order.updatedAt));

    if (els.whatsApp) {
      els.whatsApp.href = Utils.toWhatsAppLink(order.agentPhone, `بخصوص الطلب رقم ${order.id}`);
    }

    if (els.call) {
      els.call.href = Utils.toTelLink(order.agentPhone);
    }

    _renderConversation(order);
    _renderTimeline(order);
    _renderOrderAlert(order);
  }

  function _buildOutboundText(orderId, rawText) {
    const t = String(rawText || '').trim();
    const id = orderId != null ? String(orderId) : '';
    if (!t) return '';
    return `بخصوص رقم الطلب ${id}\n${t}`;
  }

  function _buildOutboundPrefix(orderId) {
    const id = orderId != null ? String(orderId) : '';
    return `بخصوص رقم الطلب ${id}`;
  }

  function _showSendError(msg) {
    if (!els.sendAlert) return;
    let s = '';
    try {
      if (typeof msg === 'string' && msg.trim()) s = msg;
      else if (msg && typeof msg.message === 'string' && msg.message.trim()) s = msg.message;
      else {
        const seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
        const safe = JSON.stringify(msg, (k, v) => {
          if (seen && v && typeof v === 'object') {
            if (seen.has(v)) return '[Circular]';
            seen.add(v);
          }
          return v;
        });
        s = safe || '';
      }
    } catch {
      try { s = String(msg); } catch { s = 'خطأ غير معروف.'; }
    }
    if (!s || s === '[object Object]') s = 'تعذر إرسال واتساب.';
    let extra = '';
    try {
      const e = window && window.__lastFfmpegError;
      if (e && /تعذر تحويل الصوت/i.test(s)) {
        const raw = (e && e.message) ? String(e.message) : String(e);
        const m = raw && raw !== '[object Object]' ? raw : '';
        let core = '';
        try { core = window && window.__ffmpegCorePathUsed ? String(window.__ffmpegCorePathUsed) : ''; } catch {}
        const parts = [];
        if (m) parts.push(m.length > 180 ? `${m.slice(0, 180)}…` : m);
        if (core) parts.push(core);
        if (parts.length) extra = ` (${parts.join(' | ')})`;
      }
    } catch {}
    els.sendAlert.textContent = (s || 'حدث خطأ.') + extra;
    els.sendAlert.classList.remove('d-none');
  }

  function _hideSendError() {
    if (!els.sendAlert) return;
    els.sendAlert.classList.add('d-none');
    els.sendAlert.textContent = '';
  }

  function _readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('فشل قراءة الملف'));
      reader.readAsDataURL(file);
    });
  }

  function _getAudioDuration(dataUrl) {
    return new Promise((resolve) => {
      const a = new Audio();
      a.preload = 'metadata';
      a.src = dataUrl;
      const done = (v) => {
        a.removeAttribute('src');
        try { a.load(); } catch {}
        resolve(v);
      };
      a.onloadedmetadata = () => {
        const d = Number(a.duration);
        resolve(Number.isFinite(d) && d > 0 ? Math.round(d) : null);
      };
      a.onerror = () => done(null);
    });
  }

  let _rec = {
    stream: null,
    mediaRecorder: null,
    chunks: [],
    blob: null,
    blobUrl: null,
    startedAt: 0,
    durationSec: null,
    active: false,
  };

  function _setRecordUI(visible) {
    if (!els.audioRecordUI) return;
    els.audioRecordUI.classList.toggle('d-none', !visible);
  }

  function _updateRecordStatus(txt) {
    if (els.audioRecordStatus) els.audioRecordStatus.textContent = txt || '';
  }

  function _previewRecording(url) {
    if (!els.audioRecordPreview || !els.audioRecordPreviewWrap) return;
    els.audioRecordPreview.src = url || '';
    els.audioRecordPreviewWrap.classList.toggle('d-none', !url);
  }

  async function _startRecording() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        _showSendError('الميكروفون غير مدعوم في هذا المتصفح.');
        return;
      }
      _hideSendError();
      _setRecordUI(true);
      _updateRecordStatus('جاري بدء التسجيل...');
      if (els.btnStopRecording) els.btnStopRecording.classList.remove('d-none');
      if (els.btnSendRecording) els.btnSendRecording.classList.add('d-none');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimePreferred = (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus'))
        ? 'audio/ogg;codecs=opus'
        : (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
          ? 'audio/webm;codecs=opus'
          : undefined;
      const mr = mimePreferred ? new MediaRecorder(stream, { mimeType: mimePreferred }) : new MediaRecorder(stream);
      _rec = { stream, mediaRecorder: mr, chunks: [], blob: null, blobUrl: null, startedAt: Date.now(), durationSec: null, active: true };
      _previewRecording('');

      mr.ondataavailable = (e) => {
        if (e && e.data && e.data.size) _rec.chunks.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(_rec.chunks, { type: mr.mimeType || 'audio/webm' });
        _rec.blob = blob;
        const url = URL.createObjectURL(blob);
        _rec.blobUrl = url;
        const approx = Math.max(1, Math.round((Date.now() - _rec.startedAt) / 1000));
        _rec.durationSec = approx;
        _updateRecordStatus('تم التسجيل. استمع ثم أرسل.');
        if (els.btnStopRecording) els.btnStopRecording.classList.add('d-none');
        if (els.btnSendRecording) els.btnSendRecording.classList.remove('d-none');
        _previewRecording(url);
      };

      mr.start();
      _updateRecordStatus('يسجّل الآن...');
    } catch (err) {
      _showSendError('تعذّر بدء التسجيل من الميكروفون.');
    }
  }

  function _stopRecording() {
    try {
      if (_rec && _rec.mediaRecorder && _rec.mediaRecorder.state === 'recording') {
        _rec.mediaRecorder.stop();
      }
      if (_rec && _rec.stream) {
        _rec.stream.getTracks().forEach((t) => {
          try { t.stop(); } catch {}
        });
      }
    } catch {}
  }

  function _resetRecording() {
    _stopRecording();
    if (_rec && _rec.blobUrl) {
      try { URL.revokeObjectURL(_rec.blobUrl); } catch {}
    }
    _rec = { stream: null, mediaRecorder: null, chunks: [], blob: null, blobUrl: null, startedAt: 0, durationSec: null, active: false };
    _previewRecording('');
    _setRecordUI(false);
    _updateRecordStatus('');
    if (els.btnStopRecording) els.btnStopRecording.classList.add('d-none');
    if (els.btnSendRecording) els.btnSendRecording.classList.add('d-none');
  }

  function _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('فشل تحويل الصوت')); 
      reader.readAsDataURL(blob);
    });
  }

  async function _blobToUint8(blob) {
    const ab = await blob.arrayBuffer();
    return new Uint8Array(ab);
  }

  let _ffmpegState = { instance: null, loading: null };

  function _loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      try {
        const scripts = document.getElementsByTagName('script');
        let existing = null;
        for (let i = 0; i < scripts.length; i++) {
          const s = scripts[i];
          const a = s.getAttribute('src');
          if (a === src || s.src === src) { existing = s; break; }
        }
        if (existing) {
          if (existing.getAttribute('data-loaded') === '1') return resolve();
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('فشل تحميل أداة التحويل.')), { once: true });
          return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.addEventListener('load', () => {
          try { s.setAttribute('data-loaded', '1'); } catch {}
          resolve();
        }, { once: true });
        s.addEventListener('error', () => reject(new Error('فشل تحميل أداة التحويل.')), { once: true });
        document.head.appendChild(s);
      } catch {
        reject(new Error('فشل تحميل أداة التحويل.'));
      }
    });
  }

  async function _getFfmpeg() {
    if (_ffmpegState.instance) return _ffmpegState.instance;
    if (_ffmpegState.loading) return _ffmpegState.loading;
    _ffmpegState.loading = (async () => {
      const hasLegacy = Boolean(window.FFmpeg && typeof window.FFmpeg.createFFmpeg === 'function');
      const hasNew = Boolean(window.FFmpegWASM && window.FFmpegWASM.FFmpeg);
      if (!hasLegacy && !hasNew) {
        await _loadScriptOnce('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.min.js');
      }
      const hasLegacy2 = Boolean(window.FFmpeg && typeof window.FFmpeg.createFFmpeg === 'function');
      const hasNew2 = Boolean(window.FFmpegWASM && window.FFmpegWASM.FFmpeg);
      if (!hasLegacy2 && !hasNew2) {
        throw new Error('أداة التحويل غير متاحة.');
      }
      const debug = Boolean(window && window.DEBUG_FFMPEG);
      let useSingleThread = false;
      try {
        useSingleThread = !(window && window.crossOriginIsolated) || (typeof SharedArrayBuffer === 'undefined');
      } catch {
        useSingleThread = true;
      }
      const corePkg = useSingleThread ? '@ffmpeg/core' : '@ffmpeg/core-mt';
      const corePathsLegacy = [
        `https://cdn.jsdelivr.net/npm/${corePkg}@0.12.10/dist/umd/ffmpeg-core.js`,
        `https://unpkg.com/${corePkg}@0.12.10/dist/umd/ffmpeg-core.js`,
      ];
      const corePathsNew = [
        `https://cdn.jsdelivr.net/npm/${corePkg}@0.12.10/dist/esm/ffmpeg-core.js`,
        `https://unpkg.com/${corePkg}@0.12.10/dist/esm/ffmpeg-core.js`,
      ];
      const corePaths = (window.FFmpeg && typeof window.FFmpeg.createFFmpeg === 'function') ? corePathsLegacy : corePathsNew;
      try { window.__ffmpegCorePathsTried = corePaths.slice(); } catch {}
      let lastErr = null;
      for (let i = 0; i < corePaths.length; i++) {
        const corePath = corePaths[i];
        try {
          let ffmpeg = null;
          let fetchFile = null;
          if (window.FFmpeg && typeof window.FFmpeg.createFFmpeg === 'function') {
            const legacy = window.FFmpeg;
            ffmpeg = legacy.createFFmpeg({ log: debug, corePath });
            fetchFile = legacy.fetchFile;
            await ffmpeg.load();
            _ffmpegState.instance = { api: 'legacy', ffmpeg, fetchFile };
          } else {
            const Cls = window.FFmpegWASM && window.FFmpegWASM.FFmpeg ? window.FFmpegWASM.FFmpeg : null;
            if (!Cls) throw new Error('أداة التحويل غير متاحة.');
            ffmpeg = new Cls();
            if (debug && ffmpeg && typeof ffmpeg.on === 'function') {
              try { ffmpeg.on('log', (e) => { try { console.log('[ffmpeg]', e && e.message ? e.message : e); } catch {} }); } catch {}
            }
            const wasmURL = corePath.replace(/ffmpeg-core\.js$/i, 'ffmpeg-core.wasm');
            const workerURL = corePath.replace(/ffmpeg-core\.js$/i, 'ffmpeg-core.worker.js');
            const remoteWorker = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js';
            const boot = `import '${remoteWorker}';`;
            const blobUrl = URL.createObjectURL(new Blob([boot], { type: 'text/javascript' }));
            try {
              await ffmpeg.load({ classWorkerURL: blobUrl, coreURL: corePath, wasmURL, workerURL });
            } finally {
              try { URL.revokeObjectURL(blobUrl); } catch {}
            }
            _ffmpegState.instance = { api: 'new', ffmpeg, fetchFile: (b) => _blobToUint8(b) };
          }
          try { window.__ffmpegCorePathUsed = corePath; } catch {}
          return _ffmpegState.instance;
        } catch (e) {
          lastErr = e;
          try { window.__ffmpegCorePathUsed = corePath; } catch {}
          try { window.__lastFfmpegError = e; } catch {}
        }
      }
      _ffmpegState.loading = null;
      _ffmpegState.instance = null;
      throw lastErr || new Error('فشل تحميل أداة التحويل.');
    })();
    return _ffmpegState.loading;
  }

  try {
    window.__ffmpegCheck = async () => {
      const info = {
        crossOriginIsolated: null,
        sharedArrayBuffer: null,
        corePathUsed: null,
        corePathsTried: null,
        api: null,
        ok: false,
        error: null,
      };
      try { info.crossOriginIsolated = Boolean(window && window.crossOriginIsolated); } catch {}
      try { info.sharedArrayBuffer = (typeof SharedArrayBuffer !== 'undefined'); } catch {}
      try {
        const st = await _getFfmpeg();
        info.ok = true;
        info.api = st && st.api ? String(st.api) : null;
      } catch (e) {
        info.error = (e && e.message) ? String(e.message) : String(e);
      }
      try { info.corePathUsed = window.__ffmpegCorePathUsed || null; } catch {}
      try { info.corePathsTried = window.__ffmpegCorePathsTried || null; } catch {}
      try {
        const le = window.__lastFfmpegError;
        if (!info.error && le) info.error = (le && le.message) ? String(le.message) : String(le);
      } catch {}
      return info;
    };
  } catch {}

  async function _convertToOgg(blob, inputExt = 'webm') {
    const st = await _getFfmpeg();
    const ffmpeg = st && st.ffmpeg ? st.ffmpeg : null;
    const fetchFile = st && st.fetchFile ? st.fetchFile : (b) => _blobToUint8(b);
    const inName = `input.${String(inputExt || 'webm').replace(/[^a-z0-9]/gi, '') || 'webm'}`;
    const outName = 'output.ogg';
    try {
      if (!ffmpeg) throw new Error('أداة التحويل غير متاحة.');
      const args = ['-i', inName, '-vn', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '24k', '-vbr', 'on', '-compression_level', '10', outName];
      if (typeof ffmpeg.writeFile === 'function' && typeof ffmpeg.exec === 'function' && typeof ffmpeg.readFile === 'function') {
        await ffmpeg.writeFile(inName, await fetchFile(blob));
        await ffmpeg.exec(args);
        const data = await ffmpeg.readFile(outName);
        try { await ffmpeg.deleteFile(inName); } catch {}
        try { await ffmpeg.deleteFile(outName); } catch {}
        return new Blob([data], { type: 'audio/ogg' });
      }
      ffmpeg.FS('writeFile', inName, await fetchFile(blob));
      await ffmpeg.run(...args);
      const data = ffmpeg.FS('readFile', outName);
      try { ffmpeg.FS('unlink', inName); } catch {}
      try { ffmpeg.FS('unlink', outName); } catch {}
      return new Blob([data], { type: 'audio/ogg' });
    } catch (e) {
      try {
        if (ffmpeg && typeof ffmpeg.deleteFile === 'function') {
          try { await ffmpeg.deleteFile(inName); } catch {}
          try { await ffmpeg.deleteFile(outName); } catch {}
        } else if (ffmpeg && typeof ffmpeg.FS === 'function') {
          try { ffmpeg.FS('unlink', inName); } catch {}
          try { ffmpeg.FS('unlink', outName); } catch {}
        }
      } catch {}
      throw e;
    }
  }

  async function _uploadToStorage(fileOrBlob, contentType, ext) {
    const sb = window.SupabaseClient ? SupabaseClient.getClient() : null;
    if (!sb || !sb.storage || !sb.storage.from) throw new Error('خدمة التخزين غير متاحة.');
    const bucketName = String(window.SUPABASE_BUCKET || 'media');
    const b = sb.storage.from(bucketName);
    const safeExt = String(ext || '').replace(/[^a-z0-9]/gi, '') || 'bin';
    const path = `orders/${currentOrderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
    const up = await b.upload(path, fileOrBlob, { contentType: contentType || undefined, upsert: false });
    if (up && up.error) throw up.error;
    const pub = b.getPublicUrl(path);
    const url = pub && pub.data && pub.data.publicUrl ? String(pub.data.publicUrl) : '';
    if (!url) throw new Error(`تعذر توليد رابط عام للملف من الحاوية ${bucketName}.`);
    return { path, publicUrl: url };
  }

  async function _waInvoke(body) {
    // 1) Direct UltraMSG call if configured on the client
    const directBase = (window && window.ULTRAMSG_BASE) ? String(window.ULTRAMSG_BASE).replace(/\/$/, '') : '';
    const directToken = (window && window.ULTRAMSG_TOKEN) ? String(window.ULTRAMSG_TOKEN) : '';
    const canDirect = Boolean(directBase && directToken);
    const _waOk = (meta, data) => {
      const m = Object.assign({
        at: (window.Utils && typeof Utils.nowIso === 'function') ? Utils.nowIso() : new Date().toISOString(),
      }, meta || {});
      try { window.__lastWaSend = Object.assign({}, m, { data }); } catch {}
      return { ok: true, data, meta: m };
    };
    if (canDirect) {
      try {
        const toInput = String((body && body.to) || '').trim();
        const to = (/@g\.us$/i.test(toInput)) ? toInput : toInput.replace(/[^0-9]/g, '');
        if (!to) throw new Error('رقم المستلم غير صالح.');
        let endpoint = '';
        const form = new URLSearchParams();
        form.set('token', directToken);
        form.set('to', to);
        if (body && body.mediaUrl && body.type === 'image') {
          endpoint = `${directBase}/messages/image`;
          form.set('image', String(body.mediaUrl));
          if (body.caption) form.set('caption', String(body.caption));
        } else if (body && body.mediaUrl && body.type === 'audio') {
          let urlNorm = String(body.mediaUrl);
          try {
            const u = new URL(urlNorm);
            if (!u.searchParams.has('download')) {
              u.searchParams.set('download', '1');
            }
            urlNorm = u.toString();
          } catch {}
          let fileBlob = null;
          let fileName = 'voice.webm';
          try {
            const u0 = new URL(urlNorm);
            const n0 = u0.pathname.split('/').pop();
            if (n0) fileName = n0;
          } catch {}
          try {
            const r0 = await fetch(urlNorm, { method: 'GET' });
            if (r0.ok) fileBlob = await r0.blob();
          } catch {}
          if (fileBlob) {
            try {
              const fdVoiceFile = new FormData();
              fdVoiceFile.append('token', directToken);
              fdVoiceFile.append('to', to);
              fdVoiceFile.append('audio', fileBlob, fileName);
              const rVoiceFile = await fetch(`${directBase}/messages/voice`, { method: 'POST', body: fdVoiceFile });
              const tVoiceFile = await rVoiceFile.text();
              let dVoiceFile = null;
              try { dVoiceFile = JSON.parse(tVoiceFile); } catch { dVoiceFile = { raw: tVoiceFile }; }
              const okVoiceFile = rVoiceFile.ok && dVoiceFile && (dVoiceFile.sent || dVoiceFile.status === 'ok' || dVoiceFile.ok === true);
              if (okVoiceFile) return _waOk({ provider: 'ultramsg', endpoint: '/messages/voice', mode: 'voice_file', ptt: true, to }, dVoiceFile);
            } catch {}
            try {
              const fdAudFile = new FormData();
              fdAudFile.append('token', directToken);
              fdAudFile.append('to', to);
              fdAudFile.append('ptt', '1');
              fdAudFile.append('audio', fileBlob, fileName);
              const rAudFile = await fetch(`${directBase}/messages/audio`, { method: 'POST', body: fdAudFile });
              const tAudFile = await rAudFile.text();
              let dAudFile = null;
              try { dAudFile = JSON.parse(tAudFile); } catch { dAudFile = { raw: tAudFile }; }
              const okAudFile = rAudFile.ok && dAudFile && (dAudFile.sent || dAudFile.status === 'ok' || dAudFile.ok === true);
              if (okAudFile) return _waOk({ provider: 'ultramsg', endpoint: '/messages/audio', mode: 'audio_file_ptt', ptt: true, to }, dAudFile);
            } catch {}
            try {
              const fdDocFile = new FormData();
              fdDocFile.append('token', directToken);
              fdDocFile.append('to', to);
              fdDocFile.append('document', fileBlob, fileName);
              const rDocFile = await fetch(`${directBase}/messages/document`, { method: 'POST', body: fdDocFile });
              const tDocFile = await rDocFile.text();
              let dDocFile = null;
              try { dDocFile = JSON.parse(tDocFile); } catch { dDocFile = { raw: tDocFile }; }
              const okDocFile = rDocFile.ok && dDocFile && (dDocFile.sent || dDocFile.status === 'ok' || dDocFile.ok === true);
              if (okDocFile) return _waOk({ provider: 'ultramsg', endpoint: '/messages/document', mode: 'document_file', ptt: false, to }, dDocFile);
            } catch {}
          }
          const formVoice = new URLSearchParams();
          formVoice.set('token', directToken);
          formVoice.set('to', to);
          formVoice.set('audio', urlNorm);
          if (body.caption) formVoice.set('caption', String(body.caption));
          try {
            const respV = await fetch(`${directBase}/messages/voice`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: formVoice,
            });
            const txtV = await respV.text();
            let dataV = null;
            try { dataV = JSON.parse(txtV); } catch { dataV = { raw: txtV }; }
            const okV = respV.ok && dataV && (dataV.sent || dataV.status === 'ok' || dataV.ok === true);
            if (okV) return _waOk({ provider: 'ultramsg', endpoint: '/messages/voice', mode: 'voice_url', ptt: true, to }, dataV);
          } catch {}
          const formAud = new URLSearchParams();
          formAud.set('token', directToken);
          formAud.set('to', to);
          formAud.set('audio', urlNorm);
          formAud.set('ptt', '1');
          try {
            const u3 = new URL(urlNorm);
            const fname = u3.pathname.split('/').pop();
            if (fname && fname.includes('.')) formAud.set('filename', fname);
          } catch {}
          if (body.caption) formAud.set('caption', String(body.caption));
          try {
            const respAud = await fetch(`${directBase}/messages/audio`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: formAud,
            });
            const txtAud = await respAud.text();
            let dataAud = null;
            try { dataAud = JSON.parse(txtAud); } catch { dataAud = { raw: txtAud }; }
            const okAud = respAud.ok && dataAud && (dataAud.sent || dataAud.status === 'ok' || dataAud.ok === true);
            if (okAud) return _waOk({ provider: 'ultramsg', endpoint: '/messages/audio', mode: 'audio_url_ptt', ptt: true, to }, dataAud);
          } catch {}
          const formDoc = new URLSearchParams();
          formDoc.set('token', directToken);
          formDoc.set('to', to);
          formDoc.set('document', urlNorm);
          try {
            const u2 = new URL(urlNorm);
            const fname = u2.pathname.split('/').pop();
            const fallbackName = fname && fname.includes('.') ? fname : (fname ? `${fname}.ogg` : 'voice.ogg');
            formDoc.set('filename', fallbackName);
          } catch {
            formDoc.set('filename', 'voice.ogg');
          }
          if (body.caption) formDoc.set('caption', String(body.caption));
          try {
            const respDoc = await fetch(`${directBase}/messages/document`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: formDoc,
            });
            const txtDoc = await respDoc.text();
            let dataDoc = null;
            try { dataDoc = JSON.parse(txtDoc); } catch { dataDoc = { raw: txtDoc }; }
            const okDoc = respDoc.ok && dataDoc && (dataDoc.sent || dataDoc.status === 'ok' || dataDoc.ok === true);
            if (okDoc) return _waOk({ provider: 'ultramsg', endpoint: '/messages/document', mode: 'document_url', ptt: false, to }, dataDoc);
          } catch {}
          const formTxt = new URLSearchParams();
          formTxt.set('token', directToken);
          formTxt.set('to', to);
          formTxt.set('body', `رابط التسجيل الصوتي: ${String(body.mediaUrl)}`);
          const resp3 = await fetch(`${directBase}/messages/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formTxt,
          });
          const txt3 = await resp3.text();
          let data3 = null;
          try { data3 = JSON.parse(txt3); } catch { data3 = { raw: txt3 }; }
          const ok3 = resp3.ok && data3 && (data3.sent || data3.status === 'ok' || data3.ok === true);
          if (!ok3) {
            let msg = '';
            try { msg = JSON.stringify(data3 || {}); } catch {}
            if (!msg || msg === '[object Object]') msg = 'تعذر إرسال (UltraMSG).';
            throw new Error(msg);
          }
          return _waOk({ provider: 'ultramsg', endpoint: '/messages/chat', mode: 'chat_fallback', ptt: false, to }, data3);
        } else {
          endpoint = `${directBase}/messages/chat`;
          form.set('body', String((body && body.body) || ''));
        }
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form,
        });
        const txt = await resp.text();
        let data = null;
        try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
        const msgStr = data && (typeof data.message === 'string' ? data.message : (typeof data.raw === 'string' ? data.raw : ''));
        if (msgStr && /not\s+authenticated|qr|scan/i.test(msgStr)) {
          throw new Error('UltraMSG غير متصل/غير مُصادق بعد. افتح UltraMSG Dashboard وأعد ربط WhatsApp (Scan QR) ثم أعد الإرسال.');
        }
        const ok = resp.ok && data && (data.sent || data.status === 'ok' || data.ok === true);
        if (!ok) {
          let msg = '';
          const cand = data && (data.error || data.message || data.raw);
          if (typeof cand === 'string') msg = cand;
          else {
            try { msg = JSON.stringify(cand); } catch { msg = String(cand || txt || ''); }
          }
          if (!msg) msg = 'تعذر إرسال (UltraMSG).';
          throw new Error(msg);
        }
        return _waOk({ provider: 'ultramsg', endpoint: endpoint.replace(directBase, ''), mode: 'direct', ptt: false, to: form.get('to') || '' }, data);
      } catch (e) {
        const msg = e && e.message ? String(e.message) : '';
        try {
          window.__lastWaSend = {
            at: (window.Utils && typeof Utils.nowIso === 'function') ? Utils.nowIso() : new Date().toISOString(),
            ok: false,
            provider: 'ultramsg',
            mode: 'direct_failed_fallback',
            error: msg || 'direct_ultramsg_failed',
            body,
          };
        } catch {}
      }
    }

    // 2) Fallback: Supabase Edge Function (only if direct not configured)
    const sb = window.SupabaseClient ? SupabaseClient.getClient() : null;
    if (!sb || !sb.functions || typeof sb.functions.invoke !== 'function') throw new Error('خدمة الإرسال غير متاحة حالياً.');
    const anon = (window && window.SUPABASE_ANON_KEY) ? String(window.SUPABASE_ANON_KEY) : '';
    const headers = {};
    if (anon) {
      headers['Authorization'] = `Bearer ${anon}`;
      headers['apikey'] = anon;
    }
    let result = null;
    let invokeErr = null;
    try {
      const { data, error } = await sb.functions.invoke('wa-send', { body, headers });
      result = data;
      invokeErr = error || null;
    } catch (e) {
      invokeErr = e;
    }
    if (!result || result.ok !== true) {
      try {
        const base = String(window.SUPABASE_URL || '').trim();
        let fnOrigin = '';
        if (base) {
          try {
            const u = new URL(base);
            fnOrigin = `${u.protocol}//${u.hostname.replace('.supabase.co', '.functions.supabase.co')}`;
          } catch {
            fnOrigin = base.replace('.supabase.co', '.functions.supabase.co').replace(/\/$/, '');
          }
        }
        if (fnOrigin) {
          const resp = await fetch(`${fnOrigin}/wa-send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(anon ? { 'Authorization': `Bearer ${anon}`, 'apikey': anon } : {}),
            },
            body: JSON.stringify(body || {}),
          });
          const txt = await resp.text();
          try { result = JSON.parse(txt); } catch { result = { raw: txt }; }
        }
      } catch {}
    }
    if (!result || result.ok !== true) {
      let msg = '';
      if (invokeErr) {
        msg = typeof invokeErr.message === 'string' && invokeErr.message.trim() ? invokeErr.message : '';
        if (!msg) {
          try { msg = JSON.stringify(invokeErr); } catch {}
        }
      }
      if (!msg && result) {
        const candidates = [result.error, result.message, result.status, result.data && (result.data.error || result.data.message || result.data.raw || result.data)];
        for (const c of candidates) {
          if (!c) continue;
          if (typeof c === 'string' && c.trim()) { msg = c; break; }
          try { msg = JSON.stringify(c); if (msg) break; } catch {}
        }
      }
      if (!msg) msg = 'تعذر إرسال واتساب.';
      throw new Error(msg);
    }
    try { window.__lastWaSend = { at: (window.Utils && typeof Utils.nowIso === 'function') ? Utils.nowIso() : new Date().toISOString(), provider: 'supabase', endpoint: 'wa-send', mode: 'edge', ptt: null, data: result }; } catch {}
    return result;
  }

  async function _sendRecording() {
    if (!_rec || !_rec.blob) return;
    try {
      if (els.sendBtn) els.sendBtn.disabled = true;
      let blobToSend = _rec.blob;
      let mime = String(_rec.blob.type || 'audio/webm');
      let ext = (mime.split('/')[1] || 'webm').split(';')[0];
      if (!/ogg/i.test(mime) && String(ext).toLowerCase() !== 'ogg') {
        try {
          _updateRecordStatus('جاري تحويل الصوت...');
          blobToSend = await _convertToOgg(_rec.blob, ext);
          mime = 'audio/ogg';
          ext = 'ogg';
        } catch (e) {
          try { window.__lastFfmpegError = e; } catch {}
          _updateRecordStatus('تعذر تحويل الصوت.');
          _showSendError('تعذر تحويل الصوت إلى OGG. جرّب تعطيل مانع الإعلانات أو افتح الصفحة بمتصفح Firefox ثم أعد المحاولة.');
          return;
        }
      }
      const { publicUrl } = await _uploadToStorage(blobToSend, mime, ext);
      const d = Number(_rec.durationSec || 0) || null;

      const order = Store.getOrderById(currentOrderId);
      const rec = (els.msgRecipient && els.msgRecipient.value) || 'agent';
      if (els.sendViaWhatsApp && els.sendViaWhatsApp.checked) {
        const to = _resolveWaTo(order, rec);
        if (!to) {
          if (String(rec) === 'page') _showSendError('واتساب الصفحة غير متوفر. حدّث page_whatsapp في قاعدة البيانات (يفضّل بصيغة ...@g.us للمجموعة).');
          else _showSendError('رقم الهاتف غير متوفر لإرسال واتساب.');
          return;
        }
        const prefix = _buildOutboundPrefix(currentOrderId);
        // ملاحظة: واتساب غالباً لا يعرض caption لرسائل الصوت (PTT)، لذا نرسل prefix كنص قبل الصوت.
        try {
          await _waInvoke({ to: String(to), body: prefix || '' });
        } catch {}
        await _waInvoke({ to: String(to), type: 'audio', mediaUrl: publicUrl, caption: prefix || null });
        try {
          const meta = (window && window.__lastWaSend) ? window.__lastWaSend : null;
          const ep = meta && meta.endpoint ? String(meta.endpoint) : '';
          const isPtt = Boolean(meta && meta.ptt);
          if (ep === '/messages/voice' || (ep === '/messages/audio' && isPtt)) {
            _updateRecordStatus('تم الإرسال كرسالة صوتية (PTT).');
          } else if (ep === '/messages/document') {
            _updateRecordStatus('تم الإرسال كملف (Document) وليس PTT.');
          } else if (ep) {
            _updateRecordStatus(`تم الإرسال عبر ${ep}.`);
          }
        } catch {}
      }

      await Store.addMessage(currentOrderId, { type: 'audio', src: publicUrl, durationSec: d, from: 'tracking' });
      _resetRecording();
    } catch (err) {
      const msg = (err && err.message) ? String(err.message) : 'تعذر إرسال التسجيل.';
      _showSendError(msg);
    } finally {
      if (els.sendBtn) els.sendBtn.disabled = false;
    }
  }

  function _wireEvents() {
    if (window.Realtime) {
      Realtime.on(Realtime.Events.ORDER_UPDATED, ({ order }) => {
        if (!order || String(order.id) !== String(currentOrderId)) return;
        _render(order);
      });

      Realtime.on(Realtime.Events.MESSAGE_RECEIVED, ({ orderId }) => {
        if (String(orderId) !== String(currentOrderId)) return;
        const order = Store.getOrderById(currentOrderId);
        if (!order) return;
        _render(order);
      });

      Realtime.on(Realtime.Events.ALERT_CREATED, ({ alert }) => {
        if (!alert || String(alert.orderId) !== String(currentOrderId)) return;
        // إعادة render لتحديث الواجهة (آخر تحديث/ألخ) إن لزم.
        const order = Store.getOrderById(currentOrderId);
        if (!order) return;
        _render(order);
      });

      Realtime.on(Realtime.Events.ALERT_RESOLVED, ({ orderId }) => {
        if (String(orderId) !== String(currentOrderId)) return;
        const order = Store.getOrderById(currentOrderId);
        if (!order) return;
        _render(order);
      });
    }

    if (els.orderAlertResolve) {
      els.orderAlertResolve.addEventListener('click', () => {
        try {
          if (window.Alerts && typeof Alerts.resolve === 'function') {
            try {
              if (window.Auth && typeof Auth.getSession === 'function') {
                Auth.getSession()
                  .then((s) => {
                    const nm = s && s.name ? String(s.name).trim() : '';
                    Alerts.resolve(currentOrderId, nm || null);
                  })
                  .catch(() => { Alerts.resolve(currentOrderId); });
              } else {
                Alerts.resolve(currentOrderId);
              }
            } catch {
              Alerts.resolve(currentOrderId);
            }
          }
        } catch {}

        try {
          const order = Store.getOrderById(currentOrderId);
          if (order) _render(order);
        } catch {}
      });
    }

    if (els.orderAlertIntervene) {
      els.orderAlertIntervene.addEventListener('click', () => {
        try {
          const a = (window.Alerts && typeof Alerts.getActiveAlert === 'function') ? Alerts.getActiveAlert(currentOrderId) : null;
          if (a) _openSupportWhatsAppAlert(a);
        } catch {}
      });
    }

    if (els.sendForm) {
      els.sendForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        _hideSendError();
        const order = Store.getOrderById(currentOrderId);
        if (!order) return;

        const text = String((els.msgText && els.msgText.value) || '').trim();
        if (!text) {
          _showSendError('اكتب الرسالة.');
          return;
        }

        const outboundText = _buildOutboundText(currentOrderId, text);
        const rec = (els.msgRecipient && els.msgRecipient.value) || 'agent';
        try {
          if (els.sendBtn) els.sendBtn.disabled = true;

          // If user chose WhatsApp, invoke Edge Function (UltraMSG)
          if (els.sendViaWhatsApp && els.sendViaWhatsApp.checked) {
            const to = _resolveWaTo(order, rec);
            if (!to) {
              if (String(rec) === 'page') _showSendError('واتساب الصفحة غير متوفر. حدّث page_whatsapp في قاعدة البيانات (يفضّل بصيغة ...@g.us للمجموعة).');
              else _showSendError('رقم الهاتف غير متوفر لإرسال واتساب.');
              return;
            }
            try {
              await _waInvoke({ to: String(to), body: outboundText || text });
            } catch (err) {
              const msg = (err && err.message) ? String(err.message) : 'تعذر الاتصال بخادم الرسائل.';
              _showSendError(msg);
              return;
            }
          }

          // Always log internally to المحادثة
          await Store.addMessage(currentOrderId, { type: 'text', text, from: 'tracking' });

          if (els.msgText) els.msgText.value = '';
          if (els.msgPreview) Utils.setText(els.msgPreview, '');
        } catch (err) {
          const msg = (err && err.message) ? String(err.message) : 'فشل إرسال الرسالة.';
          _showSendError(msg);
        } finally {
          if (els.sendBtn) els.sendBtn.disabled = false;
        }
      });
    }

    if (els.msgPreview) {
      try { els.msgPreview.classList.add('d-none'); } catch {}
      try { Utils.setText(els.msgPreview, ''); } catch {}
    }

    if (els.btnAttachImage && els.fileImage) {
      els.btnAttachImage.addEventListener('click', () => {
        els.fileImage.click();
      });
      els.fileImage.addEventListener('change', async (e) => {
        const f = e && e.target && e.target.files && e.target.files[0];
        if (!f) return;
        if (f.size > 3 * 1024 * 1024) {
          _showSendError('حجم الصورة كبير.');
          e.target.value = '';
          return;
        }
        _hideSendError();
        try {
          if (els.sendBtn) els.sendBtn.disabled = true;
          // رفع للصندوق العام ثم إرسال واتساب إن مطلوب، ثم تسجيل داخلياً
          const mime = String(f.type || 'image/jpeg');
          const ext = (mime.split('/')[1] || 'jpg').split(';')[0];
          const { publicUrl } = await _uploadToStorage(f, mime, ext);

          const order = Store.getOrderById(currentOrderId);
          const rec = (els.msgRecipient && els.msgRecipient.value) || 'agent';
          const captionRaw = String((els.msgText && els.msgText.value) || '').trim();
          const caption = captionRaw ? _buildOutboundText(currentOrderId, captionRaw) : _buildOutboundPrefix(currentOrderId);
          if (els.sendViaWhatsApp && els.sendViaWhatsApp.checked) {
            const to = _resolveWaTo(order, rec);
            if (!to) {
              if (String(rec) === 'page') _showSendError('واتساب الصفحة غير متوفر. حدّث page_whatsapp في قاعدة البيانات (يفضّل بصيغة ...@g.us للمجموعة).');
              else _showSendError('رقم الهاتف غير متوفر لإرسال واتساب.');

              e.target.value = '';
              return;
            }
            await _waInvoke({ to: String(to), type: 'image', mediaUrl: publicUrl, caption: caption || null });
          }

          await Store.addMessage(currentOrderId, { type: 'image', src: publicUrl, text: captionRaw || '', from: 'tracking' });
          if (els.msgText) els.msgText.value = '';
          e.target.value = '';
          _render(Store.getOrderById(currentOrderId));
        } catch (err) {
          const msg = (err && err.message) ? String(err.message) : 'فشل إرسال الصورة.';
          _showSendError(msg);
          try { e.target.value = ''; } catch {}
        } finally {
          if (els.sendBtn) els.sendBtn.disabled = false;
        }
      });
    }

    if (els.btnAttachAudio) {
      els.btnAttachAudio.addEventListener('click', async () => {
        await _startRecording();
      });
    }
    if (els.fileAudio) {
      els.fileAudio.addEventListener('change', async (e) => {
        const f = e && e.target && e.target.files && e.target.files[0];
        if (!f) return;
        if (f.size > 10 * 1024 * 1024) {
          _showSendError('حجم الصوت كبير.');
          e.target.value = '';
          return;
        }
        _hideSendError();
        try {
          if (els.sendBtn) els.sendBtn.disabled = true;
          let blobToSend = f;
          let mime = String(f.type || 'audio/webm');
          let ext = (mime.split('/')[1] || 'webm').split(';')[0];
          if (!/ogg/i.test(mime) && String(ext).toLowerCase() !== 'ogg') {
            try {
              blobToSend = await _convertToOgg(f, ext);
              mime = 'audio/ogg';
              ext = 'ogg';
            } catch (e2) {
              try { window.__lastFfmpegError = e2; } catch {}
              _showSendError('تعذر تحويل الصوت إلى OGG. جرّب تعطيل مانع الإعلانات أو افتح الصفحة بمتصفح Firefox ثم أعد المحاولة.');
              e.target.value = '';
              return;
            }
          }
          const { publicUrl } = await _uploadToStorage(blobToSend, mime, ext);
          const d = await _getAudioDuration(publicUrl);

          const order = Store.getOrderById(currentOrderId);
          const rec = (els.msgRecipient && els.msgRecipient.value) || 'agent';
          if (els.sendViaWhatsApp && els.sendViaWhatsApp.checked) {
            const to = _resolveWaTo(order, rec);
            if (!to) {
              if (String(rec) === 'page') _showSendError('واتساب الصفحة غير متوفر. حدّث page_whatsapp في قاعدة البيانات (يفضّل بصيغة ...@g.us للمجموعة).');
              else _showSendError('رقم الهاتف غير متوفر لإرسال واتساب.');
              return;
            }
            const prefix = _buildOutboundPrefix(currentOrderId);
            // ملاحظة: واتساب غالباً لا يعرض caption لرسائل الصوت (PTT)، لذا نرسل prefix كنص قبل الصوت.
            try {
              await _waInvoke({ to: String(to), body: prefix || '' });
            } catch {}
            await _waInvoke({ to: String(to), type: 'audio', mediaUrl: publicUrl, caption: prefix || null });
            try {
              const meta = (window && window.__lastWaSend) ? window.__lastWaSend : null;
              const ep = meta && meta.endpoint ? String(meta.endpoint) : '';
              const isPtt = Boolean(meta && meta.ptt);
              if (ep === '/messages/voice' || (ep === '/messages/audio' && isPtt)) {
                _updateRecordStatus('تم الإرسال كرسالة صوتية (PTT).');
              } else if (ep === '/messages/document') {
                _updateRecordStatus('تم الإرسال كملف (Document) وليس PTT.');
              } else if (ep) {
                _updateRecordStatus(`تم الإرسال عبر ${ep}.`);
              }
            } catch {}
          }

          await Store.addMessage(currentOrderId, { type: 'audio', src: publicUrl, durationSec: d != null ? Math.round(d) : null, from: 'tracking' });
          e.target.value = '';
        } catch (err) {
          const msg = (err && err.message) ? String(err.message) : 'تعذر إرفاق الصوت.';
          _showSendError(msg);
        } finally {
          if (els.sendBtn) els.sendBtn.disabled = false;
        }
      });
    }

    if (els.btnStopRecording) {
      els.btnStopRecording.addEventListener('click', () => {
        _stopRecording();
      });
    }
    if (els.btnCancelRecording) {
      els.btnCancelRecording.addEventListener('click', () => {
        _resetRecording();
      });
    }
    if (els.btnSendRecording) {
      els.btnSendRecording.addEventListener('click', async () => {
        await _sendRecording();
      });
    }
  }

  OrderDetailsPage.init = (session) => {
    els.orderId = Utils.qs('#detailOrderId');
    els.status = Utils.qs('#detailStatus');
    els.customerName = Utils.qs('#detailCustomerName');
    els.customerPhone = Utils.qs('#detailCustomerPhone');
    els.agentName = Utils.qs('#detailAgentName');
    els.agentPhone = Utils.qs('#detailAgentPhone');
    els.pageName = Utils.qs('#detailPageName');
    els.pageWhatsApp = Utils.qs('#detailPageWhatsApp');
    els.pageGroupId = Utils.qs('#detailPageGroupId');
    els.awaiting = Utils.qs('#detailAwaiting');
    els.lastMessage = Utils.qs('#detailLastMessage');
    els.updatedAt = Utils.qs('#detailUpdatedAt');
    els.whatsApp = Utils.qs('#detailWhatsApp');
    els.call = Utils.qs('#detailCall');

    els.conversation = Utils.qs('#conversationContainer');
    els.detailsAlert = Utils.qs('#detailsAlert');

    els.sendForm = Utils.qs('#sendMessageForm');
    els.msgRecipient = Utils.qs('#messageRecipient');
    els.msgText = Utils.qs('#messageText');
    els.msgPreview = Utils.qs('#messagePreview');
    els.sendAlert = Utils.qs('#sendMsgAlert');
    els.sendBtn = Utils.qs('#btnSendMessage');
    els.sendViaWhatsApp = Utils.qs('#sendViaWhatsApp');
    if (els.sendViaWhatsApp) {
      try { els.sendViaWhatsApp.checked = true; } catch {}
      try {
        const wrap = els.sendViaWhatsApp.closest('.form-check');
        if (wrap && !wrap.classList.contains('d-none')) wrap.classList.add('d-none');
      } catch {}
    }
    els.customerWhatsApp = Utils.qs('#detailCustomerWhatsApp');
    els.customerCall = Utils.qs('#detailCustomerCall');
    els.btnAttachImage = Utils.qs('#btnAttachImage');
    els.btnAttachAudio = Utils.qs('#btnAttachAudio');
    els.fileImage = Utils.qs('#fileImage');
    els.fileAudio = Utils.qs('#fileAudio');
    els.audioRecordUI = Utils.qs('#audioRecordUI');
    els.audioRecordStatus = Utils.qs('#audioRecordStatus');
    els.btnStopRecording = Utils.qs('#btnStopRecording');
    els.btnSendRecording = Utils.qs('#btnSendRecording');
    els.btnCancelRecording = Utils.qs('#btnCancelRecording');
    els.audioRecordPreviewWrap = Utils.qs('#audioRecordPreviewWrap');
    els.audioRecordPreview = Utils.qs('#audioRecordPreview');

    els.timelineList = Utils.qs('#timelineList');

    els.orderAlertCard = Utils.qs('#orderAlertCard');
    els.orderAlertContent = Utils.qs('#orderAlertContent');
    els.orderAlertResolve = Utils.qs('#orderAlertResolve');
    els.orderAlertIntervene = Utils.qs('#orderAlertIntervene');

    const qs = Utils.parseQuery();
    let id = qs.get('id');
    currentOrderId = id;

    if (!id) {
      // محاولة استرجاع آخر طلب تم فتحه من صفحة الطلبات
      try {
        const lastId = window.localStorage.getItem('deliverydash_last_order_id_v1');
        if (lastId) {
          id = String(lastId);
          currentOrderId = id;
          const newUrl = `${window.location.pathname}?id=${encodeURIComponent(id)}`;
          window.history.replaceState(null, '', newUrl);
        }
      } catch {}

      if (!id) {
        _showError('لم يتم تحديد رقم الطلب. افتح تفاصيل الطلب من صفحة الطلبات.');
        return;
      }
    }

    const order = Store.getOrderById(id);
    if (!order) {
      _showError('لم يتم العثور على الطلب. افتح تفاصيل الطلب من صفحة الطلبات.');
      return;
    }

    _render(order);
    try {
      const qp = Utils.parseQuery();
      const embeddedFlag = qp.get('embedded');
      const embedded = embeddedFlag && !/^0|false$/i.test(String(embeddedFlag));
      const printFlag = qp.get('print');
      const shouldSignal = embedded && printFlag && !/^0|false$/i.test(String(printFlag));
      if (shouldSignal && window.parent && window.parent !== window) {
        const origin = (window.location && window.location.origin && window.location.origin !== 'null') ? window.location.origin : '*';
        window.parent.postMessage({ type: 'deliverydash:order-details-rendered', orderId: String(id) }, origin);
      }
    } catch {}
    try {
      const qp = Utils.parseQuery();
      const printFlag = qp.get('print');
      const embeddedFlag = qp.get('embedded');
      const embedded = embeddedFlag && !/^0|false$/i.test(String(embeddedFlag));
      if (!embedded && printFlag && !/^0|false$/i.test(String(printFlag))) {
        setTimeout(() => { try { window.print(); } catch {} }, 400);
      }
    } catch {}

    _wireEvents();
  };

  window.OrderDetailsPage = OrderDetailsPage;
})();
