// --- HỆ THỐNG BẢN QUYỀN KẾT NỐI VỚI GITHUB GIST CỦA ADMIN ---
const ONLINE_CONFIG_URL = "https://gist.githubusercontent.com/Donam-da/f7c09d917d09209b818bab60c42f2ca3/raw/config.json";
let currentMachineId = "";
let expiryInterval;

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16).toUpperCase();
    });
}

function showLoginMsg(msg, color = "#ff5252") {
    const el = document.getElementById('login-status');
    el.textContent = msg;
    el.style.color = color;
}

function startExpiryTimer(expiryStr) {
    if (expiryInterval) clearInterval(expiryInterval);
    const display = document.getElementById('key-expiry-display');
    if (!display) return;

    if (expiryStr === "Vĩnh viễn") {
        display.textContent = "⏳ Hạn Key: Vĩnh viễn";
        display.style.color = "#00FF41";
        return;
    }

    if (expiryStr && expiryStr.startsWith("DURATION_MINS")) {
        display.textContent = "⏳ Hạn Key: Thời lượng (Chưa kích hoạt)";
        display.style.color = "#ffb74d";
        return;
    }

    function update() {
        if (!expiryStr) return;
        const expDate = new Date(expiryStr.replace(" ", "T")); // Hỗ trợ chuẩn ISO
        const now = new Date();
        const diff = expDate - now;

        if (diff <= 0) {
            display.textContent = "⏳ Hạn Key: ĐÃ HẾT HẠN!";
            display.style.color = "#ff5252";
            clearInterval(expiryInterval);

            // Tự động đăng xuất đẩy khách văng ra ngoài khi hết hạn
            document.getElementById('btn-logout').click();
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / 1000 / 60) % 60);
        const secs = Math.floor((diff / 1000) % 60);

        let timeStr = "";
        if (days > 0) timeStr = `${days} ngày ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        else timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        display.textContent = `⏳ Hạn Key: Còn ${timeStr}`;
        display.style.color = (days === 0 && hours === 0) ? "#ff5252" : "#00E5FF";
    }

    update();
    expiryInterval = setInterval(update, 1000);
}

function initLicensing() {
    chrome.storage.local.get(['machineId', 'licenseKey'], async (data) => {
        // 1. Khởi tạo và lấy Mã Máy (HWID)
        if (data.machineId) {
            currentMachineId = data.machineId;
        } else {
            currentMachineId = "EXT-" + generateUUID().substring(0, 8);
            chrome.storage.local.set({ machineId: currentMachineId });
        }
        document.getElementById('hwid-display').textContent = currentMachineId;

        // 2. Kiểm tra Key nếu đã lưu
        if (data.licenseKey) {
            await verifyKeyProcess(data.licenseKey, true);
        } else {
            document.getElementById('login-view').style.display = 'block';
            document.getElementById('main-view').style.display = 'none';
        }
    });
}

async function verifyKeyProcess(key, isAutoLogin = false) {
    if (!isAutoLogin) showLoginMsg("Đang kết nối Server kiểm tra Key...", "#ffb74d");

    try {
        // Tải config.json từ Gist (Thêm tham số thời gian để tránh bị trình duyệt lưu cache)
        const response = await fetch(ONLINE_CONFIG_URL + "?v=" + Date.now());
        const config = await response.json();

        if (config.app_locked) {
            throw new Error("Hệ thống đang bảo trì hoặc bị Admin khóa!");
        }

        if (!config.keys || !config.keys[key]) {
            throw new Error("Khóa cấp phép không tồn tại!");
        }

        const keyData = config.keys[key];

        if (keyData.status === "revoked") {
            throw new Error("Khóa này đã bị Admin tạm dừng hoặc thu hồi!");
        }

        if (keyData.hwid !== "ANY" && keyData.hwid !== currentMachineId) {
            throw new Error("Khóa này dành cho máy khác (Sai Mã Máy)!");
        }

        let currentExpiry = keyData.expiry;
        let needsActivation = false;

        // 1. Kiểm tra và tính toán lại Hạn Sử Dụng nếu là Key dạng Thời lượng (DURATION_MINS)
        if (currentExpiry && currentExpiry.startsWith("DURATION_MINS:")) {
            const totalMins = parseInt(currentExpiry.split(":")[1]);
            const expDate = new Date(Date.now() + totalMins * 60000);

            const pad = (n) => String(n).padStart(2, '0');
            currentExpiry = `${expDate.getFullYear()}-${pad(expDate.getMonth() + 1)}-${pad(expDate.getDate())} ${pad(expDate.getHours())}:${pad(expDate.getMinutes())}:${pad(expDate.getSeconds())}`;

            needsActivation = true; // Đánh dấu là cần cập nhật lên Gist
        } else if (currentExpiry !== "Vĩnh viễn") {
            const expDate = new Date(currentExpiry.replace(" ", "T")); // Đưa về chuẩn ISO để parse
            if (new Date() > expDate) {
                throw new Error("Khóa cấp phép đã hết hạn!");
            }
        }

        // 2. Đồng bộ trạng thái Kích hoạt và IP lên Server (Giống hệt Python)
        if (needsActivation || !isAutoLogin) {
            try {
                if (!isAutoLogin) showLoginMsg("Đang đồng bộ kích hoạt lên Server...", "#00bcd4");

                // Hàm giải mã Token
                const decryptToken = (encBase64) => {
                    if (!encBase64) return "";
                    let b64 = encBase64.replace(/-/g, '+').replace(/_/g, '/');
                    while (b64.length % 4 !== 0) b64 += "=";
                    try {
                        const raw = atob(b64);
                        const secret = "TrinhDuyetVIP_SecretKey";
                        let result = "";
                        for (let i = 0; i < raw.length; i++) {
                            result += String.fromCharCode(raw.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
                        }
                        return result;
                    } catch (e) { return ""; }
                };

                const githubToken = decryptToken(config.server_token);

                if (githubToken && githubToken.includes("ghp_")) {
                    // Lấy địa chỉ IP
                    let publicIp = "", location = "";
                    try {
                        const ipRes = await fetch("http://ip-api.com/json/");
                        const ipData = await ipRes.json();
                        publicIp = ipData.query || "";
                        if (ipData.lat && ipData.lon) location = `${ipData.lat}, ${ipData.lon}`;
                    } catch (e) { }

                    // Thời gian cập nhật (UTC+7)
                    const now = new Date();
                    const vnTime = new Date(now.getTime() + 7 * 3600000);
                    const pad = (n) => String(n).padStart(2, '0');
                    const updateTimeStr = `${vnTime.getUTCFullYear()}-${pad(vnTime.getUTCMonth() + 1)}-${pad(vnTime.getUTCDate())} ${pad(vnTime.getUTCHours())}:${pad(vnTime.getUTCMinutes())}:${pad(vnTime.getUTCSeconds())}`;

                    // Lấy Gist mới nhất để tránh đè dữ liệu
                    const gistRes = await fetch(`https://api.github.com/gists/f7c09d917d09209b818bab60c42f2ca3?v=${Date.now()}`, {
                        headers: { "Authorization": `Bearer ${githubToken}`, "Accept": "application/vnd.github+json" }
                    });
                    const gistData = await gistRes.json();
                    let liveConfig = JSON.parse(gistData.files['config.json'].content);

                    if (liveConfig.keys && liveConfig.keys[key]) {
                        if (needsActivation) liveConfig.keys[key].expiry = currentExpiry;

                        liveConfig.keys[key].last_ip_time = updateTimeStr;
                        if (!liveConfig.keys[key].clients) liveConfig.keys[key].clients = {};
                        if (!liveConfig.keys[key].clients[currentMachineId]) liveConfig.keys[key].clients[currentMachineId] = {};

                        liveConfig.keys[key].clients[currentMachineId].last_ip_time = updateTimeStr;
                        if (publicIp) {
                            liveConfig.keys[key].last_ip = publicIp;
                            liveConfig.keys[key].last_location = location;
                            liveConfig.keys[key].history_ip = publicIp;
                            liveConfig.keys[key].history_loc = location;

                            liveConfig.keys[key].clients[currentMachineId].last_ip = publicIp;
                            liveConfig.keys[key].clients[currentMachineId].last_location = location;
                            liveConfig.keys[key].clients[currentMachineId].history_ip = publicIp;
                            liveConfig.keys[key].clients[currentMachineId].history_loc = location;
                        }

                        // Đẩy lên Gist
                        await fetch(`https://api.github.com/gists/f7c09d917d09209b818bab60c42f2ca3`, {
                            method: 'PATCH',
                            headers: { "Authorization": `Bearer ${githubToken}`, "Content-Type": "application/json", "Accept": "application/vnd.github+json" },
                            body: JSON.stringify({
                                files: { "config.json": { content: JSON.stringify(liveConfig, null, 4) } }
                            })
                        });

                        // 3. Bắn thông báo về Telegram
                        const botToken = decryptToken(config.tg_bot_token) || "8983085831:AAHR_ScIfhvQjhDYuwrGz-nV3GR83KgTtGo";
                        const chatId = decryptToken(config.tg_chat_id) || "6762189023";

                        const headerMsg = needsActivation ? "🟢 <b>[KÍCH HOẠT MỚI] KHÁCH VỪA MỞ KHÓA BẰNG EXTENSION!</b>" : "🔄 <b>[ĐĂNG NHẬP] KHÁCH VỪA MỞ EXTENSION</b>";
                        const tgText = `${headerMsg}\n\n🔑 <b>Key:</b> <code>${key}</code>\n💻 <b>HWID (Extension):</b> <code>${currentMachineId}</code>\n🌍 <b>IP:</b> ${publicIp || "Không xác định"}\n⏳ <b>Hạn mới:</b> ${currentExpiry}`;

                        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id: chatId, text: tgText, parse_mode: "HTML" })
                        }).catch(e => console.log(e));
                    }
                }
            } catch (err) {
                console.log("Lỗi đồng bộ Gist từ Extension:", err);
            }
        }

        // Nếu qua hết các bài test -> KÍCH HOẠT THÀNH CÔNG
        chrome.storage.local.set({ licenseKey: key, licenseExpiry: currentExpiry }, () => {
            document.getElementById('login-view').style.display = 'none';
            document.getElementById('main-view').style.display = 'block';
            startExpiryTimer(currentExpiry);
            loadMainApp(); // Gọi hàm chạy App chính
        });

    } catch (error) {
        if (isAutoLogin) {
            document.getElementById('login-view').style.display = 'block';
            document.getElementById('main-view').style.display = 'none';
        }
        showLoginMsg(error.message, "#ff5252");
        chrome.storage.local.remove(['licenseKey', 'licenseExpiry']); // Xóa key lỗi
    }
}

