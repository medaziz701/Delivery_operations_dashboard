(function () {
  'use strict';

  const FeedPage = {};

  const els = {
    list: null,
    empty: null,
    refresh: null,
  };

  function _asTimeMs(iso) {
    const t = new Date(iso || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function _isIssueOrder(o) {
    const s = String(o?.status || '');
    return s === 'مشكلة' || s === 'مرفوض' || Boolean(o?.hasIssue) || Boolean(o?.rejectedOnArrival) || Boolean(o?.priceChanged);
  }

  function _lastMessage(order) {
    const conv = Array.isArray(order?.conversation) ? order.conversation : [];
    if (!conv.length) return null;
    const sorted = conv.slice().sort((a, b) => _asTimeMs(b?.ts) - _asTimeMs(a?.ts));
    return sorted[0] || null;
  }

  function _fromLabel(from) {
    const v = String(from || '');
    if (v === 'page') return 'الصفحة';
    if (v === 'agent') return 'المندوب';
    if (v === 'customer') return 'العميل';
    return 'رسالة';
  }

  function _buildEvents(orders) {
    const rows = [];
    const list = Array.isArray(orders) ? orders : [];

    for (const o of list) {
      if (!o) continue;

      const createdAt = o.createdAt || null;
      const updatedAt = o.updatedAt || null;

      if (createdAt) {
        rows.push({
          type: 'order_created',
          ts: createdAt,
          orderId: o.id,
          title: `تم إنشاء طلب #${o.id}`,
          subtitle: `${o.pageName || '—'} • ${o.agentName || o.agentPhone || '—'}`,
          badge: 'طلب جديد',
          tone: 'primary',
        });
      }

      if (updatedAt && updatedAt !== createdAt) {
        rows.push({
          type: 'order_updated',
          ts: updatedAt,
          orderId: o.id,
          title: `تحديث على طلب #${o.id}`,
          subtitle: `${o.status || '—'}${_isIssueOrder(o) ? ' • مشكلة/تنبيه' : ''}`,
          badge: 'تحديث',
          tone: _isIssueOrder(o) ? 'danger' : 'secondary',
        });
      }

      const lm = _lastMessage(o);
      if (lm && lm.ts) {
        const text = lm.type === 'text' ? (lm.text || '') : lm.type === 'image' ? 'صورة' : 'مقطع صوتي';
        rows.push({
          type: 'message',
          ts: lm.ts,
          orderId: o.id,
          title: `رسالة جديدة على طلب #${o.id}`,
          subtitle: `${_fromLabel(lm.from)}: ${Utils.truncate(text, 80)}`,
          badge: 'رسالة',
          tone: 'success',
        });
      }

      if (_isIssueOrder(o)) {
        const issueTs = updatedAt || createdAt;
        if (issueTs) {
          rows.push({
            type: 'issue',
            ts: issueTs,
            orderId: o.id,
            title: `طلب يحتاج متابعة #${o.id}`,
            subtitle: `${o.status || '—'} • ${o.pageName || '—'}`,
            badge: 'مشكلة',
            tone: 'danger',
          });
        }
      }
    }

    // إزالة التكرارات (نفس النوع/الوقت/الطلب) لتجنب التضخيم
    const seen = new Set();
    const unique = [];
    for (const r of rows) {
      const key = `${r.type}|${String(r.orderId)}|${String(r.ts)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(r);
    }

    unique.sort((a, b) => _asTimeMs(b.ts) - _asTimeMs(a.ts));
    return unique;
  }

  function _render() {
    if (!els.list) return;

    const orders = window.Store && typeof Store.getOrders === 'function' ? Store.getOrders() : [];
    const events = _buildEvents(orders).slice(0, 60);

    if (els.empty) {
      els.empty.classList.toggle('d-none', events.length > 0);
    }

    els.list.innerHTML = events
      .map((e) => {
        const badgeCls = e.tone === 'danger' ? 'text-bg-danger' : e.tone === 'success' ? 'text-bg-success' : e.tone === 'primary' ? 'text-bg-primary' : 'text-bg-light';
        const badgeTextCls = badgeCls === 'text-bg-light' ? 'text-dark border' : '';
        const href = `order-details.html?id=${encodeURIComponent(String(e.orderId))}`;
        return `
          <a class="list-group-item list-group-item-action" href="${href}">
            <div class="d-flex justify-content-between align-items-start gap-3">
              <div class="flex-grow-1">
                <div class="fw-bold">${Utils.escapeHtml(e.title)}</div>
                <div class="text-muted small">${Utils.escapeHtml(e.subtitle || '')}</div>
              </div>
              <div class="text-end">
                <div class="mb-2"><span class="badge ${badgeCls} ${badgeTextCls}">${Utils.escapeHtml(e.badge || '')}</span></div>
                <div class="text-muted small">${Utils.escapeHtml(Utils.formatDateTime(e.ts))}</div>
              </div>
            </div>
          </a>
        `;
      })
      .join('');
  }

  function _wireRealtime() {
    if (!window.Realtime) return;
    Realtime.on(Realtime.Events.STORE_CHANGED, _render);
    Realtime.on(Realtime.Events.ALERT_CREATED, _render);
    Realtime.on(Realtime.Events.ALERT_RESOLVED, _render);
    Realtime.on(Realtime.Events.MESSAGE_RECEIVED, _render);
    Realtime.on(Realtime.Events.ORDER_CREATED, _render);
    Realtime.on(Realtime.Events.ORDER_UPDATED, _render);
  }

  FeedPage.init = () => {
    els.list = Utils.qs('#feedList');
    els.empty = Utils.qs('#feedEmpty');
    els.refresh = Utils.qs('#btnFeedRefresh');

    if (els.refresh) {
      els.refresh.addEventListener('click', async () => {
        const btn = els.refresh;
        const prevHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>'; 
        try {
          if (window.Store && typeof Store.reload === 'function') {
            await Store.reload();
          } else {
            _render();
          }
        } finally {
          btn.disabled = false;
          btn.innerHTML = prevHtml;
          _render();
        }
      });
    }

    _wireRealtime();
    _render();
  };

  window.FeedPage = FeedPage;
})();
