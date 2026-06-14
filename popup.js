// --- HỆ THỐNG BẢN QUYỀN KẾT NỐI VỚI GITHUB GIST CỦA ADMIN ---
const ONLINE_CONFIG_URL = "https://gist.githubusercontent.com/Donam-da/f7c09d917d09209b818bab60c42f2ca3/raw/config.json";
let currentMachineId = "";
let expiryInterval;

function getDeviceFingerprint() {
    // Thu thập các thông số phần cứng cố định của máy (giống như IMEI)
    const components = [
        navigator.hardwareConcurrency || 0, // Số nhân CPU
        navigator.deviceMemory || 0,        // Dung lượng RAM
        screen.width,                       // Chiều rộng màn hình
        screen.height,                      // Chiều cao màn hình
        screen.colorDepth,                  // Độ sâu màu
        navigator.platform || ""            // Nền tảng HĐH
    ];

    // Thu thập thông tin Card đồ họa (GPU) thực tế
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
                components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
            }
        }
    } catch (e) { }

    const rawId = components.join('|');

    // Thuật toán băm (Hash) thành một chuỗi mã máy cố định
    let hash = 0;
    for (let i = 0; i < rawId.length; i++) {
        const char = rawId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }

    // Sinh ra mã có tiền tố HW- (Hardware)
    return "HW-" + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
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

async function checkForUpdates() {
    try {
        // Tải config chứa thông tin bản cập nhật từ Gist (có thêm timestamp để chống cache)
        const res = await fetch("https://gist.githubusercontent.com/Donam-da/f7c09d917d09209b818bab60c42f2ca3/raw/ext_config.json?v=" + Date.now());
        const extConfig = await res.json();
        const currentVersion = chrome.runtime.getManifest().version;

        if (extConfig.latest_version && isNewerVersion(extConfig.latest_version, currentVersion)) {
            // Xoá giao diện hiện tại, hiển thị thông báo khóa App
            document.body.innerHTML = `
                <div style="padding: 30px; text-align: center; font-family: 'Consolas', monospace; height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #090e17; background-image: linear-gradient(rgba(0, 229, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.05) 1px, transparent 1px); background-size: 15px 15px; color: #c9d1d9;">
                    <div style="background: rgba(13, 20, 36, 0.8); border: 1px solid #1f2937; border-left: 4px solid #FF0055; border-radius: 8px; padding: 25px; width: 100%; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(5px);">
                        <h2 style="color: #FF0055; margin: 0 0 15px; font-size: 20px; letter-spacing: 1px; text-shadow: 0 0 10px rgba(255,0,85,0.4);">⚠️ YÊU CẦU CẬP NHẬT</h2>
                        <div style="display: flex; justify-content: space-between; background: rgba(0,0,0,0.4); border: 1px solid #1f2937; border-radius: 6px; padding: 12px; margin-bottom: 15px; font-size: 13px;">
                            <div style="text-align: left;">
                                <div style="color: #8b949e; font-size: 11px; margin-bottom: 5px;">Phiên bản hiện tại:</div>
                                <div style="color: #ffb74d; font-weight: bold; text-shadow: 0 0 5px rgba(255, 183, 77, 0.4);">v${currentVersion}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: #8b949e; font-size: 11px; margin-bottom: 5px;">Phiên bản mới nhất:</div>
                                <div style="color: #00FF41; font-weight: bold; text-shadow: 0 0 5px rgba(0, 255, 65, 0.4);">v${extConfig.latest_version}</div>
                            </div>
                        </div>
                        <div style="margin: 0 0 20px; padding: 12px; background: rgba(0, 229, 255, 0.05); border-left: 3px solid #00E5FF; color: #e0f2fe; font-size: 12px; text-align: left; white-space: pre-wrap; line-height: 1.5;">${extConfig.update_message || "Đã có bản cập nhật mới. Vui lòng tải về để tiếp tục sử dụng!"}</div>
                        <button id="btn-do-update" style="background: rgba(0, 229, 255, 0.1); color: #00E5FF; border: 1px solid #00E5FF; padding: 12px 20px; font-size: 14px; font-family: 'Consolas', monospace; font-weight: bold; cursor: pointer; border-radius: 6px; width: 100%; transition: all 0.3s;">
                        Tải Bản Cập Nhật Ngay
                    </button>
                    </div>
                </div>
            `;
            const btn = document.getElementById('btn-do-update');
            btn.addEventListener('mouseover', () => { btn.style.background = '#00E5FF'; btn.style.color = '#000'; btn.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.5)'; btn.style.transform = 'translateY(-2px)'; });
            btn.addEventListener('mouseout', () => { btn.style.background = 'rgba(0, 229, 255, 0.1)'; btn.style.color = '#00E5FF'; btn.style.boxShadow = 'none'; btn.style.transform = 'translateY(0)'; });
            document.getElementById('btn-do-update').addEventListener('click', () => {
                window.open(extConfig.update_link, '_blank');
            });
            return true;
        }
    } catch (e) {
        console.log("Lỗi kiểm tra cập nhật:", e);
    }
    return false;
}

function isNewerVersion(latest, current) {
    const v1 = latest.split('.').map(Number);
    const v2 = current.split('.').map(Number);
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
        const num1 = v1[i] || 0;
        const num2 = v2[i] || 0;
        if (num1 > num2) return true;
        if (num1 < num2) return false;
    }
    return false;
}

