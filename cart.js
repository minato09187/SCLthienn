// Lấy supabase client từ window
const supabase = window.supabaseClient;

if (!supabase) {
    console.error("❌ Supabase Client chưa sẵn sàng!");
}

let currentUser = null;
let currentCategory = "shuttlecock";
let cart = JSON.parse(localStorage.getItem("cart") || "{}");

function showToast(msg, isError = false) {
    const toast = document.getElementById("toastMsg");
    if (!toast) return;
    toast.textContent = msg;
    toast.style.backgroundColor = isError ? "#dc2626" : "#10b981";
    toast.style.display = "block";
    setTimeout(() => toast.style.display = "none", 3000);
}

function isStrongPassword(password) {
    if (password.length < 6) return false;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasLetter && hasNumber;
}

async function loadProducts(category) {
    const container = document.getElementById("productsContainer");
    if (!container) return;

    if (!supabase) {
        container.innerHTML = "<p style='color:red;'>⚠️ Chưa kết nối được Supabase!</p>";
        return;
    }

    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('category', category);

        if (error) throw error;

        if (!products || products.length === 0) {
            container.innerHTML = "<p style='text-align:center; padding:40px;'>Chưa có sản phẩm trong danh mục này</p>";
            return;
        }

        let html = "";
        products.forEach(product => {
            html += `
                <div class="product-card">
                    <h4>${product.name}</h4>
                    <p class="price">${Number(product.price).toLocaleString()}đ</p>
                    <p class="stock">📦 Còn: ${product.stock} cái</p>
                    <button onclick="addToCart('${product.id}', '${product.name}', ${product.price}, ${product.stock})" 
                        ${product.stock <= 0 ? 'disabled' : ''}>
                        ${product.stock > 0 ? '🛒 Thêm vào giỏ' : '❌ Hết hàng'}
                    </button>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error("Lỗi tải sản phẩm:", error);
        container.innerHTML = "<p style='text-align:center; padding:40px; color:red;'>Lỗi tải sản phẩm!</p>";
    }
}

window.addToCart = (id, name, price, stock) => {
    if (!currentUser) {
        showToast("⚠️ Vui lòng đăng nhập để mua hàng!", true);
        const loginModal = document.getElementById("loginModal");
        if (loginModal) loginModal.style.display = "flex";
        return;
    }

    if (stock <= 0) {
        showToast("❌ Sản phẩm đã hết hàng!", true);
        return;
    }

    if (!cart[id]) {
        cart[id] = { id, name, price, quantity: 1, maxStock: stock };
    } else {
        if (cart[id].quantity + 1 > stock) {
            showToast(`⚠️ Chỉ còn ${stock} sản phẩm trong kho!`, true);
            return;
        }
        cart[id].quantity++;
    }
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartUI();
    showToast(`✅ Đã thêm ${name} vào giỏ hàng!`);
};

function updateCartUI() {
    const cartCount = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
    const cartCountSpan = document.getElementById("cartCount");
    if (cartCountSpan) cartCountSpan.textContent = cartCount;

    const cartItemsDiv = document.getElementById("cartItems");
    if (!cartItemsDiv) return;

    let total = 0;
    let html = "";
    for (const item of Object.values(cart)) {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        html += `
            <div class="cart-item">
                <span><strong>${item.name}</strong></span>
                <div class="cart-item-controls">
                    <button onclick="updateQuantity('${item.id}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateQuantity('${item.id}', 1)">+</button>
                </div>
                <span>${itemTotal.toLocaleString()}đ</span>
                <button onclick="removeFromCart('${item.id}')" style="background:#ef4444;">🗑️</button>
            </div>
        `;
    }

    if (Object.keys(cart).length === 0) {
        html = "<p style='text-align:center; padding:20px;'>🛒 Giỏ hàng trống</p>";
    }
    cartItemsDiv.innerHTML = html;
    const cartTotalEl = document.getElementById("cartTotal");
    if (cartTotalEl) cartTotalEl.textContent = total.toLocaleString();
}

window.updateQuantity = (id, delta) => {
    if (!cart[id]) return;
    const newQty = cart[id].quantity + delta;
    if (newQty <= 0) {
        delete cart[id];
    } else if (newQty > cart[id].maxStock) {
        showToast(`⚠️ Chỉ còn ${cart[id].maxStock} sản phẩm!`, true);
        return;
    } else {
        cart[id].quantity = newQty;
    }
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartUI();
};

window.removeFromCart = (id) => {
    delete cart[id];
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartUI();
    showToast("Đã xóa sản phẩm khỏi giỏ hàng");
};

async function submitOrder(address) {
    if (!currentUser) {
        showToast("⚠️ Vui lòng đăng nhập để đặt hàng!", true);
        const loginModal = document.getElementById("loginModal");
        if (loginModal) loginModal.style.display = "flex";
        return;
    }

    if (Object.keys(cart).length === 0) {
        showToast("🛒 Giỏ hàng trống!", true);
        return;
    }

    try {
        for (const item of Object.values(cart)) {
            const { data: prodData, error } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.id)
                .maybeSingle();

            if (error || !prodData || prodData.stock < item.quantity) {
                showToast(`❌ Sản phẩm ${item.name} không đủ số lượng!`, true);
                return;
            }
        }

        for (const item of Object.values(cart)) {
            const { data: prodData } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.id)
                .maybeSingle();

            if (prodData) {
                const newStock = prodData.stock - item.quantity;
                await supabase
                    .from('products')
                    .update({ stock: newStock })
                    .eq('id', item.id);
            }
        }

        const itemsArray = Object.values(cart).map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
        }));

        const totalPrice = Object.values(cart).reduce((sum, item) => sum + item.price * item.quantity, 0);

        const { error: orderErr } = await supabase
            .from('orders')
            .insert({
                customer_name: currentUser.displayName,
                customer_phone: currentUser.phoneNumber,
                address: address,
                items: itemsArray,
                total_price: totalPrice,
                status: "pending",
                admin_read: false
            });

        if (orderErr) {
            console.error("Lỗi gửi đơn hàng:", orderErr);
            showToast("Lỗi đặt hàng, vui lòng thử lại!", true);
            return;
        }

        cart = {};
        localStorage.setItem("cart", JSON.stringify(cart));
        updateCartUI();
        showToast("🎉 Đặt hàng thành công! Admin sẽ liên hệ bạn.");
        const addressModal = document.getElementById("addressModal");
        if (addressModal) addressModal.style.display = "none";
        loadProducts(currentCategory);
    } catch (err) {
        console.error("Lỗi submitOrder:", err);
    }
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
        showToast("Vui lòng nhập biệt danh!", true);
        return;
    }
    if (!phone) {
        showToast("Vui lòng nhập số điện thoại!", true);
        return;
    }
    if (!phone.match(/^\d{10,11}$/)) {
        showToast("Số điện thoại không hợp lệ (10-11 số)!", true);
        return;
    }
    if (!pwd) {
        showToast("Vui lòng nhập mật khẩu!", true);
        return;
    }
    if (!isStrongPassword(pwd)) {
        showToast("Mật khẩu phải có ít nhất 6 ký tự, gồm chữ và số!", true);
        return;
    }
    if (pwd !== confirmPwd) {
        showToast("Mật khẩu nhập lại không khớp!", true);
        return;
    }

    try {
        const { data: nameSnap } = await supabase
            .from('users')
            .select('*')
            .eq('name', nickname);

        if (nameSnap && nameSnap.length > 0) {
            showToast("Biệt danh này đã có người sử dụng!", true);
            return;
        }

        const { data: phoneSnap } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone);

        if (phoneSnap && phoneSnap.length > 0) {
            showToast("Số điện thoại này đã được đăng ký!", true);
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
            showToast("Đăng ký thất bại, vui lòng thử lại!", true);
            return;
        }

        showToast("Đăng ký thành công! Vui lòng đăng nhập.");
        closeModals();
        const loginModal = document.getElementById("loginModal");
        if (loginModal) loginModal.style.display = "flex";
    } catch (err) {
        console.error("Lỗi register cart:", err);
    }
}

async function login() {
    const loginPhoneEl = document.getElementById("loginPhone");
    const loginPwdEl = document.getElementById("loginPwd");

    const phone = loginPhoneEl ? loginPhoneEl.value.trim() : "";
    const pwd = loginPwdEl ? loginPwdEl.value : "";

    try {
        const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .maybeSingle();

        if (error || !userData) {
            showToast("Đã nhập sai sdt hoặc mật khẩu!", true);
            return;
        }

        if (userData.password !== pwd) {
            showToast("Đã nhập sai sdt hoặc mật khẩu!", true);
            return;
        }

        currentUser = {
            uid: phone,
            displayName: userData.name,
            phoneNumber: phone
        };
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        updateAuthUI();
        closeModals();
        showToast(`Chào mừng ${userData.name}`);
        loadProducts(currentCategory);
    } catch (err) {
        console.error("Lỗi login cart:", err);
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem("currentUser");
    updateAuthUI();
    showToast("Đã đăng xuất");
}

function updateAuthUI() {
    const authButtons = document.getElementById("authButtons");
    const userInfo = document.getElementById("userInfo");
    const userNameDisplay = document.getElementById("userNameDisplay");

    if (currentUser) {
        if (authButtons) authButtons.style.display = "none";
        if (userInfo) userInfo.style.display = "flex";
        if (userNameDisplay) userNameDisplay.textContent = currentUser.displayName;
    } else {
        if (authButtons) authButtons.style.display = "flex";
        if (userInfo) userInfo.style.display = "none";
    }
}

function closeModals() {
    const loginModal = document.getElementById("loginModal");
    const registerModal = document.getElementById("registerModal");
    const cartModal = document.getElementById("cartModal");
    const addressModal = document.getElementById("addressModal");

    if (loginModal) loginModal.style.display = "none";
    if (registerModal) registerModal.style.display = "none";
    if (cartModal) cartModal.style.display = "none";
    if (addressModal) addressModal.style.display = "none";
}

function setupCartEventListeners() {
    const showLoginBtn = document.getElementById("showLoginBtn");
    const showRegisterBtn = document.getElementById("showRegisterBtn");
    const closeLoginModalBtn = document.getElementById("closeLoginModal");
    const closeRegisterModalBtn = document.getElementById("closeRegisterModal");
    const loginSubmitBtn = document.getElementById("loginSubmit");
    const registerSubmitBtn = document.getElementById("registerSubmit");
    const gotoRegisterLink = document.getElementById("gotoRegisterLink");
    const gotoLoginLink = document.getElementById("gotoLoginLink");
    const logoutBtn = document.getElementById("logoutBtn");

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

    const cartBtn = document.getElementById("cartBtn");
    const closeCartBtn = document.getElementById("closeCartBtn");
    const checkoutBtn = document.getElementById("checkoutBtn");
    const submitOrderBtn = document.getElementById("submitOrderBtn");
    const closeAddressBtn = document.getElementById("closeAddressBtn");

    if (cartBtn) {
        cartBtn.onclick = () => {
            updateCartUI();
            const modal = document.getElementById("cartModal");
            if (modal) modal.style.display = "flex";
        };
    }
    if (closeCartBtn) closeCartBtn.onclick = () => {
        const modal = document.getElementById("cartModal");
        if (modal) modal.style.display = "none";
    };
    if (checkoutBtn) {
        checkoutBtn.onclick = () => {
            const cartModal = document.getElementById("cartModal");
            const addressModal = document.getElementById("addressModal");
            if (cartModal) cartModal.style.display = "none";
            if (addressModal) addressModal.style.display = "flex";
        };
    }
    if (submitOrderBtn) {
        submitOrderBtn.onclick = () => {
            const addressInput = document.getElementById("addressInput");
            const address = addressInput ? addressInput.value : "";
            if (!address) {
                showToast("Vui lòng nhập địa chỉ giao hàng!", true);
                return;
            }
            submitOrder(address);
        };
    }
    if (closeAddressBtn) closeAddressBtn.onclick = () => {
        const modal = document.getElementById("addressModal");
        if (modal) modal.style.display = "none";
    };

    document.querySelectorAll(".category-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentCategory = btn.dataset.category;
            loadProducts(currentCategory);
        };
    });

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
}

function initCartApp() {
    setupCartEventListeners();

    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateAuthUI();
        } catch (e) {
            console.error("Lỗi parse cart user:", e);
        }
    }

    loadProducts("shuttlecock");
    updateCartUI();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCartApp);
} else {
    initCartApp();
}