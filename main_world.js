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

// =====================================================================
// LỚP DỌN DẸP DẤU VẾT EXTENSION (CHỈ CHẠY KHI ĐÃ CÓ PROFILE)
// =====================================================================
function executePreSpoof(profile) {
    try {
        const sanitizeWindow = (win) => {
            try {
                // 1. Tiêu diệt tức thời các dấu vết của trình duyệt Extension
                const badVars = ['lemur', 'LemurApp', 'KiwiExtension', 'browser'];
                for (let v of badVars) { try { delete win[v]; } catch (e) { } }

                // Không xóa window.chrome nếu là chế độ nhẹ (Tránh bị CreepJS báo Headless)
                if (profile && profile.skipDeepFake) return;

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

    } catch (e) { }
}
// =====================================================================

window.addEventListener("Bypass_SpoofProfile_Init", function (e) {
    let profile = e.detail;
    if (typeof profile === 'string') {
        try { profile = JSON.parse(profile); } catch (err) { }
    }
    if (!profile) return;
    window._spoofedProfile = profile; // Lưu trữ Profile để các Proxy đồng bộ có thể sử dụng

    // --- KÍCH HOẠT BẢO VỆ TOSTRING() VÀ DỌN DẸP EXTENSION ---
    // Đưa vào đây để đảm bảo Extension KHÔNG can thiệp vào web khi chưa đăng nhập Key
    if (Function.prototype.toString && !globalFnMap.has(Function.prototype.toString)) {
        const origToString = Function.prototype.toString;
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
        Object.defineProperty(fakeToString, 'name', { value: 'toString', configurable: true });
        Function.prototype.toString = fakeToString;
        globalFnMap.set(fakeToString, origToString);
        globalFnMap.set(origToString, origToString);
    }
    executePreSpoof(profile);

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

    const defineMaskedGetter = (obj, prop, value) => {
        try {
            const originalDesc = Object.getOwnPropertyDescriptor(obj, prop);

            // SỬ DỤNG ES6 METHOD SHORTHAND: Tạo hàm KHÔNG CÓ thuộc tính prototype (Giống hệt hàm Native C++)
            const wrapper = {
                getter() {
                    if (originalDesc && originalDesc.get) {
                        originalDesc.get.call(this); // Trình duyệt thật tự động kiểm tra 'this', nếu sai sẽ ném Illegal invocation
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

            // 0.1 DEEP FAKE WEB WORKER (BỊT LỖ HỔNG LỘ HỆ ĐIỀU HÀNH THẬT KHI CHẠY LUỒNG NGẦM)
            if (targetWin.Worker) {
                const OrigWorker = targetWin.Worker;
                targetWin.Worker = maskFunction(function (scriptURL, options) {
                    try {
                        const absUrl = new URL(scriptURL, targetWin.document.baseURI).href;
                        const fakeNav = `try { Object.defineProperty(WorkerNavigator.prototype, 'userAgent', {get: () => '${profile.ua}'}); Object.defineProperty(WorkerNavigator.prototype, 'platform', {get: () => '${profile.platform}'}); Object.defineProperty(WorkerNavigator.prototype, 'hardwareConcurrency', {get: () => ${profile.hardwareConcurrency}}); Object.defineProperty(WorkerNavigator.prototype, 'deviceMemory', {get: () => ${profile.deviceMemory}}); } catch(e){}`;
                        const blob = new Blob([fakeNav + `\nimportScripts('${absUrl}');`], { type: 'application/javascript' });
                        const blobUrl = URL.createObjectURL(blob);
                        return new OrigWorker(blobUrl, options);
                    } catch (e) {
                        // Nếu Web chặn Blob CSP, lùi về dùng Worker gốc
                        return new OrigWorker(scriptURL, options);
                    }
                }, OrigWorker);
            }

            // 0.2 DEEP FAKE SHARED WORKER
            if (targetWin.SharedWorker) {
                const OrigSharedWorker = targetWin.SharedWorker;
                targetWin.SharedWorker = maskFunction(function (scriptURL, options) {
                    try {
                        const absUrl = new URL(scriptURL, targetWin.document.baseURI).href;
                        const fakeNav = `try { Object.defineProperty(WorkerNavigator.prototype, 'userAgent', {get: () => '${profile.ua}'}); Object.defineProperty(WorkerNavigator.prototype, 'platform', {get: () => '${profile.platform}'}); Object.defineProperty(WorkerNavigator.prototype, 'hardwareConcurrency', {get: () => ${profile.hardwareConcurrency}}); Object.defineProperty(WorkerNavigator.prototype, 'deviceMemory', {get: () => ${profile.deviceMemory}}); } catch(e){}`;
                        const blob = new Blob([fakeNav + `\nimportScripts('${absUrl}');`], { type: 'application/javascript' });
                        const blobUrl = URL.createObjectURL(blob);
                        return new OrigSharedWorker(blobUrl, options);
                    } catch (e) {
                        return new OrigSharedWorker(scriptURL, options);
                    }
                }, OrigSharedWorker);
            }

            // --- HỆ THỐNG NATIVE BRAND CHECKING ---
            // Buộc mọi hàm bị Fake phải ném lỗi "Illegal invocation" nếu CreepJS cố tình gọi sai
            const createBrandChecker = (proto, prop) => {
                try { const getter = Object.getOwnPropertyDescriptor(proto, prop).get; return (obj) => { try { getter.call(obj); return true; } catch (e) { return false; } }; } catch (e) { return () => true; }
            };
            const isCanvas = targetWin.HTMLCanvasElement ? createBrandChecker(targetWin.HTMLCanvasElement.prototype, 'width') : () => true;
            const isCtx2D = targetWin.CanvasRenderingContext2D ? createBrandChecker(targetWin.CanvasRenderingContext2D.prototype, 'canvas') : () => true;
            const isCtxWebGL = targetWin.WebGLRenderingContext ? createBrandChecker(targetWin.WebGLRenderingContext.prototype, 'canvas') : () => true;
            const isCtxWebGL2 = targetWin.WebGL2RenderingContext ? createBrandChecker(targetWin.WebGL2RenderingContext.prototype, 'canvas') : () => true;
            const isMediaDevices = targetWin.MediaDevices ? createBrandChecker(targetWin.MediaDevices.prototype, 'ondevicechange') : () => true;

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
                defineMaskedGetter(targetWin.Navigator.prototype, 'userAgent', profile.ua);
                defineMaskedGetter(targetWin.Navigator.prototype, 'platform', profile.platform);
                defineMaskedGetter(targetWin.Navigator.prototype, 'appVersion', profile.ua.replace(/^Mozilla\//, ''));
            }
            defineMaskedGetter(targetWin.Navigator.prototype, 'hardwareConcurrency', profile.hardwareConcurrency);
            defineMaskedGetter(targetWin.Navigator.prototype, 'deviceMemory', profile.deviceMemory);
            defineMaskedGetter(targetWin.Navigator.prototype, 'vendor', profile.navigatorVendor || "Google Inc.");
            defineMaskedGetter(targetWin.Navigator.prototype, 'webdriver', false);

            // 1.5. Fake Touch Support
            if (profile.ua.includes("Mobile") || profile.ua.includes("Android")) {
                defineMaskedGetter(targetWin.Navigator.prototype, 'maxTouchPoints', 5);
                if (!('ontouchstart' in targetWin)) {
                    targetWin.ontouchstart = null;
                    try { Object.defineProperty(targetWin, 'ontouchstart', { value: null, writable: true, configurable: true, enumerable: true }); } catch (e) { }
                }
            }

            // 2. Fake Screen
            if (profile.screenWidth && profile.screenHeight && targetWin.Screen) {
                defineMaskedGetter(targetWin.Screen.prototype, 'width', profile.screenWidth);
                defineMaskedGetter(targetWin.Screen.prototype, 'height', profile.screenHeight);
                defineMaskedGetter(targetWin.Screen.prototype, 'availWidth', profile.screenWidth);
                defineMaskedGetter(targetWin.Screen.prototype, 'availHeight', profile.screenHeight);
                if (profile.colorDepth) {
                    defineMaskedGetter(targetWin.Screen.prototype, 'colorDepth', profile.colorDepth);
                    defineMaskedGetter(targetWin.Screen.prototype, 'pixelDepth', profile.colorDepth);
                }

                // Đồng bộ kích thước cửa sổ Browser (Chống rò rỉ qua CSS Media Queries)
                if (targetWin.Window && targetWin.Window.prototype) {
                    defineMaskedGetter(targetWin.Window.prototype, 'innerWidth', profile.screenWidth);
                    defineMaskedGetter(targetWin.Window.prototype, 'innerHeight', profile.screenHeight);
                    defineMaskedGetter(targetWin.Window.prototype, 'outerWidth', profile.screenWidth);
                    defineMaskedGetter(targetWin.Window.prototype, 'outerHeight', profile.screenHeight);
                }

                if (targetWin.matchMedia) {
                    const origMatchMedia = targetWin.matchMedia;
                    targetWin.matchMedia = maskFunction(function (query) {
                        let matches = null;
                        if (query.includes('max-width')) {
                            const m = query.match(/max-width:\s*(\d+)px/);
                            if (m && profile.screenWidth) matches = profile.screenWidth <= parseInt(m[1]);
                        } else if (query.includes('min-width')) {
                            const m = query.match(/min-width:\s*(\d+)px/);
                            if (m && profile.screenWidth) matches = profile.screenWidth >= parseInt(m[1]);
                        }
                        if (matches !== null && targetWin.MediaQueryList) {
                            const res = Object.create(targetWin.MediaQueryList.prototype);
                            Object.defineProperty(res, 'matches', { get: () => matches });
                            Object.defineProperty(res, 'media', { get: () => query });
                            res.addListener = function () { }; res.removeListener = function () { };
                            return res;
                        }
                        return origMatchMedia.apply(this, arguments);
                    }, origMatchMedia);
                }
            }

            // 2.5. Fake Device Pixel Ratio (DSF)
            if (profile.dsf && targetWin.Window && targetWin.Window.prototype) {
                defineMaskedGetter(targetWin.Window.prototype, 'devicePixelRatio', profile.dsf);
            }

            // 3. Deep Fake WebGL
            if (targetWin.WebGLRenderingContext && profile.webglVendor && profile.webglRenderer) {
                const originalGetParameter = targetWin.WebGLRenderingContext.prototype.getParameter;
                const wrapper = {
                    getParameter(param) {
                        if (!isCtxWebGL(this)) return originalGetParameter.apply(this, arguments);
                        if (param === 37445) return profile.webglVendor; // UNMASKED_VENDOR
                        if (param === 37446) return profile.webglRenderer; // UNMASKED_RENDERER
                        if (param === 7936) return "WebKit"; // VENDOR
                        if (param === 7937) return "WebKit WebGL"; // RENDERER
                        if (param === 7938) return `WebGL 1.0 (OpenGL ES 2.0 Chromium ${profile.chromeMajor}.0)`; // VERSION
                        return originalGetParameter.apply(this, arguments);
                    }
                };
                targetWin.WebGLRenderingContext.prototype.getParameter = maskFunction(wrapper.getParameter, originalGetParameter);
            }
            if (targetWin.WebGL2RenderingContext && profile.webglVendor && profile.webglRenderer) {
                const originalGetParameter2 = targetWin.WebGL2RenderingContext.prototype.getParameter;
                const wrapper2 = {
                    getParameter(param) {
                        if (!isCtxWebGL2(this)) return originalGetParameter2.apply(this, arguments);
                        if (param === 37445) return profile.webglVendor;
                        if (param === 37446) return profile.webglRenderer;
                        if (param === 7936) return "WebKit";
                        if (param === 7937) return "WebKit WebGL";
                        if (param === 7938) return `WebGL 2.0 (OpenGL ES 3.0 Chromium ${profile.chromeMajor}.0)`;
                        return originalGetParameter2.apply(this, arguments);
                    }
                };
                targetWin.WebGL2RenderingContext.prototype.getParameter = maskFunction(wrapper2.getParameter, originalGetParameter2);
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
                if (parseInt(profile.chromeMajor) < 89) {
                    // Trình duyệt cũ (Dưới Chrome 89) không có Client Hints. Phải xoá đi để Turnstile không bắt bài.
                    defineMaskedGetter(targetWin.Navigator.prototype, 'userAgentData', undefined);
                } else {
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
                    if (profile.platformVersion) fakePlatformVersion = profile.platformVersion;

                    const uaDataProto = Object.getPrototypeOf(targetWin.navigator.userAgentData);
                    defineMaskedGetter(uaDataProto, 'brands', fakeBrands);
                    defineMaskedGetter(uaDataProto, 'mobile', profile.ua.includes("Mobile"));
                    defineMaskedGetter(uaDataProto, 'platform', fakePlatform);

                    const originalGetHighEntropyValues = window._origGetHEV || uaDataProto.getHighEntropyValues;
                    const uaDataBrandsGetter = Object.getOwnPropertyDescriptor(targetWin.NavigatorUAData.prototype, 'brands').get;
                    const wrapperUA = {
                        getHighEntropyValues() {
                            try { uaDataBrandsGetter.call(this); } catch (e) { return originalGetHighEntropyValues.apply(this, arguments); }
                            return originalGetHighEntropyValues.apply(this, arguments).then(values => {
                                const hints = arguments[0] || [];
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
            }

            // 8. Fake Plugins (Tránh lộ PC Plugins khi Fake Mobile)
            if (profile.ua.includes("Mobile") || profile.ua.includes("Android")) {
                if (targetWin.navigator.plugins && targetWin.navigator.plugins.length > 0) {
                    // Sử dụng Object.freeze để giống hệt mảng rỗng bản Native, không bị lộ do Object.create
                    const createEmptyPluginArray = (proto) => Object.freeze(Object.assign(Object.create(proto.prototype), { length: 0 }));

                    if (targetWin.PluginArray) defineMaskedGetter(targetWin.Navigator.prototype, 'plugins', createEmptyPluginArray(targetWin.PluginArray));
                    if (targetWin.MimeTypeArray) defineMaskedGetter(targetWin.Navigator.prototype, 'mimeTypes', createEmptyPluginArray(targetWin.MimeTypeArray));
                    defineMaskedGetter(targetWin.Navigator.prototype, 'pdfViewerEnabled', false);
                }
            }

            // 11. Deep Fake Timezone & Locale (Nhiễu Múi giờ và Ngôn ngữ)
            if (!profile.skipDeepFake && targetWin.Intl && targetWin.Intl.DateTimeFormat) {
                const tzMap = {
                    '-420': ['Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Phnom_Penh', 'Asia/Vientiane'],
                    '-480': ['Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Shanghai', 'Asia/Taipei', 'Asia/Manila', 'Asia/Hong_Kong'],
                    '-540': ['Asia/Tokyo', 'Asia/Seoul'],
                    '0': ['Europe/London', 'Europe/Dublin'],
                    '-60': ['Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid'],
                    '240': ['America/New_York', 'America/Detroit', 'America/Havana'],
                    '300': ['America/Chicago', 'America/Mexico_City'],
                    '480': ['America/Los_Angeles', 'America/Tijuana']
                };
                const isIntlDTF = targetWin.Intl && targetWin.Intl.DateTimeFormat ? createBrandChecker(targetWin.Intl.DateTimeFormat.prototype, 'format') : () => true;
                const origResolvedOptions = targetWin.Intl.DateTimeFormat.prototype.resolvedOptions;
                targetWin.Intl.DateTimeFormat.prototype.resolvedOptions = maskFunction(function () {
                    if (!isIntlDTF(this)) return origResolvedOptions.apply(this, arguments);
                    const opts = origResolvedOptions.apply(this, arguments);
                    if (opts) {
                        const realOffset = new targetWin.Date().getTimezoneOffset().toString();
                        if (tzMap[realOffset]) {
                            // Bốc ngẫu nhiên một Múi giờ tương đương cùng Offset để không bị mâu thuẫn DST
                            const idx = Math.abs(profile.canvasR || 0) % tzMap[realOffset].length;
                            opts.timeZone = tzMap[realOffset][idx];
                        }
                        if (profile.fakeLocale) opts.locale = profile.fakeLocale;
                    }
                    return opts;
                }, origResolvedOptions);
            }
            if (profile.fakeLocale && !profile.skipUaFake) {
                defineMaskedGetter(targetWin.Navigator.prototype, 'language', profile.fakeLocale);
                defineMaskedGetter(targetWin.Navigator.prototype, 'languages', [profile.fakeLocale, 'en-US', 'en']);
            }

            // 12. Deep Fake Media Devices (Nhiễu số lượng Loa, Mic, Camera)
            if (!profile.skipDeepFake && targetWin.navigator && targetWin.navigator.mediaDevices && targetWin.navigator.mediaDevices.enumerateDevices) {
                const origEnumerate = targetWin.navigator.mediaDevices.enumerateDevices;
                targetWin.navigator.mediaDevices.enumerateDevices = maskFunction(function () {
                    if (!isMediaDevices(this)) return origEnumerate.apply(this, arguments);
                    return origEnumerate.apply(this, arguments).then(devices => {
                        let fakeDevices = [];
                        const makeDevice = (kind, label, idx) => {
                            const dId = "dev_" + kind + "_" + idx + "_" + Math.abs(profile.canvasR);
                            const gId = "grp_" + kind + "_" + Math.abs(profile.canvasG);
                            let obj = {};
                            if (targetWin.MediaDeviceInfo && targetWin.MediaDeviceInfo.prototype) obj = Object.create(targetWin.MediaDeviceInfo.prototype);
                            Object.defineProperty(obj, 'deviceId', { value: dId, enumerable: true });
                            Object.defineProperty(obj, 'kind', { value: kind, enumerable: true });
                            Object.defineProperty(obj, 'label', { value: label, enumerable: true });
                            Object.defineProperty(obj, 'groupId', { value: gId, enumerable: true });
                            obj.toJSON = function () { return { deviceId: this.deviceId, kind: this.kind, label: this.label, groupId: this.groupId }; };
                            return obj;
                        };
                        for (let i = 0; i < (profile.audioIn || 1); i++) fakeDevices.push(makeDevice('audioinput', '', i));
                        for (let i = 0; i < (profile.audioOut || 1); i++) fakeDevices.push(makeDevice('audiooutput', '', i));
                        for (let i = 0; i < (profile.videoIn || 1); i++) fakeDevices.push(makeDevice('videoinput', '', i));
                        return fakeDevices;
                    });
                }, origEnumerate);
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
                            const parentNode = targetWin.document.body || targetWin.document.documentElement;
                            if (parentNode) parentNode.appendChild(a);
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