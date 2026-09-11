// Load configuration from environment variables or use placeholders
window.SUPABASE_URL = window.SUPABASE_URL || 'YOUR_SUPABASE_URL';
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

window.SUPPORT_WHATSAPP_NUMBER = window.SUPPORT_WHATSAPP_NUMBER || 'YOUR_WHATSAPP_NUMBER';

// UltraMSG direct config (frontend) — note: exposes the token in the client
window.ULTRAMSG_BASE = window.ULTRAMSG_BASE || 'https://api.ultramsg.com/instance164992/';
window.ULTRAMSG_TOKEN = window.ULTRAMSG_TOKEN || 'YOUR_ULTRAMSG_TOKEN';

// Supabase Storage bucket to use for media uploads
window.SUPABASE_BUCKET = window.SUPABASE_BUCKET || 'media';
