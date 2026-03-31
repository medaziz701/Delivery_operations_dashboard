(function(){
  'use strict';

  function initAlertsBell(){
    const bellBtn = document.querySelector('#alertsBell');
    const badge = document.querySelector('#alertsCount');
    const list = document.querySelector('#alertsDropdown');
    if (!bellBtn || !badge) return;

    const STORAGE_KEY = 'deliverydash_alerts_v1';
    const SEEN_AT_KEY = 'deliverydash_alerts_seen_at_v1';

    function readActive(){
      try{
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const obj = (window.Utils && Utils.safeJsonParse) ? Utils.safeJsonParse(raw, {}) : JSON.parse(raw || '{}');
        return Object.values(obj || {}).filter(a => a && !a.resolvedAt);
      }catch{ return []; }
    }

    function getSeenAtMs(){
      const raw = window.localStorage.getItem(SEEN_AT_KEY);
      const t = Date.parse(raw || '');
      return Number.isFinite(t) ? t : 0;
    }

    function setSeenNow(){
      try{ window.localStorage.setItem(SEEN_AT_KEY, (window.Utils && Utils.nowIso) ? Utils.nowIso() : new Date().toISOString()); }catch{}
    }

    function getSupportNumber(){
      const v = typeof window.SUPPORT_WHATSAPP_NUMBER === 'string' ? window.SUPPORT_WHATSAPP_NUMBER.trim() : '';
      return v;
    }

    function openSupportWhatsApp(alert){
      const supportNumber = getSupportNumber();
      if (!supportNumber) return false;
      const orderId = alert && alert.orderId ? String(alert.orderId) : '';
      const keyword = alert && alert.keyword ? String(alert.keyword) : '';
      const snippet = alert && alert.snippet ? String(alert.snippet) : '';
      const base = window.location.origin + window.location.pathname.replace(/[^/]+$/, '');
      const detailsUrl = `${base}order-details.html?id=${encodeURIComponent(orderId)}`;
      const text = `طلب تدخل عاجل\nرقم الطلب: ${orderId}\nالسبب: ${keyword}\nالملخص: ${snippet}\nرابط التفاصيل: ${detailsUrl}`;
      try{
        const url = (window.Utils && Utils.toWhatsAppLink) ? Utils.toWhatsAppLink(supportNumber, text) : `https://wa.me/${supportNumber.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(text)}`;
        if (!url || url === '#') return false;
        window.open(url, 'support-whatsapp', 'width=430,height=720,noopener,noreferrer');
        return true;
      } catch { return false; }
    }

    function renderList(){
      if (!list) return;
      const items = readActive()
        .sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
        .slice(0, 10);
      if (!items.length){
        list.innerHTML = '<div class="text-center text-dark fw-semibold py-3">لا توجد تنبيهات</div>';
        return;
      }
      list.innerHTML = items.map(a => {
        const id = a.orderId ? (window.Utils ? Utils.escapeHtml(String(a.orderId)) : String(a.orderId)) : '—';
        const kw = a.keyword ? (window.Utils ? Utils.escapeHtml(String(a.keyword)) : String(a.keyword)) : 'تنبيه';
        const when = (window.Utils && Utils.formatDateTime) ? Utils.formatDateTime(a.createdAt) : (a.createdAt || '');
        const snippet = a.snippet ? ((window.Utils && Utils.escapeHtml) ? Utils.escapeHtml(String(a.snippet)) : String(a.snippet)) : '';
        return `
          <div class="p-2">
            <div class="alert alert-danger d-flex justify-content-between align-items-start gap-2 mb-0" role="alert">
              <div class="flex-grow-1 text-end">
                <div class="fw-bold">تنبيه: كلمة مفتاحية (${kw})</div>
                <div class="small text-secondary">طلب رقم ${id} • ${when}</div>
                <div class="small mt-2 text-body">${snippet}</div>
              </div>
              <div class="d-flex flex-column gap-2 ms-2 flex-shrink-0" style="min-width: 140px">
                <a class="btn btn-light btn-sm border w-100" href="order-details.html?id=${encodeURIComponent(String(id))}">تفاصيل</a>
                <button class="btn btn-warning btn-sm w-100" data-action="intervene" data-order-id="${id}">طلب تدخل</button>
                <button class="btn btn-outline-secondary btn-sm w-100" data-action="resolve-alert" data-order-id="${id}">تم حل المشكلة</button>
              </div>
            </div>
          </div>`;
      }).join('');
    }

    function updateBadge(){
      const seenAt = getSeenAtMs();
      const count = readActive().filter(a => Date.parse(a.createdAt || 0) > seenAt).length;
      if (count > 0){
        badge.textContent = String(count);
        badge.classList.remove('d-none');
      } else {
        badge.classList.add('d-none');
      }
    }

    bellBtn.addEventListener('show.bs.dropdown', () => {
      setSeenNow();
      updateBadge();
      renderList();
    });

    // Keep dropdown open when interacting inside
    if (list){
      list.addEventListener('click', (e) => { e.stopPropagation(); });

      // Actions delegation
      list.addEventListener('click', (e) => {
        const btnResolve = e.target.closest('[data-action="resolve-alert"]');
        if (btnResolve){
          const orderId = btnResolve.getAttribute('data-order-id');
          if (window.Alerts && typeof Alerts.resolve === 'function'){
            const doResolve = (byName) => {
              try { Alerts.resolve(orderId, byName || null); } catch { Alerts.resolve(orderId); }
              updateBadge();
              renderList();
            };

            try {
              if (window.Auth && typeof Auth.getSession === 'function'){
                Auth.getSession()
                  .then((s) => {
                    const nm = s && s.name ? String(s.name).trim() : '';
                    doResolve(nm);
                  })
                  .catch(() => { doResolve(null); });
              } else {
                doResolve(null);
              }
            } catch {
              doResolve(null);
            }
          }
          e.preventDefault();
          return;
        }

        const btnIntervene = e.target.closest('[data-action="intervene"]');
        if (btnIntervene){
          const orderId = btnIntervene.getAttribute('data-order-id');
          const alert = (readActive().find(x => String(x.orderId) === String(orderId))) || null;
          if (alert){ openSupportWhatsApp(alert); }
          e.preventDefault();
          return;
        }
      });
    }

    if (window.Realtime){
      Realtime.on(Realtime.Events.ALERT_CREATED, () => { updateBadge(); renderList(); });
      Realtime.on(Realtime.Events.ALERT_RESOLVED, () => { updateBadge(); renderList(); });
    }

    updateBadge();
    renderList();
  }

  document.addEventListener('DOMContentLoaded', () => {
    try{ initAlertsBell(); }catch{}
  });
})();