// Lắng nghe sự kiện nút Đăng Nhập
document.getElementById('btn-login').addEventListener('click', () => {
    const key = document.getElementById('key-input').value.trim();
    if (!key) return showLoginMsg("Vui lòng nhập Key!");
    verifyKeyProcess(key, false);
});

// Lắng nghe sự kiện Copy HWID
document.getElementById('btn-copy-hwid').addEventListener('click', (e) => {
    navigator.clipboard.writeText(currentMachineId);
    e.target.textContent = "ĐÃ COPY!";
    setTimeout(() => e.target.textContent = "COPY MÃ MÁY", 2000);
});

// Lắng nghe sự kiện Đăng xuất
document.getElementById('btn-logout').addEventListener('click', () => {
    if (expiryInterval) clearInterval(expiryInterval);
    chrome.storage.local.remove(['licenseKey', 'licenseExpiry'], () => {
        document.getElementById('login-view').style.display = 'block';
        document.getElementById('main-view').style.display = 'none';
    });
});

const profiles = {
    samsung: {
        name: "Android 14.0.0 | Chrome v125.0.0.0",
        ua: "Mozilla/5.0 (Linux; Android 14; SM-S908DS) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
        platform: "Linux aarch64",
        hardwareConcurrency: 8,
        deviceMemory: 8,
        screenWidth: 412,
        screenHeight: 915,
        dsf: 2.5,
        webglVendor: "Qualcomm",
        webglRenderer: "Adreno (TM) 730"
    },
    pixel: {
        name: "Android 13.0.0 | Chrome v120.0.0.0",
        ua: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        platform: "Linux aarch64",
        hardwareConcurrency: 8,
        deviceMemory: 8,
        screenWidth: 412,
        screenHeight: 915,
        dsf: 2.5,
        webglVendor: "ARM",
        webglRenderer: "Mali-G710"
    },
    linktot_mobile: {
        name: "Android 14 | Chrome v125 (Chuẩn LinkTot)",
        ua: "Mozilla/5.0 (Linux; Android 14; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
        platform: "Linux aarch64",
        hardwareConcurrency: 8,
        deviceMemory: 8,
        screenWidth: 412,
        screenHeight: 915,
        dsf: 2.5,
        webglVendor: "Qualcomm",
        webglRenderer: "Adreno (TM) 730"
    }
};

