// Chặn rò rỉ IP thực qua WebRTC (Bắt buộc phải đi qua Proxy nếu có)
chrome.privacy.network.webRTCIPHandlingPolicy.set({
    value: 'disable_non_proxied_udp'
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_VALIDATED_PROFILE") {
        // Người gác cổng: Chỉ cung cấp profile cho trang web nếu có Key hợp lệ trong máy
        chrome.storage.local.get(['licenseKey', 'licenseExpiry', 'spoofProfile'], (data) => {
            if (data.licenseKey && data.licenseExpiry && data.spoofProfile) {
                sendResponse({ profile: data.spoofProfile });
            } else {
                sendResponse({ profile: null });
            }
        });
        return true; // Giữ kênh giao tiếp mở
    }
    if (message.type === "UPDATE_RULES") {
        const profile = message.profile;
        const ruleId = 1;

        let requestHeaders = [
            { header: "user-agent", operation: "set", value: profile.ua }
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

        // Đồng bộ hóa sec-ch-ua với User-Agent để tránh bị Cloudflare bắt lỗi lệch Brand
        let secChUa = `"Not/A)Brand";v="8", "Chromium";v="${profile.chromeMajor}", "Google Chrome";v="${profile.chromeMajor}"`;
        if (profile.ua.includes("EdgA") || profile.ua.includes("Edg/")) {
            secChUa = `"Not/A)Brand";v="8", "Chromium";v="${profile.chromeMajor}", "Microsoft Edge";v="${profile.chromeMajor}"`;
        } else if (profile.ua.includes("OPR/")) {
            secChUa = `"Not/A)Brand";v="8", "Chromium";v="${profile.chromeMajor}", "Opera";v="${profile.chromeMajor}"`;
        } else if (profile.ua.includes("SamsungBrowser")) {
            const ssMatch = profile.ua.match(/SamsungBrowser\/(\d+)/);
            const ssVer = ssMatch ? ssMatch[1] : "20";
            secChUa = `"Not/A)Brand";v="8", "Chromium";v="${profile.chromeMajor}", "Samsung Internet";v="${ssVer}"`;
        }

        requestHeaders.push({ header: "sec-ch-ua", operation: "set", value: secChUa });
        requestHeaders.push({ header: "sec-ch-ua-mobile", operation: "set", value: profile.ua.includes("Mobile") ? "?1" : "?0" });
        requestHeaders.push({ header: "sec-ch-ua-platform", operation: "set", value: `"${fakePlatform}"` });
        requestHeaders.push({ header: "sec-ch-ua-model", operation: "set", value: `"${fakeModel}"` });
        requestHeaders.push({ header: "sec-ch-ua-platform-version", operation: "set", value: `"${fakePlatformVersion}"` });

        const newRule = {
            id: ruleId,
            priority: 1,
            action: {
                type: "modifyHeaders",
                requestHeaders: requestHeaders,
                responseHeaders: [
                    { header: "content-security-policy", operation: "remove" }
                ]
            },
            condition: {
                urlFilter: "*",
                resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "ping", "script", "stylesheet", "image"]
            }
        };
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [ruleId],
            addRules: [newRule]
        });
    } else if (message.type === "CLEAR_BROWSING_DATA") {
        // Xóa sạch toàn bộ Cookie, Cache, LocalStorage để web quên danh tính cũ
        chrome.browsingData.remove({
            "since": 0
        }, {
            "appcache": false,
            "cache": false,
            "cacheStorage": false,
            "cookies": true,
            "fileSystems": true,
            "indexedDB": true,
            "localStorage": true,
            "pluginData": false,
            "serviceWorkers": true,
            "webSQL": true
        }, () => {
            sendResponse({ success: true });
        });
        return true; // Giữ kênh giao tiếp mở để gửi callback
    } else if (message.type === "OPEN_CRYPTO_LOGIN") {
        const creds = message.creds || {};
        chrome.tabs.create({ url: "https://cryptolinkforearn.com/login" }, (tab) => {
            const listener = function (tabId, changeInfo, updatedTab) {
                if (tabId === tab.id && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: (emailVal, passVal) => {
                            setTimeout(() => {
                                const emailInput = document.querySelector('input[name="email"], input[type="email"]');
                                const passInput = document.querySelector('input[name="password"], input[type="password"]');
                                if (emailInput && passInput) {
                                    emailInput.value = emailVal;
                                    passInput.value = passVal;
                                    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                                    passInput.dispatchEvent(new Event('input', { bubbles: true }));

                                    const btn = document.querySelector('button[type="submit"]');
                                    if (btn) btn.click();
                                }
                            }, 800);
                        },
                        args: [creds.email || "", creds.pass || ""]
                    }).catch(err => console.log(err));
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
    }
});