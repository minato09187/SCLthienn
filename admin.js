import { supabase } from "./supabaseClient.js";

window.supabase = supabase;
window.adminLoggedIn = false;
window.selectedDate = new Date().toISOString().split('T')[0];
window.courtsCount = 6;
window.timeSlots = [];
let unreadOrdersCount = 0;

for (let i = 0; i < 24; i++) {
    let start = i.toString().padStart(2, '0') + ":00";
    let end = (i + 1).toString().padStart(2, '0') + ":00";
    window.timeSlots.push(`${start} - ${end}`);
}

window.showToast = (msg, isError = false) => {
    const toast = document.getElementById('toastMsg');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.backgroundColor = isError ? '#dc2626' : '#10b981';
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};

// ========== QUẢN LÝ SÂN ==========
async function renderAdminTable() {
    const container = document.getElementById("adminTable");
    if (!container || !window.adminLoggedIn) return;
    
    const dateStr = window.selectedDate;
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', dateStr);
        
    if (error) console.error("Lỗi tải lịch sân:", error);

    const slotMap = new Map();
    (bookings || []).forEach(row => {
        if (row.slots && Array.isArray(row.slots)) {
            row.slots.forEach(slotObj => {
                const key = Object.keys(slotObj)[0];
                slotMap.set(key, slotObj[key]);
            });
        }
    });
    
    let html = `<div class="table-responsive"><table class="booking-table"><thead><tr><th>Giờ / Sân</th>`;
    for (let i = 0; i < window.timeSlots.length; i++) {
        html += `<th>${window.timeSlots[i]}</th>`;
    }
    html += `</tr></thead><tbody>`;
    
    for (let c = 1; c <= window.courtsCount; c++) {
        html += `<tr><td class="court-label">Sân ${c}</td>`;
        for (let h = 0; h < window.timeSlots.length; h++) {
            const key = `${c}_${h}`;
            const slot = slotMap.get(key);
            const status = slot?.status;
            
            let cellClass = "booking-cell";
            let cellContent = "";
            
            if (status === "confirmed") {
                cellClass += " admin-booked";
                cellContent = `${slot.userName}<br><small>${slot.phone}</small><br><span style="font-size:10px;">✅ Đã duyệt</span>`;
            } else if (status === "pending") {
                cellClass += " admin-pending";
                cellContent = `${slot.userName}<br><small>${slot.phone}</small><br>
                    <div style="margin-top:5px;">
                        <button class="confirm-btn" data-key="${key}" style="background:#10b981; padding:4px 8px; font-size:10px; border:none; border-radius:20px; cursor:pointer;">✅ Duyệt</button>
                        <button class="cancel-btn" data-key="${key}" style="background:#ef4444; padding:4px 8px; font-size:10px; border:none; border-radius:20px; cursor:pointer;">❌ Từ chối</button>
                    </div>`;
            } else {
                cellClass += " available";
                cellContent = "✔️ Trống";
            }
            html += `<td class="${cellClass}" data-key="${key}">${cellContent}</td>`;
        }
        html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    document.querySelectorAll(".confirm-btn").forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const key = btn.dataset.key;
            await updateSlotStatus(key, "confirmed");
        };
    });
    
    document.querySelectorAll(".cancel-btn").forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const key = btn.dataset.key;
            await deleteSlot(key);
        };
    });
}

async function updateSlotStatus(key, newStatus) {
    const dateStr = window.selectedDate;
    const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', dateStr);

    if (!bookings) return;

    for (const row of bookings) {
        if (row.slots && Array.isArray(row.slots)) {
            const updatedSlots = row.slots.map(slotObj => {
                const slotKey = Object.keys(slotObj)[0];
                if (slotKey === key) {
                    return { [slotKey]: { ...slotObj[slotKey], status: newStatus } };
                }
                return slotObj;
            });
            
            await supabase
                .from('bookings')
                .update({ slots: updatedSlots })
                .eq('id', row.id);

            window.showToast(`Đã duyệt đặt sân!`);
            renderAdminTable();
            return;
        }
    }
}

