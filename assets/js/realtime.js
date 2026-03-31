(function () {
  'use strict';

  const Events = {
    STORE_READY: 'store:ready',
    STORE_CHANGED: 'store:changed',

    ORDER_CREATED: 'order:created',
    ORDER_UPDATED: 'order:updated',

    MESSAGE_RECEIVED: 'message:received',

    ALERT_CREATED: 'alert:created',
    ALERT_RESOLVED: 'alert:resolved',
  };

  const Realtime = {};

  Realtime.Events = Events;

  Realtime.emit = (eventName, detail = {}) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  };

  Realtime.on = (eventName, handler) => {
    const wrapped = (evt) => handler(evt.detail || {});
    window.addEventListener(eventName, wrapped);
    return () => window.removeEventListener(eventName, wrapped);
  };

  let _connected = false;
  let _channels = [];
  let _alertsChannel = null;

  function _isSupabaseEnabled() {
    return Boolean(window.SupabaseClient && typeof SupabaseClient.isConfigured === 'function' && SupabaseClient.isConfigured());
  }

  function _mapOrderRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      customerName: row.customer_name,
      agentPhone: row.agent_phone,
      pageName: row.page_name,
      pageNumber: row.page_number,
      status: row.status,
      awaitingPageReply: row.awaiting_page_reply,
      price: row.price,
      rejectedOnArrival: row.rejected_on_arrival,
      hasIssue: row.has_issue,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function _mapMessageRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      type: row.type,
      from: row.from_role,
      byName: row.by_name,
      text: row.text,
      src: row.media_url,
      durationSec: row.audio_duration_sec,
      ts: row.created_at,
    };
  }

  function _mergeWithStoreOrder(mappedOrder) {
    if (!mappedOrder) return null;
    if (!window.Store || typeof Store.getOrderById !== 'function') return mappedOrder;

    let existing = Store.getOrderById(mappedOrder.id);

    if (!existing && typeof Store.getOrders === 'function') {
      const all = Store.getOrders();
      existing = all.find((o) => o && o.__supabasePending);
    }

    if (!existing) return mappedOrder;

    return Object.assign({}, existing, mappedOrder, {
      conversation: existing.conversation,
      timeline: existing.timeline,
    });
  }

  Realtime.disconnect = async () => {
    if (!_channels.length) {
      _connected = false;
      return true;
    }

    const sb = _isSupabaseEnabled() ? SupabaseClient.getClient() : null;

    const channels = _channels.slice();
    _channels = [];
    _connected = false;
    _alertsChannel = null;

    if (!sb) return true;

    await Promise.all(
      channels.map((ch) => {
        try {
          return sb.removeChannel(ch);
        } catch {
          return null;
        }
      })
    );

    return true;
  };

  Realtime.connect = () => {
    if (_connected) return true;

    if (!_isSupabaseEnabled()) {
      _connected = true;
      return true;
    }

    const sb = SupabaseClient.getClient();
    if (!sb) return false;

    const ordersChannel = sb
      .channel('realtime:orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const mapped = _mapOrderRow(payload.new);
          const merged = _mergeWithStoreOrder(mapped);
          Realtime.emit(Realtime.Events.ORDER_CREATED, { order: merged });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const mapped = _mapOrderRow(payload.new);
          const merged = _mergeWithStoreOrder(mapped);
          Realtime.emit(Realtime.Events.ORDER_UPDATED, { order: merged });
          Realtime.emit(Realtime.Events.STORE_CHANGED, { orders: window.Store ? Store.getOrders() : [] });
        }
      )
      .subscribe();

    const messagesChannel = sb
      .channel('realtime:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new;
          const message = _mapMessageRow(row);
          const orderId = row ? row.order_id : null;

          Realtime.emit(Realtime.Events.MESSAGE_RECEIVED, { orderId, message });
        }
      )
      .subscribe();

    const alertsChannel = sb
      .channel('realtime:alerts')
      .on('broadcast', { event: 'alert_resolved' }, (payload) => {
        const p = payload && payload.payload ? payload.payload : {};
        const orderId = p.orderId || p.order_id || p.id || null;
        if (orderId) {
          Realtime.emit(Realtime.Events.ALERT_RESOLVED, { orderId: String(orderId) });
        }
      })
      .subscribe();
    _alertsChannel = alertsChannel;

    _channels = [ordersChannel, messagesChannel, alertsChannel];
    _connected = true;
    return true;
  };

  Realtime.broadcast = (eventName, payload = {}) => {
    if (!_isSupabaseEnabled()) return false;
    const sb = SupabaseClient.getClient();
    if (!sb || !_alertsChannel) return false;
    try {
      _alertsChannel.send({ type: 'broadcast', event: String(eventName || ''), payload });
      return true;
    } catch {
      return false;
    }
  };

  window.Realtime = Realtime;
})();
