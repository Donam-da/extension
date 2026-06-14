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
    // Chỉ tạo nút nổi trên cửa sổ duyệt web chính, ngăn không cho tạo bên trong các iframe (như popup của Google)
    if (window !== window.top) return;

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
        .title { display: flex; justify-content: space-between; align-items: center; color: #00FF41; font-size: 12px; font-weight: bold; border-bottom: 1px dashed #30363d; padding-bottom: 5px; margin-bottom: 5px; }
        .top-btn { cursor: pointer; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-family: Consolas, monospace; transition: all 0.2s; color: #8b949e; user-select: none; }
        .top-btn:hover { background: #161b22; color: #c9d1d9; }
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
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }
    `;

    const wrapper = document.createElement('div');
    wrapper.className = 'menu-wrapper';
    wrapper.innerHTML = `
        <div class="panel" id="main-panel">
            <div class="title">
                <span id="btn-refresh" class="top-btn" title="Tải lại trang" style="color: #00E5FF;">F5</span>
                <span id="btn-pin-menu" class="top-btn" title="Ghim menu nổi này">Ghim</span>
            </div>
            <button class="btn crypto" id="btn-change-task">Đổi Nhiệm Vụ</button>
            <button class="btn" id="btn-crypto-link" style="color: #FF9800; border-color: #FF9800;">CRYPTO</button>
            <button class="btn close" id="btn-hide">Ẩn nút nổi</button>
        </div>
    `;

    const fab = document.createElement('div');
    fab.className = 'fab';
    fab.textContent = 'VCL'; // Logo hiển thị trong hình tròn
    fab.title = 'Extension VIP Menu';

    // --- LOGIC DI CHUYỂN NÚT NỔI (DRAGGABLE) ---
    let isDragging = false;
    let hasDragged = false;
    let startX, startY;

    fab.addEventListener('mousedown', dragStart);
    fab.addEventListener('touchstart', dragStart, { passive: false });

    function dragStart(e) {
        if (e.button === 2) return; // Không kéo nếu click chuột phải
        if (e.type === 'touchstart') {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else {
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault(); // Tránh bôi đen text ngầm trên trang khi kéo
        }

        const rect = container.getBoundingClientRect();
        container.style.bottom = 'auto';
        container.style.right = 'auto';
        container.style.left = rect.left + 'px';
        container.style.top = rect.top + 'px';

        isDragging = true;
        hasDragged = false;

        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);
    }

    function adjustMenuPosition() {
        const rect = container.getBoundingClientRect();
        // Tránh bị lẹm trên/dưới (Menu cao tối đa khoảng 250px)
        if (rect.top < 250) {
            wrapper.style.bottom = 'auto';
            wrapper.style.top = '65px'; // Đẩy menu xuống dưới
        } else {
            wrapper.style.top = 'auto';
            wrapper.style.bottom = '65px'; // Đẩy menu lên trên (mặc định)
        }

        // Tránh bị lẹm trái/phải (Menu rộng tối đa 220px)
        if (rect.left < 220) {
            wrapper.style.right = 'auto';
            wrapper.style.left = '0'; // Đẩy menu sang phải
        } else {
            wrapper.style.left = 'auto';
            wrapper.style.right = '0'; // Đẩy menu sang trái (mặc định)
        }
    }

    function drag(e) {
        if (!isDragging) return;
        let clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        let clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        let dx = clientX - startX;
        let dy = clientY - startY;

        // Nếu di chuyển trên 3 pixel thì được tính là đang kéo (tránh nhận nhầm khi click)
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true;

        let newLeft = container.offsetLeft + dx;
        let newTop = container.offsetTop + dy;

        // Giới hạn để icon không bị kéo văng ra ngoài khung màn hình
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - container.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - container.offsetHeight));

        container.style.left = newLeft + 'px';
        container.style.top = newTop + 'px';

        adjustMenuPosition(); // Đảo hướng linh hoạt ngay khi đang kéo

        startX = clientX;
        startY = clientY;
        if (e.type === 'touchmove') e.preventDefault(); // Chống cuộn trang trên điện thoại
    }

    function dragEnd() {
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchend', dragEnd);

        // Lưu vị trí vào Storage để giữ nguyên trên mọi trang web
        chrome.storage.local.set({ menuPosX: container.style.left, menuPosY: container.style.top });
    }

    function checkBounds() {
        if (container.style.left && container.style.left !== 'auto') {
            let currentLeft = parseInt(container.style.left, 10) || 0;
            let currentTop = parseInt(container.style.top, 10) || 0;

            let maxLeft = Math.max(0, window.innerWidth - container.offsetWidth);
            let maxTop = Math.max(0, window.innerHeight - container.offsetHeight);

            let newLeft = Math.min(Math.max(0, currentLeft), maxLeft);
            let newTop = Math.min(Math.max(0, currentTop), maxTop);

            container.style.left = newLeft + 'px';
            container.style.top = newTop + 'px';

            adjustMenuPosition();
        }
    }

    window.addEventListener('resize', checkBounds);

    // Tải lại vị trí đã lưu trước đó (nếu có)
    chrome.storage.local.get(['menuPosX', 'menuPosY'], (data) => {
        if (data.menuPosX && data.menuPosY) {
            container.style.bottom = 'auto';
            container.style.right = 'auto';
            container.style.left = data.menuPosX;
            container.style.top = data.menuPosY;
            setTimeout(() => {
                checkBounds(); // Kéo lại vào màn hình nếu lúc trước lưu ở màn hình to hơn
                adjustMenuPosition(); // Cập nhật hướng mở sau khi load vị trí cũ
            }, 50);
        }
    });

    fab.addEventListener('click', (e) => {
        // Nếu vừa kéo xong thì KHÔNG mở menu (chặn hành vi click)
        if (hasDragged) {
            e.preventDefault();
            return;
        }
        adjustMenuPosition(); // Tính toán lại hướng mở trước khi hiển thị popup
        wrapper.classList.toggle('show');
    });
    // ------------------------------------------

    // Main Panel Events
    const pinBtn = wrapper.querySelector('#btn-pin-menu');

    chrome.storage.local.get(['isMenuPinned'], (data) => {
        if (data.isMenuPinned) {
            wrapper.classList.add('show');
            pinBtn.style.color = '#00FF41';
            setTimeout(adjustMenuPosition, 50);
        }
    });

    pinBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Ngăn sự kiện click truyền ra ngoài
        chrome.storage.local.get(['isMenuPinned'], (data) => {
            const newState = !data.isMenuPinned;
            chrome.storage.local.set({ isMenuPinned: newState }, () => {
                if (newState) {
                    pinBtn.style.color = '#00FF41';
                    pinBtn.title = "Đã ghim (Sẽ tự động mở ở trang mới)";
                } else {
                    pinBtn.style.color = '';
                    pinBtn.title = "Ghim menu nổi này";
                }
            });
        });
    });

    wrapper.querySelector('#btn-refresh').addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.reload();
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

        // Truyền object đã parse qua để tránh lỗi undefine trên một số phiên bản Chrome mới
        window.dispatchEvent(new CustomEvent("Bypass_SpoofProfile_Init", { detail: JSON.parse(profileStr) }));
    });
});