async function deleteSlot(key) {
    if (!confirm("Xóa đặt sân này?")) return;
    
    const dateStr = window.selectedDate;
    const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', dateStr);

    if (!bookings) return;

    for (const row of bookings) {
        if (row.slots && Array.isArray(row.slots)) {
            const updatedSlots = row.slots.filter(slotObj => Object.keys(slotObj)[0] !== key);
            if (updatedSlots.length === 0) {
                await supabase.from('bookings').delete().eq('id', row.id);
            } else {
                await supabase.from('bookings').update({ slots: updatedSlots }).eq('id', row.id);
            }
            window.showToast("Đã xóa đặt sân!");
            renderAdminTable();
            return;
        }
    }
}

// ========== QUẢN LÝ SHOP ==========
async function loadProducts() {
    const container = document.getElementById("productsList");
    if (!container) return;
    
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) console.error("Lỗi danh sách sản phẩm:", error);

    let html = "";
    (products || []).forEach(product => {
        const categoryName = {
            shuttlecock: " Cầu",
            racket: "🏸 Vợt",
            net: " Lưới",
            shirt: "👕 Áo",
            shoes: "👟 Giày"
        }[product.category] || product.category;
        
        html += `
            <div class="product-item">
                <div class="product-info">
                    <strong>${product.name}</strong>
                    <span class="product-category">${categoryName}</span>
                    <span class="product-price">${Number(product.price).toLocaleString()}đ</span>
                    <span class="product-stock">📦 Còn: ${product.stock}</span>
                </div>
                <div class="product-actions">
                    <input type="number" id="editStock_${product.id}" value="${product.stock}" min="0" style="width:80px">
                    <input type="number" id="editPrice_${product.id}" value="${product.price}" min="0" style="width:120px">
                    <button onclick="updateProduct('${product.id}')" style="background:#3b82f6;">✏️ Cập nhật</button>
                    <button onclick="deleteProduct('${product.id}')" style="background:#ef4444;">🗑️ Xóa</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html || "<p>Chưa có sản phẩm nào. Hãy thêm sản phẩm mới!</p>";
}

window.updateProduct = async (id) => {
    const stockEl = document.getElementById(`editStock_${id}`);
    const priceEl = document.getElementById(`editPrice_${id}`);
    const newStock = parseInt(stockEl ? stockEl.value : "0");
    const newPrice = parseInt(priceEl ? priceEl.value : "0");
    
    if (isNaN(newStock) || isNaN(newPrice)) {
        window.showToast("Vui lòng nhập số hợp lệ!", true);
        return;
    }
    
    const { error } = await supabase
        .from('products')
        .update({ stock: newStock, price: newPrice })
        .eq('id', id);

    if (error) {
        window.showToast("Cập nhật sản phẩm thất bại!", true);
        return;
    }

    window.showToast("Cập nhật sản phẩm thành công!");
    loadProducts();
};

window.deleteProduct = async (id) => {
    if (confirm("Bạn có chắc muốn xóa sản phẩm này?")) {
        await supabase.from('products').delete().eq('id', id);
        window.showToast("Đã xóa sản phẩm!");
        loadProducts();
    }
};

async function addProduct() {
    const nameInput = document.getElementById("productName");
    const categorySelect = document.getElementById("productCategory");
    const priceInput = document.getElementById("productPrice");
    const stockInput = document.getElementById("productStock");

    const name = nameInput ? nameInput.value.trim() : "";
    const category = categorySelect ? categorySelect.value : "shuttlecock";
    const price = parseInt(priceInput ? priceInput.value : "");
    const stock = parseInt(stockInput ? stockInput.value : "");
    
    if (!name || isNaN(price) || isNaN(stock)) {
        window.showToast("Vui lòng nhập đầy đủ thông tin!", true);
        return;
    }
    
    const { error } = await supabase
        .from('products')
        .insert({
            name: name,
            category: category,
            price: price,
            stock: stock
        });

    if (error) {
        console.error("Lỗi thêm sản phẩm:", error);
        window.showToast("Thêm sản phẩm thất bại!", true);
        return;
    }
    
    window.showToast("Thêm sản phẩm thành công!");
    if (nameInput) nameInput.value = "";
    if (priceInput) priceInput.value = "";
    if (stockInput) stockInput.value = "";
    loadProducts();
}

// ========== QUẢN LÝ ĐƠN HÀNG ==========
async function checkNewOrders() {
    const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
    
    let newCount = 0;
    const now = new Date();
    
    (orders || []).forEach(order => {
        const createdAt = new Date(order.created_at);
        const diffMinutes = (now - createdAt) / (1000 * 60);
        if (diffMinutes <= 30 && !order.admin_read) {
            newCount++;
        }
    });
    
    unreadOrdersCount = newCount;
    updateOrdersBadge();
}

function updateOrdersBadge() {
    const ordersBadge = document.getElementById("ordersBadge");
    if (ordersBadge) {
        ordersBadge.style.display = unreadOrdersCount > 0 ? "inline-block" : "none";
    }
}

function markOrdersAsRead() {
    unreadOrdersCount = 0;
    updateOrdersBadge();
}

async function loadOrders() {
    const container = document.getElementById("ordersList");
    if (!container) return;
    
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
        
    if (error) console.error("Lỗi danh sách đơn hàng:", error);

    let html = "";
    (orders || []).forEach(order => {
        const date = new Date(order.created_at);
        const isNew = !order.admin_read;
        
        html += `
            <div class="order-item ${isNew ? 'order-new' : ''}" data-id="${order.id}">
                <div class="order-header">
                    <strong>👤 ${order.customer_name || 'Khách'}</strong>
                    <span>📞 ${order.customer_phone || ''}</span>
                    <span>📍 ${order.address || 'Chưa có địa chỉ'}</span>
                    <span>📅 ${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
                    ${isNew ? '<span class="new-badge">🆕 Mới</span>' : ''}
                </div>
                <div class="order-items">
                    ${order.items?.map(item => `
                        <div class="order-item-detail">
                            ${item.name} x ${item.quantity} = ${(item.price * item.quantity).toLocaleString()}đ
                        </div>
                    `).join('') || ''}
                </div>
                <div class="order-total">
                    <strong>Tổng: ${Number(order.total_price || 0).toLocaleString()}đ</strong>
                    <button onclick="markOrderRead('${order.id}')" style="background:#10b981;">✅ Đã xem</button>
                    <button onclick="deleteOrder('${order.id}')" style="background:#ef4444;">🗑️ Xóa</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html || "<p>Chưa có đơn hàng nào</p>";
}

window.markOrderRead = async (id) => {
    await supabase.from('orders').update({ admin_read: true }).eq('id', id);
    window.showToast("Đã đánh dấu đã xem!");
    loadOrders();
    checkNewOrders();
};

window.deleteOrder = async (id) => {
    if (confirm("Xóa đơn hàng này?")) {
        await supabase.from('orders').delete().eq('id', id);
        window.showToast("Đã xóa đơn hàng!");
        loadOrders();
        checkNewOrders();
    }
};

function startOrderListener() {
    supabase
        .channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
            if (window.adminLoggedIn) {
                checkNewOrders();
                const activeTab = document.querySelector('.admin-tab.active');
                if (activeTab && activeTab.dataset.tab === "orders") {
                    loadOrders();
                }
            }
        })
        .subscribe();
}

