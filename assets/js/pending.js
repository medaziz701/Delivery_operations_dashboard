(function () {
  'use strict';

  const PendingPage = {};

  function _show(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('d-none');
  }

  function _hide(el) {
    if (!el) return;
    el.classList.add('d-none');
    el.textContent = '';
  }

  PendingPage.init = async () => {
    const alertEl = Utils.qs('#pendingAlert');
    const okEl = Utils.qs('#pendingOk');
    const btn = Utils.qs('#btnCheck');

    const btnDefaultHtml = btn ? btn.innerHTML : '';

    function setLoading(isLoading) {
      if (!btn) return;
      btn.disabled = Boolean(isLoading);
      if (isLoading) {
        btn.innerHTML = '<span class="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true"></span>جاري التحقق...';
      } else {
        btn.innerHTML = btnDefaultHtml;
      }
    }

    async function check() {
      _hide(alertEl);
      _hide(okEl);

      const session = await (Auth.refreshSession ? Auth.refreshSession() : Auth.getSession());
      if (!session) {
        window.location.href = 'index.html?login=1';
        return;
      }

      Auth.applyRoleToDom(session);

      if (session.role === 'Admin' || session.isApproved) {
        _show(okEl, 'تمت الموافقة. يتم تحويلك إلى لوحة التحكم...');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 700);
        return;
      }

      _show(alertEl, 'الحساب ما زال بانتظار موافقة المدير.');
    }

    if (btn) {
      btn.addEventListener('click', () => {
        setLoading(true);
        Promise.resolve()
          .then(() => check())
          .catch(() => {})
          .finally(() => setLoading(false));
      });
    }

    window.addEventListener('pageshow', (e) => {
      // When restored from bfcache, re-check approval status.
      if (e && e.persisted) {
        setLoading(true);
        Promise.resolve()
          .then(() => check())
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    });

    const logoutBtn = Utils.qs('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await Auth.logout();
        window.location.href = 'index.html?login=1';
      });
    }

    setLoading(true);
    try {
      await check();
    } finally {
      setLoading(false);
    }
  };

  window.PendingPage = PendingPage;
})();
