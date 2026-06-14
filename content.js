// Chạy sớm nhất có thể ngay khi document_start để kịp ghi đè API

chrome.runtime.sendMessage({ type: "GET_VALIDATED_PROFILE" }, (response) => {
    if (!response || !response.profile) return;

    const profileStr = JSON.stringify(response.profile).replace(/</g, '\\u003c');

    window.dispatchEvent(new CustomEvent("Bypass_SpoofProfile_Init", { detail: JSON.parse(profileStr) }));
});