function generateRandomProfile() {
    const brands = ["Xiaomi", "Oppo", "Vivo", "Realme", "OnePlus", "Motorola", "Sony", "Nokia", "Asus", "ZTE", "Infinix"];
    const models = ["Pro", "Ultra", "Plus", "Max", "5G", "Pro+", "Lite", "FE", "Edge", "Power", "Neo", "GT"];
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const model = models[Math.floor(Math.random() * models.length)];
    const androidVer = Math.floor(Math.random() * 6) + 10; // Phiên bản Android từ 10 đến 15

    // Sinh ngẫu nhiên sâu phiên bản Chrome để tạo ra hàng tỷ tổ hợp User-Agent không đụng hàng
    const chromeMajor = Math.floor(Math.random() * (128 - 110 + 1)) + 110;
    const chromeMinor = Math.floor(Math.random() * 5000) + 1000;
    const chromePatch = Math.floor(Math.random() * 200) + 10;

    const w = [360, 384, 393, 412][Math.floor(Math.random() * 4)];
    const h = [800, 854, 873, 915][Math.floor(Math.random() * 4)];

    return {
        name: `Android ${androidVer} | Chrome v${chromeMajor}.${chromeMinor}`,
        ua: `Mozilla/5.0 (Linux; Android ${androidVer}; ${brand} ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.${chromeMinor}.${chromePatch} Mobile Safari/537.36`,
        platform: "Linux aarch64",
        hardwareConcurrency: [4, 6, 8][Math.floor(Math.random() * 3)],
        deviceMemory: [4, 6, 8, 12][Math.floor(Math.random() * 4)],
        screenWidth: w,
        screenHeight: h,
        dsf: [2.0, 2.25, 2.5, 2.75, 3.0][Math.floor(Math.random() * 5)],
        webglVendor: "Qualcomm",
        webglRenderer: "Adreno (TM) " + ["610", "618", "620", "640", "650", "730", "740"][Math.floor(Math.random() * 7)]
    };
}

