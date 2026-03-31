(function () {
  'use strict';

  const STORAGE_KEY = 'deliverydash_session_v1';

  const Auth = {};

  let _cachedSession = null;

  function _clearPersistedSession() {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function _isSupabaseEnabled() {
    return Boolean(window.SupabaseClient && typeof SupabaseClient.isConfigured === 'function' && SupabaseClient.isConfigured());
  }

  function _runAsync(fn) {
    Promise.resolve()
      .then(fn)
      .catch(() => {});
  }

  function _logAudit() {}

  async function _loadMyProfile(sb, userId) {
    try {
      const { data, error } = await sb
        .from('users_profile')
        .select('phone, created_at')
        .eq('id', userId)
        .maybeSingle();
      if (error) return null;
      return data || null;
    } catch {
      return null;
    }
  }

  async function _resolveEmailForLogin(sb, identifier) {
    const v = String(identifier || '').trim();
    if (!v) throw new Error('أدخل الاسم أو رقم الهاتف.');

    const { data, error } = await sb.rpc('lookup_login_email', { p_identifier: v });
    if (error || !data) {
      throw new Error('بيانات الدخول غير صحيحة.');
    }

    return String(data || '').trim();
  }

  async function _loadProfile(sb, userId) {
    try {
      const { data, error } = await sb
        .from('users_profile')
        .select('role, full_name, is_approved, is_blocked, is_deleted')
        .eq('id', userId)
        .maybeSingle();

      if (error) return null;
      return data || null;
    } catch {
      return null;
    }
  }

  async function _buildSessionFromSupabaseSession(sb, sbSession) {
    const user = sbSession && sbSession.user;
    if (!user) return null;

    const profile = await _loadProfile(sb, user.id);

    const role = profile && profile.role ? profile.role : 'Tracking';
    const name = profile && profile.full_name ? profile.full_name : user.email || '—';
    const isApproved = Boolean(profile && profile.is_approved);
    const isBlocked = Boolean(profile && profile.is_blocked);
    const isDeleted = Boolean(profile && profile.is_deleted);

    const normalizedRole = role === 'Admin' ? 'Admin' : 'Tracking';

    return {
      userId: user.id,
      username: user.email || '—',
      role: normalizedRole,
      name,
      isApproved,
      isBlocked,
      isDeleted,
      loggedInAt: Utils.nowIso(),
    };
  }

  Auth.getSession = async () => {
    if (_cachedSession) return _cachedSession;

    const sb = SupabaseClient.getClient();
    if (!sb) return null;

    const { data, error } = await sb.auth.getSession();
    if (error || !data || !data.session) return null;

    const session = await _buildSessionFromSupabaseSession(sb, data.session);
    _cachedSession = session;
    return session;
  };

  Auth.refreshSession = async () => {
    _cachedSession = null;
    const sb = SupabaseClient.getClient();
    if (!sb) return null;

    const { data, error } = await sb.auth.getSession();
    if (error || !data || !data.session) return null;

    const session = await _buildSessionFromSupabaseSession(sb, data.session);
    _cachedSession = session;
    return session;
  };

  Auth.login = async (identifier, password) => {
    const u = String(identifier || '').trim();
    const p = String(password || '').trim();

    const sb = SupabaseClient.getClient();
    if (!sb) {
      throw new Error('Supabase غير مهيأ.');
    }

    const email = await _resolveEmailForLogin(sb, u);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: p });
    if (error || !data || !data.session) {
      const msg = (error && (error.message || error.error_description)) || 'بيانات الدخول غير صحيحة.';
      throw new Error(msg);
    }

    const session = await _buildSessionFromSupabaseSession(sb, data.session);

    if (session && (session.isBlocked || session.isDeleted)) {
      try {
        await sb.auth.signOut();
      } catch {}
      _cachedSession = null;
      throw new Error('هذا الحساب محظور أو تم تعطيله.');
    }

    _cachedSession = session;
    _logAudit(sb, 'auth_login', { identifier: u }, session && session.userId);
    return session;
  };

  Auth.requestPasswordReset = async (identifier, redirectTo) => {
    const u = String(identifier || '').trim();
    if (!u) throw new Error('أدخل الاسم أو رقم الهاتف أولاً.');

    const sb = SupabaseClient.getClient();
    if (!sb) {
      throw new Error('Supabase غير مهيأ.');
    }

    const email = await _resolveEmailForLogin(sb, u);
    const opts = redirectTo ? { redirectTo: String(redirectTo) } : undefined;
    const fn = sb.auth && sb.auth.resetPasswordForEmail;
    if (typeof fn !== 'function') {
      throw new Error('ميزة استرجاع كلمة المرور غير متاحة.');
    }

    const { error } = await fn.call(sb.auth, email, opts);
    if (error) {
      throw new Error(error.message || 'تعذر إرسال رابط إعادة التعيين.');
    }
    return true;
  };

  Auth.logout = async () => {
    const sb = SupabaseClient.getClient();
    _logAudit(sb, 'auth_logout', null, _cachedSession && _cachedSession.userId);
    _cachedSession = null;
    _clearPersistedSession();

    if (!sb) return;
    await sb.auth.signOut();
  };

  Auth.redirectToLogin = () => {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.href = `index.html?login=1&next=${next}`;
  };

  Auth.redirectAfterLogin = (session) => {
    if (!session) return;
    if (session.role === 'Tracking' && !session.isApproved) {
      window.location.href = 'pending.html';
      return;
    }
    // حالياً كل الصلاحيات تذهب لنفس لوحة التحكم، مع إخفاء/تعطيل ميزات حسب الدور داخل الواجهة.
    window.location.href = 'dashboard.html';
  };

  Auth.requireAuth = async (allowedRoles) => {
    const session = await Auth.getSession();
    if (!session) {
      Auth.redirectToLogin();
      return null;
    }

    if (session.isBlocked || session.isDeleted) {
      await Auth.logout();
      window.location.href = 'index.html?reason=blocked&login=1';
      return null;
    }

    if (session.role === 'Tracking' && !session.isApproved) {
      window.location.href = 'pending.html';
      return null;
    }

    if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
      Auth.redirectToLogin();
      return null;
    }

    return session;
  };

  Auth.applyRoleToDom = (session) => {
    if (!session) return;
    document.body.dataset.role = session.role === 'Admin' ? 'Admin' : 'Tracking';

    const navUser = Utils.qs('#navUser');
    if (navUser) {
      navUser.textContent = `${session.name} • ${session.role}`;
    }

    const profileName = Utils.qs('#profileName');
    if (profileName) {
      profileName.textContent = String(session.name || '—');
    }

    const profileRole = Utils.qs('#profileRole');
    if (profileRole) {
      profileRole.textContent = String(session.role || '—');
    }

    const profileUsername = Utils.qs('#profileUsername');
    if (profileUsername) {
      profileUsername.textContent = String(session.username || '—');
    }

    // Wire profile modal (if present)
    try {
      const modalEl = document.getElementById('profileModal');
      if (modalEl && !modalEl.dataset.wired) {
        const onShow = async () => {
          const sb = _isSupabaseEnabled() ? SupabaseClient.getClient() : null;
          if (!sb) return;
          const p = await _loadMyProfile(sb, String(session.userId || ''));
          const phoneEl = Utils.qs('#profilePhone');
          const createdEl = Utils.qs('#profileCreatedAt');
          if (phoneEl) phoneEl.textContent = String((p && p.phone) || '—');
          if (createdEl) createdEl.textContent = String(p && p.created_at ? Utils.formatDateTime(p.created_at) : '—');

          try {
            const sec = Utils.qs('#profilePwSection');
            const alertEl = Utils.qs('#profilePwAlert');
            if (sec) sec.classList.add('d-none');
            if (alertEl) {
              alertEl.textContent = '';
              alertEl.classList.add('d-none');
              alertEl.classList.remove('alert-success');
              alertEl.classList.add('alert-danger');
            }
          } catch {}
        };

        modalEl.addEventListener('show.bs.modal', () => {
          onShow().catch(() => {});
        });

        const pwOpenBtn = Utils.qs('#profilePwOpen');
        const pwSection = Utils.qs('#profilePwSection');
        if (pwOpenBtn && !pwOpenBtn.dataset.wired) {
          pwOpenBtn.addEventListener('click', () => {
            if (!pwSection) return;

            const alertEl = Utils.qs('#profilePwAlert');
            if (alertEl) {
              alertEl.textContent = '';
              alertEl.classList.add('d-none');
              alertEl.classList.remove('alert-success');
              alertEl.classList.add('alert-danger');
            }

            const nowHidden = pwSection.classList.toggle('d-none');
            pwOpenBtn.classList.toggle('btn-outline-primary', !nowHidden);
            pwOpenBtn.classList.toggle('btn-outline-secondary', nowHidden);
            pwOpenBtn.textContent = nowHidden ? 'تغيير كلمة المرور' : 'إغلاق تغيير كلمة المرور';
          });
          pwOpenBtn.dataset.wired = '1';
        }

        const form = Utils.qs('#profilePwForm');
        if (form) {
          (function(){
            const toggleEl = Utils.qs('#profilePwToggle');
            const oldEl = Utils.qs('#profilePwOld');
            const newEl = Utils.qs('#profilePwNew');
            const cEl = Utils.qs('#profilePwConfirm');
            if (toggleEl && !toggleEl.dataset.wired) {
              let shown = false;
              const apply = () => {
                const t = shown ? 'text' : 'password';
                try { if (oldEl) oldEl.setAttribute('type', t); } catch {}
                try { if (newEl) newEl.setAttribute('type', t); } catch {}
                try { if (cEl) cEl.setAttribute('type', t); } catch {}
                const icon = toggleEl.querySelector('i');
                if (icon) {
                  icon.classList.toggle('bi-eye', !shown);
                  icon.classList.toggle('bi-eye-slash', shown);
                }
              };
              toggleEl.addEventListener('click', () => {
                shown = !shown;
                apply();
              });
              apply();
              toggleEl.dataset.wired = '1';
            }
          })();

          form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const alertEl = Utils.qs('#profilePwAlert');
            const btn = Utils.qs('#profilePwSave');
            const oldEl = Utils.qs('#profilePwOld');
            const newEl = Utils.qs('#profilePwNew');
            const cEl = Utils.qs('#profilePwConfirm');

            const showErr = (msg) => {
              if (!alertEl) return;
              alertEl.textContent = String(msg || 'تعذر تغيير كلمة المرور.');
              alertEl.classList.remove('d-none');
            };
            const hideErr = () => {
              if (!alertEl) return;
              alertEl.textContent = '';
              alertEl.classList.add('d-none');
            };

            hideErr();

            const oldPw = String(oldEl && oldEl.value ? oldEl.value : '').trim();
            const pw1 = String(newEl && newEl.value ? newEl.value : '').trim();
            const pw2 = String(cEl && cEl.value ? cEl.value : '').trim();
            if (!oldPw) {
              showErr('أدخل كلمة المرور الحالية.');
              return;
            }
            if (!pw1 || pw1.length < 6) {
              showErr('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
              return;
            }
            if (pw1 !== pw2) {
              showErr('كلمتا المرور غير متطابقتين.');
              return;
            }

            const sb = _isSupabaseEnabled() ? SupabaseClient.getClient() : null;
            if (!sb || !sb.auth || typeof sb.auth.updateUser !== 'function') {
              showErr('Supabase غير مفعّل.');
              return;
            }

            if (btn) btn.disabled = true;
            try {
              // Verify old password by re-authentication.
              const email = String(session.username || '').trim();
              if (!email) {
                showErr('تعذر التحقق من الحساب.');
                return;
              }

              const { error: signErr } = await sb.auth.signInWithPassword({ email, password: oldPw });
              if (signErr) {
                showErr('كلمة المرور الحالية غير صحيحة.');
                return;
              }

              const { error } = await sb.auth.updateUser({ password: pw1 });
              if (error) {
                showErr(error.message || 'تعذر تغيير كلمة المرور.');
                return;
              }
              if (oldEl) oldEl.value = '';
              if (newEl) newEl.value = '';
              if (cEl) cEl.value = '';
              // Reuse alert element to show success using Bootstrap class switch
              if (alertEl) {
                alertEl.textContent = 'تم تغيير كلمة المرور بنجاح.';
                alertEl.classList.remove('d-none');
                alertEl.classList.remove('alert-danger');
                alertEl.classList.add('alert-success');
                setTimeout(() => {
                  try {
                    alertEl.classList.add('d-none');
                    alertEl.classList.remove('alert-success');
                    alertEl.classList.add('alert-danger');
                    alertEl.textContent = '';
                  } catch {}
                }, 2500);
              }
            } catch {
              showErr('تعذر تغيير كلمة المرور.');
            } finally {
              if (btn) btn.disabled = false;
            }
          });
        }

        modalEl.dataset.wired = '1';
      }
    } catch {}
  };

  window.Auth = Auth;
})();
