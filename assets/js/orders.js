(function () {
  'use strict';

  const OrdersPage = {};

  const state = {
    search: '',
    sort: 'desc', // desc: الأحدث أولاً
    date: '', // YYYY-MM-DD (افتراضيًا: اليوم)
    time: '', // HH:MM (اختياري)
    rejectedOnly: false,
    priceChangedOnly: false,
    selectedIds: new Set(), // للطباعة المتعددة
  };

  const els = {
    tbody: null,
    empty: null,
    searchInput: null,
    dateFilter: null,
    timeFilter: null,
    rejectedFilter: null,
    priceChangedFilter: null,
    sortBtn: null,
    resetBtn: null,
    metricsRow: null,
    metricToday: null,
    metricIssues: null,
    selectAllHeader: null,
    selectAllOrders: null,
    selectedCount: null,
    btnPrintSelected: null,
  };

  let printFrame = null;
  let printMsgHandler = null;
  let printTimeoutId = null;
  let didTriggerPrint = false;

  function _cleanupPrintFrame() {
    if (!printFrame) return;
    try {
      printFrame.onload = null;
    } catch {}
    try {
      if (printTimeoutId) clearTimeout(printTimeoutId);
    } catch {}
    printTimeoutId = null;
    didTriggerPrint = false;
    try {
      if (printMsgHandler) window.removeEventListener('message', printMsgHandler);
    } catch {}
    printMsgHandler = null;
    try {
      if (printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
    } catch {}
    printFrame = null;
  }

  function _printOrder(orderId) {
    const id = String(orderId || '').trim();
    if (!id) return;

    _cleanupPrintFrame();

    didTriggerPrint = false;

    const expectedId = id;
    printMsgHandler = (evt) => {
      try {
        if (!evt) return;
        const data = evt.data || {};
        if (!data || data.type !== 'deliverydash:order-details-rendered') return;
        if (String(data.orderId || '') !== String(expectedId)) return;
        const iframe = printFrame;
        if (!iframe) return;
        if (evt.source && iframe.contentWindow && evt.source !== iframe.contentWindow) return;
        if (didTriggerPrint) return;
        const w = iframe.contentWindow;
        if (!w) return;
        didTriggerPrint = true;
        try { w.focus(); } catch {}
        setTimeout(() => {
          try { w.print(); } catch {}
        }, 100);
        try {
          w.onafterprint = () => {
            _cleanupPrintFrame();
          };
        } catch {}
        setTimeout(() => {
          _cleanupPrintFrame();
        }, 15000);
      } catch {}
    };
    try {
      window.addEventListener('message', printMsgHandler);
    } catch {}

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.src = `order-details.html?id=${encodeURIComponent(id)}&print=1&embedded=1`;

    iframe.onload = () => {
      // Fallback in case the iframe can't postMessage (or takes too long).
      try {
        if (printTimeoutId) clearTimeout(printTimeoutId);
      } catch {}
      printTimeoutId = setTimeout(() => {
        try {
          const iframe2 = printFrame;
          if (!iframe2) return;
          const w = iframe2.contentWindow;
          if (!w) return;
          if (didTriggerPrint) return;
          didTriggerPrint = true;
          try { w.focus(); } catch {}
          try { w.print(); } catch {}
          setTimeout(() => {
            _cleanupPrintFrame();
          }, 15000);
        } catch {}
      }, 5000);
    };

    document.body.appendChild(iframe);
    printFrame = iframe;
  }

  // ===== Multi-select print functionality =====
  function _updateSelectionUi() {
    const count = state.selectedIds.size;
    if (els.selectedCount) {
      els.selectedCount.textContent = `${count} محدد`;
      els.selectedCount.classList.toggle('d-none', count === 0);
    }
    if (els.btnPrintSelected) {
      els.btnPrintSelected.classList.toggle('d-none', count === 0);
    }
    if (els.btnClearSelection) {
      els.btnClearSelection.classList.toggle('d-none', count === 0);
    }
  }

  function _printMultipleOrders(orderIds) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return;

    const ids = orderIds.map(String);
    const orders = Store.getOrders().filter(o => ids.includes(String(o.id)));
    
    if (orders.length === 0) {
      alert('لم يتم العثور على الطلبات المحددة');
      return;
    }

    // Create iframe for printing
    _cleanupPrintFrame();
    
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = '0';
    
    const now = new Date();
    const dateStr = now.toLocaleString('ar');
    
    // Generate print HTML
    const printHtml = _generateMultiPrintHtml(orders, dateStr);
    
    document.body.appendChild(iframe);
    printFrame = iframe;
    
    iframe.onload = () => {
      setTimeout(() => {
        try {
          const w = iframe.contentWindow;
          if (w) {
            w.focus();
            w.print();
          }
        } catch (e) {
          console.error('Print error:', e);
        }
      }, 500);
    };
    
    // Write content to iframe
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();
  }

  function _generateMultiPrintHtml(orders, dateStr) {
    const orderCards = orders.map(order => {
      const conv = Array.isArray(order.conversation) ? order.conversation : [];
      const lastMessages = conv.slice(-3).reverse();
      
      let messagesHtml = '';
      if (lastMessages.length > 0) {
        messagesHtml = lastMessages.map(m => {
          const from = m.from === 'agent' ? 'المندوب' :
                      m.from === 'page' ? 'الصفحة' :
                      m.from === 'customer' ? 'العميل' :
                      m.from === 'tracking' ? 'المتابعة' : m.from;
          const body = m.type === 'text' ? Utils.escapeHtml(m.text) :
                      m.type === 'image' ? '📷 صورة' :
                      m.type === 'audio' ? '🎤 تسجيل صوتي' : 'رسالة';
          return `<div style="padding: 5px 0; border-bottom: 1px dotted #ddd; font-size: 12px;">
            <strong>${Utils.escapeHtml(from)}:</strong> ${body}
            <span style="color: #999; font-size: 11px;">${Utils.formatDateTime ? Utils.formatDateTime(m.ts) : m.ts}</span>
          </div>`;
        }).join('');
      } else {
        messagesHtml = '<div style="padding: 5px 0; font-size: 12px; color: #999;">لا توجد رسائل</div>';
      }
      
      const statusColor = {
        'معلق': '#ffc107',
        'قيد التنفيذ': '#0d6efd',
        'جاري التوصيل': '#0d6efd',
        'رفض عند الوصول': '#dc3545',
        'تم التسليم': '#198754',
        'مشكلة': '#dc3545',
        'مرفوض': '#212529',
        'ملغي': '#6c757d',
      }[String(order.status || '').trim()] || '#6c757d';
      
      const issueBadge = order.hasIssue ? '<div style="color: #dc3545; font-weight: bold;">⚠️ توجد مشكلة</div>' : '';
      const rejectBadge = order.rejectedOnArrival ? '<div style="color: #dc3545; font-weight: bold;">❌ رفض عند الوصول</div>' : '';
      
      return `
        <div style="border: 1px solid #000; margin-bottom: 20px; page-break-inside: avoid;">
          <div style="background: #f5f5f5; padding: 10px 15px; border-bottom: 1px solid #000; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 700; font-size: 16px;">طلب #${Utils.escapeHtml(order.id)}</div>
            <div style="background: ${statusColor}; color: #fff; padding: 3px 10px; border-radius: 3px; font-size: 12px; font-weight: 600;">
              ${Utils.escapeHtml(order.status || '—')}
            </div>
          </div>
          <div style="padding: 15px;">
            <div style="display: flex; margin-bottom: 8px;">
              <div style="font-weight: 600; min-width: 120px; color: #555;">المندوب:</div>
              <div>${Utils.escapeHtml(order.agentName || '—')} ${order.agentPhone ? `(${Utils.escapeHtml(order.agentPhone)})` : ''}</div>
            </div>
            <div style="display: flex; margin-bottom: 8px;">
              <div style="font-weight: 600; min-width: 120px; color: #555;">الصفحة:</div>
              <div>${Utils.escapeHtml(order.pageName || '—')} ${order.pagePhone ? `(${Utils.escapeHtml(order.pagePhone)})` : ''}</div>
            </div>
            <div style="display: flex; margin-bottom: 8px;">
              <div style="font-weight: 600; min-width: 120px; color: #555;">العميل:</div>
              <div>${Utils.escapeHtml(order.customerName || '—')} ${order.customerPhone ? `(${Utils.escapeHtml(order.customerPhone)})` : ''}</div>
            </div>
            <div style="display: flex; margin-bottom: 8px;">
              <div style="font-weight: 600; min-width: 120px; color: #555;">السعر:</div>
              <div>${order.price || 0} د.أ ${order.priceChanged ? '(تم التعديل)' : ''}</div>
            </div>
            <div style="display: flex; margin-bottom: 8px;">
              <div style="font-weight: 600; min-width: 120px; color: #555;">تاريخ الإنشاء:</div>
              <div>${Utils.formatDateTime ? Utils.formatDateTime(order.createdAt) : order.createdAt}</div>
            </div>
            ${issueBadge}
            ${rejectBadge}
            <div style="font-weight: 700; margin: 15px 0 10px 0; padding-bottom: 5px; border-bottom: 1px solid #ddd; font-size: 14px;">آخر الرسائل</div>
            <div style="max-height: 150px; overflow: hidden;">
              ${messagesHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>طباعة الطلبات</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
      background: #fff;
      color: #000;
      font-size: 14px;
      line-height: 1.5;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #000;">
    <h1 style="margin: 0 0 5px 0; font-size: 24px; font-weight: 700;">Quick Delivery - تقرير الطلبات</h1>
    <div style="font-size: 14px; color: #666;">تاريخ الطباعة: ${dateStr}</div>
    <div style="font-size: 14px; color: #666;">عدد الطلبات: ${orders.length}</div>
  </div>
  ${orderCards}
  <div style="text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #000; font-size: 12px; color: #666;">
    Quick Delivery - جميع الحقوق محفوظة
  </div>
</body>
</html>`;
  }

  function _wireSelectionEvents() {
    // Checkbox in header
    if (els.selectAllHeader) {
      els.selectAllHeader.addEventListener('change', (e) => {
        const checked = Boolean(e.target && e.target.checked);
        const visibleOrders = _getFilteredOrders();
        if (checked) {
          visibleOrders.forEach((o) => state.selectedIds.add(String(o.id)));
        } else {
          visibleOrders.forEach((o) => state.selectedIds.delete(String(o.id)));
        }
        _renderTable();
        _updateSelectionUi();
      });
    }

    // Select all checkbox (above table)
    if (els.selectAllOrders) {
      els.selectAllOrders.addEventListener('change', (e) => {
        const checked = Boolean(e.target && e.target.checked);
        const visibleOrders = _getFilteredOrders();
        if (checked) {
          visibleOrders.forEach((o) => state.selectedIds.add(String(o.id)));
        } else {
          visibleOrders.forEach((o) => state.selectedIds.delete(String(o.id)));
        }
        _renderTable();
        _updateSelectionUi();
      });
    }

    // Individual checkboxes in tbody
    if (els.tbody) {
      els.tbody.addEventListener('change', (e) => {
        const cb = e.target.closest('.order-checkbox');
        if (!cb) return;
        const orderId = String(cb.getAttribute('data-order-id') || '');
        if (cb.checked) {
          state.selectedIds.add(orderId);
        } else {
          state.selectedIds.delete(orderId);
        }
        _updateSelectionUi();
      });
    }

    // Print selected button
    if (els.btnPrintSelected) {
      els.btnPrintSelected.addEventListener('click', () => {
        const ids = Array.from(state.selectedIds);
        if (ids.length === 0) return;
        if (ids.length === 1) {
          _printOrder(ids[0]);
        } else {
          _printMultipleOrders(ids);
        }
      });
    }

    // Clear selection button
    if (els.btnClearSelection) {
      els.btnClearSelection.addEventListener('click', () => {
        state.selectedIds.clear();
        _renderTable();
        _updateSelectionUi();
        // Uncheck the select all checkboxes
        if (els.selectAllHeader) els.selectAllHeader.checked = false;
        if (els.selectAllOrders) els.selectAllOrders.checked = false;
      });
    }
  }

  function _todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function _dateKeyOf(iso) {
    const d = new Date(iso || 0);
    if (!Number.isFinite(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function _timeKeyOf(iso) {
    const d = new Date(iso || 0);
    if (!Number.isFinite(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // Normalize Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to ASCII (0123456789)
  function _normalizeDigits(str) {
    const s = String(str || '');
    const ar = '٠١٢٣٤٥٦٧٨٩';
    return s.replace(/[٠-٩]/g, (ch) => String(ar.indexOf(ch)));
  }

  // Keep only digits from a phone-like string, after normalizing Arabic-Indic digits
  function _digitsOnly(str) {
    const s = _normalizeDigits(str);
    return String(s || '').replace(/[^0-9]/g, '');
  }

  function _getLastMessage(order) {
    const conv = Array.isArray(order.conversation) ? order.conversation : [];
    return conv.length ? conv[conv.length - 1] : null;
  }

  function _fromLabel(msg) {
    const f = String((msg && msg.from) || '');
    if (f === 'agent') return 'المندوب';
    if (f === 'page') return 'الصفحة';
    if (f === 'customer') return 'العميل';
    if (f === 'tracking') {
      const byName = (msg && msg.byName) ? String(msg.byName || '').trim() : '';
      return byName ? `قسم المتابعة (${byName})` : 'قسم المتابعة';
    }
    return '—';
  }

  function _lastMessageSummary(order) {
    const last = _getLastMessage(order);
    if (!last) return '—';

    const sender = _fromLabel(last);
    let body = '—';
    if (last.type === 'text') body = last.text || '—';
    else if (last.type === 'image') body = 'صورة';
    else if (last.type === 'audio') body = 'تسجيل صوتي';
    else body = 'رسالة';

    return `(${sender}): ${body}`;
  }

  function _statusBadge(status) {
    const s = String(status || '').trim();

    const map = {
      'معلق': 'warning',
      'قيد التنفيذ': 'primary',
      'جاري التوصيل': 'primary',
      'جارى التوصيل': 'primary',
      'رفض عند الوصول': 'danger',
      'تعديل سعر': 'warning',
      'تم التسليم': 'success',
      'مشكلة': 'danger',
      'مرفوض': 'dark',
      'ملغي': 'secondary',
    };

    const color = map[s] || 'light';
    const textClass = color === 'light' ? 'text-black' : '';
    const isKnown = Object.prototype.hasOwnProperty.call(map, s);
    const weight = isKnown ? '' : 'fw-bold';

    return `<span class="badge text-bg-${color} ${textClass} ${weight} badge-status">${Utils.escapeHtml(s || '—')}</span>`;
  }

  function _orderMatchesSearch(order, q) {
    if (!q) return true;

    const lastMsg = _lastMessageSummary(order);
    const hay = [
      order.id,
      order.customerName,
      order.customerPhone,
      order.agentName,
      order.agentPhone,
      order.pageName,
      order.pageNumber,
      order.pagePhone,
      order.pageWhatsApp,
      order.status,
      lastMsg,
    ]
      .map((x) => (x == null ? '' : String(x)))
      .join(' | ')
      .toLowerCase();

    return hay.includes(q.toLowerCase());
  }

  function _compareUpdatedAt(a, b) {
    const ai = _isIssueOrder(a) ? 1 : 0;
    const bi = _isIssueOrder(b) ? 1 : 0;
    if (ai !== bi) return bi - ai; // القضايا/التنبيهات أولاً دائمًا

    const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();

    if (state.sort === 'asc') return at - bt;
    return bt - at;
  }

  function _getFilteredOrders() {
    let orders = Store.getOrders();

    // Prepare search term and detect numeric query
    const qRaw = String(state.search || '').trim();
    const q = _normalizeDigits(qRaw);
    const isNumeric = /^\d+$/.test(q);

    // فلترة حسب التاريخ/الوقت (تعتمد على createdAt)
    // عند البحث برقم الطلب (أرقام فقط) نتجاهل فلترة التاريخ/الوقت لعرض النتائج مباشرة
    if (!isNumeric && state.date) {
      orders = orders.filter((o) => {
        const ts = o.updatedAt || o.createdAt;
        const dk = _dateKeyOf(ts);
        if (!dk || dk !== state.date) return false;
        if (state.time) {
          const d = new Date(ts || 0);
          if (!Number.isFinite(d.getTime())) return false;
          const selHour = parseInt(String(state.time).split(':')[0], 10);
          if (!Number.isFinite(selHour)) return true;
          const h = d.getHours();
          if (h === selHour) return true;
          const alt = (selHour + 12) % 24; // سماح AM/PM
          return h === alt;
        }
        return true;
      });
    }

    if (state.rejectedOnly || state.priceChangedOnly) {
      orders = orders.filter((o) => {
        const s = String(o.status || '').trim();
        const rejected = Boolean(o.rejectedOnArrival) || s === 'مرفوض' || s === 'رفض عند الوصول';
        const priceChanged = Boolean(o.priceChanged) || s.includes('تعديل سعر');

        if (state.rejectedOnly && state.priceChangedOnly) {
          return rejected || priceChanged;
        }
        if (state.rejectedOnly) return rejected;
        if (state.priceChangedOnly) return priceChanged;
        return true;
      });
    }

    if (state.search) {
      if (isNumeric) {
        // بحث مباشر بالأرقام (as-you-type): رقم الطلب (بادئة) أو رقم هاتف المندوب (أي جزء)
        orders = orders.filter((o) => {
          const phone = _digitsOnly(o.agentPhone);
          return String(o.id).startsWith(q) || (phone && phone.includes(q));
        });
      } else {
        orders = orders.filter((o) => _orderMatchesSearch(o, state.search));
      }
    }

    orders.sort(_compareUpdatedAt);
    return orders;
  }

  function _isIssueOrder(order) {
    const status = String(order.status || '');
    const hasAlert = window.Alerts ? Alerts.hasActiveAlert(order.id) : false;
    const hasIssue = Boolean(order.hasIssue);
    return status === 'مشكلة' || status === 'مرفوض' || hasIssue || hasAlert;
  }

  function _updateMetrics() {
    if (els.metricsRow) {
      els.metricsRow.classList.toggle('d-none', !els.metricsRow.dataset || els.metricsRow.dataset.enabled !== '1');
    }

    const orders = Store.getOrders();

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const createdToday = orders.filter((o) => {
      const d = new Date(o.createdAt || 0);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return key === todayKey;
    }).length;

    const issues = orders.filter((o) => _isIssueOrder(o)).length;

    Utils.setText(els.metricToday, createdToday);
    Utils.setText(els.metricIssues, issues);
  }

  function _statusSummary(order) {
    const s = String(order.status || '').trim();
    const showRejected = Boolean(order.rejectedOnArrival) && s !== 'رفض عند الوصول';
    const showPriceChanged = Boolean(order.priceChanged) && !s.includes('تعديل سعر');

    const statusStr = String(order.status || '').trim();
    const parts = [];
    if (statusStr) {
      parts.push(_statusBadge(statusStr));
    }
    if (showRejected) parts.push('<span class="badge text-bg-danger">رفض عند الوصول</span>');
    if (showPriceChanged) parts.push('<span class="badge text-bg-warning text-dark">تعديل سعر</span>');
    return parts.join(' ');
  }

  function _rowHtml(order) {
    const lastMsg = _lastMessageSummary(order);

    const hasAlert = window.Alerts ? Alerts.hasActiveAlert(order.id) : false;
    const trClass = hasAlert ? 'order-row--alert' : '';
    const isSelected = state.selectedIds.has(String(order.id));

    return `
      <tr class="${trClass}" data-order-id="${Utils.escapeHtml(order.id)}" role="button" style="cursor:pointer">
        <td onclick="event.stopPropagation()">
          <input type="checkbox" class="form-check-input order-checkbox" data-order-id="${Utils.escapeHtml(order.id)}" ${isSelected ? 'checked' : ''} />
        </td>
        <td class="fw-semibold">${Utils.escapeHtml(order.id)}</td>
        <td>
          <div class="fw-semibold">${Utils.escapeHtml(order.agentName || '—')}</div>
          <div class="small text-muted mt-1">${Utils.escapeHtml(order.agentPhone || '—')}</div>
        </td>
        <td>
          <div class="fw-semibold">${Utils.escapeHtml(order.pageName || '—')}</div>
          <div class="small text-muted mt-1">${Utils.escapeHtml(order.pagePhone || '—')}</div>
        </td>
        <td>${_statusSummary(order)}</td>
        <td title="${Utils.escapeHtml(lastMsg)}">${Utils.escapeHtml(Utils.truncate(lastMsg, 72))}</td>
        <td>${Utils.escapeHtml(Utils.formatDateTime(order.updatedAt))}</td>
        <td class="text-end">
          <div class="d-inline-flex gap-1">
            <a class="btn btn-outline-secondary btn-sm" href="order-details.html?id=${encodeURIComponent(order.id)}">تفاصيل</a>
            <button class="btn btn-outline-primary btn-sm" type="button" data-action="print-order" data-order-id="${Utils.escapeHtml(order.id)}">
              <i class="bi bi-printer ms-1"></i> طباعة PDF
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function _renderTable() {
    const orders = _getFilteredOrders();

    if (!els.tbody) return;

    if (!orders.length) {
      els.tbody.innerHTML = '';
      if (els.empty) els.empty.classList.remove('d-none');
      return;
    }

    if (els.empty) els.empty.classList.add('d-none');

    els.tbody.innerHTML = orders.map(_rowHtml).join('');
  }

  function _applySortBtnUi() {
    if (!els.sortBtn) return;

    const icon = state.sort === 'desc' ? 'bi-sort-down' : 'bi-sort-up';
    const text = state.sort === 'desc' ? 'ترتيب حسب آخر تحديث' : 'ترتيب حسب أقدم تحديث';

    els.sortBtn.innerHTML = `<i class="bi ${icon} ms-1"></i>${text}`;
  }

  function _resetFilters() {
    state.search = '';
    state.sort = 'desc';
    state.date = _todayKey();
    state.time = '';
    state.rejectedOnly = false;
    state.priceChangedOnly = false;

    if (els.searchInput) els.searchInput.value = '';
    if (els.dateFilter) els.dateFilter.value = state.date;
    if (els.timeFilter) els.timeFilter.value = '';
    if (els.rejectedFilter) els.rejectedFilter.checked = false;
    if (els.priceChangedFilter) els.priceChangedFilter.checked = false;

    _applySortBtnUi();
    _updateMetrics();
    _renderTable();
  }

  function _wireEvents() {
    if (els.searchInput) {
      els.searchInput.addEventListener(
        'input',
        Utils.debounce((e) => {
          state.search = String(e.target.value || '').trim();
          _renderTable();
        }, 150)
      );
    }

    if (els.dateFilter) {
      els.dateFilter.addEventListener('change', (e) => {
        state.date = String(e.target.value || '').trim();
        _renderTable();
      });
    }

    if (els.timeFilter) {
      els.timeFilter.addEventListener('change', (e) => {
        state.time = String(e.target.value || '').trim();
        _renderTable();
      });
    }

    if (els.rejectedFilter) {
      els.rejectedFilter.addEventListener('change', (e) => {
        state.rejectedOnly = Boolean(e.target && e.target.checked);
        _renderTable();
      });
    }

    if (els.priceChangedFilter) {
      els.priceChangedFilter.addEventListener('change', (e) => {
        state.priceChangedOnly = Boolean(e.target && e.target.checked);
        _renderTable();
      });
    }

    if (els.sortBtn) {
      els.sortBtn.addEventListener('click', () => {
        state.sort = state.sort === 'desc' ? 'asc' : 'desc';
        _applySortBtnUi();
        _renderTable();
      });
    }

    if (els.resetBtn) {
      els.resetBtn.addEventListener('click', () => {
        _resetFilters();
      });
    }

    if (els.tbody) {
      els.tbody.addEventListener('click', (e) => {
        const printBtn = e.target.closest('button[data-action="print-order"]');
        if (printBtn) {
          e.preventDefault();
          e.stopPropagation();
          const orderId = printBtn.getAttribute('data-order-id');
          _printOrder(orderId);
          return;
        }

        // إذا كان النقر على رابط تفاصيل، نحفظ id ثم نترك المتصفح يتابع التنقل.
        const a = e.target.closest('a');
        if (a) {
          const href = a.getAttribute('href') || '';
          if (href.includes('order-details') && href.includes('id=')) {
            try {
              const u = new URL(href, window.location.href);
              const idFromHref = u.searchParams.get('id');
              if (idFromHref) {
                window.localStorage.setItem('deliverydash_last_order_id_v1', String(idFromHref));
              }
            } catch {}
          }
          return;
        }

        // لا تتدخل إذا كان النقر على زر داخل الصف.
        if (e.target.closest('button')) return;

        const tr = e.target.closest('tr[data-order-id]');
        if (!tr) return;
        const orderId = tr.getAttribute('data-order-id');
        if (!orderId) return;

        // حفظ آخر طلب تم الضغط عليه (للاسترجاع عند فتح الصفحة بدون ?id بسبب إعدادات السيرفر)
        try {
          window.localStorage.setItem('deliverydash_last_order_id_v1', String(orderId));
        } catch {}
        window.location.href = `order-details.html?id=${encodeURIComponent(orderId)}`;
      });
    }

    if (window.Realtime) {
      Realtime.on(Realtime.Events.STORE_CHANGED, () => {
        _updateMetrics();
        _renderTable();
      });

      Realtime.on(Realtime.Events.ALERT_CREATED, () => {
        _updateMetrics();
        _renderTable();
      });

      Realtime.on(Realtime.Events.ALERT_RESOLVED, () => {
        _updateMetrics();
        _renderTable();
      });
    }
  }

  function _applyRole(session) {
    // Tracking: يرى الطلبات فقط بدون إحصائيات
    if (!session) return;

    if (els.metricsRow) {
      els.metricsRow.dataset.enabled = '1';
      els.metricsRow.classList.toggle('d-none', false);
    }
  }

  OrdersPage.init = (session) => {
    els.tbody = Utils.qs('#ordersTbody');
    els.empty = Utils.qs('#ordersEmpty');
    els.searchInput = Utils.qs('#searchInput');
    els.dateFilter = Utils.qs('#dateFilter');
    els.timeFilter = Utils.qs('#timeFilter');
    els.rejectedFilter = Utils.qs('#filterRejected');
    els.priceChangedFilter = Utils.qs('#filterPriceChanged');
    els.sortBtn = Utils.qs('#sortBtn');
    els.resetBtn = Utils.qs('#btnResetFilters');
    els.metricsRow = Utils.qs('#metricsRow');
    els.metricToday = Utils.qs('#metricToday');
    els.metricIssues = Utils.qs('#metricIssues');
    els.selectAllHeader = Utils.qs('#selectAllHeader');
    els.selectAllOrders = Utils.qs('#selectAllOrders');
    els.selectedCount = Utils.qs('#selectedCount');
    els.btnPrintSelected = Utils.qs('#btnPrintSelected');
    els.btnClearSelection = Utils.qs('#btnClearSelection');

    _applyRole(session);
    _applySortBtnUi();

    // افتراضيًا: عرض طلبات اليوم فقط (كل يوم جديد -> جدول يبدو فارغًا)
    state.date = _todayKey();
    state.time = '';
    if (els.dateFilter) els.dateFilter.value = state.date;
    if (els.timeFilter) els.timeFilter.value = '';

    // أول render بعد تحميل البيانات
    _updateMetrics();
    _renderTable();

    _wireEvents();
    _wireSelectionEvents();
  };

  window.OrdersPage = OrdersPage;
})();
