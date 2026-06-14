// =====================================================================
// HỆ THỐNG BẢO VỆ NATIVE C++ CHUẨN MỰC TỐI THƯỢNG
// Khởi tạo ngay từ ms đầu tiên để bọc tất cả các hàm bị giả mạo.
// =====================================================================
const globalFnMap = new WeakMap();

const maskFunction = (fakeFn, originalFn) => {
    globalFnMap.set(fakeFn, originalFn);
    if (originalFn && originalFn.name) {
        try { Object.defineProperty(fakeFn, 'name', { value: originalFn.name, configurable: true }); } catch (e) { }
    }
    return fakeFn;
};

// Đè toString ngay lập tức để Turnstile không thể quét mã nguồn hàm
if (Function.prototype.toString) {
    const origToString = Function.prototype.toString;
    const fakeToString = function toString() {
        if (globalFnMap.has(this)) {
            const target = globalFnMap.get(this);
            if (typeof target === 'string') return target;
            return origToString.call(target);
        }
        if (this === fakeToString) return origToString.call(origToString);
        return origToString.call(this);
    };
    Function.prototype.toString = fakeToString;
    globalFnMap.set(fakeToString, origToString);
    globalFnMap.set(origToString, origToString);
}

// =====================================================================
// LỚP PHÒNG NGỰ ĐỒNG BỘ (SYNCHRONOUS DEFENSE) - CHẠY NGAY LẬP TỨC
// Ngăn chặn các trang web dùng inline script để bắt bài trước khi
// Extension kịp nhận được Profile từ background.
// =====================================================================
(function syncPreSpoof() {
    try {
        const sanitizeWindow = (win) => {
            try {
                // 1. Tiêu diệt tức thời các dấu vết của trình duyệt Extension
                const badVars = ['lemur', 'LemurApp', 'KiwiExtension', 'browser'];
                for (let v of badVars) { try { delete win[v]; } catch (e) { } }

                // 2. Dọn sạch window.chrome bằng DELETE sâu (TUYỆT ĐỐI KHÔNG DÙNG PROXY VÌ TURNSTILE SẼ PHÁT HIỆN)
                if (win.chrome) {
                    const extKeys = ['runtime', 'extension', 'app', 'webstore', 'management', 'tabs', 'windows', 'storage', 'identity', 'alarms'];
                    for (let key of extKeys) {
                        try { delete win.chrome[key]; } catch (e) { }
                    }
                    try {
                        const proto = Object.getPrototypeOf(win.chrome);
                        if (proto && proto !== Object.prototype) {
                            for (let key of extKeys) {
                                try { delete proto[key]; } catch (e) { }
                            }
                        }
                    } catch (e) { }

                }
            } catch (e) { }
        };

        sanitizeWindow(window);

        // Bảo vệ Iframe (Nếu web tạo Iframe bằng JS để luồn qua hệ thống check)
        if (window.HTMLIFrameElement && window.HTMLIFrameElement.prototype) {
            const iframeWinDesc = Object.getOwnPropertyDescriptor(window.HTMLIFrameElement.prototype, 'contentWindow');
            if (iframeWinDesc && iframeWinDesc.get && !globalFnMap.has(iframeWinDesc.get)) {
                const origGet = iframeWinDesc.get;
                const wrapperWin = {
                    get() {
                        const win = origGet.call(this);
                        if (win) sanitizeWindow(win);
                        return win;
                    }
                };
                const fakeGet = maskFunction(wrapperWin.get, origGet);
                Object.defineProperty(window.HTMLIFrameElement.prototype, 'contentWindow', { get: fakeGet, configurable: true, enumerable: true });
            }
        }

        // 5. Cầm chân Cloudflare/Turnstile: Bắt Promise của nó phải chờ cho đến khi Profile tải xong!
        if (navigator.userAgentData) {
            const origGetHighEntropyValues = navigator.userAgentData.getHighEntropyValues;
            window._isProfileReady = false;

            const fakeGetHighEntropyValues = function getHighEntropyValues(hints) {
                if (!window._isProfileReady) {
                    return new Promise((resolve) => {
                        const waitInterval = setInterval(() => {
                            if (window._isProfileReady) {
                                clearInterval(waitInterval);
                                resolve(navigator.userAgentData.getHighEntropyValues(hints));
                            }
                        }, 5);
                    });
                }
                return origGetHighEntropyValues.call(this, hints);
            };
            navigator.userAgentData.getHighEntropyValues = maskFunction(fakeGetHighEntropyValues, origGetHighEntropyValues);
        }
    } catch (e) { }
})();
// =====================================================================

