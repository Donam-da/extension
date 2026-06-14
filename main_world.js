window.addEventListener("Bypass_SpoofProfile_Init", function (e) {
    let profile = e.detail;
    if (typeof profile === 'string') {
        try { profile = JSON.parse(profile); } catch (err) { }
    }
    if (!profile) return;

    // --- HỆ THỐNG RADAR BẮT LỖI CLOUDFLARE TRỰC TIẾP TRÊN MÀN HÌNH ---
    function showDebugError(msg, source, lineno, colno, error) {
        let errStr = (msg + " " + source + " " + (error ? error.stack : '')).toLowerCase();
        if (!errStr.includes('cloudflare') && !errStr.includes('turnstile') && !errStr.includes('challenge')) return;

        const logError = () => {
            let errBox = document.getElementById('vcl-cf-debug');
            if (!errBox) {
                errBox = document.createElement('div');
                errBox.id = 'vcl-cf-debug';
                errBox.style.cssText = 'position: fixed; top: 10px; left: 10px; z-index: 2147483647; background: rgba(13, 17, 23, 0.95); color: #ff5252; border: 2px solid #ff5252; padding: 15px; border-radius: 8px; font-family: Consolas, monospace; font-size: 11px; max-width: 90vw; max-height: 50vh; overflow-y: auto; box-shadow: 0 0 20px rgba(255, 82, 82, 0.5); pointer-events: none;';
                document.body.appendChild(errBox);
            }

            const errDiv = document.createElement('div');
            errDiv.style.borderBottom = "1px dashed #30363d";
            errDiv.style.marginBottom = "8px";
            errDiv.style.paddingBottom = "8px";
            errDiv.innerHTML = `<strong style="color:#FF9800; font-size: 13px;">[PHÁT HIỆN LỖI CLOUDFLARE]</strong><br>
                                <b style="color: #c9d1d9;">Lỗi:</b> ${msg}<br>
                                <b style="color: #c9d1d9;">Nguồn:</b> ${source}:${lineno}:${colno}<br>
                                <b style="color: #c9d1d9;">Dấu vết:</b> <span style="color:#8b949e;">${error && error.stack ? error.stack.replace(/\n/g, '<br>') : 'Không có'}</span>`;
            errBox.appendChild(errDiv);
        };

        if (document.body) logError();
        else document.addEventListener('DOMContentLoaded', logError);
    }

    window.addEventListener('error', function (e) {
        showDebugError(e.message, e.filename, e.lineno, e.colno, e.error);
    }, true);

    window.addEventListener('unhandledrejection', function (e) {
        if (e.reason) showDebugError(e.reason.message || "Promise Rejection", e.reason.stack || "", 0, 0, e.reason);
    }, true);

    // KỸ THUẬT VƯỢT MẶT TOSTRING() TOÀN CẦU (Không dùng Proxy để tránh bị phát hiện)
    // SỬ DỤNG WEAKMAP TOÀN CỤC: Chia sẻ chung giữa cửa sổ chính và mọi Iframe con
    const globalFnMap = new WeakMap();

    const maskFunction = (fakeFn, originalFn) => {
        globalFnMap.set(fakeFn, originalFn);
        if (originalFn && originalFn.name) {
            try { Object.defineProperty(fakeFn, 'name', { value: originalFn.name, configurable: true }); } catch (e) { }
        }
        return fakeFn;
    };

    const defineMaskedGetter = (obj, prop, value, expectedClassName) => {
        try {
            const originalDesc = Object.getOwnPropertyDescriptor(obj, prop);
            const fakeGetter = function () {
                if (expectedClassName) {
                    // Sử dụng Object.prototype.toString để kiểm tra chính xác class xuyên Iframe (Cross-realm), giống hệt hành vi native C++
                    if (Object.prototype.toString.call(this) !== `[object ${expectedClassName}]`) throw new TypeError("Illegal invocation");
                }
                return value;
            };
            if (originalDesc && originalDesc.get) {
                globalFnMap.set(fakeGetter, originalDesc.get);
            } else {
                globalFnMap.set(fakeGetter, function () { return "function get " + prop + "() { [native code] }"; });
            }
            Object.defineProperty(obj, prop, { get: fakeGetter, set: undefined, configurable: true, enumerable: true });
        } catch (e) { }
    };

    const spoofedWindows = new WeakSet();

    // Gói toàn bộ logic Spoofing vào một hàm để áp dụng cho cả Window chính lẫn các Iframe con
    function applySpoofing(targetWin) {
        if (!targetWin) return;
        try {
            // Kiểm tra an toàn Iframe chéo tên miền bằng cách đọc thử location.href
            // Tránh bẫy CORS, nếu Iframe của Cloudflare bị chạm vào sẽ tự động bỏ qua để không phá vỡ luồng
            try { let testHref = targetWin.location.href; } catch (err) { return; }

            // Dùng WeakSet để lưu lịch sử thay vì gắn biến trực tiếp vào window, tránh bị Cloudflare quét phát hiện
            if (spoofedWindows.has(targetWin)) return;
            spoofedWindows.add(targetWin);

            // 0. BẢO VỆ HÀM TOSTRING() ĐỘC LẬP TRÊN TỪNG IFRAME (Tuyệt chiêu tàng hình đa lớp)
            if (targetWin.Function && targetWin.Function.prototype && targetWin.Function.prototype.toString) {
                const origToString = targetWin.Function.prototype.toString;
                // Đảm bảo không bọc lại 2 lần gây lỗi đệ quy
                if (!globalFnMap.has(origToString)) {
                    const fakeToString = function toString() {
                        if (globalFnMap.has(this)) return origToString.call(globalFnMap.get(this));
                        if (this === targetWin.Function.prototype.toString) return origToString.call(origToString);
                        return origToString.call(this);
                    };
                    targetWin.Function.prototype.toString = fakeToString;
                    globalFnMap.set(fakeToString, origToString);
                    globalFnMap.set(origToString, origToString);
                }
            }

            // 1. Fake Navigator
            defineMaskedGetter(targetWin.Navigator.prototype, 'userAgent', profile.ua, "Navigator");
            defineMaskedGetter(targetWin.Navigator.prototype, 'platform', profile.platform, "Navigator");
            defineMaskedGetter(targetWin.Navigator.prototype, 'hardwareConcurrency', profile.hardwareConcurrency, "Navigator");
            defineMaskedGetter(targetWin.Navigator.prototype, 'deviceMemory', profile.deviceMemory, "Navigator");
            defineMaskedGetter(targetWin.Navigator.prototype, 'vendor', profile.navigatorVendor || "Google Inc.", "Navigator");
            defineMaskedGetter(targetWin.Navigator.prototype, 'webdriver', false, "Navigator");
            defineMaskedGetter(targetWin.Navigator.prototype, 'appVersion', profile.ua.replace(/^Mozilla\//, ''), "Navigator");

            // 1.5. Fake Touch Support
            if (profile.ua.includes("Mobile") || profile.ua.includes("Android")) {
                defineMaskedGetter(targetWin.Navigator.prototype, 'maxTouchPoints', 5, "Navigator");
                if (!('ontouchstart' in targetWin)) {
                    targetWin.ontouchstart = null;
                    try { Object.defineProperty(targetWin, 'ontouchstart', { value: null, writable: true, configurable: true, enumerable: true }); } catch (e) { }
                }
                // Đã gỡ bỏ fake plugins/mimeTypes vì Kiwi Browser vốn đã tự làm trống array một cách chuẩn chỉ. Can thiệp thêm sẽ dễ bị lộ.
            }

            // 3. Deep Fake WebGL
            if (targetWin.WebGLRenderingContext) {
                const originalGetParameter = targetWin.WebGLRenderingContext.prototype.getParameter;
                targetWin.WebGLRenderingContext.prototype.getParameter = maskFunction(function (param) {
                    if (param === 37445) return profile.webglVendor;
                    if (param === 37446) return profile.webglRenderer;
                    return originalGetParameter.call(this, param);
                }, originalGetParameter);
            }
            if (targetWin.WebGL2RenderingContext) {
                const originalGetParameter2 = targetWin.WebGL2RenderingContext.prototype.getParameter;
                targetWin.WebGL2RenderingContext.prototype.getParameter = maskFunction(function (param) {
                    if (param === 37445) return profile.webglVendor;
                    if (param === 37446) return profile.webglRenderer;
                    return originalGetParameter2.call(this, param);
                }, originalGetParameter2);
            }

            // 6. Fake window.chrome
            // TẨY SẠCH DẤU VẾT KIWI BROWSER: Chrome Mobile thật KHÔNG BAO GIỜ có các API Extension
            // Cloudflare phát hiện Kiwi giả danh Chrome vì sự tồn tại của chrome.runtime!
            if (profile.ua.includes("Mobile") || profile.ua.includes("Android")) {
                if (targetWin.chrome) {
                    const extApis = ['runtime', 'extension', 'app', 'webstore', 'management'];
                    extApis.forEach(api => {
                        try { delete targetWin.chrome[api]; } catch (e) { }
                        try { Object.defineProperty(targetWin.chrome, api, { value: undefined, configurable: true }); } catch (e) { }
                    });
                }
            }

            // 7. Client Hints (userAgentData)
            if (targetWin.navigator && targetWin.navigator.userAgentData) {
                // Đồng bộ mảng Brands với User-Agent để qua mặt Turnstile
                let brandName = "Google Chrome";
                let brandVer = profile.chromeMajor;

                if (profile.ua.includes("EdgA") || profile.ua.includes("Edg/")) {
                    brandName = "Microsoft Edge";
                } else if (profile.ua.includes("OPR/")) {
                    brandName = "Opera";
                } else if (profile.ua.includes("SamsungBrowser")) {
                    brandName = "Samsung Internet";
                    const ssMatch = profile.ua.match(/SamsungBrowser\/(\d+)/);
                    if (ssMatch) brandVer = ssMatch[1];
                }

                let fakeBrands = [
                    { brand: "Not/A)Brand", version: "8" },
                    { brand: "Chromium", version: profile.chromeMajor },
                    { brand: brandName, version: brandVer }
                ];
                let fakePlatform = profile.platform.includes("Win") ? "Windows" : profile.platform;
                if (profile.platform.includes("Linux") && profile.ua.includes("Android")) fakePlatform = "Android";
                if (profile.platform.includes("Mac")) fakePlatform = "macOS";

                let fakeModel = "";
                let fakePlatformVersion = "13.0.0";
                const modelMatch = profile.ua.match(/\(Linux; Android \d+(?:\.\d+)*; ([^)]+)\)/);
                if (modelMatch) fakeModel = modelMatch[1];
                const verMatch = profile.ua.match(/Android (\d+(?:\.\d+)*)/);
                if (verMatch) fakePlatformVersion = verMatch[1] + ".0.0";

                const uaDataProto = Object.getPrototypeOf(targetWin.navigator.userAgentData);
                defineMaskedGetter(uaDataProto, 'brands', fakeBrands, "NavigatorUAData");
                defineMaskedGetter(uaDataProto, 'mobile', profile.ua.includes("Mobile"), "NavigatorUAData");
                defineMaskedGetter(uaDataProto, 'platform', fakePlatform, "NavigatorUAData");

                const originalGetHighEntropyValues = uaDataProto.getHighEntropyValues;
                uaDataProto.getHighEntropyValues = maskFunction(function (hints) {
                    return originalGetHighEntropyValues.call(this, hints).then(values => {
                        let fakeValues = { ...values };
                        if (hints.includes("brands")) fakeValues.brands = fakeBrands;
                        if (hints.includes("fullVersionList")) fakeValues.fullVersionList = fakeBrands;
                        if (hints.includes("platform")) fakeValues.platform = fakePlatform;
                        if (hints.includes("mobile")) fakeValues.mobile = profile.ua.includes("Mobile");
                        if (hints.includes("model")) fakeValues.model = fakeModel;
                        if (hints.includes("platformVersion")) fakeValues.platformVersion = fakePlatformVersion;
                        if (hints.includes("architecture")) fakeValues.architecture = profile.platform.includes("Win") ? "x86" : "arm";
                        if (hints.includes("bitness")) fakeValues.bitness = "64";
                        return fakeValues;
                    });
                }, originalGetHighEntropyValues);
            }

            // 9.5. Chặn rò rỉ IP qua WebRTC (Xóa STUN/TURN Servers)
            const spoofRTC = (RTClass) => {
                if (!RTClass) return;
                const originalRTC = RTClass;
                const fakeRTC = maskFunction(function (config) {
                    let safeConfig = {};
                    if (config) {
                        try { safeConfig = JSON.parse(JSON.stringify(config)); }
                        catch (e) { safeConfig = { ...config }; }
                    }
                    safeConfig.iceServers = []; // Xóa sạch máy chủ STUN/TURN
                    safeConfig.iceTransportPolicy = 'relay'; // Ép dùng TURN (nếu không có sẽ chặn hoàn toàn quá trình lấy IP)

                    const pc = new originalRTC(safeConfig);
                    if (pc.setConfiguration) {
                        const origSet = pc.setConfiguration;
                        pc.setConfiguration = maskFunction(function (cfg) {
                            let safeCfg = cfg ? { ...cfg } : {};
                            safeCfg.iceServers = [];
                            safeCfg.iceTransportPolicy = 'relay';
                            return origSet.call(this, safeCfg);
                        }, origSet);
                    }
                    return pc;
                }, originalRTC);
                fakeRTC.prototype = originalRTC.prototype;
                // Đảm bảo prototype constructor khớp với function ảo để tránh bị Turnstile bắt lỗi
                try { Object.defineProperty(fakeRTC.prototype, 'constructor', { value: fakeRTC, configurable: true, writable: true }); } catch (e) { }
                return fakeRTC;
            };
            if (targetWin.RTCPeerConnection) targetWin.RTCPeerConnection = spoofRTC(targetWin.RTCPeerConnection);
            if (targetWin.webkitRTCPeerConnection) targetWin.webkitRTCPeerConnection = spoofRTC(targetWin.webkitRTCPeerConnection);

            // 9.6. Chặn Service Worker (Tránh bị soi cấu hình ngầm)
            if (targetWin.navigator && targetWin.navigator.serviceWorker) {
                const origRegister = targetWin.navigator.serviceWorker.register;
                targetWin.navigator.serviceWorker.register = maskFunction(function () {
                    return Promise.reject(new Error("Service Worker is disabled for privacy"));
                }, origRegister);
            }

            // 10. Smart Back (Giữ lại tính năng của Admin)
            try {
                const hostname = targetWin.location.hostname;
                const href = targetWin.location.href;
                if (targetWin === targetWin.top && (hostname.includes('online') || hostname.includes('uptolink') || hostname.includes('linkhuongdan') || href.includes('/online/'))) {
                    const backUrl = profile.lastUptoLink || 'https://uptolink.vip';

                    // Tuyệt chiêu: Giả lập "Điền link và ấn Enter" như người dùng thật
                    const forceGoBack = () => {
                        targetWin.location.href = backUrl; // Điền URL
                        try {
                            const a = targetWin.document.createElement('a'); // Tạo link ẩn
                            a.href = backUrl;
                            targetWin.document.body.appendChild(a);
                            a.click(); // Tự động click (Enter)
                        } catch (e) { }
                    };

                    // Ghi đè history.back và history.go để phòng trường hợp nút bấm dùng JS lùi trang
                    try {
                        const origBack = targetWin.History.prototype.back;
                        targetWin.History.prototype.back = maskFunction(function () { forceGoBack(); }, origBack);

                        const origGo = targetWin.History.prototype.go;
                        targetWin.History.prototype.go = maskFunction(function (delta) {
                            if (delta === -1) { forceGoBack(); }
                            else { return origGo.call(this, delta); }
                        }, origGo);
                    } catch (e) { }

                    // Bẫy nút Back của trình duyệt bằng cách đẩy 1 state giả
                    if (!targetWin.history.state || targetWin.history.state.page !== 'hacked_back_button') {
                        targetWin.history.pushState({ page: 'hacked_back_button' }, "", href);
                    }
                    targetWin.addEventListener('popstate', function (event) { forceGoBack(); });
                    targetWin.onpopstate = function () { forceGoBack(); }; // Ghi đè thêm đề phòng website xóa sự kiện

                    // Vô hiệu hoá pushState của trang web để chống History Trap (Trang web cố tình giam người dùng bằng cách spam pushState)
                    try {
                        const origPushState = targetWin.History.prototype.pushState;
                        targetWin.History.prototype.pushState = maskFunction(function () { return null; }, origPushState);
                        const origReplaceState = targetWin.History.prototype.replaceState;
                        targetWin.History.prototype.replaceState = maskFunction(function () { return null; }, origReplaceState);
                    } catch (e) { }
                    targetWin.document.addEventListener('mousedown', function (e) {
                        let target = e.target.closest('a, button, [onclick], [class*="btn"], [class*="button"], [class*="back"]');
                        if (target) {
                            let text = (target.innerText || target.textContent || '').toLowerCase().trim();
                            let onclickAttr = target.getAttribute('onclick') || '';
                            let hrefAttr = target.href || '';
                            let className = (target.getAttribute('class') || '').toLowerCase();

                            if ((text.length < 50 && (text.includes('return') || text.includes('quay lại') || text.includes('trở về') || text.includes('trở lại') || text.includes('đổi nhiệm vụ') || text.includes('back'))) ||
                                className.includes('back') ||
                                hrefAttr.includes('history.back') ||
                                hrefAttr.includes('history.go(-1)') ||
                                onclickAttr.includes('history.back') ||
                                onclickAttr.includes('history.go(-1)')) {
                                e.preventDefault(); e.stopPropagation();
                                forceGoBack();
                            }
                        }
                    }, true);
                }
            } catch (e) { }

        } catch (e) { }
    }

    // Kích hoạt Deep Fake trên Cửa sổ chính hiện tại
    applySpoofing(window);

    // Kích hoạt Deep Fake trên TẤT CẢ các Iframe được tạo ẩn (Bypass cực mạnh)
    try {
        const originalIframeCwGet = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get;
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: maskFunction(function () {
                const cw = originalIframeCwGet.apply(this);
                if (cw) applySpoofing(cw);
                return cw;
            }, originalIframeCwGet),
            configurable: true
        });
    } catch (e) { }

    try {
        const originalIframeCdGet = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument').get;
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
            get: maskFunction(function () {
                const cd = originalIframeCdGet.apply(this);
                if (cd && cd.defaultView) applySpoofing(cd.defaultView);
                return cd;
            }, originalIframeCdGet),
            configurable: true
        });
    } catch (e) { }

}, { once: true });