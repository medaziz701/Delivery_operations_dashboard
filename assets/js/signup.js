(function () {
  'use strict';

  const SignupPage = {};

  function _show(el, msg, clsToShow = 'd-none') {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove(clsToShow);
  }

  function _hide(el, clsToHide = 'd-none') {
    if (!el) return;
    el.classList.add(clsToHide);
    el.textContent = '';
  }

  function _digitsOnly(v) {
    return String(v || '').replace(/[^0-9]+/g, '');
  }

  function _buildPseudoEmail(phoneDigits) {
    return `u${phoneDigits}@example.com`;
  }

  function _isValidEmail(v) {
    const s = String(v || '').trim();
    if (!s) return false;
    // Simple validation good enough for UI; Supabase will validate too.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  SignupPage.init = async () => {
    const sb = window.SupabaseClient ? SupabaseClient.getClient() : null;
    if (!sb) return;

    const form = Utils.qs('#signupForm');
    const alertEl = Utils.qs('#signupAlert');
    const okEl = Utils.qs('#signupSuccess');
    const phoneEl = Utils.qs('#phone');
    const pwdEl = Utils.qs('#password');
    const togglePwdBtn = Utils.qs('#togglePassword');

    if (!form) return;

    if (phoneEl) {
      phoneEl.addEventListener('input', () => {
        const digits = _digitsOnly(phoneEl.value);
        phoneEl.value = digits;
      });
    }

    if (togglePwdBtn && pwdEl) {
      togglePwdBtn.addEventListener('click', () => {
        const isPw = pwdEl.type === 'password';
        pwdEl.type = isPw ? 'text' : 'password';
        const icon = togglePwdBtn.querySelector('i');
        if (icon) {
          icon.classList.toggle('bi-eye', !isPw);
          icon.classList.toggle('bi-eye-slash', isPw);
        }
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      _hide(alertEl);
      _hide(okEl);

      const fullName = String(Utils.qs('#fullName')?.value || '').trim();
      const phoneRaw = String(Utils.qs('#phone')?.value || '').trim();
      const emailRaw = String(Utils.qs('#email')?.value || '').trim();
      const password = String(Utils.qs('#password')?.value || '').trim();

      const phoneDigits = _digitsOnly(phoneRaw);
      if (!fullName) {
        _show(alertEl, 'أدخل الاسم الكامل.');
        return;
      }
      if (!phoneDigits) {
        _show(alertEl, 'أدخل رقم الهاتف.');
        return;
      }
      if (!password || password.length < 6) {
        _show(alertEl, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
        return;
      }

      if (emailRaw && !_isValidEmail(emailRaw)) {
        _show(alertEl, 'البريد الإلكتروني غير صحيح.');
        return;
      }

      const email = emailRaw ? emailRaw : _buildPseudoEmail(phoneDigits);

      try {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone: phoneDigits,
            },
          },
        });

        if (error) {
          _show(alertEl, error.message || 'تعذر إنشاء الحساب.');
          return;
        }

        _show(okEl, 'تم إنشاء الحساب. بانتظار موافقة المدير.');

        if (data && data.session) {
          window.location.href = 'pending.html';
          return;
        }

        _show(okEl, 'تم إنشاء الحساب. يرجى تفعيل الحساب عبر البريد الإلكتروني ثم تسجيل الدخول. بعد ذلك سيتم تفعيل الصلاحيات فور موافقة المدير.');
      } catch (err) {
        _show(alertEl, err?.message || 'تعذر إنشاء الحساب.');
      }
    });
  };

  window.SignupPage = SignupPage;
})();