async function initLicensing() {
    // Kiểm tra bản cập nhật bắt buộc trước
    const hasUpdate = await checkForUpdates();
    if (hasUpdate) return; // Nếu có bản cập nhật mới, dừng tại đây để khóa App

    chrome.storage.local.get(['machineId', 'licenseKey'], async (data) => {
        // 1. Khởi tạo và lấy Mã Máy (HWID) dựa trên phần cứng (IMEI ảo)
        const hwFingerprint = getDeviceFingerprint();

        if (data.machineId && data.machineId === hwFingerprint) {
            currentMachineId = data.machineId;
        } else {
            currentMachineId = hwFingerprint;
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

function generateAndroidBuildId() {
    const buildPrefix = ["SKQ1", "TKQ1", "RKQ1", "SP1A", "TP1A", "UP1A", "RP1A"][Math.floor(Math.random() * 7)];
    const buildDate = `${Math.floor(Math.random() * 5 + 20)}${Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0')}${Math.floor(Math.random() * 28 + 1).toString().padStart(2, '0')}`;
    const buildSuffix = (Math.floor(Math.random() * 900) + 100).toString().padStart(3, '0');
    return `${buildPrefix}.${buildDate}.${buildSuffix}`;
}

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
        name: "Android 13.0.0 | Chrome v126.0.0.0",
        ua: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
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
        name: "Android 14 | Chrome v128 (Chuẩn LinkTot)",
        ua: "Mozilla/5.0 (Linux; Android 14; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
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
    const models = ["Pro", "Ultra", "Plus", "Max", "5G", "Pro+", "Lite", "FE", "Vision", "Power", "Neo", "GT", "Play", "Note", "Focus"];
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const model = models[Math.floor(Math.random() * models.length)];

    // Mở rộng dải Android để tăng số lượng tổ hợp
    const androidVer = Math.floor(Math.random() * 6) + 9; // Phiên bản Android từ 9 đến 14

    // FAKE PHIÊN BẢN CHROME SIÊU ĐA DẠNG: Từ v70 đến v135, sinh ra hàng chục triệu tổ hợp
    const chromeMajor = (Math.floor(Math.random() * 66) + 70).toString();
    const fullChromeVer = `${chromeMajor}.0.${Math.floor(Math.random() * 6000) + 2000}.${Math.floor(Math.random() * 300)}`;

    // KỊCH BẢN 1 (ALL BROWSER): Fake ngẫu nhiên cấu trúc của hàng chục loại trình duyệt (Dựa trên lõi Chromium)
    const browserTypes = ["Chrome", "Edge", "Opera", "Samsung"];
    const selectedBrowser = browserTypes[Math.floor(Math.random() * browserTypes.length)];

    let browserSuffix = `Chrome/${fullChromeVer} Mobile Safari/537.36`;
    let browserNameStr = `Chrome v${chromeMajor}`;

    if (selectedBrowser === "Edge") {
        browserSuffix = `Chrome/${fullChromeVer} Mobile Safari/537.36 EdgA/${fullChromeVer}`;
        browserNameStr = `Edge v${chromeMajor}`;
    } else if (selectedBrowser === "Opera") {
        const operaVer = Math.floor(Math.random() * 20) + 60; // Trình duyệt Opera Mobile có dải phiên bản riêng
        browserSuffix = `Chrome/${fullChromeVer} Mobile Safari/537.36 OPR/${operaVer}.0.0.0`;
        browserNameStr = `Opera v${operaVer}`;
    } else if (selectedBrowser === "Samsung") {
        const ssVer = Math.floor(Math.random() * 10) + 15; // Samsung Internet có dải phiên bản riêng
        browserSuffix = `Chrome/${fullChromeVer} Mobile Safari/537.36 SamsungBrowser/${ssVer}.0`;
        browserNameStr = `Samsung Internet v${ssVer}`;
    }

    const buildId = generateAndroidBuildId();
    let ua = `Mozilla/5.0 (Linux; Android ${androidVer}; ${brand} ${model} Build/${buildId}) AppleWebKit/537.36 (KHTML, like Gecko) ${browserSuffix}`;

    const w = [360, 384, 393, 412, 428][Math.floor(Math.random() * 5)];
    const h = [800, 854, 873, 892, 915, 926][Math.floor(Math.random() * 6)];

    return {
        name: `Android ${androidVer} | ${browserNameStr}`,
        ua: ua,
        platform: "Linux aarch64",
        hardwareConcurrency: [4, 6, 8][Math.floor(Math.random() * 3)],
        deviceMemory: [4, 6, 8, 12][Math.floor(Math.random() * 4)],
        screenWidth: w,
        screenHeight: h,
        dsf: [2.0, 2.25, 2.5, 2.75, 3.0, 3.5][Math.floor(Math.random() * 6)],
        webglVendor: "Qualcomm",
        webglRenderer: "Adreno (TM) " + ["610", "618", "620", "640", "650", "730", "740", "750"][Math.floor(Math.random() * 8)],
        fullChromeVer: fullChromeVer
    };
}

function generateStandardChromeProfile() {
    // Kịch bản 2: Sinh ngẫu nhiên hàng tỷ cấu hình nhưng 100% là CHROME và MÁY CHUẨN
    const samsungSeries = ["S928", "S926", "S921", "S918", "S916", "S911", "S908", "S906", "S901", "A556", "A546", "A536", "A346", "A736"];
    const samsungSuffix = ["B", "U", "U1", "W", "N", "0", "E"];
    const pixelModels = ["Pixel 6", "Pixel 6 Pro", "Pixel 6a", "Pixel 7", "Pixel 7 Pro", "Pixel 7a", "Pixel 8", "Pixel 8 Pro", "Pixel 8a", "Pixel 9", "Pixel 9 Pro"];

    let devName = "";
    let vendor = "";
    let gpu = "";

    // Ghép nối tự động thiết bị phần cứng
    if (Math.random() > 0.4) {
        const series = samsungSeries[Math.floor(Math.random() * samsungSeries.length)];
        const suffix = samsungSuffix[Math.floor(Math.random() * samsungSuffix.length)];
        devName = `SM-${series}${suffix}`;
        vendor = "Qualcomm";
        if (series.includes("S92")) gpu = "Adreno (TM) 750";
        else if (series.includes("S91")) gpu = "Adreno (TM) 740";
        else if (series.includes("S90")) gpu = "Adreno (TM) 730";
        else gpu = "Adreno (TM) " + ["618", "642L", "644"][Math.floor(Math.random() * 3)];
    } else {
        devName = pixelModels[Math.floor(Math.random() * pixelModels.length)];
        vendor = "ARM";
        if (devName.includes("8") || devName.includes("9")) gpu = "Mali-G715";
        else if (devName.includes("7")) gpu = "Mali-G710";
        else gpu = "Mali-G78";
    }

    const androidVer = Math.floor(Math.random() * 4) + 11; // Rải đều Android từ 11 đến 14

    // ĐỒNG BỘ ENGINE: LinkTot soi Feature Detection rất gắt.
    // Bắt buộc lấy Phiên bản lõi thật để không mâu thuẫn API, lấy ĐÚNG số Build thật để không bị lộ.
    const realUaMatch = navigator.userAgent.match(/Chrome\/([0-9.]+)/);
    let fullChromeVer = "";
    let chromeMajor = "128";
    if (realUaMatch) {
        fullChromeVer = realUaMatch[1];
        chromeMajor = fullChromeVer.split('.')[0];
    } else {
        chromeMajor = (Math.floor(Math.random() * 10) + 120).toString();
        fullChromeVer = `${chromeMajor}.0.${Math.floor(Math.random() * 6000) + 2000}.${Math.floor(Math.random() * 300)}`;
    }

    const buildId = generateAndroidBuildId();

    return {
        name: `Chrome Chuẩn | ${devName} (Build/${buildId.split('.')[0]})`,
        ua: `Mozilla/5.0 (Linux; Android ${androidVer}; ${devName} Build/${buildId}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${fullChromeVer} Mobile Safari/537.36`,
        platform: "Linux aarch64",
        hardwareConcurrency: [4, 6, 8][Math.floor(Math.random() * 3)],
        deviceMemory: [4, 6, 8, 12][Math.floor(Math.random() * 4)],
        screenWidth: [384, 393, 412][Math.floor(Math.random() * 3)],
        screenHeight: [850, 873, 892, 915][Math.floor(Math.random() * 4)],
        dsf: [2.0, 2.5, 3.0, 3.5][Math.floor(Math.random() * 4)],
        webglVendor: vendor,
        webglRenderer: gpu,
        fullChromeVer: fullChromeVer
    };
}

function generateWindowsProfile() {
    // ĐỒNG BỘ ENGINE CHO KỊCH BẢN WINDOWS PC: Dùng CHÍNH XÁC chuỗi phiên bản Chrome thật của trình duyệt hiện tại
    const realUaMatch = navigator.userAgent.match(/Chrome\/([0-9.]+)/);
    let fullChromeVer = "";
    let chromeMajor = "128";
    if (realUaMatch) {
        fullChromeVer = realUaMatch[1];
        chromeMajor = fullChromeVer.split('.')[0];
    } else {
        chromeMajor = (Math.floor(Math.random() * 6) + 125).toString();
        fullChromeVer = `${chromeMajor}.0.${Math.floor(Math.random() * 500) + 6000}.${Math.floor(Math.random() * 100) + 50}`;
    }

    const w = [1366, 1600, 1920, 2560][Math.floor(Math.random() * 4)];
    const h = w === 1366 ? 768 : w === 1600 ? 900 : w === 1920 ? 1080 : 1440;

    return {
        name: `Windows PC | Chrome v${chromeMajor}`,
        ua: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${fullChromeVer} Safari/537.36`,
        platform: "Win32",
        hardwareConcurrency: [4, 6, 8, 12, 16][Math.floor(Math.random() * 5)],
        deviceMemory: [8, 16, 32][Math.floor(Math.random() * 3)],
        screenWidth: w,
        screenHeight: h,
        dsf: [1.0, 1.25, 1.5][Math.floor(Math.random() * 3)]
        // CHÚ Ý: Cố tình KHÔNG truyền webglVendor và webglRenderer để lấy GPU thật của PC vượt Cloudflare
        , fullChromeVer: fullChromeVer
    };
}

function generateKiwiProfile() {
    const originalUa = navigator.userAgent;
    const realUaMatch = originalUa.match(/Chrome\/([0-9.]+)/);
    const chromeMajor = realUaMatch ? realUaMatch[1].split('.')[0] : "128";
    const fullChromeVer = realUaMatch ? `${chromeMajor}.0.${Math.floor(Math.random() * 6000) + 2000}.${Math.floor(Math.random() * 300)}` : "128.0.6000.0";

    const w = [360, 384, 393, 412, 428][Math.floor(Math.random() * 5)];
    const h = [800, 854, 873, 892, 915, 926][Math.floor(Math.random() * 6)];

    let vendor = "Qualcomm";
    let gpu = "Adreno (TM) " + ["610", "618", "620", "640", "650", "730", "740", "750"][Math.floor(Math.random() * 8)];
    if (Math.random() > 0.7) {
        vendor = "ARM";
        gpu = "Mali-G7" + ["10", "15", "8"][Math.floor(Math.random() * 3)];
    }

    const brands = ["Xiaomi", "Oppo", "Vivo", "Realme", "OnePlus", "Motorola", "Samsung"];
    const models = ["Pro", "Ultra", "Plus", "Max", "5G", "Lite", "FE"];
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const model = models[Math.floor(Math.random() * models.length)];
    const androidVer = Math.floor(Math.random() * 6) + 9;

    const buildId = generateAndroidBuildId();

    // Thay thế Tên máy, HĐH và nhét thêm mã Build vào User-Agent gốc (Giữ nguyên lõi Chrome)
    let newUa = originalUa.replace(/\(Linux; Android [^;]+; [^)]+\)/, `(Linux; Android ${androidVer}; ${brand} ${model} Build/${buildId})`);
    if (newUa === originalUa) {
        newUa = `Mozilla/5.0 (Linux; Android ${androidVer}; ${brand} ${model} Build/${buildId}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${fullChromeVer} Mobile Safari/537.36`;
    }

    return {
        name: `Kiwi Mobile | ${brand} (Build/${buildId.split('.')[0]})`,
        ua: newUa,
        platform: navigator.platform,
        hardwareConcurrency: [4, 6, 8][Math.floor(Math.random() * 3)],
        deviceMemory: [4, 6, 8, 12][Math.floor(Math.random() * 4)],
        screenWidth: w,
        screenHeight: h,
        dsf: [2.0, 2.25, 2.5, 2.75, 3.0, 3.5][Math.floor(Math.random() * 6)],
        webglVendor: vendor,
        webglRenderer: gpu,
        isKiwi: true,
        fullChromeVer: fullChromeVer
    };
}

function updateUI(profile) {
    // Đã ẩn tính năng hiển thị thông số thiết bị do không còn cần thiết
}

document.getElementById('apply-btn').addEventListener('click', () => {
    const selected = document.getElementById('profile-select').value;
    let profile;
    if (selected === "random") profile = generateRandomProfile();
    else if (selected === "random_noise") profile = generateStandardChromeProfile();
    else if (selected === "windows_pc") profile = generateWindowsProfile();
    else if (selected === "random_kiwi") profile = generateKiwiProfile();
    else {
        profile = JSON.parse(JSON.stringify(profiles[selected]));
        const realUaMatch = navigator.userAgent.match(/Chrome\/([0-9.]+)/);
        const chromeMajor = realUaMatch ? realUaMatch[1] : "128";
        const fullChromeVer = `${chromeMajor}.0.${Math.floor(Math.random() * 6000) + 2000}.${Math.floor(Math.random() * 300)}`;
        profile.ua = profile.ua.replace(/Chrome\/\d+\.0\.0\.0/, `Chrome/${fullChromeVer}`);
        profile.name = profile.name.replace(/Chrome v\d+\.0\.0\.0/, `Chrome v${chromeMajor}`);
        profile.fullChromeVer = fullChromeVer;
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
    btn.textContent = "WAIT...";
    btn.style.background = "#ffb74d";
    btn.style.color = "#000";
    btn.disabled = true;

    // Gọi background xóa sạch Cookie, Cache, Storage trước khi đổi profile
    chrome.runtime.sendMessage({ type: "CLEAR_BROWSING_DATA" }, (response) => {
        chrome.storage.local.set({ spoofProfile: profile }, () => {
            updateUI(profile);
            chrome.runtime.sendMessage({ type: "UPDATE_RULES", profile: profile });

            btn.textContent = "Success";
            btn.style.background = "#00FF41";
            btn.disabled = false;
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style = "";
            }, 1000); // Rút ngắn thời gian chờ hiển thị Success xuống còn 1 giây (1000ms)

            // Tự động tải lại tab hiện hành để trang web nhận diện danh tính mới ngay lập tức
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) chrome.tabs.reload(tabs[0].id);
            });
        });
    });
});

document.getElementById('crypto-settings-btn').addEventListener('click', () => {
    const box = document.getElementById('crypto-settings-box');
    if (box.style.display === 'none' || box.style.display === '') {
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