// ========== THÔNG BÁO ĐẶT SÂN ==========
async function loadNotifications() {
    const notifList = document.getElementById("notificationPanel");
    if (!notifList) return;
    
    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) console.error("Lỗi thông báo:", error);

    let html = `<div style="padding: 12px; border-bottom: 1px solid #ddd; font-weight: bold;">📢 THÔNG BÁO ĐẶT SÂN</div>`;
    let count = 0;
    
    if (!notifications || notifications.length === 0) {
        html += "<div style='padding: 20px; text-align: center;'>Chưa có thông báo</div>";
    } else {
        notifications.forEach(data => {
            if (!data.read) count++;
            html += `
                <div class="notif-item ${!data.read ? 'unread' : ''}" data-id="${data.id}" style="padding: 12px; border-bottom: 1px solid #eee; cursor:pointer;">
                    <strong>👤 ${data.user_name}</strong><br>
                    📞 ${data.phone}<br>
                    🏸 ${data.court_slots}<br>
                    📅 ${data.date}
                </div>
            `;
        });
    }
    notifList.innerHTML = html;
    
    const badge = document.getElementById("notifBadge");
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? "inline-block" : "none";
    }
    
    document.querySelectorAll(".notif-item").forEach(el => {
        el.onclick = async () => {
            const id = el.dataset.id;
            if (id) {
                await supabase.from('notifications').update({ read: true }).eq('id', id);
                loadNotifications();
            }
        };
    });
}

