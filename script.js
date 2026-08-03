(function() {
    // Lấy supabase client từ window
    const supabase = window.supabaseClient;
    
    if (!supabase) {
        console.error("❌ Supabase Client chưa sẵn sàng!");
        // Không tạo mock, để lỗi hiện rõ
    }

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
        if (!toast) return;
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
        try {
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
        } catch (err) {
            console.error("Lỗi getBookedSlots:", err);
            return { bookedMap: new Map(), pendingMap: new Map() };
        }
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
                        const modal = document.getElementById("loginModal");
                        if (modal) modal.style.display = "flex";
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
            const modal = document.getElementById("loginModal");
            if (modal) modal.style.display = "flex";
            return;
        }
        
        if (window.tempSelectedSlots.size === 0) {
            window.showToast("Vui lòng chọn ít nhất 1 khung giờ!", true);
            return;
        }
        
        const user = window.currentUser;
        const dateStr = window.selectedDate;
        const bookingDocId = `${dateStr}_${user.uid}`;
        
        try {
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
        } catch (err) {
            console.error("Lỗi confirmBooking:", err);
        }
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
        const regNameEl = document.getElementById("regName");
        const regPhoneEl = document.getElementById("regPhone");
        const regPwdEl = document.getElementById("regPwd");
        const regConfirmPwdEl = document.getElementById("regConfirmPwd");

        const nickname = regNameEl ? regNameEl.value.trim() : "";
        const phone = regPhoneEl ? regPhoneEl.value.trim() : "";
        const pwd = regPwdEl ? regPwdEl.value : "";
        const confirmPwd = regConfirmPwdEl ? regConfirmPwdEl.value : "";
        
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
        
        try {
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
            const loginModal = document.getElementById("loginModal");
            if (loginModal) loginModal.style.display = "flex";
        } catch (err) {
            console.error("Lỗi register:", err);
        }
    }

    async function login() {
        const loginPhoneEl = document.getElementById("loginPhone");
        const loginPwdEl = document.getElementById("loginPwd");

        const phone = loginPhoneEl ? loginPhoneEl.value.trim() : "";
        const pwd = loginPwdEl ? loginPwdEl.value : "";
        
        if (!phone || !pwd) {
            window.showToast("Vui lòng nhập đầy đủ thông tin!", true);
            return;
        }

        try {
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
        } catch (err) {
            console.error("Lỗi login:", err);
        }
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
            if (authButtons) authButtons.style.display = "none";
            if (userInfo) userInfo.style.display = "flex";
            const displayEl = document.getElementById("userNameDisplay");
            if (displayEl) displayEl.textContent = window.currentUser.displayName;
        } else {
            if (authButtons) authButtons.style.display = "flex";
            if (userInfo) userInfo.style.display = "none";
        }
    }

    function closeModals() {
        const loginModal = document.getElementById("loginModal");
        const registerModal = document.getElementById("registerModal");
        if (loginModal) loginModal.style.display = "none";
        if (registerModal) registerModal.style.display = "none";
    }

    function initDatePicker() {
        const datePicker = document.getElementById("datePicker");
        if (!datePicker) return;
        const today = new Date().toISOString().split('T')[0];
        datePicker.value = window.selectedDate;
        datePicker.min = today;
        datePicker.addEventListener("change", (e) => {
            window.selectedDate = e.target.value;
            window.tempSelectedSlots.clear();
            renderBookingTable();
        });
    }

    function setupEventListeners() {
        const showLoginBtn = document.getElementById("showLoginBtn");
        const showRegisterBtn = document.getElementById("showRegisterBtn");
        const closeLoginModalBtn = document.getElementById("closeLoginModal");
        const closeRegisterModalBtn = document.getElementById("closeRegisterModal");
        const loginSubmitBtn = document.getElementById("loginSubmit");
        const registerSubmitBtn = document.getElementById("registerSubmit");
        const gotoRegisterLink = document.getElementById("gotoRegisterLink");
        const gotoLoginLink = document.getElementById("gotoLoginLink");
        const logoutBtn = document.getElementById("logoutBtn");
        const confirmBookingBtn = document.getElementById("confirmBookingBtn");
        const clearSelectionBtn = document.getElementById("clearSelectionBtn");

        if (showLoginBtn) showLoginBtn.onclick = () => {
            const modal = document.getElementById("loginModal");
            if (modal) modal.style.display = "flex";
        };
        if (showRegisterBtn) showRegisterBtn.onclick = () => {
            const modal = document.getElementById("registerModal");
            if (modal) modal.style.display = "flex";
        };
        if (closeLoginModalBtn) closeLoginModalBtn.onclick = closeModals;
        if (closeRegisterModalBtn) closeRegisterModalBtn.onclick = closeModals;
        if (loginSubmitBtn) loginSubmitBtn.onclick = login;
        if (registerSubmitBtn) registerSubmitBtn.onclick = register;
        if (gotoRegisterLink) gotoRegisterLink.onclick = (e) => {
            e.preventDefault();
            closeModals();
            const modal = document.getElementById("registerModal");
            if (modal) modal.style.display = "flex";
        };
        if (gotoLoginLink) gotoLoginLink.onclick = (e) => {
            e.preventDefault();
            closeModals();
            const modal = document.getElementById("loginModal");
            if (modal) modal.style.display = "flex";
        };
        if (logoutBtn) logoutBtn.onclick = logout;
        if (confirmBookingBtn) confirmBookingBtn.onclick = confirmBooking;
        if (clearSelectionBtn) clearSelectionBtn.onclick = clearAllSelection;

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
                    const btn = document.getElementById("loginSubmit");
                    if (btn) btn.click();
                }
            });
        }
        if (loginPwdInput) {
            loginPwdInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const btn = document.getElementById("loginSubmit");
                    if (btn) btn.click();
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
                        const btn = document.getElementById("registerSubmit");
                        if (btn) btn.click();
                    }
                });
            }
        });
    }

    function initApp() {
        setupEventListeners();

        const savedUser = localStorage.getItem("currentUser");
        if (savedUser) {
            try {
                window.currentUser = JSON.parse(savedUser);
                updateAuthUI();
            } catch (e) {
                console.error("Lỗi parse user:", e);
            }
        }
        initDatePicker();
        renderBookingTable();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initApp);
    } else {
        initApp();
    }
})();