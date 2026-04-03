import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, addDoc, setDoc, onSnapshot, orderBy } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB82QdjDo-glKNndiGtawo0SArTGVZrbqw",
    authDomain: "sclthienn-ebd45.firebaseapp.com",
    projectId: "sclthienn-ebd45",
    storageBucket: "sclthienn-ebd45.firebasestorage.app",
    messagingSenderId: "171574896796",
    appId: "1:171574896796:web:12a0c4d00952ace6886559",
    measurementId: "G-WJB7KFH28M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.db = db;
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
    const bookingsRef = collection(db, "bookings");
    const q = query(bookingsRef, where("date", "==", dateStr));
    const snapshot = await getDocs(q);
    const slotMap = new Map();
    
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.slots) {
            data.slots.forEach(slotObj => {
                const key = Object.keys(slotObj)[0];
                slotMap.set(key, slotObj[key]);
            });
        }
    });
    
    let html = `<div class="table-responsive"><table class="booking-table"><thead><tr><th>Giờ / Sân</th>`;
    for (let i = 0; i < window.timeSlots.length; i++) {
        html += `<th>${window.timeSlots[i]}</th>`;
    }
    html += `<tr></thead><tbody>`;
    
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
    const bookingsRef = collection(db, "bookings");
    const q = query(bookingsRef, where("date", "==", dateStr));
    const snapshot = await getDocs(q);
    
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.slots) {
            const updatedSlots = data.slots.map(slotObj => {
                const slotKey = Object.keys(slotObj)[0];
                if (slotKey === key) {
                    return { [slotKey]: { ...slotObj[slotKey], status: newStatus } };
                }
                return slotObj;
            });
            await updateDoc(docSnap.ref, { slots: updatedSlots });
            window.showToast(`Đã duyệt đặt sân!`);
            renderAdminTable();
            return;
        }
    }
}

