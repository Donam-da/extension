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

// 2.5. Auto Google Logic (Tự động điền Text và Enter trên Google)
if (window.location.hostname.includes('google.') && window.location.pathname === '/') {
    chrome.storage.local.get(['autoGoogleText'], (data) => {
        if (data.autoGoogleText) {
            const doGoogleSearch = () => {
                const searchBox = document.querySelector('textarea[name="q"], input[name="q"]');
                if (searchBox) {
                    searchBox.value = data.autoGoogleText;
                    searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                    const form = searchBox.closest('form');
                    setTimeout(() => {
                        if (form) form.submit();
                        else searchBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                    }, 100); // Đợi 100ms để mô phỏng người thật thao tác
                    chrome.storage.local.remove('autoGoogleText'); // Xóa lệnh sau khi chạy xong để không bị lặp
                } else setTimeout(doGoogleSearch, 100);
            };
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', doGoogleSearch);
            else doGoogleSearch();
        }
    });
}

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
        .menu-wrapper {
            position: absolute; bottom: 65px; right: 0;
            display: none; flex-direction: column; gap: 8px;
        }
        .menu-wrapper.show { display: flex; }
        .panel {
            width: 180px; background: #0D1117; border: 1px solid #30363d;
            border-radius: 8px; padding: 10px; display: flex;
            flex-direction: column; gap: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        }
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
        
        /* Auto Google Styles */
        .ag-item {
            display: flex; justify-content: space-between; align-items: center;
            background: #161b22; border: 1px solid #30363d; border-radius: 4px; padding: 6px;
            cursor: pointer; font-size: 11px; color: #c9d1d9; transition: border 0.2s;
        }
        .ag-item:hover { border-color: #00E5FF; }
        .ag-item.selected { border-color: #4285F4; color: #4285F4; background: #0d1117; font-weight: bold; }
        .ag-btn-del { color: #ff5252; cursor: pointer; font-weight: bold; padding: 0 4px; }
        .ag-btn-del:hover { background: #ff5252; color: #fff; border-radius: 2px; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }
    `;

    const wrapper = document.createElement('div');
    wrapper.className = 'menu-wrapper';
    wrapper.innerHTML = `
        <div class="panel" id="main-panel">
            <div class="title">MENU NỔI<span id="btn-pin-menu" title="Ghim menu nổi này" style="cursor: pointer; padding: 0 4px; font-size: 13px; transition: 0.3s;">📌</span></div>
            <button class="btn crypto" id="btn-change-task">Đổi Nhiệm Vụ</button>
            <button class="btn" id="btn-crypto-link" style="color: #FF9800; border-color: #FF9800;">CRYPTO</button>
            <button class="btn" id="btn-open-ag" style="color: #4285F4; border-color: #4285F4;">AuTo Google</button>
            <button class="btn close" id="btn-hide">Ẩn nút nổi</button>
        </div>

        <div class="panel" id="ag-panel" style="display: none; width: 220px;">
            <div class="title" style="color: #4285F4;">AUTO GOOGLE <span id="btn-back-main" title="Quay lại" style="cursor: pointer; padding: 0 4px; font-size: 13px; float: right; margin-top: -2px;">🔙</span></div>
            <div id="ag-list" style="max-height: 140px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; margin-bottom: 5px;"></div>
            <div style="display: flex; gap: 4px; margin-bottom: 5px;">
                <input type="text" id="ag-input" placeholder="Nhập text mới..." style="flex: 1; background: #0D1117; color: #00E5FF; border: 1px solid #30363d; border-radius: 4px; font-size: 11px; padding: 6px; outline: none;">
                <button id="ag-add" style="background: #161b22; color: #00FF41; border: 1px solid #30363d; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; padding: 0 8px;">Thêm</button>
            </div>
            <button class="btn" id="ag-fill" style="background: #4285F4; color: #fff; border-color: #4285F4; font-size: 12px;">&gt; ĐIỀN VÀO GOOGLE &lt;</button>
        </div>
    `;

    const fab = document.createElement('div');
    fab.className = 'fab';
    fab.textContent = '36'; // Logo hiển thị trong hình tròn
    fab.title = 'Extension VIP Menu';

    fab.addEventListener('click', () => wrapper.classList.toggle('show'));

    // Main Panel Events
    const pinBtn = wrapper.querySelector('#btn-pin-menu');

    chrome.storage.local.get(['isMenuPinned'], (data) => {
        if (data.isMenuPinned) {
            wrapper.classList.add('show');
            pinBtn.style.filter = 'drop-shadow(0 0 3px #00FF41)';
        }
    });

    pinBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Ngăn sự kiện click truyền ra ngoài
        chrome.storage.local.get(['isMenuPinned'], (data) => {
            const newState = !data.isMenuPinned;
            chrome.storage.local.set({ isMenuPinned: newState }, () => {
                if (newState) {
                    pinBtn.style.filter = 'drop-shadow(0 0 3px #00FF41)';
                    pinBtn.title = "Đã ghim (Sẽ tự động mở ở trang mới)";
                } else {
                    pinBtn.style.filter = 'none';
                    pinBtn.title = "Ghim menu nổi này";
                }
            });
        });
    });

    wrapper.querySelector('#btn-change-task').addEventListener('click', () => {
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

    wrapper.querySelector('#btn-crypto-link').addEventListener('click', () => {
        window.location.href = 'https://cryptolinkforearn.com/links';
    });

    wrapper.querySelector('#btn-hide').addEventListener('click', () => container.style.display = 'none');

    // Switching Panels
    const mainPanel = wrapper.querySelector('#main-panel');
    const agPanel = wrapper.querySelector('#ag-panel');

    wrapper.querySelector('#btn-open-ag').addEventListener('click', () => {
        mainPanel.style.display = 'none';
        agPanel.style.display = 'flex';
        loadAgList();
    });
    wrapper.querySelector('#btn-back-main').addEventListener('click', () => {
        agPanel.style.display = 'none';
        mainPanel.style.display = 'flex';
    });

    // Auto Google Logic
    let agTexts = [];
    let agSelectedIdx = -1;
    const listEl = wrapper.querySelector('#ag-list');
    const inputEl = wrapper.querySelector('#ag-input');

    const renderAgList = () => {
        listEl.innerHTML = '';
        agTexts.forEach((text, idx) => {
            const item = document.createElement('div');
            item.className = 'ag-item' + (idx === agSelectedIdx ? ' selected' : '');

            const textSpan = document.createElement('span');
            textSpan.textContent = text;
            textSpan.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px;';

            const delBtn = document.createElement('span');
            delBtn.textContent = 'X';
            delBtn.className = 'ag-btn-del';
            delBtn.title = 'Xóa';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                agTexts.splice(idx, 1);
                if (agSelectedIdx === idx) agSelectedIdx = -1;
                else if (agSelectedIdx > idx) agSelectedIdx--;
                chrome.storage.local.set({ autoGoogleList: agTexts });
                renderAgList();
            };

            item.onclick = () => {
                agSelectedIdx = idx;
                renderAgList();
            };

            item.appendChild(textSpan);
            item.appendChild(delBtn);
            listEl.appendChild(item);
        });
    };

    const loadAgList = () => {
        chrome.storage.local.get(['autoGoogleList'], (data) => {
            if (data.autoGoogleList) agTexts = data.autoGoogleList;
            renderAgList();
        });
    };

    wrapper.querySelector('#ag-add').addEventListener('click', () => {
        const val = inputEl.value.trim();
        if (val) {
            agTexts.push(val);
            chrome.storage.local.set({ autoGoogleList: agTexts });
            inputEl.value = '';
            agSelectedIdx = agTexts.length - 1; // Auto select newly added
            renderAgList();
        }
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') wrapper.querySelector('#ag-add').click();
    });

    wrapper.querySelector('#ag-fill').addEventListener('click', () => {
        if (agSelectedIdx >= 0 && agSelectedIdx < agTexts.length) {
            const text = agTexts[agSelectedIdx];
            chrome.storage.local.set({ autoGoogleText: text }, () => {
                window.open('https://www.google.com/', '_blank');
            });
        } else {
            alert('Vui lòng chọn 1 dòng text trước khi Điền!');
        }
    });

    shadow.appendChild(style); shadow.appendChild(wrapper); shadow.appendChild(fab);
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