function generateStandardChromeProfile() {
    // Kịch bản 2: Chỉ lấy các máy nguyên bản, chuẩn và cao cấp nhất
    const devices = [
        { name: "SM-S928B", vendor: "Qualcomm", gpu: "Adreno (TM) 750" }, // S24 Ultra
        { name: "SM-S918B", vendor: "Qualcomm", gpu: "Adreno (TM) 740" }, // S23 Ultra
        { name: "SM-S908B", vendor: "Qualcomm", gpu: "Adreno (TM) 730" }, // S22 Ultra
        { name: "Pixel 8 Pro", vendor: "ARM", gpu: "Mali-G715" },
        { name: "Pixel 7", vendor: "ARM", gpu: "Mali-G710" }
    ];
    const dev = devices[Math.floor(Math.random() * devices.length)];
    const androidVer = Math.floor(Math.random() * 2) + 13; // Android 13 hoặc 14

    const chromeMajor = Math.floor(Math.random() * 6) + 120; // Chrome 120 - 125
    const chromeMinor = Math.floor(Math.random() * 5000) + 1000;
    const chromePatch = Math.floor(Math.random() * 200) + 10;

    return {
        name: `Chrome Chuẩn | ${dev.name} (v${chromeMajor}.${chromeMinor})`,
        ua: `Mozilla/5.0 (Linux; Android ${androidVer}; ${dev.name}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.${chromeMinor}.${chromePatch} Mobile Safari/537.36`,
        platform: "Linux aarch64",
        hardwareConcurrency: 8,
        deviceMemory: 8,
        screenWidth: [393, 412][Math.floor(Math.random() * 2)],
        screenHeight: [850, 915][Math.floor(Math.random() * 2)],
        dsf: [2.0, 2.5, 3.0][Math.floor(Math.random() * 3)],
        webglVendor: dev.vendor,
        webglRenderer: dev.gpu
    };
}

function updateUI(profile) {
    if (!document.getElementById('info-box')) return;
    document.getElementById('info-box').style.display = 'block';
    document.getElementById('current-device').textContent = profile.name + " (" + profile.platform + ")";
    document.getElementById('current-screen').textContent = profile.screenWidth + "x" + profile.screenHeight;
    document.getElementById('current-hw').textContent = profile.deviceMemory + "GB / " + profile.hardwareConcurrency + " Cores";
    document.getElementById('current-webgl').textContent = profile.webglVendor + " - " + profile.webglRenderer;

    let canvasStr = "R:" + (profile.canvasR || 0) + ", G:" + (profile.canvasG || 0) + ", B:" + (profile.canvasB || 0);
    let audioStr = (profile.audioNoise || 0).toFixed(7);
    document.getElementById('current-noise').textContent = "Canvas [" + canvasStr + "] | Audio [" + audioStr + "]";

    document.getElementById('current-ua').textContent = profile.ua;
}

