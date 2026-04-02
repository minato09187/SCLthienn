import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, addDoc } from "firebase/firestore";

// 🔧 THAY THẾ BẰNG CONFIG FIREBASE CỦA BẠN
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
const auth = getAuth(app);
const db = getFirestore(app);

window.db = db;
window.currentUser = null;
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

async function renderBookingTable() {
    const container = document.getElementById("customerTable");
    if (!container) return;
    
    const dateStr = window.selectedDate;
    const todayStr = new Date().toISOString().split('T')[0];
    const isPastDate = dateStr < todayStr;
    
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
            
            if (isPastDate) {
                cellClass += " past-date";
                cellContent = "🔒";
            } else if (isBooked) {
                cellClass += " booked";
                cellContent = "❌ Đã đặt";
            } else {
                cellClass += " available";
                cellContent = "✔️";
            }
            html += `<td class="${cellClass}" data-court="${c}" data-hour="${h}" data-booked="${isBooked}">${cellContent}</td>`;
        }
        html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    if (!isPastDate) {
        document.querySelectorAll(`#customerTable .booking-cell.available`).forEach(cell => {
            cell.addEventListener('click', async (e) => {
                const court = parseInt(cell.dataset.court);
                const hour = parseInt(cell.dataset.hour);
                if (!window.currentUser) {
                    window.showToast("Vui lòng đăng nhập để đặt sân!", true);
                    return;
                }
                
                const key = `${court}_${hour}`;
                const qCheck = query(collection(db, "bookings"), where("date", "==", window.selectedDate));
                const snapCheck = await getDocs(qCheck);
                let already = false;
                snapCheck.forEach(docSn => {
                    if (docSn.data().slots) {
                        docSn.data().slots.forEach(slotObj => {
                            if (Object.keys(slotObj)[0] === key) already = true;
                        });
                    }
                });
                if (already) {
                    window.showToast("Ô này vừa có người đặt rồi!", true);
                    renderBookingTable();
                    return;
                }
                
                const user = window.currentUser;
                const bookingDocId = `${window.selectedDate}_${user.uid}`;
                const bookingDocRef = doc(db, "bookings", bookingDocId);
                const docSnap = await getDoc(bookingDocRef);
                const newSlot = { [key]: { userId: user.uid, userName: user.displayName, phone: user.phoneNumber } };
                
                if (docSnap.exists()) {
                    const existing = docSnap.data().slots || [];
                    await updateDoc(bookingDocRef, { slots: [...existing, newSlot] });
                } else {
                    await setDoc(bookingDocRef, {
                        date: window.selectedDate,
                        userId: user.uid,
                        userName: user.displayName,
                        phone: user.phoneNumber,
                        slots: [newSlot],
                        createdAt: new Date()
                    });
                }
                
                window.showToast(`Đặt sân ${court} - ${window.timeSlots[hour]} thành công!`);
                const notifRef = collection(db, "notifications");
                await addDoc(notifRef, {
                    userName: user.displayName,
                    phone: user.phoneNumber,
                    courtSlots: `Sân ${court} - ${window.timeSlots[hour]}`,
                    date: window.selectedDate,
                    read: false,
                    createdAt: new Date(),
                    userId: user.uid
                });
                
                renderBookingTable();
            });
        });
    }
}

// Auth functions (đăng ký, đăng nhập, v.v.)
async function register() {
    const nickname = document.getElementById("regName").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const pwd = document.getElementById("regPwd").value;
    const confirmPwd = document.getElementById("regConfirmPwd").value;
    if (!nickname || !phone || !pwd) {
        window.showToast("Vui lòng nhập đầy đủ thông tin", true);
        return;
    }
    if (pwd !== confirmPwd) {
        window.showToast("Mật khẩu nhập lại không khớp!", true);
        return;
    }
    
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("phone", "==", phone));
    const snap = await getDocs(q);
    if (!snap.empty) {
        window.showToast("Số điện thoại đã được đăng ký!", true);
        return;
    }
    
    await setDoc(doc(usersRef, phone), {
        name: nickname,
        phone: phone,
        password: pwd,
        createdAt: new Date()
    });
    window.showToast("Đăng ký thành công! Vui lòng đăng nhập.");
    closeModals();
    document.getElementById("loginModal").style.display = "flex";
}

async function login() {
    const phone = document.getElementById("loginPhone").value.trim();
    const pwd = document.getElementById("loginPwd").value;
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("phone", "==", phone));
    const snap = await getDocs(q);
    if (snap.empty) {
        window.showToast("Đã nhập sai sdt hoặc mật khẩu!", true);
        return;
    }
    let userData = null;
    snap.forEach(docSnap => { userData = docSnap.data(); });
    if (userData.password !== pwd) {
        window.showToast("Đã nhập sai sdt hoặc mật khẩu!", true);
        return;
    }
    
    window.currentUser = {
        uid: phone,
        displayName: userData.name,
        phoneNumber: phone
    };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    updateAuthUI();
    closeModals();
    renderBookingTable();
    window.showToast(`Chào mừng ${userData.name}`);
}

function logout() {
    window.currentUser = null;
    localStorage.removeItem("currentUser");
    updateAuthUI();
    renderBookingTable();
    window.showToast("Đã đăng xuất");
}

function updateAuthUI() {
    const authButtons = document.getElementById("authButtons");
    const userInfo = document.getElementById("userInfo");
    if (window.currentUser) {
        authButtons.style.display = "none";
        userInfo.style.display = "flex";
        document.getElementById("userNameDisplay").textContent = window.currentUser.displayName;
    } else {
        authButtons.style.display = "flex";
        userInfo.style.display = "none";
    }
}

function closeModals() {
    document.getElementById("loginModal").style.display = "none";
    document.getElementById("registerModal").style.display = "none";
}

function initDatePicker() {
    const datePicker = document.getElementById("datePicker");
    const today = new Date().toISOString().split('T')[0];
    datePicker.value = window.selectedDate;
    datePicker.min = today;
    datePicker.addEventListener("change", (e) => {
        window.selectedDate = e.target.value;
        renderBookingTable();
    });
}

// Khởi chạy
window.onload = () => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        updateAuthUI();
    }
    initDatePicker();
    renderBookingTable();
    
    document.getElementById("showLoginBtn").onclick = () => document.getElementById("loginModal").style.display = "flex";
    document.getElementById("showRegisterBtn").onclick = () => document.getElementById("registerModal").style.display = "flex";
    document.getElementById("closeLoginModal").onclick = closeModals;
    document.getElementById("closeRegisterModal").onclick = closeModals;
    document.getElementById("loginSubmit").onclick = login;
    document.getElementById("registerSubmit").onclick = register;
    document.getElementById("gotoRegisterLink").onclick = (e) => { e.preventDefault(); closeModals(); document.getElementById("registerModal").style.display = "flex"; };
    document.getElementById("gotoLoginLink").onclick = (e) => { e.preventDefault(); closeModals(); document.getElementById("loginModal").style.display = "flex"; };
    document.getElementById("logoutBtn").onclick = logout;
    document.getElementById("confirmBookingBtn").onclick = () => {
        if (!window.currentUser) window.showToast("Vui lòng đăng nhập!", true);
        else window.showToast("Yêu cầu đã gửi đến quản lý!");
    };
};
