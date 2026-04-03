import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, addDoc, setDoc, onSnapshot, orderBy } from "firebase/firestore";

// 🔧 THAY THẾ BẰNG CONFIG CỦA BẠN
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
window.adminDeleteMode = false;
window.selectedCellsToDelete = [];

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
    const bookingMap = new Map();
    
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.slots) {
            data.slots.forEach(slotObj => {
                const key = Object.keys(slotObj)[0];
                bookingMap.set(key, slotObj[key]);
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
            const booked = bookingMap.get(key);
            const isBooked = !!booked;
            let cellClass = "booking-cell";
            let cellContent = "";
            
            if (isBooked) {
                cellClass += " admin-booked";
                cellContent = `${booked.userName}<br><small>${booked.phone}</small>`;
            } else {
                cellClass += " available";
                cellContent = "✔️ Trống";
            }
            html += `<td class="${cellClass}" data-court="${c}" data-hour="${h}" data-booked="${isBooked}">${cellContent}</td>`;
        }
        html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    container.innerHTML = html;
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
            shuttlecock: "🏸 Cầu",
            racket: "🏓 Vợt",
            net: "🥅 Lưới",
            shirt: "👕 Áo",
            shoes: "👟 Giày"
        }[product.category] || product.category;
        
        html += `
            <div class="product-item" data-id="${product.id}">
                <div class="product-info">
                    <strong>${product.name}</strong>
                    <span class="product-category">${categoryName}</span>
                    <span class="product-price">${product.price.toLocaleString()}đ</span>
                    <span class="product-stock">📦 Còn: ${product.stock}</span>
                </div>
                <div class="product-actions">
                    <input type="number" id="editStock_${product.id}" value="${product.stock}" min="0" style="width:80px">
                    <input type="number" id="editPrice_${product.id}" value="${product.price}" min="0" style="width:120px">
                    <button onclick="updateProduct('${product.id}')">✏️ Cập nhật</button>
                    <button onclick="deleteProduct('${product.id}')" style="background:#ef4444">🗑️ Xóa</button>
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
    await updateDoc(productRef, {
        stock: newStock,
        price: newPrice
    });
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

// ========== QUẢN LÝ ĐƠN HÀNG ==========
async function loadOrders() {
    const container = document.getElementById("ordersList");
    if (!container) return;
    
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    let html = "";
    snapshot.forEach(docSnap => {
        const order = { id: docSnap.id, ...docSnap.data() };
        const date = order.createdAt?.toDate?.() || new Date();
        
        html += `
            <div class="order-item">
                <div class="order-header">
                    <strong>👤 ${order.userName}</strong>
                    <span>📞 ${order.userPhone}</span>
                    <span>📍 ${order.address}</span>
                    <span>📅 ${date.toLocaleDateString()}</span>
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
                    <button onclick="markOrderCompleted('${order.id}')" style="background:#10b981">✅ Đã giao hàng</button>
                    <button onclick="deleteOrder('${order.id}')" style="background:#ef4444">🗑️ Xóa</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html || "<p>Chưa có đơn hàng nào</p>";
}

window.markOrderCompleted = async (id) => {
    await deleteDoc(doc(db, "orders", id));
    window.showToast("Đã đánh dấu đơn hàng hoàn thành!");
    loadOrders();
};

window.deleteOrder = async (id) => {
    if (confirm("Xóa đơn hàng này?")) {
        await deleteDoc(doc(db, "orders", id));
        window.showToast("Đã xóa đơn hàng!");
        loadOrders();
    }
};

// ========== XÓA SÂN ADMIN ==========
function enableAdminDeleteMode() {
    window.adminDeleteMode = !window.adminDeleteMode;
    const btn = document.getElementById("toggleDeleteBtn");
    if (window.adminDeleteMode) {
        btn.textContent = "❌ Hủy xóa";
        btn.style.background = "#ef4444";
        window.showToast("Đã bật chế độ xóa, click vào ô xanh để chọn");
    } else {
        btn.textContent = "🗑️ Xóa sân (admin)";
        btn.style.background = "#3b82f6";
        window.selectedCellsToDelete = [];
    }
}

