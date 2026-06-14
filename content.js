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
                }, 800);
            };
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', doLogin);
            else doLogin();
        }
    });
}

// 1. Ghi nhận tức thời URL (Phòng trường hợp trang web dùng JS Redirect nhảy trang quá nhanh)
if (window.location.hostname.includes('uptolink') && window.location.pathname.length > 1 && window.location.pathname !== '/' && !window.location.pathname.includes('/finish/')) {
    chrome.storage.local.set({ lastUptoLink: window.location.href });
}

// 2. Bắt click link nhiệm vụ từ bất kỳ đâu
document.addEventListener('mousedown', function (e) {
    let target = e.target.closest('a');
    if (target && target.href && target.href.includes('uptolink.vip') && new URL(target.href).pathname.length > 1 && !new URL(target.href).pathname.includes('/finish/')) {
        chrome.storage.local.set({ lastUptoLink: target.href });
    }
}, true);

// 3. TẠO ICON NỔI (QUICK MENU) TRÊN MỌI TRANG WEB
function injectFloatingMenu() {
    if (window !== window.top) return;
    if (document.getElementById('vip-ext-floating-menu')) return;

    const container = document.createElement('div');
    container.id = 'vip-ext-floating-menu';
    container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; font-family: Consolas, monospace;';

    const shadow = container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        :host {
            --menu-bg: #0D1117;
            --menu-border: #00E5FF;
            --menu-text: #00E5FF;
            --menu-panel-bg: #0D1117;
            --menu-panel-border: #30363d;
            --menu-title-border: #30363d;
            --btn-bg: #161b22;
            --btn-hover-bg: #0D1117;
            --top-btn-hover: #161b22;
            --top-btn-text: #8b949e;
            --top-btn-hover-text: #c9d1d9;
            --scrollbar-thumb: #30363d;
            --crypto-color: #B300FF;
            --close-color: #ff5252;
            --btn-text: #00E5FF;
            --pin-active: #00FF41;
            --fab-shadow: rgba(0, 229, 255, 0.4);
            --fab-shadow-hover: rgba(0, 229, 255, 0.8);
        }
        :host(.light-theme) {
            --menu-bg: #ffffff;
            --menu-border: #0277bd;
            --menu-text: #0277bd;
            --menu-panel-bg: #f5f8fa;
            --menu-panel-border: #b0bec5;
            --menu-title-border: #b0bec5;
            --btn-bg: #ffffff;
            --btn-hover-bg: #e1e2e1;
            --top-btn-hover: #cfd8dc;
            --top-btn-text: #546e7a;
            --top-btn-hover-text: #263238;
            --scrollbar-thumb: #b0bec5;
            --crypto-color: #6a1b9a;
            --close-color: #d32f2f;
            --btn-text: #0277bd;
            --pin-active: #2e7d32;
            --fab-shadow: rgba(2, 119, 189, 0.4);
            --fab-shadow-hover: rgba(2, 119, 189, 0.8);
        }
        .fab {
            width: 25px; height: 25px; border-radius: 50%;
            background: var(--menu-bg); border: 2px solid var(--menu-border); color: var(--menu-text);
            display: flex; align-items: center; justify-content: center;
            font-size: 10px; font-weight: bold; cursor: pointer;
            box-shadow: 0 0 5px var(--fab-shadow);
            transition: all 0.3s ease; user-select: none;
        }
        .fab:hover { background: var(--menu-border); color: #fff; box-shadow: 0 0 8px var(--fab-shadow-hover); }
        .menu-wrapper {
            position: absolute; bottom: 35px; right: 0;
            display: none; flex-direction: column; gap: 4px;
        }
        .menu-wrapper.show { display: flex; }
        .panel {
            width: 100px; background: var(--menu-panel-bg); border: 1px solid var(--menu-panel-border);
            border-radius: 6px; padding: 6px; display: flex;
            flex-direction: column; gap: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }
        .title { display: flex; justify-content: space-between; align-items: center; color: var(--pin-active); font-size: 8px; font-weight: bold; border-bottom: 1px dashed var(--menu-title-border); padding-bottom: 4px; margin-bottom: 4px; }
        .top-btn { cursor: pointer; padding: 2px 4px; border-radius: 3px; font-size: 8px; font-family: Consolas, monospace; transition: all 0.2s; color: var(--top-btn-text); user-select: none; }
        .top-btn:hover { background: var(--top-btn-hover); color: var(--top-btn-hover-text); }
        .btn {
            background: var(--btn-bg); color: var(--btn-text); border: 1px solid var(--menu-panel-border);
            padding: 5px; border-radius: 3px; cursor: pointer;
            font-size: 8px; font-family: Consolas, monospace; font-weight: bold;
            text-transform: uppercase; transition: all 0.2s;
        }
        .btn:hover { border-color: var(--btn-text); background: var(--btn-hover-bg); }
        .btn.crypto { color: var(--crypto-color); border-color: var(--crypto-color); }
        .btn.crypto:hover { background: var(--crypto-color); color: #fff; }
        .btn.close { color: var(--close-color); border-color: var(--close-color); }
        .btn.close:hover { background: var(--close-color); color: #fff; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 2px; }
    `;

    const wrapper = document.createElement('div');
    wrapper.className = 'menu-wrapper';
    wrapper.innerHTML = `
        <div class="panel" id="main-panel">
            <div class="title">
                <span id="btn-refresh" class="top-btn" title="Tải lại trang" style="color: var(--btn-text);">REFRESH</span>
                <span id="btn-pin-menu" class="top-btn" title="Ghim menu nổi này">Ghim</span>
            </div>
            <button class="btn crypto" id="btn-change-task">Đổi Nhiệm Vụ</button>
            <button class="btn" id="btn-crypto-link" style="color: #FF9800; border-color: #FF9800;">CRYPTO</button>
            <button class="btn close" id="btn-hide">Ẩn nút nổi</button>
        </div>
    `;

    const fab = document.createElement('div');
    fab.className = 'fab';
    fab.textContent = 'VCL';
    fab.title = 'Extension VIP Menu';

    let isDragging = false;
    let hasDragged = false;
    let startX, startY;

    fab.addEventListener('mousedown', dragStart);
    fab.addEventListener('touchstart', dragStart, { passive: false });

    function dragStart(e) {
        if (e.button === 2) return;
        if (e.type === 'touchstart') {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else {
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault();
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
        if (rect.top < 150) {
            wrapper.style.bottom = 'auto';
            wrapper.style.top = '35px';
        } else {
            wrapper.style.top = 'auto';
            wrapper.style.bottom = '35px';
        }

        if (rect.left < 120) {
            wrapper.style.right = 'auto';
            wrapper.style.left = '0';
        } else {
            wrapper.style.left = 'auto';
            wrapper.style.right = '0';
        }
    }

    function drag(e) {
        if (!isDragging) return;
        let clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        let clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        let dx = clientX - startX;
        let dy = clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true;

        let newLeft = container.offsetLeft + dx;
        let newTop = container.offsetTop + dy;

        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - container.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - container.offsetHeight));

        container.style.left = newLeft + 'px';
        container.style.top = newTop + 'px';

        adjustMenuPosition();

        startX = clientX;
        startY = clientY;
        if (e.type === 'touchmove') e.preventDefault();
    }

    function dragEnd() {
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchend', dragEnd);

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

    chrome.storage.local.get(['menuPosX', 'menuPosY'], (data) => {
        if (data.menuPosX && data.menuPosY) {
            container.style.bottom = 'auto';
            container.style.right = 'auto';
            container.style.left = data.menuPosX;
            container.style.top = data.menuPosY;
            setTimeout(() => {
                checkBounds();
                adjustMenuPosition();
            }, 50);
        }
    });

    const pinBtn = wrapper.querySelector('#btn-pin-menu');

    fab.addEventListener('click', (e) => {
        if (hasDragged) {
            e.preventDefault();
            return;
        }
        adjustMenuPosition();
        if (wrapper.classList.contains('show')) {
            wrapper.classList.remove('show');
            chrome.storage.local.get(['isMenuPinned'], (data) => {
                if (data.isMenuPinned) {
                    chrome.storage.local.set({ isMenuPinned: false }, () => {
                        pinBtn.style.color = '';
                        pinBtn.title = "Ghim menu nổi này";
                    });
                }
            });
        } else {
            wrapper.classList.add('show');
        }
    });

    chrome.storage.local.get(['isMenuPinned'], (data) => {
        if (data.isMenuPinned) {
            wrapper.classList.add('show');
            pinBtn.style.color = 'var(--pin-active)';
            setTimeout(adjustMenuPosition, 50);
        }
    });

    chrome.storage.local.get(['lightTheme'], (data) => {
        if (data.lightTheme) container.classList.add('light-theme');
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "TOGGLE_THEME") {
            if (message.isLight) container.classList.add('light-theme');
            else container.classList.remove('light-theme');
        }
    });

    pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.storage.local.get(['isMenuPinned'], (data) => {
            const newState = !data.isMenuPinned;
            chrome.storage.local.set({ isMenuPinned: newState }, () => {
                if (newState) {
                    pinBtn.style.color = 'var(--pin-active)';
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
            let backUrl = data.lastUptoLink || 'https://uptolink.vip';
            if (backUrl.includes('/finish/')) {
                backUrl = 'https://uptolink.vip';
            }
            window.location.href = backUrl;
            try {
                const a = document.createElement('a');
                a.href = backUrl;
                document.body.appendChild(a);
                a.click();
            } catch (e) { }
        });
    });

    wrapper.querySelector('#btn-crypto-link').addEventListener('click', () => {
        window.location.href = 'https://cryptolinkforearn.com/links';
    });

    wrapper.querySelector('#btn-hide').addEventListener('click', () => container.style.display = 'none');

    shadow.appendChild(style); shadow.appendChild(wrapper); shadow.appendChild(fab);
    document.body.appendChild(container);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectFloatingMenu);
else injectFloatingMenu();

chrome.storage.local.get(['lastUptoLink'], (data) => {
    let lastLink = data.lastUptoLink || 'https://uptolink.vip';
    if (lastLink.includes('/finish/')) {
        lastLink = 'https://uptolink.vip';
    }

    chrome.runtime.sendMessage({ type: "GET_VALIDATED_PROFILE" }, (response) => {
        if (!response || !response.profile) return;

        // Bổ sung lastUptoLink vào profile để truyền sang main_world phục vụ Smart Back
        response.profile.lastUptoLink = lastLink;
        const profileStr = JSON.stringify(response.profile).replace(/</g, '\\u003c');

        window.dispatchEvent(new CustomEvent("Bypass_SpoofProfile_Init", { detail: JSON.parse(profileStr) }));
    });
});