window.addEventListener("Bypass_SpoofProfile_Init", function (e) {
    let profile = e.detail;
    if (typeof profile === 'string') {
        try { profile = JSON.parse(profile); } catch (err) { }
    }
    if (!profile) return;
    window._spoofedProfile = profile; // Lưu trữ Profile để các Proxy đồng bộ có thể sử dụng

    // --- HỆ THỐNG RADAR BẮT LỖI CLOUDFLARE TRỰC TIẾP TRÊN MÀN HÌNH ---
    function showDebugError(msg, source, lineno, colno, error) {
        let errStr = (msg + " " + source + " " + (error ? error.stack : '')).toLowerCase();
        if (!errStr.includes('cloudflare') && !errStr.includes('turnstile') && !errStr.includes('challenge')) return;

        const logError = () => {
            let errBox = document.getElementById('vcl-cf-debug');
            const parentNode = document.body || document.documentElement;
            if (!parentNode) return; // Nếu web chưa tải xong HTML thì bỏ qua render hộp thoại

            if (!errBox) {
                errBox = document.createElement('div');
                errBox.id = 'vcl-cf-debug';
                errBox.style.cssText = 'position: fixed; top: 10px; left: 10px; z-index: 2147483647; background: rgba(13, 17, 23, 0.95); color: #ff5252; border: 2px solid #ff5252; padding: 15px; border-radius: 8px; font-family: Consolas, monospace; font-size: 11px; max-width: 90vw; max-height: 50vh; overflow-y: auto; box-shadow: 0 0 20px rgba(255, 82, 82, 0.5); pointer-events: none;';
                parentNode.appendChild(errBox);
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

        logError();
    }

    window.addEventListener('error', function (e) {
        showDebugError(e.message, e.filename, e.lineno, e.colno, e.error);
    }, true);

    window.addEventListener('unhandledrejection', function (e) {
        if (e.reason) showDebugError(e.reason.message || "Promise Rejection", e.reason.stack || "", 0, 0, e.reason);
    }, true);

    const defineMaskedGetter = (obj, prop, value, expectedClassName) => {
        try {
            const originalDesc = Object.getOwnPropertyDescriptor(obj, prop);

            // SỬ DỤNG ES6 METHOD SHORTHAND: Tạo hàm KHÔNG CÓ thuộc tính prototype (Giống hệt hàm Native C++)
            const wrapper = {
                getter() {
                    if (expectedClassName) {
                        if (Object.prototype.toString.call(this) !== `[object ${expectedClassName}]`) throw new TypeError("Illegal invocation");
                    }
                    return value;
                }
            };
            const fakeGetter = wrapper.getter;
            Object.defineProperty(fakeGetter, 'name', { value: `get ${prop}`, configurable: true });

            if (originalDesc && originalDesc.get) {
                globalFnMap.set(fakeGetter, originalDesc.get);
            } else {
                globalFnMap.set(fakeGetter, `function get ${prop}() { [native code] }`);
            }
            Object.defineProperty(obj, prop, { get: fakeGetter, set: undefined, configurable: true, enumerable: true });
        } catch (e) { }
    };

    const spoofedWindows = new WeakSet();

    function applySpoofing(targetWin) {
        if (!targetWin) return;
        try {
            try { let testHref = targetWin.location.href; } catch (err) { return; }

            if (spoofedWindows.has(targetWin)) return;
            spoofedWindows.add(targetWin);

            // 0. BẢO VỆ HÀM TOSTRING() CHO CÁC IFRAME CON MỚI TẠO
            if (targetWin.Function && targetWin.Function.prototype && targetWin.Function.prototype.toString) {
                const origToString = targetWin.Function.prototype.toString;
                if (!globalFnMap.has(origToString)) {
                    const wrapper = {
                        toString() {
                            if (globalFnMap.has(this)) {
                                const target = globalFnMap.get(this);
                                if (typeof target === 'string') return target;
                                return origToString.call(target);
                            }
                            if (this === wrapper.toString) return origToString.call(origToString);
                            return origToString.call(this);
                        }
                    };
                    const fakeToString = wrapper.toString;
                    targetWin.Function.prototype.toString = fakeToString;
                    globalFnMap.set(fakeToString, origToString);
                    globalFnMap.set(origToString, origToString);
                }
            }

            // 0.5 BẢO VỆ IFRAME ĐỘNG (Chống rò rỉ danh tính thật qua about:blank)
            // Khi trang web tạo iframe ẩn, nó sẽ lấy được navigator gốc trước khi extension kịp chạy.
            if (targetWin.HTMLIFrameElement && targetWin.HTMLIFrameElement.prototype) {
                const iframeWinDesc = Object.getOwnPropertyDescriptor(targetWin.HTMLIFrameElement.prototype, 'contentWindow');
                if (iframeWinDesc && iframeWinDesc.get && !globalFnMap.has(iframeWinDesc.get)) {
                    const wrapperWin = {
                        get() {
                            const win = iframeWinDesc.get.call(this);
                            if (win) applySpoofing(win); // Tiêm danh tính ảo ngay lập tức vào iframe
                            return win;
                        }
                    };
                    Object.defineProperty(targetWin.HTMLIFrameElement.prototype, 'contentWindow', { get: wrapperWin.get, configurable: true, enumerable: true });
                    globalFnMap.set(wrapperWin.get, iframeWinDesc.get);
                }

                const iframeDocDesc = Object.getOwnPropertyDescriptor(targetWin.HTMLIFrameElement.prototype, 'contentDocument');
                if (iframeDocDesc && iframeDocDesc.get && !globalFnMap.has(iframeDocDesc.get)) {
                    const wrapperDoc = {
                        get() {
                            const doc = iframeDocDesc.get.call(this);
                            if (doc && doc.defaultView) applySpoofing(doc.defaultView);
                            return doc;
                        }
                    };
                    Object.defineProperty(targetWin.HTMLIFrameElement.prototype, 'contentDocument', { get: wrapperDoc.get, configurable: true, enumerable: true });
                    globalFnMap.set(wrapperDoc.get, iframeDocDesc.get);
                }
            }

            // 1. Fake Navigator
            if (!profile.skipUaFake) {
                defineMaskedGetter(targetWin.Navigator.prototype, 'userAgent', profile.ua, "Navigator");
                defineMaskedGetter(targetWin.Navigator.prototype, 'platform', profile.platform, "Navigator");
                defineMaskedGetter(targetWin.Navigator.prototype, 'appVersion', profile.ua.replace(/^Mozilla\//, ''), "Navigator");
            }
            defineMaskedGetter(targetWin.Navigator.prototype, 'hardwareConcurrency', profile.hardwareConcurrency, "Navigator");
            defineMaskedGetter(targetWin.Navigator.prototype, 'deviceMemory', profile.deviceMemory, "Navigator");
            defineMaskedGetter(targetWin.Navigator.prototype, 'vendor', profile.navigatorVendor || "Google Inc.", "Navigator");
            defineMaskedGetter(targetWin.Navigator.prototype, 'webdriver', false, "Navigator");

            // 1.5. Fake Touch Support
            if (profile.ua.includes("Mobile") || profile.ua.includes("Android")) {
                defineMaskedGetter(targetWin.Navigator.prototype, 'maxTouchPoints', 5, "Navigator");
                if (!('ontouchstart' in targetWin)) {
                    targetWin.ontouchstart = null;
                    try { Object.defineProperty(targetWin, 'ontouchstart', { value: null, writable: true, configurable: true, enumerable: true }); } catch (e) { }
                }
            }

            // 2. Fake Screen
            if (profile.screenWidth && profile.screenHeight && targetWin.Screen) {
                defineMaskedGetter(targetWin.Screen.prototype, 'width', profile.screenWidth, "Screen");
                defineMaskedGetter(targetWin.Screen.prototype, 'height', profile.screenHeight, "Screen");
                defineMaskedGetter(targetWin.Screen.prototype, 'availWidth', profile.screenWidth, "Screen");
                defineMaskedGetter(targetWin.Screen.prototype, 'availHeight', profile.screenHeight, "Screen");
                if (profile.colorDepth) {
                    defineMaskedGetter(targetWin.Screen.prototype, 'colorDepth', profile.colorDepth, "Screen");
                    defineMaskedGetter(targetWin.Screen.prototype, 'pixelDepth', profile.colorDepth, "Screen");
                }
            }

            // 3. Deep Fake WebGL
            if (targetWin.WebGLRenderingContext && profile.webglVendor && profile.webglRenderer) {
                const originalGetParameter = targetWin.WebGLRenderingContext.prototype.getParameter;
                const wrapper = {
                    getParameter(param) {
                        if (param === 37445) return profile.webglVendor;
                        if (param === 37446) return profile.webglRenderer;
                        return originalGetParameter.call(this, param);
                    }
                };
                targetWin.WebGLRenderingContext.prototype.getParameter = maskFunction(wrapper.getParameter, originalGetParameter);
            }
            if (targetWin.WebGL2RenderingContext && profile.webglVendor && profile.webglRenderer) {
                const originalGetParameter2 = targetWin.WebGL2RenderingContext.prototype.getParameter;
                const wrapper2 = {
                    getParameter(param) {
                        if (param === 37445) return profile.webglVendor;
                        if (param === 37446) return profile.webglRenderer;
                        return originalGetParameter2.call(this, param);
                    }
                };
                targetWin.WebGL2RenderingContext.prototype.getParameter = maskFunction(wrapper2.getParameter, originalGetParameter2);
            }

            // 4. Deep Fake Canvas (Nhiễu vân tay đồ họa)
            if (profile.canvasR && targetWin.HTMLCanvasElement) {
                // Bơm thuộc tính willReadFrequently để tắt cảnh báo Performance của Chrome
                const origGetContext = targetWin.HTMLCanvasElement.prototype.getContext;
                const wrapperGetContext = {
                    getContext(contextId, options) {
                        if (contextId === '2d') {
                            options = options || {};
                            options.willReadFrequently = true;
                        }
                        return origGetContext.call(this, contextId, options);
                    }
                };
                targetWin.HTMLCanvasElement.prototype.getContext = maskFunction(wrapperGetContext.getContext, origGetContext);

                const origGetImageData = targetWin.CanvasRenderingContext2D.prototype.getImageData;
                const wrapperCanvas = {
                    getImageData(x, y, w, h) {
                        const imageData = origGetImageData.call(this, x, y, w, h);
                        if (imageData && imageData.data) {
                            for (let i = 0; i < imageData.data.length; i += 4) {
                                imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + profile.canvasR));
                                imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + profile.canvasG));
                                imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + profile.canvasB));
                            }
                        }
                        return imageData;
                    }
                };
                targetWin.CanvasRenderingContext2D.prototype.getImageData = maskFunction(wrapperCanvas.getImageData, origGetImageData);

                const origToDataURL = targetWin.HTMLCanvasElement.prototype.toDataURL;
                const wrapperDataURL = {
                    toDataURL(type, encoderOptions) {
                        const context = this.getContext('2d');
                        if (context && profile.canvasR) {
                            try {
                                const imageData = origGetImageData.call(context, 0, 0, this.width, this.height);
                                if (imageData && imageData.data) {
                                    for (let i = 0; i < imageData.data.length; i += 4) {
                                        imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + profile.canvasR));
                                        imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + profile.canvasG));
                                        imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + profile.canvasB));
                                    }
                                    context.putImageData(imageData, 0, 0);
                                }
                            } catch (e) { }
                        }
                        return origToDataURL.call(this, type, encoderOptions);
                    }
                };
                targetWin.HTMLCanvasElement.prototype.toDataURL = maskFunction(wrapperDataURL.toDataURL, origToDataURL);
            }

            // 5. Deep Fake Audio (Nhiễu vân tay âm thanh)
            if (profile.audioNoise && targetWin.AudioBuffer) {
                const origGetChannelData = targetWin.AudioBuffer.prototype.getChannelData;
                const wrapperAudio = {
                    getChannelData(channel) {
                        const data = origGetChannelData.call(this, channel);
                        for (let i = 0; i < data.length; i += 100) {
                            data[i] += profile.audioNoise;
                        }
                        return data;
                    }
                };
                targetWin.AudioBuffer.prototype.getChannelData = maskFunction(wrapperAudio.getChannelData, origGetChannelData);
            }

            // 6. Fake window.chrome
            if (profile.ua.includes("Mobile") || profile.ua.includes("Android")) {
                try {
                    try { delete targetWin.browser; } catch (e) { }
                    if (targetWin.chrome) {
                        const extKeys = ['runtime', 'extension', 'app', 'webstore', 'management', 'tabs', 'windows', 'storage', 'identity', 'alarms'];
                        for (let key of extKeys) {
                            try { delete targetWin.chrome[key]; } catch (e) { }
                        }

                        const chromeProto = Object.getPrototypeOf(targetWin.chrome);
                        if (chromeProto && chromeProto !== Object.prototype) {
                            for (let key of extKeys) {
                                try { delete chromeProto[key]; } catch (e) { }
                            }
                        }
                    }
                } catch (e) { }
            }

            // 7. Client Hints (userAgentData)
            if (targetWin.navigator && targetWin.navigator.userAgentData && !profile.skipUaFake) {
                let brandName = "Google Chrome";
                let brandVer = profile.chromeMajor;
                let fullBrandVer = profile.fullChromeVer || `${profile.chromeMajor}.0.0.0`;

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
                    { brand: "Chromium", version: profile.chromeMajor }
                ];
                let fakeFullBrands = [
                    { brand: "Not/A)Brand", version: "8.0.0.0" },
                    { brand: "Chromium", version: fullBrandVer }
                ];
                if (!profile.isKiwi) {
                    fakeBrands.push({ brand: brandName, version: brandVer });
                    fakeFullBrands.push({ brand: brandName, version: fullBrandVer });
                }
                let fakePlatform = profile.platform.includes("Win") ? "Windows" : profile.platform;
                if (profile.platform.includes("Linux") && profile.ua.includes("Android")) fakePlatform = "Android";
                if (profile.platform.includes("Mac")) fakePlatform = "macOS";

                let fakeModel = "";
                let fakePlatformVersion = "13.0.0";
                const modelMatch = profile.ua.match(/\(Linux; Android \d+(?:\.\d+)*; ([^)]+)\)/);
                if (modelMatch) fakeModel = modelMatch[1].split(' Build/')[0];
                const verMatch = profile.ua.match(/Android (\d+(?:\.\d+)*)/);
                if (verMatch) fakePlatformVersion = verMatch[1] + ".0.0";

                const uaDataProto = Object.getPrototypeOf(targetWin.navigator.userAgentData);
                defineMaskedGetter(uaDataProto, 'brands', fakeBrands, "NavigatorUAData");
                defineMaskedGetter(uaDataProto, 'mobile', profile.ua.includes("Mobile"), "NavigatorUAData");
                defineMaskedGetter(uaDataProto, 'platform', fakePlatform, "NavigatorUAData");

                const originalGetHighEntropyValues = uaDataProto.getHighEntropyValues;
                const wrapperUA = {
                    getHighEntropyValues(hints) {
                        return originalGetHighEntropyValues.call(this, hints).then(values => {
                            let fakeValues = { ...values };
                            if (hints.includes("brands")) fakeValues.brands = fakeBrands;
                            if (hints.includes("fullVersionList")) fakeValues.fullVersionList = fakeFullBrands;
                            if (hints.includes("platform")) fakeValues.platform = fakePlatform;
                            if (hints.includes("mobile")) fakeValues.mobile = profile.ua.includes("Mobile");
                            if (hints.includes("model")) fakeValues.model = fakeModel;
                            if (hints.includes("platformVersion")) fakeValues.platformVersion = fakePlatformVersion;
                            if (hints.includes("architecture")) fakeValues.architecture = profile.platform.includes("Win") ? "x86" : "arm";
                            if (hints.includes("bitness")) fakeValues.bitness = profile.platform.includes("Win") ? "64" : "";
                            return fakeValues;
                        });
                    }
                };
                uaDataProto.getHighEntropyValues = maskFunction(wrapperUA.getHighEntropyValues, originalGetHighEntropyValues);
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
                    safeConfig.iceServers = [];
                    safeConfig.iceTransportPolicy = 'relay';

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

            // 10. Smart Back (Tuyệt chiêu chống giam lỏng)
            try {
                const hostname = targetWin.location.hostname;
                const href = targetWin.location.href;
                if (targetWin === targetWin.top && (hostname.includes('online') || hostname.includes('uptolink') || hostname.includes('linkhuongdan') || href.includes('/online/'))) {
                    const backUrl = profile.lastUptoLink || 'https://uptolink.vip';

                    const forceGoBack = () => {
                        targetWin.location.href = backUrl;
                        try {
                            const a = targetWin.document.createElement('a');
                            a.href = backUrl;
                            targetWin.document.body.appendChild(a);
                            a.click();
                        } catch (e) { }
                    };

                    try {
                        const origBack = targetWin.History.prototype.back;
                        targetWin.History.prototype.back = maskFunction(function () { forceGoBack(); }, origBack);

                        const origGo = targetWin.History.prototype.go;
                        targetWin.History.prototype.go = maskFunction(function (delta) {
                            if (delta === -1) { forceGoBack(); }
                            else { return origGo.call(this, delta); }
                        }, origGo);
                    } catch (e) { }

                    if (!targetWin.history.state || targetWin.history.state.page !== 'hacked_back_button') {
                        targetWin.history.pushState({ page: 'hacked_back_button' }, "", href);
                    }
                    targetWin.addEventListener('popstate', function (event) { forceGoBack(); });
                    targetWin.onpopstate = function () { forceGoBack(); };

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

    applySpoofing(window);
    window._isProfileReady = true; // Mở khóa cho Promise của Cloudflare tiếp tục chạy

}, { once: true });