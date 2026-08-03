// Supabase Project Credentials
const SUPABASE_URL = "https://zfcrfnvfjcuqjjgxbbzn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_h4Z_yVBEFbneP00PGldvGA_uPt7FdLS";

// Khởi tạo Supabase client (CHỈ DÙNG THẬT, KHÔNG MOCK)
function initSupabaseClient() {
    // Kiểm tra SDK đã load chưa
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Supabase Client đã khởi tạo thành công!");
        return;
    }
    
    // Nếu SDK chưa load, tải script
    console.warn("⚠️ Supabase SDK chưa được tải, đang tải...");
    
    const script = document.createElement('script');
    script.src = "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    script.onload = function() {
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log("✅ Supabase Client đã khởi tạo thành công!");
        } else {
            console.error("❌ Không thể tạo Supabase Client!");
        }
    };
    script.onerror = function() {
        console.error("❌ Không thể tải Supabase SDK! Vui lòng kiểm tra kết nối mạng.");
    };
    document.head.appendChild(script);
}

// Khởi tạo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSupabaseClient);
} else {
    initSupabaseClient();
}