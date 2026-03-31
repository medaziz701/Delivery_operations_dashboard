(function () {
  'use strict';

  const Utils = {};

  Utils.qs = (selector, root = document) => root.querySelector(selector);
  Utils.qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  Utils.setText = (el, text) => {
    if (!el) return;
    el.textContent = text == null ? '' : String(text);
  };

  Utils.escapeHtml = (value) => {
    const str = value == null ? '' : String(value);
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return str.replace(/[&<>"']/g, (m) => map[m]);
  };

  Utils.truncate = (value, max = 80) => {
    const str = value == null ? '' : String(value);
    if (str.length <= max) return str;
    return `${str.slice(0, max - 1)}…`;
  };

  Utils.nowIso = () => new Date().toISOString();

  Utils.formatDateTime = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ar', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  Utils.formatDate = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(date);
  };

  Utils.parseQuery = () => new URLSearchParams(window.location.search);

  Utils.cleanPhone = (phone) => {
    const raw = phone == null ? '' : String(phone);
    return raw.replace(/[^0-9]/g, '');
  };

  Utils.toTelLink = (phone) => {
    const clean = Utils.cleanPhone(phone);
    if (!clean) return '#';
    return `tel:+${clean}`;
  };

  Utils.toWhatsAppLink = (phone, text = '') => {
    const clean = Utils.cleanPhone(phone);
    if (!clean) return '#';
    const query = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${clean}${query}`;
  };

  Utils.debounce = (fn, waitMs = 180) => {
    let timerId;
    return (...args) => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => fn(...args), waitMs);
    };
  };

  Utils.safeJsonParse = (raw, fallback) => {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  Utils.setYear = () => {
    const yearEl = Utils.qs('#year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  };

  window.Utils = Utils;
})();
