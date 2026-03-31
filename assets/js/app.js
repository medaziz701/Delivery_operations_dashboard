(function () {
  'use strict';

  function wirePasswordToggles(root) {
    const scope = root || document;
    const buttons = scope.querySelectorAll('[data-toggle-password]');
    buttons.forEach((btn) => {
      if (btn.dataset && btn.dataset.wired === '1') return;
      const targetId = btn.getAttribute('data-toggle-password');
      if (!targetId) return;
      const input = scope.getElementById(targetId) || document.getElementById(targetId);
      if (!input) return;
      btn.addEventListener('click', () => {
        const isPw = String(input.getAttribute('type') || '').toLowerCase() === 'password';
        input.setAttribute('type', isPw ? 'text' : 'password');
        const icon = btn.querySelector('i');
        if (icon) {
          if (isPw) {
            icon.classList.remove('bi-eye');
            icon.classList.add('bi-eye-slash');
          } else {
            icon.classList.add('bi-eye');
            icon.classList.remove('bi-eye-slash');
          }
        }
      });
      btn.dataset.wired = '1';
    });
  }

  function wireDashboardMobileMenuTabs() {
    if (!document.body || document.body.dataset.page !== 'dashboard') return;

    let lastHandledAt = 0;

    function forceActivate(targetSel) {
      if (!targetSel) return;

      const pane = document.querySelector(targetSel);
      if (!pane) return;

      document.querySelectorAll('.tab-content .tab-pane').forEach((p) => {
        p.classList.remove('show');
        p.classList.remove('active');
      });

      pane.classList.add('active');
      pane.classList.add('show');

      document.querySelectorAll('[data-bs-toggle="pill"][data-bs-target]').forEach((t) => {
        const isActive = String(t.getAttribute('data-bs-target') || '') === String(targetSel);
        t.classList.toggle('active', isActive);
        try { t.setAttribute('aria-selected', isActive ? 'true' : 'false'); } catch {}
      });
    }

    function onMenuActivate(e) {
      const btn = e.target && e.target.closest
        ? e.target.closest('.navbar .dropdown-menu [data-bs-toggle="pill"][data-bs-target]')
        : null;
      if (!btn) return;

      const now = Date.now();
      if (now - lastHandledAt < 350) return;
      lastHandledAt = now;

      e.preventDefault();

      const bs = window.bootstrap;
      try {
        if (bs && bs.Tab && typeof bs.Tab.getOrCreateInstance === 'function') {
          bs.Tab.getOrCreateInstance(btn).show();
        }
      } catch {}

      try {
        forceActivate(btn.getAttribute('data-bs-target'));
      } catch {}

      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      } catch {
        try { window.scrollTo(0, 0); } catch {}
      }

      try {
        const menu = btn.closest('.dropdown-menu');
        const dropdown = menu ? menu.closest('.dropdown') : null;
        const toggle = dropdown ? dropdown.querySelector('[data-bs-toggle="dropdown"]') : null;
        if (toggle && bs && bs.Dropdown && typeof bs.Dropdown.getOrCreateInstance === 'function') {
          bs.Dropdown.getOrCreateInstance(toggle).hide();
        }
      } catch {}
    }

    document.addEventListener('pointerup', onMenuActivate, true);
    document.addEventListener('touchend', onMenuActivate, true);
    document.addEventListener('click', onMenuActivate, true);
  }

  function wireLoginModalIfPresent() {
    const form = Utils.qs('#landingLoginForm');
    const alertEl = Utils.qs('#landingLoginAlert');
    if (!form) return;
    try {
      const lastU = window.localStorage.getItem('deliverydash_last_username') || '';
      const uEl = Utils.qs('#landingUsername');
      if (lastU && uEl && !uEl.value) uEl.value = lastU;
    } catch {}
    try { form.setAttribute('autocomplete', 'on'); } catch {}
    const uEl2 = Utils.qs('#landingUsername');
    const pEl = Utils.qs('#landingPassword');
    try { if (uEl2) { uEl2.setAttribute('name', 'username'); uEl2.setAttribute('autocomplete', 'username'); } } catch {}
    try { if (pEl) { pEl.setAttribute('name', 'password'); pEl.setAttribute('autocomplete', 'current-password'); } } catch {}

    function showError(msg) {
      if (!alertEl) return;
      alertEl.textContent = msg;
      alertEl.classList.remove('d-none');
    }

    function hideError() {
      if (!alertEl) return;
      alertEl.classList.add('d-none');
      alertEl.textContent = '';
    }

    wirePasswordToggles(document);

    const forgotBtn = Utils.qs('#landingForgotPwBtn');
    if (forgotBtn && !forgotBtn.dataset.wired) {
      forgotBtn.addEventListener('click', async () => {
        const identifier = Utils.qs('#landingUsername')?.value;
        try {
          hideError();
          const base = new URL('.', window.location.href);
          const redirectTo = new URL('reset-password', base).toString();
          await Auth.requestPasswordReset(identifier, redirectTo);
          if (alertEl) {
            alertEl.textContent = 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.';
            alertEl.classList.remove('d-none');
            alertEl.classList.remove('alert-danger');
            alertEl.classList.add('alert-success');
          }
        } catch (err) {
          if (alertEl) {
            alertEl.classList.remove('alert-success');
            alertEl.classList.add('alert-danger');
          }
          showError(err?.message || 'تعذر إرسال رابط إعادة التعيين');
        }
      });
      forgotBtn.dataset.wired = '1';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = Utils.qs('#landingUsername')?.value;
      const password = Utils.qs('#landingPassword')?.value;
      const remember = Utils.qs('#landingRemember')?.checked !== false;

      try {
        hideError();
        try {
          window.localStorage.setItem('deliverydash_remember_v1', remember ? '1' : '0');
          window.localStorage.setItem('deliverydash_last_username', String(username || ''));
        } catch {}
        if (window.SupabaseClient && typeof SupabaseClient.reset === 'function') {
          SupabaseClient.reset();
        }

        const newSession = await Auth.login(username, password);

        const qs2 = Utils.parseQuery();
        const next = safeNextPath(qs2.get('next'));
        if (next) {
          window.location.href = next;
          return;
        }

        Auth.redirectAfterLogin(newSession);
      } catch (err) {
        showError(err?.message || 'حدث خطأ أثناء تسجيل الدخول');
      }
    });
  }

  async function initResetPassword() {
    const alertEl = Utils.qs('#resetAlert');
    const okEl = Utils.qs('#resetOk');
    const form = Utils.qs('#resetForm');
    const p1El = Utils.qs('#resetPw1');
    const p2El = Utils.qs('#resetPw2');

    function showErr(msg) {
      if (!alertEl) return;
      alertEl.textContent = String(msg || 'تعذر إتمام العملية.');
      alertEl.classList.remove('d-none');
    }

    function hideErr() {
      if (!alertEl) return;
      alertEl.textContent = '';
      alertEl.classList.add('d-none');
    }

    function showOk(msg) {
      if (!okEl) return;
      okEl.textContent = String(msg || 'تم بنجاح.');
      okEl.classList.remove('d-none');
    }

    hideErr();
    if (okEl) okEl.classList.add('d-none');

    const sb = window.SupabaseClient ? SupabaseClient.getClient() : null;
    if (!sb || !sb.auth) {
      showErr('Supabase غير مهيأ.');
      return;
    }

    try {
      const { data } = await sb.auth.getSession();
      if (!data || !data.session) {
        showErr('رابط إعادة التعيين غير صالح أو منتهي.');
      }
    } catch {
      showErr('رابط إعادة التعيين غير صالح أو منتهي.');
    }

    wirePasswordToggles(document);

    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideErr();
      if (okEl) okEl.classList.add('d-none');

      const pw1 = String(p1El?.value || '').trim();
      const pw2 = String(p2El?.value || '').trim();
      if (!pw1 || pw1.length < 6) {
        showErr('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
        return;
      }
      if (pw1 !== pw2) {
        showErr('كلمتا المرور غير متطابقتين.');
        return;
      }

      const btn = Utils.qs('#resetSaveBtn');
      if (btn) btn.disabled = true;
      try {
        const { error } = await sb.auth.updateUser({ password: pw1 });
        if (error) {
          showErr(error.message || 'تعذر تحديث كلمة المرور.');
          return;
        }
        showOk('تم إنشاء كلمة مرور جديدة بنجاح. يمكنك تسجيل الدخول الآن.');
        try { await sb.auth.signOut(); } catch {}
        try { if (p1El) p1El.value = ''; if (p2El) p2El.value = ''; } catch {}
      } catch {
        showErr('تعذر تحديث كلمة المرور.');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  async function initLanding() {
    wireLoginModalIfPresent();
    return;
  }

  function safeNextPath(nextRaw) {
    if (!nextRaw) return null;

    const s = String(nextRaw);

    // منع open redirect
    if (s.includes('://') || s.startsWith('//')) return null;

    // السماح فقط بصفحات هذا المشروع
    if (!s.endsWith('.html') && !s.includes('.html?')) return null;

    return s;
  }

  async function initLogin() {
    const session = await Auth.getSession();
    if (session) {
      Auth.redirectAfterLogin(session);
      return;
    }

    const form = Utils.qs('#loginForm');
    const alertEl = Utils.qs('#loginAlert');

    function showError(msg) {
      if (!alertEl) return;
      alertEl.textContent = msg;
      alertEl.classList.remove('d-none');
    }

    function hideError() {
      if (!alertEl) return;
      alertEl.classList.add('d-none');
      alertEl.textContent = '';
    }

    if (!form) return;
    try {
      const lastU = window.localStorage.getItem('deliverydash_last_username') || '';
      const uEl = Utils.qs('#username');
      if (lastU && uEl && !uEl.value) uEl.value = lastU;
    } catch {}
    try { form.setAttribute('autocomplete', 'on'); } catch {}
    const uEl2 = Utils.qs('#username');
    const pEl2 = Utils.qs('#password');
    try { if (uEl2) { uEl2.setAttribute('name', 'username'); uEl2.setAttribute('autocomplete', 'username'); } } catch {}
    try { if (pEl2) { pEl2.setAttribute('name', 'password'); pEl2.setAttribute('autocomplete', 'current-password'); } } catch {}

    wirePasswordToggles(document);

    const qs = Utils.parseQuery();
    const reason = qs.get('reason');
    if (reason === 'blocked') {
      showError('هذا الحساب محظور أو تم تعطيله. تواصل مع المدير.');
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = Utils.qs('#username')?.value;
      const password = Utils.qs('#password')?.value;
      const remember = Utils.qs('#rememberMe')?.checked !== false;

      try {
        hideError();
        try {
          window.localStorage.setItem('deliverydash_remember_v1', remember ? '1' : '0');
          window.localStorage.setItem('deliverydash_last_username', String(username || ''));
        } catch {}
        if (window.SupabaseClient && typeof SupabaseClient.reset === 'function') {
          SupabaseClient.reset();
        }
        const newSession = await Auth.login(username, password);

        const qs2 = Utils.parseQuery();
        const next = safeNextPath(qs2.get('next'));
        if (next) {
          window.location.href = next;
          return;
        }

        Auth.redirectAfterLogin(newSession);
      } catch (err) {
        showError(err?.message || 'حدث خطأ أثناء تسجيل الدخول');
      }
    });

    const forgotBtn = Utils.qs('#loginForgotPwBtn');
    if (forgotBtn && !forgotBtn.dataset.wired) {
      forgotBtn.addEventListener('click', async () => {
        const identifier = Utils.qs('#username')?.value;
        try {
          hideError();
          const base = new URL('.', window.location.href);
          const redirectTo = new URL('reset-password', base).toString();
          await Auth.requestPasswordReset(identifier, redirectTo);
          if (alertEl) {
            alertEl.textContent = 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.';
            alertEl.classList.remove('d-none');
            alertEl.classList.remove('alert-danger');
            alertEl.classList.add('alert-success');
          }
        } catch (err) {
          if (alertEl) {
            alertEl.classList.remove('alert-success');
            alertEl.classList.add('alert-danger');
          }
          showError(err?.message || 'تعذر إرسال رابط إعادة التعيين');
        }
      });
      forgotBtn.dataset.wired = '1';
    }
  }

  async function initDashboard() {
    const session = await Auth.requireAuth(['Admin', 'Tracking']);
    if (!session) return;

    Auth.applyRoleToDom(session);

    wireDashboardMobileMenuTabs();

    const logoutBtn = Utils.qs('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await Auth.logout();
        window.location.href = 'login.html';
      });
    }

    if (window.Realtime) Realtime.connect();

    await Store.init();

    if (window.Alerts) {
      Alerts.setContainer(Utils.qs('#globalAlerts'));
      await Alerts.init();
    }

    if (window.OrdersPage) {
      OrdersPage.init(session);
    }

    if (window.FeedPage) {
      FeedPage.init(session);
    }

    if (session.role === 'Admin' && window.UsersPage) {
      UsersPage.init(session);
    } else {
      const usersTabBtn = document.querySelector('[data-bs-target="#tabUsers"]');
      if (usersTabBtn) usersTabBtn.classList.add('d-none');
      const usersPane = Utils.qs('#tabUsers');
      if (usersPane) usersPane.classList.add('d-none');
    }

    if (session.role === 'Admin' && window.StatsPage) {
      StatsPage.init();
    } else {
      const statsTabBtn = document.querySelector('[data-bs-target="#tabStats"]');
      if (statsTabBtn) statsTabBtn.classList.add('d-none');
      const statsPane = Utils.qs('#tabStats');
      if (statsPane) statsPane.classList.add('d-none');
    }
  }

  async function initOrderDetails() {
    const session = await Auth.requireAuth(['Admin', 'Tracking']);
    if (!session) return;

    Auth.applyRoleToDom(session);

    const logoutBtn = Utils.qs('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await Auth.logout();
        window.location.href = 'login.html';
      });
    }

    if (window.Realtime) Realtime.connect();

    await Store.init();

    if (window.Alerts) {
      Alerts.setContainer(Utils.qs('#globalAlerts'));
      await Alerts.init();
    }

    if (window.OrderDetailsPage) {
      OrderDetailsPage.init(session);
    }
  }

  async function bootstrap() {
    Utils.setYear();
    wireLoginModalIfPresent();

    const page = document.body?.dataset?.page;
    if (page === 'landing') {
      await initLanding();
      return;
    }

    if (page === 'signup') {
      if (window.SignupPage) {
        await SignupPage.init();
      }
      return;
    }

    if (page === 'pending') {
      if (window.PendingPage) {
        await PendingPage.init();
      }
      return;
    }

    if (page === 'login') {
      await initLogin();
      return;
    }

    if (page === 'reset-password') {
      await initResetPassword();
      return;
    }

    if (page === 'dashboard') {
      await initDashboard();
      return;
    }

    if (page === 'order-details') {
      await initOrderDetails();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bootstrap().catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
    });
  });
})();
