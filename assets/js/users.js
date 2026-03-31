(function () {
  'use strict';

  const UsersPage = {};

  const els = {
    tbody: null,
    empty: null,
    alert: null,
    refresh: null,
    filter: null,
  };

  let _allRows = [];
  let _meId = '';
  let _primaryAdminId = '';

  function _computePrimaryAdminId(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const admins = list
      .filter((u) => String(u && u.role || '') === 'Admin')
      .filter((u) => !Boolean(u && u.is_deleted))
      .map((u) => ({ id: String(u.id || ''), ts: Date.parse(u.created_at || '') }))
      .filter((u) => u.id && Number.isFinite(u.ts))
      .sort((a, b) => a.ts - b.ts);
    return admins.length ? admins[0].id : '';
  }

  function _countPending(rows) {
    const list = Array.isArray(rows) ? rows : [];
    return list.filter((u) => {
      const role = String(u.role || '');
      const isApproved = Boolean(u.is_approved);
      const isDeleted = Boolean(u.is_deleted);
      // Only non-admins, not deleted, not approved
      return role !== 'Admin' && !isDeleted && !isApproved;
    }).length;
  }

  function _updatePendingBadge() {
    const n = _countPending(_allRows);
    const el = document.getElementById('usersPendingBadge');
    const elSm = document.getElementById('usersPendingBadgeSm');
    if (el) {
      if (n > 0) {
        el.textContent = String(n);
        el.classList.remove('d-none');
      } else {
        el.classList.add('d-none');
      }
    }
    if (elSm) {
      if (n > 0) {
        elSm.textContent = String(n);
        elSm.classList.remove('d-none');
      } else {
        elSm.classList.add('d-none');
      }
    }
  }

  function _mapProfileRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      full_name: row.full_name,
      phone: row.phone,
      role: row.role,
      is_approved: Boolean(row.is_approved),
      is_blocked: Boolean(row.is_blocked),
      is_deleted: Boolean(row.is_deleted),
      created_at: row.created_at,
    };
  }

  function _showError(msg) {
    if (!els.alert) return;
    els.alert.textContent = msg || '';
    els.alert.classList.remove('d-none');
  }

  function _hideError() {
    if (!els.alert) return;
    els.alert.classList.add('d-none');
    els.alert.textContent = '';
  }

  function _statusBadges(u) {
    const badges = [];

    const role = String(u.role || '');
    const isApproved = Boolean(u.is_approved);
    const isBlocked = Boolean(u.is_blocked);
    const isDeleted = Boolean(u.is_deleted);

    if (role === 'Admin') {
      badges.push('<span class="badge text-bg-primary">Admin</span>');
    } else {
      badges.push('<span class="badge text-bg-light text-dark border">Tracking</span>');
    }

    if (isDeleted) {
      badges.push('<span class="badge text-bg-dark">محذوف</span>');
      return badges.join(' ');
    }

    // Only non-admins get pending/approved badges
    if (role !== 'Admin') {
      if (!isApproved) {
        badges.push('<span class="badge text-bg-warning text-dark">بانتظار الموافقة</span>');
      } else {
        badges.push('<span class="badge text-bg-success">مُعتمد</span>');
      }
    }

    if (isBlocked) {
      badges.push('<span class="badge text-bg-danger">محظور</span>');
    }

    return badges.join(' ');
  }

  function _actionsHtml(u) {
    const id = Utils.escapeHtml(u.id);
    const role = String(u.role || '');
    const isApproved = Boolean(u.is_approved);
    const isBlocked = Boolean(u.is_blocked);
    const isDeleted = Boolean(u.is_deleted);

    const isSelf = Boolean(_meId) && String(u.id || '') === String(_meId);

    if (isDeleted) {
      return '<span class="text-muted small">—</span>';
    }

    const btns = [];

    if (!isSelf) {
      if (role === 'Admin') {
        const isPrimary = Boolean(_primaryAdminId) && String(u.id || '') === String(_primaryAdminId);
        if (!isPrimary) {
          btns.push(
            `<button class="btn btn-outline-warning btn-sm" data-action="role-tracking" data-id="${id}">
              <i class="bi bi-shield-x ms-1"></i>
              إلغاء Admin
            </button>`
          );
        }
      } else {
        btns.push(
          `<button class="btn btn-outline-primary btn-sm" data-action="role-admin" data-id="${id}">
            <i class="bi bi-shield-check ms-1"></i>
            جعل Admin
          </button>`
        );
      }
    }

    if (role !== 'Admin' && !isApproved) {
      btns.push(
        `<button class="btn btn-success btn-sm" data-action="approve" data-id="${id}">
          <i class="bi bi-check2 ms-1"></i>
          موافقة
        </button>`
      );
    }

    if (role !== 'Admin' && isBlocked) {
      btns.push(
        `<button class="btn btn-outline-success btn-sm" data-action="unblock" data-id="${id}">
          <i class="bi bi-unlock ms-1"></i>
          إلغاء الحظر
        </button>`
      );
    } else if (role !== 'Admin') {
      btns.push(
        `<button class="btn btn-outline-danger btn-sm" data-action="block" data-id="${id}">
          <i class="bi bi-lock ms-1"></i>
          حظر
        </button>`
      );
    }

    if (role !== 'Admin') {
      btns.push(
        `<button class="btn btn-outline-dark btn-sm" data-action="delete" data-id="${id}">
          <i class="bi bi-trash ms-1"></i>
          حذف
        </button>`
      );
    }

    return `<div class="d-flex gap-2 justify-content-end flex-wrap">${btns.join('')}</div>`;
  }

  function _rowHtml(u) {
    return `
      <tr>
        <td class="fw-semibold">${Utils.escapeHtml(u.full_name || '—')}</td>
        <td>${Utils.escapeHtml(u.phone || '—')}</td>
        <td>${Utils.escapeHtml(u.role || '—')}</td>
        <td>${_statusBadges(u)}</td>
        <td>${Utils.escapeHtml(Utils.formatDateTime(u.created_at))}</td>
        <td class="text-end">${_actionsHtml(u)}</td>
      </tr>
    `;
  }

  function _matchesFilter(u, filter) {
    const role = String(u.role || '');
    const isApproved = Boolean(u.is_approved);
    const isBlocked = Boolean(u.is_blocked);
    const isDeleted = Boolean(u.is_deleted);

    // Admin row is always visible in "all" to avoid confusion.
    if (role === 'Admin') {
      return filter === 'all';
    }

    if (filter === 'pending') return !isDeleted && !isApproved;
    if (filter === 'approved') return !isDeleted && isApproved;
    if (filter === 'active') return !isDeleted && isApproved && !isBlocked;
    if (filter === 'blocked') return !isDeleted && isBlocked;
    if (filter === 'deleted') return isDeleted;
    return true;
  }

  function _render(rows) {
    const filter = els.filter ? String(els.filter.value || 'all') : 'all';
    const filtered = (Array.isArray(rows) ? rows : []).filter((u) => _matchesFilter(u, filter));

    if (els.empty) {
      els.empty.classList.toggle('d-none', filtered.length > 0);
    }

    if (els.tbody) {
      els.tbody.innerHTML = filtered.map(_rowHtml).join('');
      if (filtered.length === 0) {
        els.tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">—</td></tr>';
      }
    }
  }

  async function _load() {
    _hideError();

    const sb = window.SupabaseClient ? SupabaseClient.getClient() : null;
    if (!sb) return;

    if (els.tbody) {
      els.tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">جاري التحميل...</td></tr>';
    }
    if (els.refresh) els.refresh.disabled = true;

    let rows = [];
    let rpcErr = null;
    let fallbackTried = false;
    try {
      const { data, error } = await sb.rpc('admin_list_users');
      rpcErr = error || null;
      if (!error) rows = Array.isArray(data) ? data : [];
    } catch (e) {
      rpcErr = e;
    }

    if (rpcErr) {
      try {
        const { data, error } = await sb
          .from('users_profile')
          .select('id, full_name, phone, role, is_approved, is_blocked, is_deleted, created_at')
          .order('created_at', { ascending: false });
        fallbackTried = true;
        if (!error && Array.isArray(data)) rows = data.map(_mapProfileRow).filter(Boolean);
      } catch {}
    }

    if (els.refresh) els.refresh.disabled = false;
    _allRows = Array.isArray(rows) ? rows : [];
    _primaryAdminId = _computePrimaryAdminId(_allRows);
    _render(_allRows);
    _updatePendingBadge();

    if (rpcErr && fallbackTried && _allRows.length === 0) {
      _showError('تعذر تحميل المستخدمين. يرجى تثبيت وظائف الإدارة في قاعدة البيانات.');
    }
  }

  async function _approve(userId) {
    _hideError();

    const sb = window.SupabaseClient ? SupabaseClient.getClient() : null;
    if (!sb) return;

    const { error } = await sb.rpc('admin_approve_user', { p_user_id: String(userId) });
    if (error) {
      _showError(error.message || 'تعذر تنفيذ الموافقة.');
      return;
    }

    await _load();
  }

  async function _setRole(userId, role) {
    _hideError();

    const sb = window.SupabaseClient ? SupabaseClient.getClient() : null;
    if (!sb) return;

    const targetId = String(userId);
    const nextRole = String(role || '').trim();
    if (!targetId || !nextRole) return;

    const { error } = await sb.rpc('admin_set_user_role', {
      p_user_id: targetId,
      p_role: nextRole,
    });

    if (error) {
      _showError(error.message || 'تعذر تحديث الدور.');
      return;
    }

    await _load();
  }

  async function _setBlocked(userId, blocked) {
    _hideError();

    const sb = window.SupabaseClient ? SupabaseClient.getClient() : null;
    if (!sb) return;

    const { error } = await sb.rpc('admin_set_user_blocked', {
      p_user_id: String(userId),
      p_blocked: Boolean(blocked),
    });

    if (error) {
      _showError(error.message || 'تعذر تحديث حالة الحظر.');
      return;
    }

    await _load();
  }

  async function _deleteUser(userId) {
    _hideError();

    const sb = window.SupabaseClient ? SupabaseClient.getClient() : null;
    if (!sb) return;

    // Prefer hard delete (removes from auth.users) via Edge Function.
    // If function is not deployed/configured, fall back to soft delete.
    const targetId = String(userId);

    try {
      if (sb.functions && typeof sb.functions.invoke === 'function') {
        const { data, error } = await sb.functions.invoke('admin-delete-user', {
          body: { user_id: targetId },
        });

        if (!error && data && data.ok === true) {
          await _load();
          return;
        }
      }
    } catch {
      // ignore and fall back
    }

    const { error: softErr } = await sb.rpc('admin_soft_delete_user', { p_user_id: targetId });
    if (softErr) {
      _showError(softErr.message || 'تعذر حذف المستخدم.');
      return;
    }

    await _load();
  }

  UsersPage.init = (session) => {
    if (!session || session.role !== 'Admin') return;

    _meId = String(session.userId || '');

    els.tbody = Utils.qs('#usersTbody');
    els.empty = Utils.qs('#usersEmpty');
    els.alert = Utils.qs('#usersAlert');
    els.refresh = Utils.qs('#btnUsersRefresh');
    els.filter = Utils.qs('#usersFilter');

    if (els.refresh) {
      els.refresh.addEventListener('click', () => {
        _load().catch(() => {});
      });
    }

    if (els.filter) {
      els.filter.addEventListener('change', () => {
        _render(_allRows);
        _updatePendingBadge();
      });
    }

    if (els.tbody) {
      els.tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (!action || !id) return;

        if (action === 'role-admin') {
          const ok = window.confirm('هل تريد ترقية هذا المستخدم إلى Admin؟');
          if (!ok) return;
          _setRole(id, 'Admin').catch(() => {});
          return;
        }

        if (action === 'role-tracking') {
          const ok = window.confirm('هل تريد إلغاء صلاحية Admin لهذا المستخدم وإرجاعه إلى Tracking؟');
          if (!ok) return;
          _setRole(id, 'Tracking').catch(() => {});
          return;
        }

        if (action === 'approve') {
          _approve(id).catch(() => {});
          return;
        }

        if (action === 'block') {
          const ok = window.confirm('هل أنت متأكد من حظر هذا المستخدم؟');
          if (!ok) return;
          _setBlocked(id, true).catch(() => {});
          return;
        }

        if (action === 'unblock') {
          _setBlocked(id, false).catch(() => {});
          return;
        }

        if (action === 'delete') {
          const ok = window.confirm('حذف المستخدم سيعطله ويمنع دخوله. هل تريد المتابعة؟');
          if (!ok) return;
          _deleteUser(id).catch(() => {});
        }
      });
    }

    _load().catch(() => {});
    _updatePendingBadge();
  };

  window.UsersPage = UsersPage;
})();