async function confirmDeleteCells() {
    if (!window.adminDeleteMode || window.selectedCellsToDelete.length === 0) {
        window.showToast("Chưa chọn ô nào!", true);
        return;
    }
    
    for (let item of window.selectedCellsToDelete) {
        const key = `${item.court}_${item.hour}`;
        const q = query(collection(db, "bookings"), where("date", "==", window.selectedDate));
        const snapshot = await getDocs(q);
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            if (data.slots) {
                const newSlots = data.slots.filter(slotObj => Object.keys(slotObj)[0] !== key);
                if (newSlots.length === 0) {
                    await deleteDoc(docSnap.ref);
                } else {
                    await updateDoc(docSnap.ref, { slots: newSlots });
                }
            }
        }
    }
    window.showToast(`Đã xóa ${window.selectedCellsToDelete.length} ô`);
    window.selectedCellsToDelete = [];
    window.adminDeleteMode = false;
    document.getElementById("toggleDeleteBtn").textContent = "🗑️ Xóa sân (admin)";
    document.getElementById("toggleDeleteBtn").style.background = "#3b82f6";
    renderAdminTable();
}

// ========== THÔNG BÁO ==========
function loadNotifications() {
    const notifList = document.getElementById("notificationPanel");
    const q = query(collection(db, "notifications"), where("read", "==", false), orderBy("createdAt", "desc"));
    getDocs(q).then(snapshot => {
        let html = "<h4>📢 Thông báo đặt sân mới</h4>";
        let count = 0;
        snapshot.forEach(docSn => {
            const data = docSn.data();
            count++;
            html += `
                <div class="notif-item unread" data-id="${docSn.id}">
                    <strong>${data.userName}</strong><br>
                    📞 ${data.phone}<br>
                    🏸 ${data.courtSlots}<br>
                    📅 ${data.date}
                </div>
            `;
        });
        if (count === 0) html += "<div>Không có thông báo mới</div>";
        notifList.innerHTML = html;
        document.getElementById("notifBadge").textContent = count > 0 ? count : "";
        document.getElementById("notifBadge").style.display = count > 0 ? "inline-block" : "none";
        
        document.querySelectorAll(".notif-item").forEach(el => {
            el.addEventListener("click", async () => {
                const id = el.dataset.id;
                await updateDoc(doc(db, "notifications", id), { read: true });
                loadNotifications();
            });
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

// ========== KHỞI TẠO ==========
function initDatePicker() {
    const datePicker = document.getElementById("datePicker");
    datePicker.value = window.selectedDate;
    datePicker.addEventListener("change", (e) => {
        window.selectedDate = e.target.value;
        renderAdminTable();
    });
}

function initTabs() {
    document.querySelectorAll(".admin-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            document.querySelectorAll(".admin-tab-content").forEach(content => content.style.display = "none");
            document.getElementById(`${tabName}Tab`).style.display = "block";
            
            if (tabName === "shop") loadProducts();
            if (tabName === "orders") loadOrders();
        });
    });
}

// Event cho xóa cells
document.addEventListener('click', (e) => {
    if (!window.adminLoggedIn || !window.adminDeleteMode) return;
    const cell = e.target.closest('.admin-booked');
    if (!cell) return;
    const court = parseInt(cell.dataset.court);
    const hour = parseInt(cell.dataset.hour);
    const exists = window.selectedCellsToDelete.some(item => item.court === court && item.hour === hour);
    if (exists) {
        window.selectedCellsToDelete = window.selectedCellsToDelete.filter(item => !(item.court === court && item.hour === hour));
        cell.style.outline = "";
    } else {
        window.selectedCellsToDelete.push({ court, hour });
        cell.style.outline = "3px solid orange";
    }
});

window.onload = () => {
    initDatePicker();
    initTabs();
    document.getElementById("adminLoginBtn").onclick = adminLogin;
    document.getElementById("adminLogoutBtn").onclick = adminLogout;
    document.getElementById("toggleDeleteBtn").onclick = enableAdminDeleteMode;
    document.getElementById("confirmDeleteBtn").onclick = confirmDeleteCells;
    document.getElementById("addProductBtn").onclick = addProduct;
    document.getElementById("notifBell").onclick = () => {
        const panel = document.getElementById("notificationPanel");
        panel.style.display = panel.style.display === "none" ? "block" : "none";
        if (panel.style.display === "block") loadNotifications();
    };
};