function startNotificationListener() {
    supabase
        .channel('public:notifications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
            if (window.adminLoggedIn) loadNotifications();
        })
        .subscribe();
}

// ========== ADMIN AUTH ==========
async function adminLogin() {
    const pwdInput = document.getElementById("adminPassword").value;
    
    const { data: settingData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'admin')
        .maybeSingle();

    let correctPwd = "admin123";
    if (settingData && settingData.value && settingData.value.password) {
        correctPwd = settingData.value.password;
    }
    
    if (pwdInput === correctPwd) {
        window.adminLoggedIn = true;
        document.getElementById("adminLoginDiv").style.display = "none";
        document.getElementById("adminContent").style.display = "block";
        renderAdminTable();
        loadProducts();
        loadOrders();
        loadNotifications();
        startNotificationListener();
        startOrderListener();
        checkNewOrders();
        window.showToast("Đăng nhập admin thành công");
    } else {
        window.showToast("Mật khẩu admin không đúng!", true);
    }
}

function adminLogout() {
    window.adminLoggedIn = false;
    document.getElementById("adminLoginDiv").style.display = "block";
    document.getElementById("adminContent").style.display = "none";
    window.showToast("Đã đăng xuất admin");
}

function initDatePicker() {
    const datePicker = document.getElementById("datePicker");
    if (datePicker) {
        datePicker.value = window.selectedDate;
        datePicker.addEventListener("change", (e) => {
            window.selectedDate = e.target.value;
            renderAdminTable();
        });
    }
}

function initTabs() {
    document.querySelectorAll(".admin-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            document.querySelectorAll(".admin-tab-content").forEach(content => content.style.display = "none");
            const activeTab = document.getElementById(`${tabName}Tab`);
            if (activeTab) activeTab.style.display = "block";
            
            if (tabName === "shop") loadProducts();
            if (tabName === "orders") {
                loadOrders();
                markOrdersAsRead();
            }
        });
    });
}

window.onload = () => {
    initDatePicker();
    initTabs();
    
    const loginBtn = document.getElementById("adminLoginBtn");
    const logoutBtn = document.getElementById("adminLogoutBtn");
    const addProductBtn = document.getElementById("addProductBtn");
    const notifBell = document.getElementById("notifBell");
    
    if (loginBtn) loginBtn.onclick = adminLogin;
    if (logoutBtn) logoutBtn.onclick = adminLogout;
    if (addProductBtn) addProductBtn.onclick = addProduct;
    if (notifBell) {
        notifBell.onclick = () => {
            const panel = document.getElementById("notificationPanel");
            if (panel) {
                panel.style.display = panel.style.display === "none" ? "block" : "none";
                if (panel.style.display === "block") loadNotifications();
            }
        };
    }
};