(function () {
  'use strict';

  const STORAGE_KEY = 'deliverydash_orders_v1';
  const MSG_SENDER_KEY = 'deliverydash_msg_sender_v1';

  // بيانات افتراضية كخطة بديلة في حال فشل fetch (مثلاً عند فتح الملفات مباشرة عبر file://)
  // المصدر الأساسي للبيانات هو: assets/data/orders.json
  const DEFAULT_ORDERS = [
    {
      id: 1001,
      customerName: 'أحمد محمود',
      agentPhone: '201001234567',
      pageName: 'متجر النخبة',
      pageNumber: '01',
      status: 'قيد التنفيذ',
      awaitingPageReply: true,
      price: 120,
      rejectedOnArrival: false,
      createdAt: '2026-01-03T10:10:00.000Z',
      updatedAt: '2026-01-05T08:30:00.000Z',
      conversation: [
        {
          id: 'm1',
          type: 'text',
          from: 'customer',
          text: 'السلام عليكم، محتاج الطلب بسرعة لو سمحت.',
          ts: '2026-01-05T08:10:00.000Z',
        },
        {
          id: 'm2',
          type: 'text',
          from: 'agent',
          text: 'تمام، جاري المتابعة مع الصفحة.',
          ts: '2026-01-05T08:12:00.000Z',
        },
        {
          id: 'm3',
          type: 'text',
          from: 'page',
          text: 'تم الاستلام وسيتم التجهيز الآن.',
          ts: '2026-01-05T08:30:00.000Z',
        },
      ],
      timeline: [
        { status: 'معلق', ts: '2026-01-03T10:10:00.000Z', note: 'تم إنشاء الطلب' },
        { status: 'قيد التنفيذ', ts: '2026-01-05T08:12:00.000Z', note: 'تم إسناد الطلب للمندوب' },
      ],
    },
    {
      id: 1002,
      customerName: 'سارة علي',
      agentPhone: '201227654321',
      pageName: 'سوق المدينة',
      pageNumber: '02',
      status: 'معلق',
      awaitingPageReply: true,
      price: 75,
      rejectedOnArrival: false,
      createdAt: '2026-01-05T07:20:00.000Z',
      updatedAt: '2026-01-05T07:35:00.000Z',
      conversation: [
        {
          id: 'm1',
          type: 'text',
          from: 'customer',
          text: 'هل تم إرسال الطلب للصفحة؟',
          ts: '2026-01-05T07:20:00.000Z',
        },
        {
          id: 'm2',
          type: 'text',
          from: 'agent',
          text: 'نعم، بانتظار الرد.',
          ts: '2026-01-05T07:35:00.000Z',
        },
      ],
      timeline: [{ status: 'معلق', ts: '2026-01-05T07:20:00.000Z', note: 'تم إنشاء الطلب' }],
    },
    {
      id: 1003,
      customerName: 'محمد إبراهيم',
      agentPhone: '201115551111',
      pageName: 'عطور الروان',
      pageNumber: '03',
      status: 'تم التسليم',
      awaitingPageReply: false,
      price: 210,
      rejectedOnArrival: false,
      createdAt: '2026-01-02T11:00:00.000Z',
      updatedAt: '2026-01-04T16:25:00.000Z',
      conversation: [
        {
          id: 'm1',
          type: 'text',
          from: 'page',
          text: 'تم تجهيز الطلب، جاهز للاستلام.',
          ts: '2026-01-04T14:05:00.000Z',
        },
        {
          id: 'm2',
          type: 'image',
          from: 'page',
          src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='560' height='320'><rect width='100%25' height='100%25' fill='%23eef2ff'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Cairo, Arial' font-size='28' fill='%230f172a'>صورة فاتورة (تجريبية)</text></svg>",
          ts: '2026-01-04T14:06:00.000Z',
        },
        {
          id: 'm3',
          type: 'text',
          from: 'agent',
          text: 'تم التسليم للعميل بنجاح.',
          ts: '2026-01-04T16:25:00.000Z',
        },
      ],
      timeline: [
        { status: 'معلق', ts: '2026-01-02T11:00:00.000Z', note: 'تم إنشاء الطلب' },
        { status: 'قيد التنفيذ', ts: '2026-01-04T14:05:00.000Z', note: 'بدء التنفيذ' },
        { status: 'تم التسليم', ts: '2026-01-04T16:25:00.000Z', note: 'تم التسليم' },
      ],
    },
    {
      id: 1004,
      customerName: 'ريم حسن',
      agentPhone: '201009990000',
      pageName: 'ملابس ستايل',
      pageNumber: '01',
      status: 'مشكلة',
      awaitingPageReply: false,
      price: 145,
      rejectedOnArrival: false,
      createdAt: '2026-01-04T09:05:00.000Z',
      updatedAt: '2026-01-05T09:01:00.000Z',
      conversation: [
        {
          id: 'm1',
          type: 'text',
          from: 'agent',
          text: 'تم التواصل مع الصفحة ولم يصل رد حتى الآن.',
          ts: '2026-01-05T08:55:00.000Z',
        },
        {
          id: 'm2',
          type: 'text',
          from: 'customer',
          text: 'في مشكلة؟',
          ts: '2026-01-05T09:01:00.000Z',
        },
      ],
      timeline: [
        { status: 'معلق', ts: '2026-01-04T09:05:00.000Z', note: 'تم إنشاء الطلب' },
        { status: 'مشكلة', ts: '2026-01-05T09:01:00.000Z', note: 'تم وضع الطلب كحالة مشكلة' },
      ],
    },
    {
      id: 1005,
      customerName: 'خالد يوسف',
      agentPhone: '201333221100',
      pageName: 'الكترونيات برو',
      pageNumber: '02',
      status: 'مرفوض',
      awaitingPageReply: false,
      price: 399,
      rejectedOnArrival: true,
      createdAt: '2026-01-01T15:40:00.000Z',
      updatedAt: '2026-01-03T12:10:00.000Z',
      conversation: [
        {
          id: 'm1',
          type: 'text',
          from: 'agent',
          text: 'العميل رفض الطلب عند الوصول.',
          ts: '2026-01-03T12:10:00.000Z',
        },
      ],
      timeline: [
        { status: 'معلق', ts: '2026-01-01T15:40:00.000Z', note: 'تم إنشاء الطلب' },
        { status: 'مرفوض', ts: '2026-01-03T12:10:00.000Z', note: 'رفض عند الوصول' },
      ],
    },
    {
      id: 1006,
      customerName: 'ندى سمير',
      agentPhone: '201010101010',
      pageName: 'مستلزمات بيت',
      pageNumber: '03',
      status: 'قيد التنفيذ',
      awaitingPageReply: false,
      price: 65,
      rejectedOnArrival: false,
      createdAt: '2025-12-31T10:00:00.000Z',
      updatedAt: '2026-01-05T06:45:00.000Z',
      conversation: [
        {
          id: 'm1',
          type: 'text',
          from: 'page',
          text: 'تم تجهيز الطلب.',
          ts: '2026-01-05T06:40:00.000Z',
        },
        {
          id: 'm2',
          type: 'audio',
          from: 'agent',
          durationSec: 8,
          ts: '2026-01-05T06:45:00.000Z',
        },
      ],
      timeline: [
        { status: 'معلق', ts: '2025-12-31T10:00:00.000Z', note: 'تم إنشاء الطلب' },
        { status: 'قيد التنفيذ', ts: '2026-01-05T06:45:00.000Z', note: 'تم تحديث الحالة' },
      ],
    },
  ];

  const Store = {};

  let _orders = [];
  let _initialized = false;
  let _realtimeWired = false;

  function _loadSenderMap() {
    try {
      const raw = window.localStorage.getItem(MSG_SENDER_KEY);
      const parsed = Utils.safeJsonParse(raw, null);
      if (!parsed || typeof parsed !== 'object') return {};
      if (Array.isArray(parsed)) return {};
      return parsed;
    } catch {
      return {};
    }
  }

  function _saveSenderMap(map) {
    try {
      window.localStorage.setItem(MSG_SENDER_KEY, JSON.stringify(map || {}));
    } catch {}
  }

  function _rememberSender(msgId, byName) {
    const id = String(msgId || '').trim();
    const name = String(byName || '').trim();
    if (!id || !name) return;
    try {
      const map = _loadSenderMap();
      map[id] = name;
      const keys = Object.keys(map);
      if (keys.length > 800) {
        const next = {};
        const slice = keys.slice(keys.length - 400);
        slice.forEach((k) => { next[k] = map[k]; });
        _saveSenderMap(next);
        return;
      }
      _saveSenderMap(map);
    } catch {}
  }

  function _applyRememberedSender(message) {
    try {
      if (!message) return;
      if (String(message.from || '') !== 'tracking') return;
      if (message.byName) return;
      const id = String(message.id || '').trim();
      if (!id) return;
      const map = _loadSenderMap();
      const name = map && map[id] ? String(map[id]) : '';
      if (name) message.byName = name;
    } catch {}
  }

  function _emitStoreReady() {
    if (!window.Realtime) return;
    Realtime.emit(Realtime.Events.STORE_READY, { orders: Store.getOrders() });
  }

  function _emitStoreChanged() {
    if (!window.Realtime) return;
    Realtime.emit(Realtime.Events.STORE_CHANGED, { orders: Store.getOrders() });
  }

  function _wireRealtimeToStore() {
    if (_realtimeWired) return;
    if (!window.Realtime || typeof Realtime.on !== 'function') return;

    _realtimeWired = true;

    Realtime.on(Realtime.Events.ORDER_CREATED, ({ order }) => {
      if (!order) return;

      let target = Store.getOrderById(order.id);
      if (!target) {
        target = _orders.find((o) => o && o.__supabasePending);
      }

      const now = Utils.nowIso();

      if (target) {
        const existingConversation = Array.isArray(target.conversation) ? target.conversation : [];
        const existingTimeline = Array.isArray(target.timeline) ? target.timeline : [];

        Object.assign(target, order);

        if (!Array.isArray(target.conversation) || !target.conversation.length) {
          target.conversation = existingConversation;
        }

        if (!Array.isArray(target.timeline) || !target.timeline.length) {
          target.timeline = existingTimeline.length
            ? existingTimeline
            : [{ status: target.status || 'معلق', ts: target.createdAt || now, note: 'تم إنشاء الطلب' }];
        }

        if (target.__supabasePending) {
          delete target.__supabasePending;
        }
      } else {
        const normalized = Object.assign({}, order);
        if (!Array.isArray(normalized.conversation)) normalized.conversation = [];
        if (!Array.isArray(normalized.timeline)) {
          normalized.timeline = [{ status: normalized.status || 'معلق', ts: normalized.createdAt || now, note: 'تم إنشاء الطلب' }];
        }

        _orders.unshift(normalized);
      }

      _persist();
      _emitStoreChanged();
    });

    Realtime.on(Realtime.Events.ORDER_UPDATED, ({ order }) => {
      if (!order) return;

      const existing = Store.getOrderById(order.id);
      if (existing) {
        const prevStatus = existing.status;
        Object.assign(existing, order);

        if (order.status && order.status !== prevStatus) {
          const ts = existing.updatedAt || Utils.nowIso();
          if (!Array.isArray(existing.timeline)) existing.timeline = [];
          existing.timeline.push({ status: order.status, ts, note: 'تحديث حالة الطلب' });
        }

        _persist();
        return;
      }

      const normalized = Object.assign({}, order);
      if (!Array.isArray(normalized.conversation)) normalized.conversation = [];
      if (!Array.isArray(normalized.timeline)) normalized.timeline = [];
      _orders.unshift(normalized);
      _persist();
    });

    Realtime.on(Realtime.Events.MESSAGE_RECEIVED, ({ orderId, message }) => {
      if (!orderId || !message) return;
      const order = Store.getOrderById(orderId);
      if (!order) return;

      if (!Array.isArray(order.conversation)) order.conversation = [];

      const msgId = String(message.id || '');
      if (msgId && order.conversation.some((m) => String(m.id || '') === msgId)) return;

      order.conversation.push(message);

      if (message.from === 'page') {
        order.awaitingPageReply = false;
      }

      const nextTs = message.ts || Utils.nowIso();
      const prevTime = new Date(order.updatedAt || order.createdAt || 0).getTime();
      const nextTime = new Date(nextTs || 0).getTime();
      if (!Number.isFinite(prevTime) || (Number.isFinite(nextTime) && nextTime > prevTime)) {
        order.updatedAt = nextTs;
      }

      _persist();
      _emitStoreChanged();
    });
  }

  function _persist() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(_orders));
  }

  function _loadPersisted() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = Utils.safeJsonParse(raw, null);
    if (!Array.isArray(parsed)) return false;
    _orders = parsed;
    return true;
  }

  async function _loadFromJson() {
    const res = await fetch('assets/data/orders.json', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Failed to load orders.json');
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.orders)) {
      throw new Error('Invalid orders.json format');
    }

    _orders = data.orders;
  }

  function _isSupabaseEnabled() {
    return Boolean(window.SupabaseClient && typeof SupabaseClient.isConfigured === 'function' && SupabaseClient.isConfigured());
  }

  async function _hasSupabaseSession() {
    const sb = _isSupabaseEnabled() ? SupabaseClient.getClient() : null;
    if (!sb || !sb.auth || typeof sb.auth.getSession !== 'function') return false;

    try {
      const res = await sb.auth.getSession();
      return Boolean(res && res.data && res.data.session);
    } catch {
      return false;
    }
  }

  function _isUuid(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '').trim());
  }

  function _uuidv4() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    const cryptoObj = window.crypto || window.msCrypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      cryptoObj.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    const r = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
    return `${r()}${r()}-${r()}-${r()}-${r()}-${r()}${r()}${r()}`;
  }

  function _ensureMessageId(inputId) {
    const existing = String(inputId || '').trim();
    if (_isSupabaseEnabled()) {
      if (existing && _isUuid(existing)) return existing;
      return _uuidv4();
    }

    return existing || `m-${Date.now()}`;
  }

  function _runAsync(fn) {
    Promise.resolve()
      .then(fn)
      .catch(() => {});
  }

  function _buildOrderInsertRow(order) {
    return {
      customer_name: order.customerName,
      agent_phone: order.agentPhone,
      page_name: order.pageName,
      page_number: order.pageNumber,
      page_phone: order.pagePhone,
      page_whatsapp: order.pageWhatsApp,
      page_id: order.pageId,
      status: order.status,
      awaiting_page_reply: order.awaitingPageReply,
      price: order.price,
      rejected_on_arrival: order.rejectedOnArrival,
      has_issue: order.hasIssue,
    };
  }

  function _buildOrderUpdateRow(patch) {
    const row = {};

    if (patch.customerName !== undefined) row.customer_name = patch.customerName;
    if (patch.agentPhone !== undefined) row.agent_phone = patch.agentPhone;
    if (patch.pageName !== undefined) row.page_name = patch.pageName;
    if (patch.pageNumber !== undefined) row.page_number = patch.pageNumber;
    if (patch.pagePhone !== undefined) row.page_phone = patch.pagePhone;
    if (patch.pageWhatsApp !== undefined) row.page_whatsapp = patch.pageWhatsApp;
    if (patch.pageId !== undefined) row.page_id = patch.pageId;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.awaitingPageReply !== undefined) row.awaiting_page_reply = patch.awaitingPageReply;
    if (patch.price !== undefined) row.price = patch.price;
    if (patch.rejectedOnArrival !== undefined) row.rejected_on_arrival = patch.rejectedOnArrival;
    if (patch.hasIssue !== undefined) row.has_issue = patch.hasIssue;

    return row;
  }

  function _buildMessageInsertRow(orderId, message) {
    const type = String(message.type || 'text');

    const row = {
      id: message.id,
      order_id: orderId,
      type,
      from_role: String(message.from || 'agent'),
      text: message.text || null,
      media_url: message.src || null,
      audio_duration_sec: message.durationSec != null ? Number(message.durationSec) : null,
      created_at: message.ts || Utils.nowIso(),
    };

    if (type !== 'text') row.text = null;
    if (type !== 'image' && type !== 'audio') row.media_url = null;
    if (type !== 'audio') row.audio_duration_sec = null;

    return row;
  }

  function _mapOrderRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      agentName: row.agent_name,
      agentPhone: row.agent_phone,
      pageName: row.page_name,
      pageNumber: row.page_number,
      pagePhone: row.page_phone,
      pageWhatsApp: row.page_whatsapp,
      pageId: row.page_id,
      status: row.status,
      awaitingPageReply: row.awaiting_page_reply,
      price: row.price != null ? Number(row.price) : 0,
      priceChanged: Boolean(row.price_changed),
      rejectedOnArrival: row.rejected_on_arrival,
      hasIssue: row.has_issue,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      conversation: [],
      timeline: [],
    };
  }

  function _mapMessageRow(row) {
    if (!row) return null;
    const mapped = {
      id: row.id,
      type: row.type,
      from: row.from_role,
      byName: row.by_name,
      text: row.text,
      src: row.media_url,
      durationSec: row.audio_duration_sec,
      ts: row.created_at,
    };
    _applyRememberedSender(mapped);
    return mapped;
  }

  function _mapStatusHistoryRow(row) {
    if (!row) return null;
    return {
      status: row.status,
      ts: row.created_at,
      note: row.note,
    };
  }

  async function _loadFromSupabase() {
    const sb = _isSupabaseEnabled() ? SupabaseClient.getClient() : null;
    if (!sb) return false;

    const ordersRes = await sb
      .from('orders')
      .select(
        'id, customer_name, customer_phone, agent_name, agent_phone, page_name, page_number, page_phone, page_whatsapp, page_id, status, awaiting_page_reply, price, price_changed, rejected_on_arrival, has_issue, created_at, updated_at'
      )
      .order('updated_at', { ascending: false });

    if (ordersRes.error) return false;

    const orderRows = Array.isArray(ordersRes.data) ? ordersRes.data : [];
    if (!orderRows.length) {
      _orders = [];
      _persist();
      return true;
    }

    const orderIds = orderRows.map((r) => r.id);

    const [messagesRes, historyRes] = await Promise.all([
      sb
        .from('messages')
        .select('id, order_id, type, from_role, by_name, text, media_url, audio_duration_sec, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: true }),
      sb
        .from('order_status_history')
        .select('id, order_id, status, note, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: true }),
    ]);

    if (messagesRes.error || historyRes.error) return false;

    const messagesByOrderId = {};
    (Array.isArray(messagesRes.data) ? messagesRes.data : []).forEach((row) => {
      const oid = row ? row.order_id : null;
      if (oid == null) return;
      if (!messagesByOrderId[oid]) messagesByOrderId[oid] = [];
      const mapped = _mapMessageRow(row);
      if (mapped) messagesByOrderId[oid].push(mapped);
    });

    const historyByOrderId = {};
    (Array.isArray(historyRes.data) ? historyRes.data : []).forEach((row) => {
      const oid = row ? row.order_id : null;
      if (oid == null) return;
      if (!historyByOrderId[oid]) historyByOrderId[oid] = [];
      const mapped = _mapStatusHistoryRow(row);
      if (mapped) historyByOrderId[oid].push(mapped);
    });

    _orders = orderRows
      .map((row) => {
        const order = _mapOrderRow(row);
        if (!order) return null;

        const oid = row.id;
        order.conversation = (messagesByOrderId[oid] || []).slice();
        order.timeline = (historyByOrderId[oid] || []).slice();
        return order;
      })
      .filter(Boolean);

    _persist();
    return true;
  }

  Store.init = async () => {
    if (_initialized) return Store.getOrders();

    _wireRealtimeToStore();

    let loadedFromSupabase = false;
    if (_isSupabaseEnabled()) {
      try {
        const hasSession = await _hasSupabaseSession();
        loadedFromSupabase = hasSession ? await _loadFromSupabase() : false;
      } catch {
        loadedFromSupabase = false;
      }
    }

    if (!loadedFromSupabase) {
      // 1) حاول القراءة من LocalStorage
      const hasPersisted = _loadPersisted();

      // 2) إن لم توجد بيانات محلية، حاول قراءة ملف JSON
      if (!hasPersisted) {
        try {
          await _loadFromJson();
        } catch {
          // 3) كخطة بديلة: بيانات افتراضية داخلية
          _orders = DEFAULT_ORDERS;
        }

        _persist();
      }
    }

    _initialized = true;
    _emitStoreReady();
    _emitStoreChanged();

    return Store.getOrders();
  };

  Store.getOrders = () => _orders.slice();

  Store.getOrderById = (id) => {
    const key = String(id);
    return _orders.find((o) => String(o.id) === key) || null;
  };

  Store.createOrder = (partial = {}) => {
    return null;
  };

  Store.updateOrder = (id, patch = {}, options = {}) => {
    const order = Store.getOrderById(id);
    if (!order) return Promise.reject(new Error('order not found'));

    const next = Object.assign({}, order, patch || {});
    Object.assign(order, next);
    order.updatedAt = Utils.nowIso();
    _persist();
    _emitStoreChanged();

    if (!_isSupabaseEnabled()) return Promise.resolve(order);

    return (async () => {
      const hasSession = await _hasSupabaseSession();
      if (!hasSession) return order;

      const sb = SupabaseClient.getClient();
      if (!sb) return order;

      if (patch && patch.status !== undefined) {
        const newStatus = String(patch.status || '').trim();
        if (newStatus) {
          const rpcRes = await sb.rpc('tracking_update_order_status', {
            p_order_id: Number(id),
            p_status: newStatus,
          });
          if (rpcRes.error) throw rpcRes.error;

          const rows = Array.isArray(rpcRes.data) ? rpcRes.data : [rpcRes.data];
          const row = rows && rows[0] ? rows[0] : null;
          const mapped = _mapOrderRow(row);
          if (mapped) {
            const existing = Store.getOrderById(id);
            if (existing) {
              const prevStatus = existing.status;
              Object.assign(existing, mapped);
              if (mapped.status && mapped.status !== prevStatus) {
                const ts = existing.updatedAt || Utils.nowIso();
                if (!Array.isArray(existing.timeline)) existing.timeline = [];
                existing.timeline.push({ status: mapped.status, ts, note: 'تحديث حالة الطلب' });
              }
              _persist();
              _emitStoreChanged();
              return existing;
            }
          }
        }
      }

      return order;
    })();
  };

  Store.addMessage = async (orderId, messageInput = {}) => {
    const order = Store.getOrderById(orderId);
    if (!order) throw new Error('order not found');

    const type = String(messageInput.type || 'text');
    const text = type === 'text' ? String(messageInput.text || '') : null;
    const mediaUrl = (type === 'image' || type === 'audio') ? (String(messageInput.src || '') || null) : null;
    const audioSec = type === 'audio' && messageInput.durationSec != null ? Number(messageInput.durationSec) : null;

    let byName = '';
    try {
      const provided = String(messageInput.byName || '').trim();
      if (provided) byName = provided;
    } catch {}
    if (!byName) {
      try {
        if (window.Auth && typeof Auth.getSession === 'function') {
          const s = await Auth.getSession();
          const nm = s && s.name ? String(s.name).trim() : '';
          if (nm) byName = nm;
        }
      } catch {}
    }

    if (_isSupabaseEnabled()) {
      try {
        const hasSession = await _hasSupabaseSession();
        if (hasSession) {
          const sb = SupabaseClient.getClient();
          const rpcRes = await sb.rpc('tracking_add_message', {
            p_order_id: Number(orderId),
            p_type: type,
            p_text: text,
            p_media_url: mediaUrl,
            p_audio_duration_sec: audioSec,
          });

          if (rpcRes.error) throw rpcRes.error;
          const rows = Array.isArray(rpcRes.data) ? rpcRes.data : [rpcRes.data];
          const row = rows && rows[0];
          const mapped = _mapMessageRow(row);
          if (mapped) {
            // Dashboard-originated messages should appear as Tracking in the UI
            mapped.from = 'tracking';
            if (byName) {
              mapped.byName = byName;
              _rememberSender(mapped.id, byName);
            }
            if (type === 'audio' && !mapped.src && mediaUrl) {
              mapped.src = mediaUrl;
            }
            if (!Array.isArray(order.conversation)) order.conversation = [];
            const msgId = String(mapped.id || '');
            const exists = msgId && order.conversation.some((m) => String(m.id || '') === msgId);
            if (!exists) order.conversation.push(mapped);
            const nextTs = mapped.ts || Utils.nowIso();
            const prevTime = new Date(order.updatedAt || order.createdAt || 0).getTime();
            const nextTime = new Date(nextTs || 0).getTime();
            if (!Number.isFinite(prevTime) || (Number.isFinite(nextTime) && nextTime > prevTime)) {
              order.updatedAt = nextTs;
            }
            _persist();
            _emitStoreChanged();
            return mapped;
          }
        }
      } catch (e) {}
    }

    const msg = {
      id: _ensureMessageId(messageInput.id),
      type,
      from: 'tracking',
      text,
      src: mediaUrl,
      durationSec: audioSec,
      ts: Utils.nowIso(),
    };

    if (byName) {
      msg.byName = byName;
      _rememberSender(msg.id, byName);
    }

    if (!Array.isArray(order.conversation)) order.conversation = [];
    order.conversation.push(msg);
    order.updatedAt = msg.ts;
    _persist();
    _emitStoreChanged();
    return msg;
  };

  Store.reload = async () => {
    let loadedFromSupabase = false;
    if (_isSupabaseEnabled()) {
      try {
        const hasSession = await _hasSupabaseSession();
        loadedFromSupabase = hasSession ? await _loadFromSupabase() : false;
      } catch {
        loadedFromSupabase = false;
      }
    }

    if (!loadedFromSupabase) {
      const hasPersisted = _loadPersisted();
      if (!hasPersisted) {
        try {
          await _loadFromJson();
        } catch {
          _orders = DEFAULT_ORDERS.slice();
        }
        _persist();
      }
    }

    _emitStoreChanged();
    return Store.getOrders();
  };

  Store.resetDemoData = async () => {
    // مفيد أثناء العرض على العميل.
    _orders = DEFAULT_ORDERS.slice();
    _persist();
    _emitStoreChanged();
    return Store.getOrders();
  };

  window.Store = Store;
})();
