import { supabase } from "./supabaseClient.js";

window.supabase = supabase;
window.currentUser = null;
window.selectedDate = new Date().toISOString().split('T')[0];
window.courtsCount = 6;
window.timeSlots = [];
window.tempSelectedSlots = new Set();

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

function isStrongPassword(password) {
    if (password.length < 6) return false;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasLetter && hasNumber;
}

async function getBookedSlots() {
    const dateStr = window.selectedDate;
    const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', dateStr);

    if (error) {
        console.error("Lỗi lấy dữ liệu đặt sân:", error);
        return { bookedMap: new Map(), pendingMap: new Map() };
    }

    const bookedMap = new Map();
    const pendingMap = new Map();
    
    (data || []).forEach(row => {
        if (row.slots && Array.isArray(row.slots)) {
            row.slots.forEach(slotObj => {
                const key = Object.keys(slotObj)[0];
                const slotData = slotObj[key];
                if (slotData.status === "confirmed") {
                    bookedMap.set(key, slotData);
                } else if (slotData.status === "pending") {
                    pendingMap.set(key, slotData);
                }
            });
        }
    });
    
    return { bookedMap, pendingMap };
}

async function renderBookingTable() {
    const container = document.getElementById("customerTable");
    if (!container) return;
    
    const dateStr = window.selectedDate;
    const todayStr = new Date().toISOString().split('T')[0];
    const isPastDate = dateStr < todayStr;
    
    const { bookedMap, pendingMap } = await getBookedSlots();
    
    let html = `<div class="table-responsive"><table class="booking-table"><thead><tr><th>Giờ / Sân</th>`;
    for (let i = 0; i < window.timeSlots.length; i++) {
        html += `<th>${window.timeSlots[i]}</th>`;
    }
    html += `</tr></thead><tbody>`;
    
    for (let c = 1; c <= window.courtsCount; c++) {
        html += `<tr><td class="court-label">Sân ${c}</td>`;
        for (let h = 0; h < window.timeSlots.length; h++) {
            const key = `${c}_${h}`;
            const isBooked = bookedMap.has(key);
            const isPending = pendingMap.has(key);
            const isTempSelected = window.tempSelectedSlots.has(key);
            
            let cellClass = "booking-cell";
            let cellContent = "";
            
            if (isPastDate) {
                cellClass += " past-date";
                cellContent = "🔒";
            } else if (isBooked) {
                cellClass += " booked";
                cellContent = "❌ Đã đặt";
            } else if (isPending) {
                cellClass += " pending";
                cellContent = "⏳ Chờ duyệt";
            } else if (isTempSelected) {
                cellClass += " temp-selected";
                cellContent = "⭐ Đã chọn";
            } else {
                cellClass += " available";
                cellContent = "✔️";
            }
            html += `<td class="${cellClass}" data-court="${c}" data-hour="${h}" data-key="${key}">${cellContent}</td>`;
        }
        html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    if (!isPastDate) {
        const clickableCells = document.querySelectorAll(`#customerTable .booking-cell.available, #customerTable .booking-cell.temp-selected`);
        
        clickableCells.forEach(cell => {
            cell.removeEventListener('click', cell.handler);
            
            const handler = async (e) => {
                e.stopPropagation();
                const court = parseInt(cell.dataset.court);
                const hour = parseInt(cell.dataset.hour);
                const key = cell.dataset.key;
                
                if (!window.currentUser) {
                    window.showToast("Vui lòng đăng nhập để đặt sân!", true);
                    document.getElementById("loginModal").style.display = "flex";
                    return;
                }
                
                if (window.tempSelectedSlots.has(key)) {
                    window.tempSelectedSlots.delete(key);
                    window.showToast(`Đã bỏ chọn sân ${court} - ${window.timeSlots[hour]}`);
                } else {
                    window.tempSelectedSlots.add(key);
                    window.showToast(`Đã chọn sân ${court} - ${window.timeSlots[hour]}`);
                }
                
                await renderBookingTable();
            };
            
            cell.handler = handler;
            cell.addEventListener('click', handler);
        });
    }
}

async function confirmBooking() {
    if (!window.currentUser) {
        window.showToast("Vui lòng đăng nhập để đặt sân!", true);
        document.getElementById("loginModal").style.display = "flex";
        return;
    }
    
    if (window.tempSelectedSlots.size === 0) {
        window.showToast("Vui lòng chọn ít nhất 1 khung giờ!", true);
        return;
    }
    
    const user = window.currentUser;
    const dateStr = window.selectedDate;
    const bookingDocId = `${dateStr}_${user.uid}`;
    
    const { data: existingData } = await supabase
        .from('bookings')
        .select('slots')
        .eq('id', bookingDocId)
        .maybeSingle();

    let existingSlots = [];
    if (existingData && existingData.slots) {
        existingSlots = existingData.slots;
    }
    
    const newSlots = [];
    const bookedSlotsInfo = [];
    
    for (const key of window.tempSelectedSlots) {
        const [court, hour] = key.split('_');
        newSlots.push({ 
            [key]: { 
                userId: user.uid, 
                userName: user.displayName, 
                phone: user.phoneNumber,
                status: "pending",
                createdAt: new Date().toISOString()
            } 
        });
        bookedSlotsInfo.push(`Sân ${court} - ${window.timeSlots[parseInt(hour)]}`);
    }
    
    const allSlots = [...existingSlots, ...newSlots];

    const { error: bookingErr } = await supabase
        .from('bookings')
        .upsert({
            id: bookingDocId,
            date: dateStr,
            user_id: user.uid,
            user_name: user.displayName,
            phone: user.phoneNumber,
            slots: allSlots
        });

    if (bookingErr) {
        console.error("Lỗi đặt sân:", bookingErr);
        window.showToast("Lỗi đặt sân, vui lòng thử lại!", true);
        return;
    }

    try {
        await supabase
            .from('notifications')
            .insert({
                user_name: user.displayName,
                phone: user.phoneNumber,
                court_slots: bookedSlotsInfo.join(", "),
                date: dateStr,
                read: false,
                user_id: user.uid
            });
    } catch (error) {
        console.error("Lỗi gửi thông báo:", error);
    }
    
    window.showToast(`Đã gửi yêu cầu đặt sân! Vui lòng chờ admin duyệt.`);
    window.tempSelectedSlots.clear();
    await renderBookingTable();
}

function clearAllSelection() {
    if (window.tempSelectedSlots.size === 0) {
        window.showToast("Không có khung giờ nào được chọn!", true);
        return;
    }
    window.tempSelectedSlots.clear();
    renderBookingTable();
    window.showToast("Đã bỏ chọn tất cả khung giờ!");
}

async function register() {
    const nickname = document.getElementById("regName").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const pwd = document.getElementById("regPwd").value;
    const confirmPwd = document.getElementById("regConfirmPwd").value;
    
    if (!nickname) {
        window.showToast("Vui lòng nhập biệt danh!", true);
        return;
    }
    if (!phone) {
        window.showToast("Vui lòng nhập số điện thoại!", true);
        return;
    }
    if (!phone.match(/^\d{10,11}$/)) {
        window.showToast("Số điện thoại không hợp lệ (10-11 số)!", true);
        return;
    }
    if (!pwd) {
        window.showToast("Vui lòng nhập mật khẩu!", true);
        return;
    }
    if (!isStrongPassword(pwd)) {
        window.showToast("Mật khẩu phải có ít nhất 6 ký tự, gồm chữ và số!", true);
        return;
    }
    if (pwd !== confirmPwd) {
        window.showToast("Mật khẩu nhập lại không khớp!", true);
        return;
    }
    
    const { data: nameSnap } = await supabase
        .from('users')
        .select('*')
        .eq('name', nickname);

    if (nameSnap && nameSnap.length > 0) {
        window.showToast("Biệt danh này đã có người sử dụng!", true);
        return;
    }
    
    const { data: phoneSnap } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone);

    if (phoneSnap && phoneSnap.length > 0) {
        window.showToast("Số điện thoại này đã được đăng ký!", true);
        return;
    }
    
    const { error: regErr } = await supabase
        .from('users')
        .insert({
            name: nickname,
            phone: phone,
            password: pwd
        });

    if (regErr) {
        console.error("Lỗi đăng ký:", regErr);
        window.showToast("Đăng ký thất bại, vui lòng thử lại!", true);
        return;
    }
    
    window.showToast("Đăng ký thành công! Vui lòng đăng nhập.");
    closeModals();
    document.getElementById("loginModal").style.display = "flex";
}

