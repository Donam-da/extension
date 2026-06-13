// Chạy sớm nhất có thể ngay khi document_start để kịp ghi đè API

// 0. Tự động chuyển hướng sang trang nhiệm vụ sau khi đăng nhập cryptolinkforearn
if (window.location.hostname === 'cryptolinkforearn.com' && window.location.pathname.startsWith('/dashboard')) {
    window.location.replace('https://cryptolinkforearn.com/links');
}

// 0.5. Tự động điền mật khẩu và đăng nhập cryptolinkforearn
if (window.location.hostname === 'cryptolinkforearn.com' && window.location.pathname === '/login') {
    chrome.storage.local.get(['cryptoEmail', 'cryptoPass'], (data) => {
        if (data.cryptoEmail && data.cryptoPass) {
            const doLogin = () => {
                setTimeout(() => {
                    const emailInput = document.querySelector('input[name="email"], input[type="email"]');
                    const passInput = document.querySelector('input[name="password"], input[type="password"]');
                    if (emailInput && passInput) {
                        emailInput.value = data.cryptoEmail;
                        passInput.value = data.cryptoPass;
                        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                        passInput.dispatchEvent(new Event('input', { bubbles: true }));

                        const btn = document.querySelector('button[type="submit"]');
                        if (btn) btn.click();
                    }
                }, 800); // Đợi 800ms để trang web load xong các mã JS bảo mật
            };
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', doLogin);
            else doLogin();
        }
    });
}

// 1. Ghi nhận tức thời URL (Phòng trường hợp trang web dùng JS Redirect nhảy trang quá nhanh)
if (window.location.hostname.includes('uptolink') && window.location.pathname.length > 1 && window.location.pathname !== '/') {
    chrome.storage.local.set({ lastUptoLink: window.location.href });
}

// 2. Bắt click link nhiệm vụ từ bất kỳ đâu (Tuyệt chiêu phòng chống 302 Redirect không chạy content.js)
document.addEventListener('mousedown', function (e) {
    let target = e.target.closest('a');
    if (target && target.href && target.href.includes('uptolink.vip') && new URL(target.href).pathname.length > 1) {
        chrome.storage.local.set({ lastUptoLink: target.href });
    }
}, true);

// 3. TẠO ICON NỔI (QUICK MENU) TRÊN MỌI TRANG WEB
function injectFloatingMenu() {
    // Tránh việc tạo trùng lặp nút nếu trang web gọi lại
    if (document.getElementById('vip-ext-floating-menu')) return;

    const container = document.createElement('div');
    container.id = 'vip-ext-floating-menu';
    container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; font-family: Consolas, monospace;';

    // Sử dụng Shadow DOM để cách ly CSS, chống bị trang web làm hỏng giao diện
    const shadow = container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        .fab {
            width: 50px; height: 50px; border-radius: 50%;
            background: #0D1117; border: 2px solid #00E5FF; color: #00E5FF;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: bold; cursor: pointer;
            box-shadow: 0 0 10px rgba(0, 229, 255, 0.4);
            transition: all 0.3s ease; user-select: none;
        }
        .fab:hover { background: #00E5FF; color: #000; box-shadow: 0 0 15px rgba(0, 229, 255, 0.8); }
        .panel {
            position: absolute; bottom: 65px; right: 0;
            width: 180px; background: #0D1117; border: 1px solid #30363d;
            border-radius: 8px; padding: 10px; display: none;
            flex-direction: column; gap: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        }
        .panel.show { display: flex; }
        .title { color: #00FF41; font-size: 12px; text-align: center; font-weight: bold; border-bottom: 1px dashed #30363d; padding-bottom: 5px; margin-bottom: 5px; }
        .btn {
            background: #161b22; color: #00E5FF; border: 1px solid #30363d;
            padding: 8px; border-radius: 4px; cursor: pointer;
            font-size: 11px; font-family: Consolas, monospace; font-weight: bold;
            text-transform: uppercase; transition: all 0.2s;
        }
        .btn:hover { border-color: #00E5FF; background: #0D1117; }
        .btn.crypto { color: #B300FF; border-color: #B300FF; }
        .btn.crypto:hover { background: #B300FF; color: #fff; }
        .btn.close { color: #ff5252; border-color: #ff5252; }
        .btn.close:hover { background: #ff5252; color: #000; }
    `;

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
        <div class="title">MENU NHANH VIP</div>
        <button class="btn" id="btn-open-ext">Mở Giao Diện Ext</button>
        <button class="btn crypto" id="btn-change-task">Đổi Nhiệm Vụ</button>
        <button class="btn close" id="btn-hide">Ẩn nút nổi</button>
    `;

    const fab = document.createElement('div');
    fab.className = 'fab';
    fab.textContent = '36'; // Logo hiển thị trong hình tròn
    fab.title = 'Extension VIP Menu';

    fab.addEventListener('click', () => panel.classList.toggle('show'));
    panel.querySelector('#btn-open-ext').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: "OPEN_EXTENSION_UI" });
        panel.classList.remove('show');
    });
    panel.querySelector('#btn-change-task').addEventListener('click', () => {
        chrome.storage.local.get(['lastUptoLink'], (data) => {
            const backUrl = data.lastUptoLink || 'https://uptolink.vip';
            window.location.href = backUrl;
            try {
                const a = document.createElement('a');
                a.href = backUrl;
                document.body.appendChild(a);
                a.click(); // Giả lập Enter mạnh mẽ
            } catch (e) { }
        });
    });
    panel.querySelector('#btn-hide').addEventListener('click', () => container.style.display = 'none');

    shadow.appendChild(style); shadow.appendChild(panel); shadow.appendChild(fab);
    document.body.appendChild(container);
}

// Do content.js chạy ở document_start (chưa có body), ta cần chờ web tải xong khung HTML rồi mới gắn nút
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectFloatingMenu);
else injectFloatingMenu();

chrome.storage.local.get(['lastUptoLink'], (data) => {
    let lastLink = data.lastUptoLink || 'https://uptolink.vip';

    chrome.runtime.sendMessage({ type: "GET_VALIDATED_PROFILE" }, (response) => {
        if (!response || !response.profile) return;

        // Bổ sung lastUptoLink vào profile để truyền sang main_world
        response.profile.lastUptoLink = lastLink;
        const profileStr = JSON.stringify(response.profile).replace(/</g, '\\u003c');

        try {
            const script = document.createElement('script');
            script.id = 'spoof-profile-data';
            script.type = 'application/json';
            script.textContent = profileStr;
            const root = document.head || document.documentElement || document;
            root.appendChild(script);
        } catch (e) { }

        // Truyền object đã parse qua để tránh lỗi undefine trên một số phiên bản Chrome mới
        window.dispatchEvent(new CustomEvent("Bypass_SpoofProfile_Init", { detail: JSON.parse(profileStr) }));
    });
});