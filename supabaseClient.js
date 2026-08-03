// Supabase Project Credentials
const SUPABASE_URL = "https://zfcrfnvfjcuqjjgxbbzn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_h4Z_yVBEFbneP00PGldvGA_uPt7FdLS";

// Bản UMD của Supabase gán window.supabase = { createClient }
if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase Client đã khởi tạo thành công!");
} else {
    console.error("❌ Supabase SDK chưa được tải! Kiểm tra lại đường dẫn CDN.");
    console.log("window.supabase =", window.supabase);
}