async function login() {
    const phone = document.getElementById("loginPhone").value.trim();
    const pwd = document.getElementById("loginPwd").value;
    
    if (!phone || !pwd) {
        window.showToast("Vui lòng nhập đầy đủ thông tin!", true);
        return;
    }

    const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();
    
    if (error || !userData) {
        window.showToast("Đã nhập sai sdt hoặc mật khẩu!", true);
        return;
    }
    
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
    window.tempSelectedSlots.clear();
    await renderBookingTable();
    window.showToast(`Chào mừng ${userData.name}`);
}

function logout() {
    window.currentUser = null;
    localStorage.removeItem("currentUser");
    updateAuthUI();
    window.tempSelectedSlots.clear();
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
        window.tempSelectedSlots.clear();
        renderBookingTable();
    });
}

window.onload = () => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        updateAuthUI();
    }
    initDatePicker();
    renderBookingTable();
    
    const togglePasswordBtn = document.getElementById("togglePasswordBtn");
    const loginPwdInput = document.getElementById("loginPwd");
    if (togglePasswordBtn && loginPwdInput) {
        togglePasswordBtn.onclick = () => {
            if (loginPwdInput.type === "password") {
                loginPwdInput.type = "text";
                togglePasswordBtn.textContent = "🙈";
            } else {
                loginPwdInput.type = "password";
                togglePasswordBtn.textContent = "👁️";
            }
        };
    }
    
    const loginPhoneInput = document.getElementById("loginPhone");
    if (loginPhoneInput) {
        loginPhoneInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                document.getElementById("loginSubmit").click();
            }
        });
    }
    if (loginPwdInput) {
        loginPwdInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                document.getElementById("loginSubmit").click();
            }
        });
    }
    
    const regNameInput = document.getElementById("regName");
    const regPhoneInput = document.getElementById("regPhone");
    const regPwdInput = document.getElementById("regPwd");
    const regConfirmPwdInput = document.getElementById("regConfirmPwd");
    const registerInputs = [regNameInput, regPhoneInput, regPwdInput, regConfirmPwdInput];
    registerInputs.forEach(input => {
        if (input) {
            input.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    document.getElementById("registerSubmit").click();
                }
            });
        }
    });
    
    document.getElementById("showLoginBtn").onclick = () => document.getElementById("loginModal").style.display = "flex";
    document.getElementById("showRegisterBtn").onclick = () => document.getElementById("registerModal").style.display = "flex";
    document.getElementById("closeLoginModal").onclick = closeModals;
    document.getElementById("closeRegisterModal").onclick = closeModals;
    document.getElementById("loginSubmit").onclick = login;
    document.getElementById("registerSubmit").onclick = register;
    document.getElementById("gotoRegisterLink").onclick = (e) => { e.preventDefault(); closeModals(); document.getElementById("registerModal").style.display = "flex"; };
    document.getElementById("gotoLoginLink").onclick = (e) => { e.preventDefault(); closeModals(); document.getElementById("loginModal").style.display = "flex"; };
    document.getElementById("logoutBtn").onclick = logout;
    document.getElementById("confirmBookingBtn").onclick = confirmBooking;
    document.getElementById("clearSelectionBtn").onclick = clearAllSelection;
};