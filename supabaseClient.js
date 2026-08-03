// Supabase Project Credentials
const SUPABASE_URL = "https://zfcrfnvfjcuqjjgxbbzn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_h4Z_yVBEFbneP00PGldvGA_uPt7FdLS";

// Hàm tạo Supabase client
function initSupabaseClient() {
    // Kiểm tra SDK đã load chưa
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Supabase Client đã khởi tạo thành công!");
        return;
    }
    
    // Nếu SDK chưa load, tạo script để tải
    console.warn("⚠️ Supabase SDK chưa được tải, đang tải...");
    
    const script = document.createElement('script');
    script.src = "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    script.onload = function() {
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log("✅ Supabase Client đã khởi tạo thành công!");
        } else {
            console.error("❌ Vẫn không thể tạo Supabase Client!");
            createMockClient();
        }
    };
    script.onerror = function() {
        console.error("❌ Không thể tải Supabase SDK!");
        createMockClient();
    };
    document.head.appendChild(script);
}

// Tạo mock client (fallback)
function createMockClient() {
    console.warn("⚠️ Đang dùng mock client (dữ liệu giả)!");
    window.supabaseClient = {
        from: function(table) {
            return {
                select: function() {
                    console.log(`📊 SELECT từ ${table} (mock)`);
                    if (table === 'products') {
                        return Promise.resolve({
                            data: [
                                { id: 1, name: 'Cầu lông Hải Yến (Mock)', category: 'shuttlecock', price: 120000, stock: 100 },
                                { id: 2, name: 'Cầu lông Victor (Mock)', category: 'shuttlecock', price: 150000, stock: 80 },
                                { id: 3, name: 'Vợt Yonex Astrox (Mock)', category: 'racket', price: 2500000, stock: 20 },
                                { id: 4, name: 'Lưới cầu lông (Mock)', category: 'net', price: 350000, stock: 10 },
                                { id: 5, name: 'Áo cầu lông (Mock)', category: 'shirt', price: 250000, stock: 50 },
                                { id: 6, name: 'Giày cầu lông (Mock)', category: 'shoes', price: 1200000, stock: 30 }
                            ],
                            error: null
                        });
                    }
                    if (table === 'users') {
                        return Promise.resolve({
                            data: [{ name: 'Admin', phone: '0961932175', password: 'admin123' }],
                            error: null
                        });
                    }
                    if (table === 'bookings') {
                        return Promise.resolve({
                            data: [{ id: 'test', date: '2026-08-03', slots: [] }],
                            error: null
                        });
                    }
                    if (table === 'orders') {
                        return Promise.resolve({
                            data: [],
                            error: null
                        });
                    }
                    if (table === 'notifications') {
                        return Promise.resolve({
                            data: [],
                            error: null
                        });
                    }
                    if (table === 'settings') {
                        return Promise.resolve({
                            data: [{ key: 'admin', value: { password: 'admin123' } }],
                            error: null
                        });
                    }
                    return Promise.resolve({ data: [], error: null });
                },
                eq: function(field, value) {
                    console.log(`   WHERE ${field} = ${value} (mock)`);
                    return {
                        select: function() {
                            return Promise.resolve({ data: [], error: null });
                        },
                        maybeSingle: function() {
                            return Promise.resolve({ data: null, error: null });
                        },
                        order: function() {
                            return {
                                select: function() {
                                    return Promise.resolve({ data: [], error: null });
                                }
                            };
                        }
                    };
                },
                insert: function(data) {
                    console.log(`📝 INSERT vào ${table} (mock):`, data);
                    return Promise.resolve({ data: { id: Date.now() }, error: null });
                },
                update: function(data) {
                    console.log(`✏️ UPDATE ${table} (mock):`, data);
                    return {
                        eq: function(field, value) {
                            console.log(`   WHERE ${field} = ${value}`);
                            return Promise.resolve({ data: null, error: null });
                        }
                    };
                },
                delete: function() {
                    console.log(`🗑️ DELETE từ ${table} (mock)`);
                    return {
                        eq: function(field, value) {
                            console.log(`   WHERE ${field} = ${value}`);
                            return Promise.resolve({ data: null, error: null });
                        }
                    };
                },
                order: function(column, options) {
                    console.log(`📊 ORDER BY ${column} (mock)`);
                    return {
                        select: function() {
                            return Promise.resolve({ data: [], error: null });
                        }
                    };
                },
                maybeSingle: function() {
                    return {
                        select: function() {
                            return Promise.resolve({ data: null, error: null });
                        }
                    };
                },
                channel: function(name) {
                    console.log(`📡 Channel ${name} (mock)`);
                    return {
                        on: function() { return this; },
                        subscribe: function() { return this; }
                    };
                }
            };
        },
        channel: function(name) {
            console.log(`📡 Channel ${name} (mock)`);
            return {
                on: function() { return this; },
                subscribe: function() { return this; }
            };
        }
    };
    console.log("✅ Mock Supabase Client đã sẵn sàng!");
}

// Khởi tạo client
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSupabaseClient);
} else {
    initSupabaseClient();
}