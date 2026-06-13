// Chạy sớm nhất có thể ngay khi document_start để kịp ghi đè API
chrome.runtime.sendMessage({ type: "GET_VALIDATED_PROFILE" }, (response) => {
    if (!response || !response.profile) return;

    const profileStr = JSON.stringify(response.profile).replace(/</g, '\\u003c');

    try {
        const script = document.createElement('script');
        script.id = 'spoof-profile-data';
        script.type = 'application/json';
        script.textContent = profileStr;
        const root = document.head || document.documentElement || document;
        root.appendChild(script);
    } catch (e) { }

    window.dispatchEvent(new CustomEvent("Bypass_SpoofProfile_Init", { detail: profileStr }));
});