async function deleteSlot(key) {
    if (!confirm("Xóa đặt sân này?")) return;
    
    const dateStr = window.selectedDate;
    const bookingsRef = collection(db, "bookings");
    const q = query(bookingsRef, where("date", "==", dateStr));
    const snapshot = await getDocs(q);
    
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.slots) {
            const updatedSlots = data.slots.filter(slotObj => Object.keys(slotObj)[0] !== key);
            if (updatedSlots.length === 0) {
                await deleteDoc(docSnap.ref);
            } else {
                await updateDoc(docSnap.ref, { slots: updatedSlots });
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
    
    const productsRef = collection(db, "products");
    const snapshot = await getDocs(productsRef);
    
    let html = "";
    snapshot.forEach(docSnap => {
        const product = { id: docSnap.id, ...docSnap.data() };
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
                    <span class="product-price">${product.price.toLocaleString()}đ</span>
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
    const newStock = parseInt(document.getElementById(`editStock_${id}`).value);
    const newPrice = parseInt(document.getElementById(`editPrice_${id}`).value);
    
    if (isNaN(newStock) || isNaN(newPrice)) {
        window.showToast("Vui lòng nhập số hợp lệ!", true);
        return;
    }
    
    const productRef = doc(db, "products", id);
    await updateDoc(productRef, { stock: newStock, price: newPrice });
    window.showToast("Cập nhật sản phẩm thành công!");
    loadProducts();
};

window.deleteProduct = async (id) => {
    if (confirm("Bạn có chắc muốn xóa sản phẩm này?")) {
        await deleteDoc(doc(db, "products", id));
        window.showToast("Đã xóa sản phẩm!");
        loadProducts();
    }
};

async function addProduct() {
    const name = document.getElementById("productName").value.trim();
    const category = document.getElementById("productCategory").value;
    const price = parseInt(document.getElementById("productPrice").value);
    const stock = parseInt(document.getElementById("productStock").value);
    
    if (!name || isNaN(price) || isNaN(stock)) {
        window.showToast("Vui lòng nhập đầy đủ thông tin!", true);
        return;
    }
    
    const productsRef = collection(db, "products");
    await addDoc(productsRef, {
        name: name,
        category: category,
        price: price,
        stock: stock,
        createdAt: new Date()
    });
    
    window.showToast("Thêm sản phẩm thành công!");
    document.getElementById("productName").value = "";
    document.getElementById("productPrice").value = "";
    document.getElementById("productStock").value = "";
    loadProducts();
}

// ========== QUẢN LÝ ĐƠN HÀNG (có chấm đỏ) ==========
async function checkNewOrders() {
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    let newCount = 0;
    const now = new Date();
    
    snapshot.forEach(docSnap => {
        const order = docSnap.data();
        const createdAt = order.createdAt?.toDate?.() || new Date(order.createdAt);
        const diffMinutes = (now - createdAt) / (1000 * 60);
        if (diffMinutes <= 30 && !order.adminRead) {
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
    
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    let html = "";
    snapshot.forEach(docSnap => {
        const order = { id: docSnap.id, ...docSnap.data() };
        const date = order.createdAt?.toDate?.() || new Date(order.createdAt);
        const isNew = !order.adminRead;
        
        html += `
            <div class="order-item ${isNew ? 'order-new' : ''}" data-id="${order.id}">
                <div class="order-header">
                    <strong>👤 ${order.userName}</strong>
                    <span>📞 ${order.userPhone}</span>
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
                    <strong>Tổng: ${order.total?.toLocaleString() || 0}đ</strong>
                    <button onclick="markOrderRead('${order.id}')" style="background:#10b981;">✅ Đã xem</button>
                    <button onclick="deleteOrder('${order.id}')" style="background:#ef4444;">🗑️ Xóa</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html || "<p>Chưa có đơn hàng nào</p>";
}

window.markOrderRead = async (id) => {
    const orderRef = doc(db, "orders", id);
    await updateDoc(orderRef, { adminRead: true, readAt: new Date() });
    window.showToast("Đã đánh dấu đã xem!");
    loadOrders();
    checkNewOrders();
};

window.deleteOrder = async (id) => {
    if (confirm("Xóa đơn hàng này?")) {
        await deleteDoc(doc(db, "orders", id));
        window.showToast("Đã xóa đơn hàng!");
        loadOrders();
        checkNewOrders();
    }
};

function startOrderListener() {
    onSnapshot(collection(db, "orders"), () => {
        if (window.adminLoggedIn) {
            checkNewOrders();
            const activeTab = document.querySelector('.admin-tab.active');
            if (activeTab && activeTab.dataset.tab === "orders") {
                loadOrders();
            }
        }
    });
}

// ========== THÔNG BÁO ĐẶT SÂN ==========
function loadNotifications() {
    const notifList = document.getElementById("notificationPanel");
    if (!notifList) return;
    
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    getDocs(q).then(snapshot => {
        let html = `<div style="padding: 12px; border-bottom: 1px solid #ddd; font-weight: bold;">📢 THÔNG BÁO ĐẶT SÂN</div>`;
        let count = 0;
        
        if (snapshot.empty) {
            html += "<div style='padding: 20px; text-align: center;'>Chưa có thông báo</div>";
        } else {
            snapshot.forEach(docSn => {
                const data = docSn.data();
                if (!data.read) count++;
                html += `
                    <div class="notif-item ${!data.read ? 'unread' : ''}" data-id="${docSn.id}" style="padding: 12px; border-bottom: 1px solid #eee; cursor:pointer;">
                        <strong>👤 ${data.userName}</strong><br>
                        📞 ${data.phone}<br>
                        🏸 ${data.courtSlots}<br>
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
                    await updateDoc(doc(db, "notifications", id), { read: true });
                    loadNotifications();
                }
            };
        });
    });
}

function startNotificationListener() {
    onSnapshot(collection(db, "notifications"), () => {
        if (window.adminLoggedIn) loadNotifications();
    });
}

// ========== ADMIN AUTH ==========
async function adminLogin() {
    const pwdInput = document.getElementById("adminPassword").value;
    const settingsRef = doc(db, "settings", "admin");
    const docSnap = await getDoc(settingsRef);
    let correctPwd = "admin123";
    if (docSnap.exists()) correctPwd = docSnap.data().password;
    
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