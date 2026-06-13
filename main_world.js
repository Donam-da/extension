window.addEventListener("Bypass_SpoofProfile_Init", function (e) {
    const profile = e.detail;
    if (!profile) return;

    const maskFunction = (fakeFn, originalFn) => {
        const originalToString = Function.prototype.toString;
        fakeFn.toString = function toString() { return originalToString.call(originalFn); };
        fakeFn.toString.toString = function toString() { return originalToString.call(originalToString); };
        if (originalFn.name) Object.defineProperty(fakeFn, 'name', { value: originalFn.name, configurable: true });
        return fakeFn;
    };

    const defineMaskedGetter = (obj, prop, value) => {
        try {
            const originalDesc = Object.getOwnPropertyDescriptor(obj, prop);
            const fakeGetter = function () { return value; };
            const originalToString = Function.prototype.toString;
            if (originalDesc && originalDesc.get) {
                fakeGetter.toString = function toString() { return originalToString.call(originalDesc.get); };
            } else {
                fakeGetter.toString = function toString() { return "function get " + prop + "() { [native code] }"; };
            }
            fakeGetter.toString.toString = function toString() { return originalToString.call(originalToString); };
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

            // 4. Deep Fake Canvas Noise
            if (targetWin.HTMLCanvasElement) {
                const originalToDataURL = targetWin.HTMLCanvasElement.prototype.toDataURL;
                targetWin.HTMLCanvasElement.prototype.toDataURL = maskFunction(function (...args) {
                    try {
                        const ctx = this.getContext('2d');
                        if (ctx) {
                            ctx.fillStyle = "rgba(" + ((Math.abs(profile.canvasR) * 10) % 255) + ", " + ((Math.abs(profile.canvasG) * 10) % 255) + ", " + ((Math.abs(profile.canvasB) * 10) % 255) + ", 0.01)";
                            ctx.fillRect(0, 0, 1, 1);
                        }
                    } catch (e) { }
                    return originalToDataURL.apply(this, args);
                }, originalToDataURL);

                const originalToBlob = targetWin.HTMLCanvasElement.prototype.toBlob;
                targetWin.HTMLCanvasElement.prototype.toBlob = maskFunction(function (callback, type, quality) {
                    try {
                        const ctx = this.getContext('2d');
                        if (ctx) {
                            ctx.fillStyle = "rgba(" + ((Math.abs(profile.canvasR) * 10) % 255) + ", " + ((Math.abs(profile.canvasG) * 10) % 255) + ", " + ((Math.abs(profile.canvasB) * 10) % 255) + ", 0.01)";
                            ctx.fillRect(0, 0, 1, 1);
                        }
                    } catch (e) { }
                    return originalToBlob.call(this, callback, type, quality);
                }, originalToBlob);
            }
            if (targetWin.CanvasRenderingContext2D) {
                const originalGetImageData = targetWin.CanvasRenderingContext2D.prototype.getImageData;
                targetWin.CanvasRenderingContext2D.prototype.getImageData = maskFunction(function (x, y, width, height) {
                    const imageData = originalGetImageData.call(this, x, y, width, height);
                    if (imageData && imageData.data && imageData.data.length > 0) {
                        for (let i = 0; i < Math.min(64, imageData.data.length); i += 4) {
                            imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + profile.canvasR));
                            imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + profile.canvasG));
                            imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + profile.canvasB));
                        }
                    }
                    return imageData;
                }, originalGetImageData);
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

    // 8. Smart Back (Tính năng nút Quay lại / Lấy link)
    try {
        const hostname = window.location.hostname;
        // Chỉ kích hoạt thao tác chặn nút Back trên các trang nhiệm vụ cụ thể để không ảnh hưởng đến Chrome cá nhân
        if (window === window.top && (hostname.includes('linkhuongdan.online') || hostname.includes('uptolink'))) {
            const backUrl = 'https://uptolink.vip';
            try { Object.defineProperty(document, 'referrer', { get: function () { return backUrl; }, configurable: true }); } catch (e) { }
            window.history.pushState({ page: 'hacked_back_button' }, "", window.location.href);
            window.addEventListener('popstate', function (event) { window.location.href = backUrl; });
            document.addEventListener('click', function (e) {
                let target = e.target.closest('a, button');
                if (target) {
                    let text = (target.innerText || target.textContent || '').toLowerCase();
                    if (text.includes('return') || text.includes('quay lại') || text.includes('trở về') || (target.href && target.href.includes('history.back()'))) {
                        e.preventDefault(); e.stopPropagation(); window.location.href = backUrl;
                    }
                }
            }, true);
        }
    } catch (e) { }

}, { once: true });