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

    // 1. Fake Navigator
    defineMaskedGetter(Navigator.prototype, 'userAgent', profile.ua);
    defineMaskedGetter(Navigator.prototype, 'platform', profile.platform);
    defineMaskedGetter(Navigator.prototype, 'hardwareConcurrency', profile.hardwareConcurrency);
    defineMaskedGetter(Navigator.prototype, 'deviceMemory', profile.deviceMemory);
    defineMaskedGetter(Navigator.prototype, 'vendor', profile.navigatorVendor);
    defineMaskedGetter(Navigator.prototype, 'webdriver', false);
    defineMaskedGetter(Navigator.prototype, 'appVersion', profile.ua.replace(/^Mozilla\//, ''));

    // 1.5. Fake Touch Support cho profile Mobile (Bypass check Fake Mobile của LinkTot)
    if (profile.ua.includes("Mobile") || profile.ua.includes("Android")) {
        defineMaskedGetter(Navigator.prototype, 'maxTouchPoints', 5);
        if (!('ontouchstart' in window)) {
            window.ontouchstart = null;
            try { Object.defineProperty(window, 'ontouchstart', { value: null, writable: true, configurable: true, enumerable: true }); } catch (e) { }
        }
        try {
            const fakePlugins = Object.create(PluginArray.prototype);
            Object.defineProperty(fakePlugins, 'length', { value: 0 });
            Object.defineProperty(Navigator.prototype, 'plugins', { get: () => fakePlugins, configurable: true });

            const fakeMimeTypes = Object.create(MimeTypeArray.prototype);
            Object.defineProperty(fakeMimeTypes, 'length', { value: 0 });
            Object.defineProperty(Navigator.prototype, 'mimeTypes', { get: () => fakeMimeTypes, configurable: true });
        } catch (e) { }
    }

    // 2. Fake Screen Resolution
    defineMaskedGetter(Screen.prototype, 'width', profile.screenWidth);
    defineMaskedGetter(Screen.prototype, 'height', profile.screenHeight);
    defineMaskedGetter(Screen.prototype, 'availWidth', profile.screenWidth);
    defineMaskedGetter(Screen.prototype, 'availHeight', profile.screenHeight - 40);
    defineMaskedGetter(Screen.prototype, 'colorDepth', profile.colorDepth);
    defineMaskedGetter(Screen.prototype, 'pixelDepth', profile.colorDepth);

    try {
        Object.defineProperty(window, 'innerWidth', { get: () => profile.screenWidth, configurable: true });
        Object.defineProperty(window, 'innerHeight', { get: () => profile.screenHeight, configurable: true });
        Object.defineProperty(window, 'outerWidth', { get: () => profile.screenWidth, configurable: true });
        Object.defineProperty(window, 'outerHeight', { get: () => profile.screenHeight + 85, configurable: true });
        Object.defineProperty(window, 'devicePixelRatio', { get: () => profile.dsf || 2.5, configurable: true });
    } catch (e) { }

    // 3. Deep Fake WebGL (Chống check Card Đồ Họa)
    if (window.WebGLRenderingContext) {
        const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = maskFunction(function (param) {
            if (param === 37445) return profile.webglVendor;
            if (param === 37446) return profile.webglRenderer;
            return originalGetParameter.call(this, param);
        }, originalGetParameter);
    }
    if (window.WebGL2RenderingContext) {
        const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = maskFunction(function (param) {
            if (param === 37445) return profile.webglVendor;
            if (param === 37446) return profile.webglRenderer;
            return originalGetParameter2.call(this, param);
        }, originalGetParameter2);
    }

    // 4. Deep Fake Canvas Noise (Chống check Browser Hash)
    if (window.HTMLCanvasElement) {
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = maskFunction(function (...args) {
            try {
                const ctx = this.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = "rgba(" + ((Math.abs(profile.canvasR) * 10) % 255) + ", " + ((Math.abs(profile.canvasG) * 10) % 255) + ", " + ((Math.abs(profile.canvasB) * 10) % 255) + ", 0.01)";
                    ctx.fillRect(0, 0, 1, 1);
                }
            } catch (e) { }
            return originalToDataURL.apply(this, args);
        }, originalToDataURL);

        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = maskFunction(function (x, y, width, height) {
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

        const originalToBlob = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = maskFunction(function (callback, type, quality) {
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

    // 5. Deep Fake Audio
    if (window.AudioBuffer) {
        const originalGetChannelData = AudioBuffer.prototype.getChannelData;
        AudioBuffer.prototype.getChannelData = maskFunction(function (channel) {
            const data = originalGetChannelData.call(this, channel);
            if (data && data.length > 0) {
                data[0] += profile.audioNoise;
            }
            return data;
        }, originalGetChannelData);
    }

    // 6. Fake window.chrome & iframe contentWindow
    if (!window.chrome) {
        window.chrome = {
            runtime: {},
            loadTimes: maskFunction(function () { return {}; }, function loadTimes() { return {}; }),
            csi: maskFunction(function () { return {}; }, function csi() { return {}; })
        };
    } else if ((profile.ua.includes("Mobile") || profile.ua.includes("Android")) && window.chrome.app) {
        // Mobile Chrome không có thuộc tính app, xóa để không lộ là Desktop giả Mobile
        try { delete window.chrome.app; } catch (e) { }
    }
    try {
        const originalIframeCwGet = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get;
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: maskFunction(function () {
                const cw = originalIframeCwGet.apply(this);
                if (cw) {
                    try {
                        if (cw.navigator && !cw.chrome && window.chrome) cw.chrome = window.chrome;
                    } catch (e) { }
                }
                return cw;
            }, originalIframeCwGet),
            configurable: true
        });
    } catch (e) { }

    // 7. Client Hints (userAgentData)
    if (navigator.userAgentData) {
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

        defineMaskedGetter(Object.getPrototypeOf(navigator.userAgentData), 'brands', fakeBrands);
        defineMaskedGetter(Object.getPrototypeOf(navigator.userAgentData), 'mobile', profile.ua.includes("Mobile"));
        defineMaskedGetter(Object.getPrototypeOf(navigator.userAgentData), 'platform', fakePlatform);

        const originalGetHighEntropyValues = navigator.userAgentData.getHighEntropyValues;
        navigator.userAgentData.getHighEntropyValues = maskFunction(function (hints) {
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