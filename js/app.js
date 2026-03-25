const API_URL = "https://my-wallet-app-nka7.onrender.com/api";
let currentWalletId = null;

// --- UTILS ---
const $ = (id) => document.getElementById(id);
const toggle = (id, show) => $(id).classList[show ? 'remove' : 'add']('hidden');

const headers = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// Thông báo nhanh góc màn hình
const toast = (title, icon = 'success') => {
    Swal.fire({
        title, icon, toast: true, position: 'top-end',
        timer: 3000, showConfirmButton: false, timerProgressBar: true
    });
};

// Hiệu ứng loading khi chờ API
const loading = (show = true) => {
    if (show) Swal.showLoading(); else Swal.close();
};

async function api(path, method = 'GET', body = null) {
    const options = { method, headers: headers() };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${API_URL}${path}`, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Lỗi hệ thống");
    return data;
}

// --- AUTH ---
async function register() {
    try {
        const email = $('email').value;
        const password = $('password').value;
        if (!email || !password) return toast("Vui lòng nhập đủ thông tin", "warning");

        Swal.fire({ title: 'Đang gửi mã OTP...', didOpen: () => Swal.showLoading() });
        await api('/auth/register', 'POST', { email, password });

        Swal.fire("Thành công!", "Mã OTP đã được gửi vào email của bạn.", "success");
        toggle('otp-group', true);
        toggle('auth-buttons', false);
    } catch (e) { Swal.fire("Lỗi", e.message, "error"); }
}

async function verifyOTP() {
    try {
        const email = $('email').value;
        const otp = $('otp').value;
        if (!otp) return toast("Nhập mã OTP đi Sếp ơi!", "warning");

        await api('/auth/verify', 'POST', { email, otp });
        await Swal.fire("Xác thực xong!", "Bây giờ Sếp có thể đăng nhập.", "success");

        toggle('otp-group', false);
        toggle('auth-buttons', true);
    } catch (e) { Swal.fire("Lỗi OTP", e.message, "error"); }
}

async function login() {
    try {
        const email = $('email').value;
        const password = $('password').value;

        loading();
        const data = await api('/auth/login', 'POST', { email, password });
        localStorage.setItem('token', data.token);

        toast("Chào mừng Sếp quay trở lại!");
        showDashboard();
    } catch (e) { Swal.fire("Đăng nhập thất bại", e.message, "error"); }
}

// --- WALLET MANAGEMENT ---
async function showDashboard() {
    try {
        toggle('auth-section', false);
        toggle('detail-section', false);
        toggle('dashboard-section', true);

        const wallets = await api('/wallets');
        $('wallet-list').innerHTML = wallets.length ? wallets.map(w => `
            <div class="wallet-item" onclick="viewWallet('${w._id}', '${w.name}', ${w.balance})">
                <div><strong>${w.name}</strong></div>
                <div style="color:var(--primary); font-weight:bold">${w.balance.toLocaleString()}đ</div>
            </div>
        `).join('') : '<p style="text-align:center; opacity:0.6">Chưa có ví nào, tạo ngay thôi Sếp!</p>';
    } catch (e) {
        if (e.message.includes("token")) logout();
        else Swal.fire("Lỗi tải ví", e.message, "error");
    }
}

async function createWallet() {
    const { value: name } = await Swal.fire({
        title: 'Tạo ví mới',
        input: 'text',
        inputPlaceholder: 'Ví dụ: Quỹ ăn chơi, Tiền tiết kiệm...',
        showCancelButton: true,
        confirmButtonText: 'Tạo luôn',
        cancelButtonText: 'Hủy'
    });

    if (name) {
        try {
            await api('/wallets', 'POST', { name });
            showDashboard();
            toast("Đã tạo ví thành công");
        } catch (e) { Swal.fire("Lỗi", e.message, "error"); }
    }
}

function viewWallet(id, name, balance) {
    currentWalletId = id;
    toggle('dashboard-section', false);
    toggle('detail-section', true);
    $('view-wallet-name').innerText = name;
    $('view-balance').innerText = balance.toLocaleString('vi-VN') + 'đ';
    loadHistory();
}

// --- TRANSACTIONS ---
async function addTransaction(type) {
    const isIncome = type === 'income';
    const { value: formValues } = await Swal.fire({
        title: isIncome ? 'Thu nhập' : 'Chi tiêu',
        html:
            `<input id="swal-amount" type="number" class="swal2-input" placeholder="Số tiền">` +
            `<input id="swal-note" class="swal2-input" placeholder="Ghi chú (không bắt buộc)">`,
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => {
            const amount = document.getElementById('swal-amount').value;
            const note = document.getElementById('swal-note').value;
            if (!amount || amount <= 0) return Swal.showValidationMessage('Số tiền phải lớn hơn 0');
            return { amount, note };
        }
    });

    if (formValues) {
        try {
            const data = await api('/wallets/transaction', 'POST', {
                walletId: currentWalletId,
                amount: Number(formValues.amount),
                type,
                note: formValues.note
            });
            $('view-balance').innerText = data.newBalance.toLocaleString('vi-VN') + 'đ';
            loadHistory();
            toast(isIncome ? "+ Tiền về!" : "- Đã tiêu tiền");
        } catch (e) { Swal.fire("Lỗi giao dịch", e.message, "error"); }
    }
}

async function loadHistory() {
    try {
        const m = $('filter-month').value;
        const y = $('filter-year').value;
        const data = await api(`/wallets/history?walletId=${currentWalletId}&month=${m}&year=${y}`);

        $('history-body').innerHTML = data.length ? data.map(t => `
            <tr>
                <td>${new Date(t.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</td>
                <td><small>${t.userId.email.split('@')[0]}</small></td>
                <td title="${t.note}">${t.note || '-'}</td>
                <td class="${t.type}" style="text-align:right; font-weight:500">
                    ${t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                </td>
            </tr>
        `).join('') : '<tr><td colspan="4" style="text-align:center; opacity:0.5">Tháng này chưa có biến động</td></tr>';
    } catch (e) { toast("Lỗi tải lịch sử", "error"); }
}

// --- COLLABORATION & DELETE ---
async function inviteMember() {
    const { value: email } = await Swal.fire({
        title: 'Mời đồng đội',
        input: 'email',
        inputPlaceholder: 'Nhập email người muốn chia sẻ ví...',
        showCancelButton: true,
        confirmButtonText: 'Mời ngay'
    });

    if (email) {
        try {
            await api(`/wallets/${currentWalletId}/invite`, 'POST', { email });
            Swal.fire("Đã gửi!", `Thành viên ${email} đã có thể truy cập ví này.`, "success");
        } catch (e) { Swal.fire("Lỗi mời", e.message, "error"); }
    }
}

async function deleteCurrentWallet() {
    const result = await Swal.fire({
        title: 'Xóa ví này?',
        text: "Mọi dữ liệu chi tiêu sẽ biến mất mãi mãi!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Xóa luôn đi!',
        cancelButtonText: 'Để tôi nghĩ lại'
    });

    if (result.isConfirmed) {
        try {
            await api(`/wallets/${currentWalletId}`, 'DELETE');
            toast("Đã xóa ví");
            showDashboard();
        } catch (e) { Swal.fire("Lỗi", e.message, "error"); }
    }
}

function logout() {
    localStorage.removeItem('token');
    location.reload();
}

// --- INITIALIZE ---
(function init() {
    const now = new Date();
    // Fill tháng/năm tự động
    $('filter-month').innerHTML = Array.from({ length: 12 }, (_, i) =>
        `<option value="${i + 1}" ${i === now.getMonth() ? 'selected' : ''}>Tháng ${i + 1}</option>`).join('');
    $('filter-year').innerHTML = [now.getFullYear(), now.getFullYear() - 1].map(y =>
        `<option value="${y}">${y}</option>`).join('');

    if (localStorage.getItem('token')) showDashboard();
})();