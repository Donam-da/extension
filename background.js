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

        let requestHeaders = [];

        if (!profile.skipUaFake) {
            requestHeaders.push({ header: "user-agent", operation: "set", value: profile.ua });

            let fakePlatform = profile.platform.includes("Win") ? "Windows" : profile.platform;
            if (profile.platform.includes("Linux") && profile.ua.includes("Android")) fakePlatform = "Android";
            if (profile.platform.includes("Mac")) fakePlatform = "macOS";

            let fakeModel = "";
            let fakePlatformVersion = "13.0.0";
            const modelMatch = profile.ua.match(/\(Linux; Android \d+(?:\.\d+)*; ([^)]+)\)/);
            if (modelMatch) fakeModel = modelMatch[1].split(' Build/')[0];
            const verMatch = profile.ua.match(/Android (\d+(?:\.\d+)*)/);
            if (verMatch) fakePlatformVersion = verMatch[1] + ".0.0";
            // Ghi đè bằng Platform Version cấu hình cứng (Bịt lỗi leak Windows 11)
            if (profile.platformVersion) fakePlatformVersion = profile.platformVersion;

            let secChUa = `"Not/A)Brand";v="8", "Chromium";v="${profile.chromeMajor}", "Google Chrome";v="${profile.chromeMajor}"`;
            let secChUaFull = `"Not/A)Brand";v="8.0.0.0", "Chromium";v="${profile.fullChromeVer || profile.chromeMajor + '.0.0.0'}", "Google Chrome";v="${profile.fullChromeVer || profile.chromeMajor + '.0.0.0'}"`;

            if (profile.ua.includes("EdgA") || profile.ua.includes("Edg/")) {
                secChUa = `"Not/A)Brand";v="8", "Chromium";v="${profile.chromeMajor}", "Microsoft Edge";v="${profile.chromeMajor}"`;
                secChUaFull = `"Not/A)Brand";v="8.0.0.0", "Chromium";v="${profile.fullChromeVer || profile.chromeMajor + '.0.0.0'}", "Microsoft Edge";v="${profile.fullChromeVer || profile.chromeMajor + '.0.0.0'}"`;
            } else if (profile.ua.includes("OPR/")) {
                secChUa = `"Not/A)Brand";v="8", "Chromium";v="${profile.chromeMajor}", "Opera";v="${profile.chromeMajor}"`;
                secChUaFull = `"Not/A)Brand";v="8.0.0.0", "Chromium";v="${profile.fullChromeVer || profile.chromeMajor + '.0.0.0'}", "Opera";v="${profile.fullChromeVer || profile.chromeMajor + '.0.0.0'}"`;
            } else if (profile.ua.includes("SamsungBrowser")) {
                const ssMatch = profile.ua.match(/SamsungBrowser\/(\d+)/);
                const ssVer = ssMatch ? ssMatch[1] : "20";
                secChUa = `"Not/A)Brand";v="8", "Chromium";v="${profile.chromeMajor}", "Samsung Internet";v="${ssVer}"`;
                secChUaFull = `"Not/A)Brand";v="8.0.0.0", "Chromium";v="${profile.fullChromeVer || profile.chromeMajor + '.0.0.0'}", "Samsung Internet";v="${ssVer}.0.0.0"`;
            }

            if (parseInt(profile.chromeMajor) >= 89) {
                requestHeaders.push({ header: "sec-ch-ua", operation: "set", value: secChUa });
                requestHeaders.push({ header: "sec-ch-ua-full-version-list", operation: "set", value: secChUaFull });
                requestHeaders.push({ header: "sec-ch-ua-mobile", operation: "set", value: profile.ua.includes("Mobile") ? "?1" : "?0" });
                requestHeaders.push({ header: "sec-ch-ua-platform", operation: "set", value: `"${fakePlatform}"` });
                requestHeaders.push({ header: "sec-ch-ua-model", operation: "set", value: `"${fakeModel}"` });
                requestHeaders.push({ header: "sec-ch-ua-platform-version", operation: "set", value: `"${fakePlatformVersion}"` });
            } else {
                requestHeaders.push({ header: "sec-ch-ua", operation: "remove" });
                requestHeaders.push({ header: "sec-ch-ua-full-version-list", operation: "remove" });
                requestHeaders.push({ header: "sec-ch-ua-mobile", operation: "remove" });
                requestHeaders.push({ header: "sec-ch-ua-platform", operation: "remove" });
                requestHeaders.push({ header: "sec-ch-ua-model", operation: "remove" });
                requestHeaders.push({ header: "sec-ch-ua-platform-version", operation: "remove" });
            }
        }

        if (requestHeaders.length > 0) {
            const newRule = {
                id: ruleId,
                priority: 1,
                action: { type: "modifyHeaders", requestHeaders: requestHeaders },
                condition: { urlFilter: "*", resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "ping", "script", "stylesheet", "image"] }
            };
            chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId], addRules: [newRule] }, () => {
                sendResponse({ success: true });
            });
        } else {
            // Nếu được cờ skipUaFake đánh dấu, ta dọn sạch rule cũ để trình duyệt tự gửi header thật
            chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] }, () => {
                sendResponse({ success: true });
            });
        }
        return true; // Báo cho Chrome biết chúng ta sẽ trả về callback bất đồng bộ
    } else if (message.type === "CLEAR_BROWSING_DATA") {
        // KIWI BROWSER: Xóa dữ liệu an toàn theo từng cấp độ giảm dần để không bị Crash
        const typesToTry = [
            {
                "appcache": true, "cache": true, "cacheStorage": true, "cookies": true,
                "downloads": true, "fileSystems": true, "formData": true, "history": true,
                "indexedDB": true, "localStorage": true, "passwords": true, "pluginData": true,
                "serviceWorkers": true, "webSQL": true
            },
            {
                "cache": true, "cacheStorage": true, "cookies": true, "history": true,
                "indexedDB": true, "localStorage": true, "serviceWorkers": true, "webSQL": true
            },
            {
                "cache": true, "cookies": true, "history": true, "localStorage": true
            }
        ];

        let attempt = 0;
        const tryClear = () => {
            if (attempt >= typesToTry.length) {
                // Cấp độ mạnh nhất (Brute-force): Nếu tất cả mảng trên đều lỗi do trình duyệt quá kén,
                // ta sẽ gọi thủ công từng hàm sơ khai nhất không thể lỗi được.
                try { chrome.browsingData.removeCache({ "since": 0 }, () => { }); } catch (e) { }
                try { chrome.browsingData.removeCookies({ "since": 0 }, () => { }); } catch (e) { }
                try { chrome.browsingData.removeLocalStorage({ "since": 0 }, () => { }); } catch (e) { }
                try { chrome.browsingData.removeHistory({ "since": 0 }, () => { }); } catch (e) { }

                setTimeout(() => sendResponse({ success: true }), 200);
                return;
            }
            try {
                chrome.browsingData.remove({ "since": 0 }, typesToTry[attempt], () => {
                    if (chrome.runtime.lastError) { attempt++; tryClear(); }
                    else { sendResponse({ success: true }); }
                });
            } catch (e) {
                attempt++; tryClear();
            }
        };
        tryClear();
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