window.addEventListener("Bypass_SpoofProfile_Init", function (e) {
    let profile = e.detail;
    if (typeof profile === 'string') {
        try { profile = JSON.parse(profile); } catch (err) { }
    }
    if (!profile) return;

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

            // 0. BẢO VỆ HÀM TOSTRING()
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
                            if (this === targetWin.Function.prototype.toString) return origToString.call(origToString);
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

            // 6. Fake window.chrome
            if (profile.ua.includes("Mobile") || profile.ua.includes("Android")) {
                try { delete targetWin.chrome; } catch (e) { }
            }

            // 7. Client Hints (userAgentData)
            if (targetWin.navigator && targetWin.navigator.userAgentData) {
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
                const wrapperUA = {
                    getHighEntropyValues(hints) {
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
                    }
                };
                uaDataProto.getHighEntropyValues = maskFunction(wrapperUA.getHighEntropyValues, originalGetHighEntropyValues);
            }

        } catch (e) { }
    }

    applySpoofing(window);

}, { once: true });