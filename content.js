// Chạy sớm nhất có thể ngay khi document_start để kịp ghi đè API
chrome.storage.local.get(['spoofProfile'], (data) => {
    if (!data.spoofProfile) return;

    // Gửi data sang MAIN World thông qua CustomEvent để thực thi spoofing mà không cần tạo thẻ <script> (Bypass CSP)
    window.dispatchEvent(new CustomEvent("Bypass_SpoofProfile_Init", { detail: data.spoofProfile }));
});