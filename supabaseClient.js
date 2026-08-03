// Supabase Project Credentials
const SUPABASE_URL = "https://zfcrfnvfjcuqjjgxbbzn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_h4Z_yVBEFbneP00PGldvGA_uPt7FdLS";

// Hàm tạo Supabase client (hỗ trợ cả 2 cách load)
function initSupabaseClient() {
    // Cách 1: Dùng SDK đã load sẵn
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Supabase Client đã khởi tạo thành công (SDK)!");
        return;
    }

    // Cách 2: Mock client cho local test
    console.warn("⚠️ Supabase SDK chưa được tải, đang dùng mock client...");
    window.supabaseClient = {
        from: function(table) {
            return {
                select: function(columns) {
                    console.log(`📊 SELECT from ${table}:`, columns);
                    // Giả lập dữ liệu cho products
                    if (table === 'products') {
                        return Promise.resolve({
                            data: [
                                { id: 1, name: 'Cầu lông Hải Yến', category: 'shuttlecock', price: 120000, stock: 100 },
                                { id: 2, name: 'Cầu lông Victor', category: 'shuttlecock', price: 150000, stock: 80 },
                                { id: 3, name: 'Vợt Yonex Astrox', category: 'racket', price: 2500000, stock: 20 }
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
                    return Promise.resolve({ data: [], error: null });
                },
                insert: function(data) {
                    console.log(`📝 INSERT into ${table}:`, data);
                    return Promise.resolve({ data: { id: Date.now() }, error: null });
                },
                update: function(data) {
                    console.log(`✏️ UPDATE ${table}:`, data);
                    return {
                        eq: function(field, value) {
                            console.log(`   WHERE ${field} = ${value}`);
                            return Promise.resolve({ data: null, error: null });
                        }
                    };
                },
                delete: function() {
                    console.log(`🗑️ DELETE from ${table}`);
                    return {
                        eq: function(field, value) {
                            console.log(`   WHERE ${field} = ${value}`);
                            return Promise.resolve({ data: null, error: null });
                        }
                    };
                },
                order: function(column, options) {
                    console.log(`📊 ORDER BY ${column}:`, options);
                    return this;
                }
            };
        }
    };
    console.log("✅ Mock Supabase Client đã sẵn sàng!");
}

// Khởi tạo client
initSupabaseClient();
