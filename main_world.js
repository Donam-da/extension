window.addEventListener("Bypass_SpoofProfile_Init", function (e) {
    const profile = e.detail;
    if (!profile) return;

    // KỸ THUẬT VƯỢT MẶT TOSTRING() TOÀN CẦU (Không dùng Proxy để tránh bị phát hiện)
    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function toString() {
        if (this && this.__originalFn) return originalToString.call(this.__originalFn);
        if (this === Function.prototype.toString) return originalToString.call(originalToString);
        return originalToString.call(this);
    };
    Function.prototype.toString.__originalFn = originalToString;

    const maskFunction = (fakeFn, originalFn) => {
        fakeFn.__originalFn = originalFn;
        if (originalFn && originalFn.name) {
            try { Object.defineProperty(fakeFn, 'name', { value: originalFn.name, configurable: true }); } catch (e) { }
        }
        return fakeFn;
    };

    const defineMaskedGetter = (obj, prop, value) => {
        try {
            const originalDesc = Object.getOwnPropertyDescriptor(obj, prop);
            const fakeGetter = function () { return value; };
            if (originalDesc && originalDesc.get) {
                fakeGetter.__originalFn = originalDesc.get;
            } else {
                fakeGetter.__originalFn = function () { return "function get " + prop + "() { [native code] }"; };
            }
            Object.defineProperty(obj, prop, { get: fakeGetter, configurable: true, enumerable: true });
        } catch (e) { }
    };

    // Gói toàn bộ logic Spoofing vào một hàm để áp dụng cho cả Window chính lẫn các Iframe con
    function applySpoofing(targetWin) {
        if (!targetWin || targetWin.__spoofed) return;
        try {
            targetWin.__spoofed = true; // Đánh dấu đã fake để không chạy lại

            // 1. Fake Navigator
            defineMaskedGetter(targetWin.Navigator.prototype, 'userAgent', profile.ua);
            defineMaskedGetter(targetWin.Navigator.prototype, 'platform', profile.platform);
            defineMaskedGetter(targetWin.Navigator.prototype, 'hardwareConcurrency', profile.hardwareConcurrency);
            defineMaskedGetter(targetWin.Navigator.prototype, 'deviceMemory', profile.deviceMemory);
            defineMaskedGetter(targetWin.Navigator.prototype, 'vendor', profile.navigatorVendor || "Google Inc.");
            defineMaskedGetter(targetWin.Navigator.prototype, 'webdriver', false);
            defineMaskedGetter(targetWin.Navigator.prototype, 'appVersion', profile.ua.replace(/^Mozilla\//, ''));

            // 1.5. Fake Touch Support
            if (profile.ua.includes("Mobile") || profile.ua.includes("Android")) {
                defineMaskedGetter(targetWin.Navigator.prototype, 'maxTouchPoints', 5);
                if (!('ontouchstart' in targetWin)) {
                    targetWin.ontouchstart = null;
                    try { Object.defineProperty(targetWin, 'ontouchstart', { value: null, writable: true, configurable: true, enumerable: true }); } catch (e) { }
                }
                try {
                    const fakePlugins = Object.create(targetWin.PluginArray.prototype);
                    Object.defineProperty(fakePlugins, 'length', { value: 0 });
                    Object.defineProperty(targetWin.Navigator.prototype, 'plugins', { get: () => fakePlugins, configurable: true });

                    const fakeMimeTypes = Object.create(targetWin.MimeTypeArray.prototype);
                    Object.defineProperty(fakeMimeTypes, 'length', { value: 0 });
                    Object.defineProperty(targetWin.Navigator.prototype, 'mimeTypes', { get: () => fakeMimeTypes, configurable: true });
                } catch (e) { }
            }

            // 2. Fake Screen Resolution
            if (targetWin.Screen) {
                defineMaskedGetter(targetWin.Screen.prototype, 'width', profile.screenWidth);
                defineMaskedGetter(targetWin.Screen.prototype, 'height', profile.screenHeight);
                defineMaskedGetter(targetWin.Screen.prototype, 'availWidth', profile.screenWidth);
                defineMaskedGetter(targetWin.Screen.prototype, 'availHeight', profile.screenHeight - 40);
                defineMaskedGetter(targetWin.Screen.prototype, 'colorDepth', profile.colorDepth);
                defineMaskedGetter(targetWin.Screen.prototype, 'pixelDepth', profile.colorDepth);
            }

            try {
                Object.defineProperty(targetWin, 'innerWidth', { get: () => profile.screenWidth, configurable: true });
                Object.defineProperty(targetWin, 'innerHeight', { get: () => profile.screenHeight, configurable: true });
                Object.defineProperty(targetWin, 'outerWidth', { get: () => profile.screenWidth, configurable: true });
                Object.defineProperty(targetWin, 'outerHeight', { get: () => profile.screenHeight + 85, configurable: true });
                Object.defineProperty(targetWin, 'devicePixelRatio', { get: () => profile.dsf || 2.5, configurable: true });
            } catch (e) { }

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

            // 5. Deep Fake Audio
            if (targetWin.AudioBuffer) {
                const originalGetChannelData = targetWin.AudioBuffer.prototype.getChannelData;
                targetWin.AudioBuffer.prototype.getChannelData = maskFunction(function (channel) {
                    const data = originalGetChannelData.call(this, channel);
                    if (data && data.length > 0) {
                        data[0] += profile.audioNoise;
                    }
                    return data;
                }, originalGetChannelData);
            }

            // 6. Fake window.chrome
            if (!targetWin.chrome) {
                targetWin.chrome = {
                    runtime: {},
                    loadTimes: maskFunction(function () { return {}; }, function loadTimes() { return {}; }),
                    csi: maskFunction(function () { return {}; }, function csi() { return {}; })
                };
            } else if ((profile.ua.includes("Mobile") || profile.ua.includes("Android")) && targetWin.chrome.app) {
                try { delete targetWin.chrome.app; } catch (e) { }
            }

            // 7. Client Hints (userAgentData)
            if (targetWin.navigator && targetWin.navigator.userAgentData) {
                const fakeBrands = [
                    { brand: "Not/A)Brand", version: "8" },
                    { brand: "Chromium", version: profile.chromeMajor },
                    { brand: "Google Chrome", version: profile.chromeMajor }
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
                defineMaskedGetter(uaDataProto, 'brands', fakeBrands);
                defineMaskedGetter(uaDataProto, 'mobile', profile.ua.includes("Mobile"));
                defineMaskedGetter(uaDataProto, 'platform', fakePlatform);

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

            // 8. Fake Web Worker (Đánh chặn Dedicated Workers từ bên trong applySpoofing)
            try {
                const OriginalWorker = targetWin.Worker;
                if (OriginalWorker) {
                    targetWin.Worker = maskFunction(function Worker(scriptURL, options) {
                        try {
                            const workerSpoofCode = `
                                Object.defineProperty(navigator, 'userAgent', { get: () => "${profile.ua}" });
                                Object.defineProperty(navigator, 'platform', { get: () => "${profile.platform}" });
                                Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${profile.hardwareConcurrency} });
                                Object.defineProperty(navigator, 'deviceMemory', { get: () => ${profile.deviceMemory} });
                            `;
                            const blob = new Blob([
                                workerSpoofCode + `\nimportScripts('${new URL(scriptURL, document.baseURI).href}');`
                            ], { type: 'application/javascript' });

                            const blobUrl = URL.createObjectURL(blob);
                            return new OriginalWorker(blobUrl, options);
                        } catch (e) {
                            return new OriginalWorker(scriptURL, options);
                        }
                    }, OriginalWorker);
                }
            } catch (e) { }

            // 9. Fake DOMRect (Chống thuật toán kiểm tra kích thước đồ hoạ của CreepJS)
            if (targetWin.Element) {
                const originalGetClientRects = targetWin.Element.prototype.getClientRects;
                targetWin.Element.prototype.getClientRects = maskFunction(function () {
                    const rects = originalGetClientRects.call(this);
                    for (let i = 0; i < rects.length; i++) {
                        try { Object.defineProperty(rects[i], 'width', { value: rects[i].width + (profile.canvasR * 0.0001), configurable: true }); } catch (e) { }
                    }
                    return rects;
                }, originalGetClientRects);

                const originalGetBoundingClientRect = targetWin.Element.prototype.getBoundingClientRect;
                targetWin.Element.prototype.getBoundingClientRect = maskFunction(function () {
                    const rect = originalGetBoundingClientRect.call(this);
                    try {
                        Object.defineProperty(rect, 'width', { value: rect.width + (profile.canvasR * 0.0001), configurable: true });
                        Object.defineProperty(rect, 'height', { value: rect.height + (profile.canvasG * 0.0001), configurable: true });
                    } catch (e) { }
                    return rect;
                }, originalGetBoundingClientRect);
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
                if (targetWin === targetWin.top && (hostname.includes('linkhuongdan.online') || hostname.includes('uptolink'))) {
                    const backUrl = 'https://uptolink.vip';
                    try { Object.defineProperty(targetWin.document, 'referrer', { get: function () { return backUrl; }, configurable: true }); } catch (e) { }
                    targetWin.history.pushState({ page: 'hacked_back_button' }, "", targetWin.location.href);
                    targetWin.addEventListener('popstate', function (event) { targetWin.location.href = backUrl; });
                    targetWin.document.addEventListener('click', function (e) {
                        let target = e.target.closest('a, button');
                        if (target) {
                            let text = (target.innerText || target.textContent || '').toLowerCase();
                            if (text.includes('return') || text.includes('quay lại') || text.includes('trở về') || (target.href && target.href.includes('history.back()'))) {
                                e.preventDefault(); e.stopPropagation(); targetWin.location.href = backUrl;
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