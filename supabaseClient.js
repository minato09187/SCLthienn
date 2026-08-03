// Supabase Project Credentials
const SUPABASE_URL = "https://zfcrfnvfjcuqjjgxbbzn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_h4Z_yVBEFbneP00PGldvGA_uPt7FdLS";

// Khởi tạo Supabase client
function initSupabaseClient() {
    // Kiểm tra SDK đã load chưa
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Supabase Client đã khởi tạo thành công!");
        return;
    }
    
    // Nếu SDK chưa load, thử tải lại
    console.warn("⚠️ Supabase SDK chưa được tải, đang thử tải lại...");
    
    const script = document.createElement('script');
    script.src = "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    script.onload = function() {
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log("✅ Supabase Client đã khởi tạo thành công!");
            location.reload();
        }
    };
    script.onerror = function() {
        console.error("❌ Không thể tải Supabase SDK!");
    };
    document.head.appendChild(script);
}

// Khởi tạo
initSupabaseClient();
