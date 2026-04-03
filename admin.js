import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, onSnapshot, orderBy } from "firebase/firestore";

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

async function renderAdminTable() {
    const container = document.getElementById("adminTable");
    if (!container || !window.adminLoggedIn) return;
    
    const dateStr = window.selectedDate;
    const bookingsRef = collection(db, "bookings");
    const q = query(bookingsRef, where("date", "==", dateStr));
    const snapshot = await getDocs(q);
    const slotMap = new Map(); // key -> { status, userName, phone, userId }
    
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
                        <button class="confirm-btn" data-key="${key}" data-user="${slot.userId}" style="background:#10b981; padding:4px 8px; font-size:10px;">✅ Duyệt</button>
                        <button class="cancel-btn" data-key="${key}" data-user="${slot.userId}" style="background:#ef4444; padding:4px 8px; font-size:10px;">❌ Từ chối</button>
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
    
    // Gắn sự kiện cho nút duyệt/từ chối
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
            window.showToast(`Đã ${newStatus === "confirmed" ? "duyệt" : "cập nhật"} đặt sân!`);
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
                    <div class="notif-item ${!data.read ? 'unread' : ''}" data-id="${docSn.id}" style="padding: 12px; border-bottom: 1px solid #eee;">
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
}

function initDatePicker() {
    const datePicker = document.getElementById("datePicker");
    datePicker.value = window.selectedDate;
    datePicker.addEventListener("change", (e) => {
        window.selectedDate = e.target.value;
        renderAdminTable();
    });
}

window.onload = () => {
    initDatePicker();
    document.getElementById("adminLoginBtn").onclick = adminLogin;
    document.getElementById("adminLogoutBtn").onclick = adminLogout;
    document.getElementById("notifBell").onclick = () => {
        const panel = document.getElementById("notificationPanel");
        panel.style.display = panel.style.display === "none" ? "block" : "none";
        if (panel.style.display === "block") loadNotifications();
    };
};