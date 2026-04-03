import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, doc, getDoc, getDocs, updateDoc, addDoc, query, where, setDoc } from "firebase/firestore";

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

let currentUser = null;
let currentCategory = "shuttlecock";
let cart = JSON.parse(localStorage.getItem("cart") || "{}");

function showToast(msg, isError = false) {
    const toast = document.getElementById("toastMsg");
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
    
    try {
        const productsRef = collection(db, "products");
        const q = query(productsRef, where("category", "==", category));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            container.innerHTML = "<p style='text-align:center; padding:40px;'>Chưa có sản phẩm trong danh mục này</p>";
            return;
        }
        
        let html = "";
        snapshot.forEach(docSnap => {
            const product = { id: docSnap.id, ...docSnap.data() };
            html += `
                <div class="product-card">
                    <h4>${product.name}</h4>
                    <p class="price">${product.price.toLocaleString()}đ</p>
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
        document.getElementById("loginModal").style.display = "flex";
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
    document.getElementById("cartTotal").textContent = total.toLocaleString();
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
        document.getElementById("loginModal").style.display = "flex";
        return;
    }
    
    if (Object.keys(cart).length === 0) {
        showToast("🛒 Giỏ hàng trống!", true);
        return;
    }
    
    // Kiểm tra tồn kho lần cuối
    for (const item of Object.values(cart)) {
        const productRef = doc(db, "products", item.id);
        const productSnap = await getDoc(productRef);
        if (!productSnap.exists() || productSnap.data().stock < item.quantity) {
            showToast(`❌ Sản phẩm ${item.name} không đủ số lượng!`, true);
            return;
        }
    }
    
    // Trừ số lượng trong kho
    for (const item of Object.values(cart)) {
        const productRef = doc(db, "products", item.id);
        const productSnap = await getDoc(productRef);
        const newStock = productSnap.data().stock - item.quantity;
        await updateDoc(productRef, { stock: newStock });
    }
    
    // Tạo đơn hàng với trường adminRead = false
    const order = {
        userName: currentUser.displayName,
        userPhone: currentUser.phoneNumber,
        address: address,
        items: Object.values(cart).map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
        })),
        total: Object.values(cart).reduce((sum, item) => sum + item.price * item.quantity, 0),
        createdAt: new Date(),
        status: "pending",
        adminRead: false  // Đánh dấu admin chưa đọc đơn hàng này
    };
    
    await addDoc(collection(db, "orders"), order);
    
    // Xóa giỏ hàng
    cart = {};
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartUI();
    showToast("🎉 Đặt hàng thành công! Admin sẽ liên hệ bạn.");
    document.getElementById("addressModal").style.display = "none";
    loadProducts(currentCategory);
}

// ========== AUTH FUNCTIONS ==========
async function register() {
    const nickname = document.getElementById("regName").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const pwd = document.getElementById("regPwd").value;
    const confirmPwd = document.getElementById("regConfirmPwd").value;
    
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
    
    const usersRef = collection(db, "users");
    
    // Kiểm tra biệt danh đã tồn tại
    const nameQuery = query(usersRef, where("name", "==", nickname));
    const nameSnap = await getDocs(nameQuery);
    if (!nameSnap.empty) {
        showToast("Biệt danh này đã có người sử dụng!", true);
        return;
    }
    
    // Kiểm tra số điện thoại đã tồn tại
    const phoneQuery = query(usersRef, where("phone", "==", phone));
    const phoneSnap = await getDocs(phoneQuery);
    if (!phoneSnap.empty) {
        showToast("Số điện thoại này đã được đăng ký!", true);
        return;
    }
    
    await setDoc(doc(usersRef, phone), {
        name: nickname,
        phone: phone,
        password: pwd,
        createdAt: new Date()
    });
    
    showToast("Đăng ký thành công! Vui lòng đăng nhập.");
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
        showToast("Đã nhập sai sdt hoặc mật khẩu!", true);
        return;
    }
    
    let userData = null;
    snap.forEach(docSnap => { userData = docSnap.data(); });
    
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
    document.getElementById("loginModal").style.display = "none";
    document.getElementById("registerModal").style.display = "none";
    document.getElementById("cartModal").style.display = "none";
    document.getElementById("addressModal").style.display = "none";
}

// ========== KHỞI TẠO ==========
window.onload = () => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateAuthUI();
    }
    
    loadProducts("shuttlecock");
    updateCartUI();
    
    // Nút hiện/ẩn mật khẩu
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
    
    // Sự kiện Enter cho đăng nhập
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
    
    // Sự kiện Enter cho đăng ký
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
    
    // Category tabs
    document.querySelectorAll(".category-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentCategory = btn.dataset.category;
            loadProducts(currentCategory);
        };
    });
    
    // Cart events
    const cartBtn = document.getElementById("cartBtn");
    const closeCartBtn = document.getElementById("closeCartBtn");
    const checkoutBtn = document.getElementById("checkoutBtn");
    const submitOrderBtn = document.getElementById("submitOrderBtn");
    const closeAddressBtn = document.getElementById("closeAddressBtn");
    
    if (cartBtn) {
        cartBtn.onclick = () => {
            updateCartUI();
            document.getElementById("cartModal").style.display = "flex";
        };
    }
    if (closeCartBtn) closeCartBtn.onclick = () => document.getElementById("cartModal").style.display = "none";
    if (checkoutBtn) {
        checkoutBtn.onclick = () => {
            document.getElementById("cartModal").style.display = "none";
            document.getElementById("addressModal").style.display = "flex";
        };
    }
    if (submitOrderBtn) {
        submitOrderBtn.onclick = () => {
            const address = document.getElementById("addressInput").value;
            if (!address) {
                showToast("Vui lòng nhập địa chỉ giao hàng!", true);
                return;
            }
            submitOrder(address);
        };
    }
    if (closeAddressBtn) closeAddressBtn.onclick = () => document.getElementById("addressModal").style.display = "none";
    
    // Auth events
    const showLoginBtn = document.getElementById("showLoginBtn");
    const showRegisterBtn = document.getElementById("showRegisterBtn");
    const closeLoginModal = document.getElementById("closeLoginModal");
    const closeRegisterModal = document.getElementById("closeRegisterModal");
    const loginSubmit = document.getElementById("loginSubmit");
    const registerSubmit = document.getElementById("registerSubmit");
    const gotoRegisterLink = document.getElementById("gotoRegisterLink");
    const gotoLoginLink = document.getElementById("gotoLoginLink");
    const logoutBtn = document.getElementById("logoutBtn");
    
    if (showLoginBtn) showLoginBtn.onclick = () => document.getElementById("loginModal").style.display = "flex";
    if (showRegisterBtn) showRegisterBtn.onclick = () => document.getElementById("registerModal").style.display = "flex";
    if (closeLoginModal) closeLoginModal.onclick = closeModals;
    if (closeRegisterModal) closeRegisterModal.onclick = closeModals;
    if (loginSubmit) loginSubmit.onclick = login;
    if (registerSubmit) registerSubmit.onclick = register;
    if (gotoRegisterLink) {
        gotoRegisterLink.onclick = (e) => { 
            e.preventDefault(); 
            closeModals(); 
            document.getElementById("registerModal").style.display = "flex"; 
        };
    }
    if (gotoLoginLink) {
        gotoLoginLink.onclick = (e) => { 
            e.preventDefault(); 
            closeModals(); 
            document.getElementById("loginModal").style.display = "flex"; 
        };
    }
    if (logoutBtn) logoutBtn.onclick = logout;
};