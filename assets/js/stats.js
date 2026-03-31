(function () {
  'use strict';

  const StatsPage = {};

  let chartDaily = null;
  let chartAgents = null;
  let chartMiniAwaiting = null;
  let chartTrackingPerf = null;

  let _trackingPerfLoading = false;
  let _trackingPerfPending = false;

  function _dayKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function _lastNDays(n) {
    const days = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push(d);
    }
    return days;
  }

  function _formatDayLabel(d) {
    return new Intl.DateTimeFormat('ar', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
  }

  function _computeDaily(orders) {
    // اليوم - بيانات لكل ساعة (0-23) لرسم منحنى
    const todayKey = _dayKey(new Date());
    const todayOrders = orders.filter((o) => _dayKey(o.createdAt || o.updatedAt || 0) === todayKey);
    
    // Initialize counts for each hour (0-23)
    const hourlyCounts = new Array(24).fill(0);
    
    todayOrders.forEach((o) => {
      const ts = o.createdAt || o.updatedAt || 0;
      const d = new Date(ts);
      if (!Number.isFinite(d.getTime())) return;
      const hour = d.getHours();
      hourlyCounts[hour] += 1;
    });
    
    // Create labels for hours (0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22)
    const labels = [];
    const data = [];
    for (let i = 0; i < 24; i += 2) {
      labels.push(`${i}:00`);
      data.push(hourlyCounts[i] + (hourlyCounts[i + 1] || 0)); // Sum every 2 hours
    }
    
    const total = hourlyCounts.reduce((a, b) => a + b, 0);
    const maxHour = hourlyCounts.indexOf(Math.max(...hourlyCounts));
    
    return { 
      labels: labels,
      data: data,
      total: total,
      peakHour: maxHour,
      hourly: hourlyCounts
    };
  }

  function _computeDailyBy(orders, predicate) {
    // آخر 7 أيام (افتراضي لمعظم المصغرات)
    const days = _lastNDays(7);
    const labels = days.map(_formatDayLabel);
    const keys = days.map(_dayKey);
    const countsByKey = keys.reduce((acc, k) => (acc[k] = 0, acc), {});
    orders.forEach((o) => {
      if (!predicate(o)) return;
      const k = _dayKey(o.createdAt || o.updatedAt || 0);
      if (countsByKey[k] != null) countsByKey[k] += 1;
    });
    const data = keys.map((k) => countsByKey[k] || 0);
    return { labels, data };
  }

  function _computeTodayBy(orders, predicate) {
    // اليوم فقط (مخصص لـ "بانتظار رد الصفحة")
    const todayKey = _dayKey(new Date());
    const count = orders.filter((o) => predicate(o) && _dayKey(o.createdAt || o.updatedAt || 0) === todayKey).length;
    return { labels: ['اليوم'], data: [count] };
  }

  function _agentKey(order) {
    const phone = String((order && order.agentPhone) || '').trim();
    const name = String((order && order.agentName) || '').trim();
    return phone || name || 'غير معروف';
  }

  function _agentLabel(order) {
    const name = String((order && order.agentName) || '').trim();
    const phone = String((order && order.agentPhone) || '').trim();
    return name || phone || 'غير معروف';
  }

  function _orderRejectTs(order) {
    const tl = Array.isArray(order && order.timeline) ? order.timeline : [];
    for (let i = tl.length - 1; i >= 0; i -= 1) {
      const t = tl[i] || {};
      const st = String(t.status || '').trim();
      const note = String(t.note || '').trim();
      if (st === 'رفض عند الوصول' || st === 'مرفوض' || st.includes('مرفوض') || note.includes('رفض عند الوصول')) {
        return t.ts || null;
      }
    }

    const stNow = String((order && order.status) || '').trim();
    const rejected = Boolean(order && order.rejectedOnArrival) || stNow === 'رفض عند الوصول' || stNow === 'مرفوض' || stNow.includes('مرفوض');
    if (!rejected) return null;
    return (order && (order.updatedAt || order.createdAt)) || null;
  }

  function _computeAgentsRejected(orders, range) {
    const fromIso = _rangeStartIso(range);
    const fromMs = Date.parse(fromIso);

    const map = {};
    orders.forEach((o) => {
      const ts = _orderRejectTs(o);
      if (!ts) return;
      const ms = Date.parse(ts);
      if (!Number.isFinite(ms) || ms < fromMs) return;
      const key = _agentKey(o);
      if (!map[key]) map[key] = { label: _agentLabel(o), count: 0 };
      map[key].count += 1;
    });

    const entries = Object.entries(map)
      .map(([k, v]) => ({ key: k, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count);

    if (!entries.length) {
      return {
        labels: [],
        data: [],
      };
    }

    const limit = window.innerWidth >= 992 ? 12 : 8;
    const top = entries.slice(0, limit);
    return {
      labels: top.map((x) => x.label),
      data: top.map((x) => x.count),
    };
  }

  function _computeAgentMessages(orders, range) {
    const fromIso = _rangeStartIso(range);
    const fromMs = Date.parse(fromIso);

    const map = {};
    orders.forEach((o) => {
      const key = _agentKey(o);
      const label = _agentLabel(o);
      const conv = Array.isArray(o && o.conversation) ? o.conversation : [];
      conv.forEach((m) => {
        const from = String((m && m.from) || '').trim();
        if (from !== 'agent') return;
        const ts = (m && (m.ts || m.createdAt || m.sentAt)) || null;
        const ms = Date.parse(ts || '');
        if (!Number.isFinite(ms) || ms < fromMs) return;
        if (!map[key]) map[key] = { label, count: 0 };
        map[key].count += 1;
      });
    });

    const entries = Object.entries(map)
      .map(([k, v]) => ({ key: k, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count);

    if (!entries.length) {
      return {
        labels: [],
        data: [],
      };
    }

    const limit = window.innerWidth >= 992 ? 12 : 8;
    const top = entries.slice(0, limit);
    return {
      labels: top.map((x) => x.label),
      data: top.map((x) => x.count),
    };
  }

  function _ensureCharts() {
    if (!window.Chart) return false;

    const dailyCanvas = Utils.qs('#chartDaily');
    const agentsCanvas = Utils.qs('#chartAgents');
    const miniAwaitingCanvas = Utils.qs('#chartMiniAwaiting');
    const trackingPerfCanvas = Utils.qs('#chartTrackingPerf');

    if (!dailyCanvas || !agentsCanvas || !miniAwaitingCanvas) return false;

    Chart.defaults.locale = 'ar';
    Chart.defaults.font.family = 'Cairo, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    Chart.defaults.color = '#e2e8f0';

    if (!chartDaily) {
      chartDaily = new Chart(dailyCanvas, {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'الطلبات',
              data: [],
              borderColor: 'rgba(13, 110, 253, 1)',
              backgroundColor: 'rgba(13, 110, 253, 0.15)',
              borderWidth: 3,
              tension: 0.4,
              pointRadius: 5,
              pointBackgroundColor: 'rgba(13, 110, 253, 1)',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: false },
            tooltip: {
              rtl: true,
              displayColors: false,
              callbacks: {
                title(items) {
                  return (items && items[0] && items[0].label) ? String(items[0].label) : '';
                },
                label(ctx) {
                  const v = Number((ctx && ctx.parsed && ctx.parsed.y) || 0);
                  return `الطلبات: ${v}`;
                },
              },
            },
          },
          scales: {
            x: { 
              grid: { display: false }, 
              ticks: { color: '#e2e8f0', font: { size: 10 } }
            },
            y: { 
              grid: { color: 'rgba(255,255,255,0.1)' }, 
              ticks: { display: false },
              beginAtZero: true
            },
          },
          elements: { line: { borderJoinStyle: 'round' } },
        },
      });
    }

    if (!chartAgents) {
      chartAgents = new Chart(agentsCanvas, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [
            {
              label: 'رفض عند الوصول',
              data: [],
              backgroundColor: 'rgba(220, 53, 69, 0.85)',
              borderWidth: 0,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { rtl: true } },
          scales: {
            x: { grid: { display: false }, ticks: { display: false } },
            y: { grid: { display: false }, ticks: { color: '#e2e8f0', font: { size: 12, weight: '600' } } },
          },
        },
      });
    }

    if (!chartMiniAwaiting) {
      chartMiniAwaiting = new Chart(miniAwaitingCanvas, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [
            {
              label: 'رسائل المندوب',
              data: [],
              backgroundColor: 'rgba(13, 110, 253, 0.85)',
              borderWidth: 0,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { rtl: true, displayColors: false },
          },
          scales: {
            x: { grid: { display: false }, ticks: { display: false } },
            y: { grid: { display: false }, ticks: { color: '#e2e8f0', font: { size: 12, weight: '600' } } },
          },
        },
      });
    }

    if (trackingPerfCanvas && !chartTrackingPerf) {
      chartTrackingPerf = new Chart(trackingPerfCanvas, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Score',
              data: [],
              backgroundColor: 'rgba(255, 193, 7, 0.9)',
              borderWidth: 0,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              rtl: true,
              displayColors: false,
              callbacks: {
                title(items) {
                  return (items && items[0] && items[0].label) ? String(items[0].label) : '';
                },
                label(ctx) {
                  const v = Number((ctx && ctx.parsed && (ctx.parsed.x != null ? ctx.parsed.x : ctx.parsed.y)) || 0);
                  return `Score: ${v}`;
                },
                afterBody(items) {
                  try {
                    const item = items && items[0];
                    const chart = item && item.chart;
                    const idx = item && typeof item.dataIndex === 'number' ? item.dataIndex : -1;
                    const entries = chart && chart.$trackingPerfEntries ? chart.$trackingPerfEntries : [];
                    const e = (Array.isArray(entries) && idx >= 0) ? entries[idx] : null;
                    if (!e) return [];
                    return [
                      `الرسائل: ${Number(e.messages || 0)}`,
                      `حلّ المشاكل: ${Number(e.resolutions || 0)}`,
                      `الأداء: ${String(e.perf || _performanceLabel(e.score))}`,
                    ];
                  } catch {
                    return [];
                  }
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { display: false } },
            y: { grid: { display: false }, ticks: { color: '#e2e8f0', font: { size: 12, weight: '600' } } },
          },
        },
      });
    }

    return true;
  }

  function _resizeCanvases() {
    const isLg = window.innerWidth >= 992;

    const dailyCanvas = Utils.qs('#chartDaily');
    if (dailyCanvas) {
      dailyCanvas.style.height = `${isLg ? 160 : 200}px`;
    }

    const calcBarHeight = (labelsCount) => {
      const base = isLg ? 180 : 220;
      const per = isLg ? 28 : 32;
      const extra = 80;
      const n = Math.max(1, Number(labelsCount || 0));
      return Math.max(base, extra + n * per);
    };

    const agentsCanvas = Utils.qs('#chartAgents');
    if (agentsCanvas) {
      const n = chartAgents && chartAgents.data && Array.isArray(chartAgents.data.labels) ? chartAgents.data.labels.length : 0;
      agentsCanvas.style.height = `${calcBarHeight(n)}px`;
    }

    const miniCanvas = Utils.qs('#chartMiniAwaiting');
    if (miniCanvas) {
      const n = chartMiniAwaiting && chartMiniAwaiting.data && Array.isArray(chartMiniAwaiting.data.labels) ? chartMiniAwaiting.data.labels.length : 0;
      miniCanvas.style.height = `${calcBarHeight(n)}px`;
    }

    const trackingCanvas = Utils.qs('#chartTrackingPerf');
    if (trackingCanvas) {
      const n = chartTrackingPerf && chartTrackingPerf.data && Array.isArray(chartTrackingPerf.data.labels) ? chartTrackingPerf.data.labels.length : 0;
      trackingCanvas.style.height = `${calcBarHeight(n)}px`;
    }
  }

  function _refreshAgentsRejected() {
    if (!_ensureCharts()) return;
    if (!chartAgents) return;
    const orders = Store.getOrders();
    const rangeEl = Utils.qs('#agentsRejectRange');
    const range = rangeEl ? String(rangeEl.value || 'month') : 'month';
    const agents = _computeAgentsRejected(orders, range);
    chartAgents.data.labels = agents.labels;
    chartAgents.data.datasets[0].data = agents.data;
    chartAgents.update();
    _resizeCanvases();
  }

  function _refreshMiniAgentMessages() {
    if (!_ensureCharts()) return;
    if (!chartMiniAwaiting) return;
    const orders = Store.getOrders();
    const rangeEl = Utils.qs('#miniAgentMsgRange');
    const range = rangeEl ? String(rangeEl.value || 'month') : 'month';
    const ds = _computeAgentMessages(orders, range);
    chartMiniAwaiting.data.labels = ds.labels;
    chartMiniAwaiting.data.datasets[0].data = ds.data;
    chartMiniAwaiting.update();
    _resizeCanvases();
    return ds;
  }

  function _rangeStartIso(range) {
    const now = Date.now();
    const ms = range === 'day'
      ? 24 * 60 * 60 * 1000
      : range === 'week'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
    return new Date(now - ms).toISOString();
  }

  function _performanceLabel(score) {
    const s = Number(score || 0);
    if (s >= 30) return 'عالي';
    if (s >= 10) return 'متوسط';
    return 'ضعيف';
  }

  function _performanceColor(perf) {
    const p = String(perf || '');
    if (p === 'عالي') return 'rgba(25, 135, 84, 0.9)';
    if (p === 'متوسط') return 'rgba(255, 193, 7, 0.9)';
    return 'rgba(220, 53, 69, 0.9)';
  }

  async function _loadUsers(sb) {
    let rows = [];
    try {
      const { data, error } = await sb.rpc('admin_list_users');
      if (!error) rows = Array.isArray(data) ? data : [];
    } catch {}

    if (!rows.length) {
      try {
        const { data, error } = await sb
          .from('users_profile')
          .select('id, full_name, role, is_approved, is_blocked, is_deleted');
        if (!error) rows = Array.isArray(data) ? data : [];
      } catch {}
    }

    const list = Array.isArray(rows) ? rows : [];
    return list
      .filter((r) => String(r.role || '') !== 'Admin')
      .filter((r) => !Boolean(r.is_deleted) && !Boolean(r.is_blocked))
      .filter((r) => r.is_approved == null ? true : Boolean(r.is_approved))
      .map((r) => ({
        id: String(r.id || ''),
        name: String(r.full_name || '—'),
      }))
      .filter((u) => u.id);
  }

  async function _refreshTrackingPerf() {
    const rangeEl = Utils.qs('#trackingPerfRange');
    const hintEl = Utils.qs('#trackingPerfHint');
    const tableEl = Utils.qs('#trackingPerfTable');
    if (!rangeEl || !hintEl) return;

    if (_trackingPerfLoading) {
      _trackingPerfPending = true;
      return;
    }
    _trackingPerfLoading = true;

    try {
      hintEl.textContent = 'جاري التحميل...';
      if (tableEl) {
        tableEl.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">جاري التحميل...</td></tr>';
      }

      if (!window.SupabaseClient || typeof SupabaseClient.isConfigured !== 'function' || !SupabaseClient.isConfigured()) {
        if (tableEl) {
          tableEl.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Supabase غير مفعّل.</td></tr>';
        }
        hintEl.textContent = 'Supabase غير مفعّل. Score = الرسائل + 3×حلّ المشاكل. عالي ≥ 30، متوسط 10–29، ضعيف < 10.';
        return;
      }

      const sb = SupabaseClient.getClient();
      if (!sb) return;

      let sessOk = false;
      try {
        const s = sb.auth && typeof sb.auth.getSession === 'function' ? await sb.auth.getSession() : null;
        sessOk = Boolean(s && s.data && s.data.session);
      } catch {}
      if (!sessOk) {
        if (tableEl) {
          tableEl.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">يرجى تسجيل الدخول.</td></tr>';
        }
        hintEl.textContent = 'يرجى تسجيل الدخول. Score = الرسائل + 3×حلّ المشاكل. عالي ≥ 30، متوسط 10–29، ضعيف < 10.';
        return;
      }

      const range = String(rangeEl.value || 'month');
      const fromIso = _rangeStartIso(range);
      const users = await _loadUsers(sb);
      const ids = users.map((u) => u.id);

      const countsMsg = {};
      const countsRes = {};

      if (ids.length) {
        try {
          const { data, error } = await sb
            .from('audit_logs')
            .select('actor_id, created_at')
            .eq('table_name', 'messages')
            .eq('action', 'INSERT')
            .gte('created_at', fromIso)
            .in('actor_id', ids);
          if (!error && Array.isArray(data)) {
            data.forEach((r) => {
              const id = r && r.actor_id ? String(r.actor_id) : '';
              if (!id) return;
              countsMsg[id] = (countsMsg[id] || 0) + 1;
            });
          }
        } catch {}

        try {
          let resRows = [];
          let resErr = null;
          try {
            const { data, error } = await sb
              .from('audit_logs')
              .select('actor_id, new_data, created_at')
              .eq('table_name', 'order_status_history')
              .eq('action', 'INSERT')
              .gte('created_at', fromIso)
              .in('actor_id', ids)
              .eq('new_data->>status', 'تم حل المشكلة');
            resErr = error || null;
            if (!error && Array.isArray(data)) resRows = data;
          } catch (e) {
            resErr = e;
          }

          if (resErr) {
            try {
              const { data, error } = await sb
                .from('audit_logs')
                .select('actor_id, new_data, created_at')
                .eq('table_name', 'order_status_history')
                .eq('action', 'INSERT')
                .gte('created_at', fromIso)
                .in('actor_id', ids);
              if (!error && Array.isArray(data)) resRows = data;
            } catch {}
          }

          (Array.isArray(resRows) ? resRows : []).forEach((r) => {
            const id = r && r.actor_id ? String(r.actor_id) : '';
            if (!id) return;
            const st = r && r.new_data && r.new_data.status ? String(r.new_data.status) : '';
            if (st !== 'تم حل المشكلة') return;
            countsRes[id] = (countsRes[id] || 0) + 1;
          });
        } catch {}
      }

      const entries = users
        .map((u) => {
          const messages = Number(countsMsg[u.id] || 0);
          const resolutions = Number(countsRes[u.id] || 0);
          const score = messages + 3 * resolutions;
          return {
            id: u.id,
            name: u.name,
            messages,
            resolutions,
            score,
            perf: _performanceLabel(score),
          };
        })
        // Hide inactive users in the selected range to avoid showing names with empty charts.
        .filter((e) => Number(e.messages || 0) > 0 || Number(e.resolutions || 0) > 0)
        .sort((a, b) => b.score - a.score);

      const maxBars = window.innerWidth >= 992 ? 12 : 8;
      const shown = entries.slice(0, maxBars);

      if (!shown.length) {
        if (tableEl) {
          tableEl.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">لا توجد بيانات.</td></tr>';
        }
        hintEl.textContent = 'لا توجد بيانات. Score = الرسائل + 3×حلّ المشاكل. عالي ≥ 30، متوسط 10–29، ضعيف < 10.';
        if (chartTrackingPerf) {
          chartTrackingPerf.data.labels = [];
          chartTrackingPerf.data.datasets[0].data = [];
          chartTrackingPerf.data.datasets[0].backgroundColor = 'rgba(255, 193, 7, 0.9)';
          chartTrackingPerf.$trackingPerfEntries = [];
          chartTrackingPerf.update();
        }
        return;
      }

      if (tableEl) tableEl.innerHTML = '';

      hintEl.textContent = 'Score = الرسائل + 3×حلّ المشاكل. عالي ≥ 30، متوسط 10–29، ضعيف < 10.';

      if (chartTrackingPerf) {
        chartTrackingPerf.data.labels = shown.map((e) => e.name);
        chartTrackingPerf.data.datasets[0].data = shown.map((e) => e.score);
        chartTrackingPerf.data.datasets[0].backgroundColor = shown.map((e) => _performanceColor(e.perf));
        chartTrackingPerf.$trackingPerfEntries = shown;
        chartTrackingPerf.update();
        _resizeCanvases();
      }
    } finally {
      _trackingPerfLoading = false;
      if (_trackingPerfPending) {
        _trackingPerfPending = false;
        _refreshTrackingPerf();
      }
    }
  }

  function _refresh() {
    if (!_ensureCharts()) return;

    const orders = Store.getOrders();

    const daily = _computeDaily(orders);
    chartDaily.data.labels = daily.labels;
    chartDaily.data.datasets[0].data = daily.data;
    chartDaily.update();
    (function(){
      try {
        const setText = (sel, v) => { const el = Utils.qs(sel); if (el) el.textContent = v; };
        const total = Number(daily.total || 0);
        const peakHour = Number(daily.peakHour || 0);
        const now = new Date();
        const currentHour = now.getHours();
        const soFar = daily.hourly.slice(0, currentHour + 1).reduce((a, b) => a + b, 0);
        
        setText('#dailyTotal', `اليوم: ${total}`);
        setText('#dailyPeak', `الأعلى: ${daily.hourly[peakHour] || 0} (${peakHour}:00)`);
        setText('#dailyAvg', `حتى الآن: ${soFar}`);
      } catch {}
    })();

    _refreshAgentsRejected();

    const miniAgentMsgs = _refreshMiniAgentMessages() || { labels: [], data: [] };

    const setText = (sel, v) => {
      const el = Utils.qs(sel);
      if (el) el.textContent = v;
    };
    const updateSummary = (prefix, ds) => {
      const labels = Array.isArray(ds && ds.labels) ? ds.labels : [];
      const arr = Array.isArray(ds && ds.data) ? ds.data.map((x) => Number(x || 0)) : [];
      if (!arr.length) {
        setText(`#${prefix}Total`, 'الإجمالي: 0');
        setText(`#${prefix}Peak`, 'الأعلى: 0');
        setText(`#${prefix}Avg`, 'المتوسط: 0');
        return;
      }
      const sum = arr.reduce((a, b) => a + b, 0);
      const max = Math.max.apply(null, arr);
      const idx = arr.indexOf(max);
      const label = labels[idx] || '';
      const avg = sum / arr.length;
      setText(`#${prefix}Total`, `الإجمالي: ${sum}`);
      setText(`#${prefix}Peak`, `الأعلى: ${max} (${label})`);
      setText(`#${prefix}Avg`, `المتوسط: ${avg.toFixed(1)}`);
    };
    updateSummary('miniAwaiting', miniAgentMsgs);

    _refreshTrackingPerf();
  }

  StatsPage.init = () => {
    _resizeCanvases();
    _refresh();

    const rangeEl = Utils.qs('#trackingPerfRange');
    if (rangeEl) {
      rangeEl.addEventListener('change', () => {
        _refreshTrackingPerf();
      });
    }

    const agentsRangeEl = Utils.qs('#agentsRejectRange');
    if (agentsRangeEl) {
      agentsRangeEl.addEventListener('change', () => {
        _refreshAgentsRejected();
      });
    }

    const miniAgentMsgRangeEl = Utils.qs('#miniAgentMsgRange');
    if (miniAgentMsgRangeEl) {
      miniAgentMsgRangeEl.addEventListener('change', () => {
        const ds = _refreshMiniAgentMessages() || { labels: [], data: [] };
        (function(){
          try {
            const setText = (sel, v) => { const el = Utils.qs(sel); if (el) el.textContent = v; };
            const labels = Array.isArray(ds && ds.labels) ? ds.labels : [];
            const arr = Array.isArray(ds && ds.data) ? ds.data.map((x) => Number(x || 0)) : [];
            if (!arr.length) {
              setText('#miniAwaitingTotal', 'الإجمالي: 0');
              setText('#miniAwaitingPeak', 'الأعلى: 0');
              setText('#miniAwaitingAvg', 'المتوسط: 0');
              return;
            }
            const sum = arr.reduce((a, b) => a + b, 0);
            const max = Math.max.apply(null, arr);
            const idx = arr.indexOf(max);
            const label = labels[idx] || '';
            const avg = sum / arr.length;
            setText('#miniAwaitingTotal', `الإجمالي: ${sum}`);
            setText('#miniAwaitingPeak', `الأعلى: ${max} (${label})`);
            setText('#miniAwaitingAvg', `المتوسط: ${avg.toFixed(1)}`);
          } catch {}
        })();
      });
    }

    if (window.Realtime) {
      Realtime.on(Realtime.Events.STORE_CHANGED, _refresh);
      Realtime.on(Realtime.Events.ALERT_CREATED, _refresh);
      Realtime.on(Realtime.Events.ALERT_RESOLVED, _refresh);
    }

    window.addEventListener('resize', Utils.debounce(() => {
      _resizeCanvases();
      _refresh();
    }, 150));
  };

  window.StatsPage = StatsPage;
})();