document.getElementById('apply-btn').addEventListener('click', () => {
    const selected = document.getElementById('profile-select').value;
    let profile;
    if (selected === "random") profile = generateRandomProfile();
    else if (selected === "random_noise") profile = generateStandardChromeProfile();
    else {
        profile = JSON.parse(JSON.stringify(profiles[selected]));
        const chromeMinor = Math.floor(Math.random() * 5000) + 1000;
        const chromePatch = Math.floor(Math.random() * 200) + 10;
        profile.ua = profile.ua.replace(/\.0\.0\.0/g, `.0.${chromeMinor}.${chromePatch}`);
        profile.name = profile.name.replace(/\.0\.0\.0/g, `.0.${chromeMinor}`);
    }

    // Luôn luôn tạo nhiễu ngẫu nhiên để đảm bảo mỗi lần ấn tạo là ra một máy hoàn toàn độc nhất
    profile.canvasR = Math.floor(Math.random() * 10) - 5;
    if (profile.canvasR === 0) profile.canvasR = 1;
    profile.canvasG = Math.floor(Math.random() * 10) - 5;
    profile.canvasB = Math.floor(Math.random() * 10) - 5;
    profile.audioNoise = (Math.random() - 0.5) * 0.0001;
    if (profile.audioNoise === 0) profile.audioNoise = 0.00001;

    profile.colorDepth = 24;
    const match = profile.ua.match(/(?:Chrome|CriOS)\/(\d+)/);
    profile.chromeMajor = match ? match[1] : "120";
    profile.navigatorVendor = "Google Inc.";

    const btn = document.getElementById('apply-btn');
    const originalText = btn.textContent;
    btn.textContent = "[ ĐANG XÓA SẠCH COOKIE... ]";
    btn.style.background = "#ffb74d";
    btn.style.color = "#000";
    btn.disabled = true;

    // Gọi background xóa sạch Cookie, Cache, Storage trước khi đổi profile
    chrome.runtime.sendMessage({ type: "CLEAR_BROWSING_DATA" }, (response) => {
        chrome.storage.local.set({ spoofProfile: profile }, () => {
            updateUI(profile);
            chrome.runtime.sendMessage({ type: "UPDATE_RULES", profile: profile });

            btn.textContent = "[ THÀNH CÔNG - ĐÃ XÓA SẠCH DATA ]";
            btn.style.background = "#00FF41";
            btn.disabled = false;
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style = "";
            }, 3000);

            // Tự động tải lại tab hiện hành để trang web nhận diện danh tính mới ngay lập tức
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.reload(tabs[0].id);
            });
        });
    });
});

document.getElementById('crypto-settings-btn').addEventListener('click', () => {
    const box = document.getElementById('crypto-settings-box');
    if (box.style.display === 'none') {
        box.style.display = 'block';
        chrome.storage.local.get(['cryptoEmail', 'cryptoPass'], (data) => {
            if (data.cryptoEmail) document.getElementById('crypto-email').value = data.cryptoEmail;
            if (data.cryptoPass) document.getElementById('crypto-pass').value = data.cryptoPass;
        });
    } else {
        box.style.display = 'none';
    }
});

document.getElementById('save-crypto-btn').addEventListener('click', () => {
    const email = document.getElementById('crypto-email').value.trim();
    const pass = document.getElementById('crypto-pass').value.trim();
    chrome.storage.local.set({ cryptoEmail: email, cryptoPass: pass }, () => {
        const btn = document.getElementById('save-crypto-btn');
        const origText = btn.textContent;
        btn.textContent = "ĐÃ LƯU!";
        setTimeout(() => btn.textContent = origText, 2000);
    });
});

document.getElementById('crypto-btn').addEventListener('click', () => {
    chrome.storage.local.get(['cryptoEmail', 'cryptoPass'], (data) => {
        chrome.runtime.sendMessage({
            type: "OPEN_CRYPTO_LOGIN",
            creds: { email: data.cryptoEmail || "", pass: data.cryptoPass || "" }
        });
    });
});

// Gói logic khởi chạy App chính vào một hàm để gọi sau khi đăng nhập thành công
function loadMainApp() {
    chrome.storage.local.get(['spoofProfile'], (data) => {
        if (data.spoofProfile) {
            updateUI(data.spoofProfile);
        }
    });
}

// Bắt đầu quy trình kiểm tra bản quyền ngay khi mở Extension
initLicensing();