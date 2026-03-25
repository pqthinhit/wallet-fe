const API_URL = "https://my-wallet-app-x469.onrender.com/api";
let currentWalletId = null;

const headers = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

const $ = (id) => document.getElementById(id);
const toggle = (id, show) => $(id).classList[show ? 'remove' : 'add']('hidden');

async function api(path, method = 'GET', body = null) {
    const options = { method, headers: headers() };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${API_URL}${path}`, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Lỗi hệ thống");
    return data;
}

async function register() {
    try {
        const email = $('email').value;
        const password = $('password').value;
        await api('/auth/register', 'POST', { email, password });
        toggle('otp-group', true);
        toggle('auth-buttons', false);
        alert("Đã gửi OTP!");
    } catch (e) { alert(e.message); }
}

async function verifyOTP() {
    try {
        const email = $('email').value;
        const otp = $('otp').value;
        if (!otp) return alert("Vui lòng nhập mã OTP");
        await api('/auth/verify', 'POST', { email, otp });
        alert("Xác thực thành công! Hãy đăng nhập.");
        toggle('otp-group', false);
        toggle('auth-buttons', true);
    } catch (e) { alert(e.message); }
}

async function resendOTP() {
    try {
        const data = await api('/auth/resend-otp', 'POST', { email: $('email').value });
        alert(data.message);
    } catch (e) { alert(e.message); }
}

async function login() {
    try {
        const email = $('email').value;
        const password = $('password').value;
        const data = await api('/auth/login', 'POST', { email, password });
        localStorage.setItem('token', data.token);
        showDashboard();
    } catch (e) { alert(e.message); }
}

async function showDashboard() {
    try {
        toggle('auth-section', false);
        toggle('detail-section', false);
        toggle('dashboard-section', true);
        const wallets = await api('/wallets');
        $('wallet-list').innerHTML = wallets.map(w => `
            <div class="wallet-item" onclick="viewWallet('${w._id}', '${w.name}', ${w.balance})">
                <div><strong>${w.name}</strong></div>
                <div style="color:var(--primary)">${w.balance.toLocaleString()}đ</div>
            </div>
        `).join('');
    } catch (e) { alert(e.message); }
}

async function createWallet() {
    try {
        const name = prompt("Nhập tên ví mới:");
        if (!name) return;
        await api('/wallets', 'POST', { name });
        showDashboard();
    } catch (e) { alert(e.message); }
}

function viewWallet(id, name, balance) {
    currentWalletId = id;
    toggle('dashboard-section', false);
    toggle('detail-section', true);
    $('view-wallet-name').innerText = name;
    $('view-balance').innerText = balance.toLocaleString('vi-VN') + 'đ';
    loadHistory();
}

async function addTransaction(type) {
    try {
        const amount = prompt(`Nhập số tiền muốn ${type === 'income' ? 'thu' : 'chi'}:`);
        if (!amount || isNaN(amount)) return;
        const note = prompt("Ghi chú:");
        const data = await api('/wallets/transaction', 'POST', {
            walletId: currentWalletId,
            amount: Number(amount),
            type,
            note
        });
        $('view-balance').innerText = data.newBalance.toLocaleString('vi-VN') + 'đ';
        loadHistory();
    } catch (e) { alert(e.message); }
}

async function loadHistory() {
    try {
        const m = $('filter-month').value || new Date().getMonth() + 1;
        const y = $('filter-year').value || new Date().getFullYear();
        const data = await api(`/wallets/history?walletId=${currentWalletId}&month=${m}&year=${y}`);
        $('history-body').innerHTML = data.map(t => `
            <tr>
                <td>${new Date(t.date).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'})}</td>
                <td>${t.userId.email.split('@')[0]}</td>
                <td title="${t.note}">${t.note || '-'}</td>
                <td class="${t.type}" style="text-align:right">${t.amount.toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (e) { alert(e.message); }
}

async function inviteMember() {
    try {
        const email = prompt("Nhập email thành viên mới:");
        if (!email) return;
        await api(`/wallets/${currentWalletId}/invite`, 'POST', { email });
        alert("Đã thêm thành viên!");
    } catch (e) { alert(e.message); }
}

function showDashboardUI() {
    toggle('detail-section', false);
    showDashboard();
}

(function init() {
    const now = new Date();
    $('filter-month').innerHTML = Array.from({length: 12}, (_, i) => 
        `<option value="${i+1}" ${i === now.getMonth() ? 'selected' : ''}>Tháng ${i+1}</option>`).join('');
    $('filter-year').innerHTML = [now.getFullYear(), now.getFullYear()-1].map(y => 
        `<option value="${y}">${y}</option>`).join('');
    if (localStorage.getItem('token')) showDashboard();
})();

async function deleteCurrentWallet() {
    const isConfirm = confirm("Chắc chắn muốn XÓA VĨNH VIỄN ví này và toàn bộ lịch sử không? Hành động này không thể hoàn tác!");
    
    if (isConfirm) {
        try {
            await api(`/wallets/${currentWalletId}`, 'DELETE');
            alert("Đã xóa ví thành công!");
            showDashboard();
        } catch (e) {
            alert(e.message);
        }
    }
}