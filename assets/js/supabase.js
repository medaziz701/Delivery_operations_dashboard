(function () {
  'use strict';

  const SupabaseClient = {};

  let _client = null;

  function _getConfigValue(key) {
    const v = window[key];
    return typeof v === 'string' ? v.trim() : '';
  }

  function _canCreateClient(url, anonKey) {
    return Boolean(
      url &&
        anonKey &&
        window.supabase &&
        typeof window.supabase.createClient === 'function'
    );
  }

  SupabaseClient.isConfigured = () => {
    const url = _getConfigValue('SUPABASE_URL');
    const anonKey = _getConfigValue('SUPABASE_ANON_KEY');
    return _canCreateClient(url, anonKey);
  };

  SupabaseClient.reset = () => {
    _client = null;
  };

  SupabaseClient.getClient = () => {
    if (_client) return _client;

    const url = _getConfigValue('SUPABASE_URL');
    const anonKey = _getConfigValue('SUPABASE_ANON_KEY');

    if (!_canCreateClient(url, anonKey)) return null;

    const rememberRaw = window.localStorage.getItem('deliverydash_remember_v1');
    const remember = rememberRaw == null ? true : rememberRaw === '1' || rememberRaw === 'true';

    _client = window.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: remember,
      },
    });
    return _client;
  };

  window.SupabaseClient = SupabaseClient;
})();
