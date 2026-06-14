import os
import json
import requests
import zipfile
import threading
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext, filedialog

# ID của Gist chứa file config.json của bạn
GIST_ID = "f7c09d917d09209b818bab60c42f2ca3"
TOKEN_FILE = "admin_token.txt"
# Repository Public của bạn trên GitHub để chứa file ZIP Update
# Link của bạn: https://github.com/Donam-da/extensionbrowser
GITHUB_REPO = "Donam-da/extensionbrowser"

class AdminUpdaterGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Quản Lý Cập Nhật Extension VIP")
        self.root.geometry("620x580")
        
        style = ttk.Style()
        try: style.theme_use('clam')
        except: pass
        
        # --- TOP FRAME: THÔNG TIN ---
        frame_info = ttk.LabelFrame(root, text=" Cấu hình & Phiên bản ", padding=10)
        frame_info.pack(fill="x", padx=10, pady=10)
        
        ttk.Label(frame_info, text="Mã Token GitHub:").grid(row=0, column=0, sticky="w", pady=5)
        self.token_entry = ttk.Entry(frame_info, width=50)
        self.token_entry.grid(row=0, column=1, padx=5, pady=5)
        
        self.btn_save_token = ttk.Button(frame_info, text="Lưu Token", command=self.save_token)
        self.btn_save_token.grid(row=0, column=2, padx=5, pady=5)
        
        ttk.Label(frame_info, text="Phiên bản hiện tại:").grid(row=1, column=0, sticky="w", pady=5)
        self.lbl_current_version = ttk.Label(frame_info, text="Đang tải...", foreground="blue", font=("", 10, "bold"))
        self.lbl_current_version.grid(row=1, column=1, sticky="w", padx=5, pady=5)
        
        ttk.Label(frame_info, text="Phiên bản MỚI:").grid(row=2, column=0, sticky="w", pady=5)
        self.new_version_entry = ttk.Entry(frame_info, width=20)
        self.new_version_entry.grid(row=2, column=1, sticky="w", padx=5, pady=5)
        
        ttk.Label(frame_info, text="File ZIP tải lên:").grid(row=3, column=0, sticky="w", pady=5)
        frame_zip = ttk.Frame(frame_info)
        frame_zip.grid(row=3, column=1, columnspan=2, sticky="we", padx=5)
        
        self.zip_path_entry = ttk.Entry(frame_zip, width=38)
        self.zip_path_entry.pack(side="left", fill="x", expand=True)
        
        self.btn_browse = ttk.Button(frame_zip, text="Chọn File", command=self.browse_zip)
        self.btn_browse.pack(side="left", padx=(5, 0))
        
        # --- MIDDLE FRAME: GHI CHÚ ---
        frame_notes = ttk.LabelFrame(root, text=" Ghi chú cập nhật (Sẽ hiện trên màn hình khách) ", padding=10)
        frame_notes.pack(fill="x", padx=10, pady=5)
        
        self.notes_text = tk.Text(frame_notes, height=4, width=65, font=("Consolas", 10))
        self.notes_text.pack(fill="x")
        
        # --- ACTION BUTTON ---
        self.btn_release = tk.Button(root, text="🚀 PHÁT HÀNH BẢN CẬP NHẬT", bg="#E53935", fg="white", font=("Arial", 12, "bold"), height=2, cursor="hand2", command=self.start_update)
        self.btn_release.pack(fill="x", padx=10, pady=10)
        
        # --- BOTTOM FRAME: LOG ---
        frame_log = ttk.LabelFrame(root, text=" Nhật ký hệ thống ", padding=5)
        frame_log.pack(fill="both", expand=True, padx=10, pady=5)
        
        self.log_area = scrolledtext.ScrolledText(frame_log, height=10, bg="#0D1117", fg="#00FF41", font=("Consolas", 9))
        self.log_area.pack(fill="both", expand=True)
        
        self.load_initial_data()
        
    def log(self, message):
        self.root.after(0, self._append_log, message)
        
    def _append_log(self, message):
        self.log_area.insert(tk.END, message + "\n")
        self.log_area.see(tk.END)
        
    def load_initial_data(self):
        if os.path.exists(TOKEN_FILE):
            with open(TOKEN_FILE, "r", encoding="utf-8") as f:
                token = f.read().strip()
                if token: self.token_entry.insert(0, token)
        
        if os.path.exists("manifest.json"):
            try:
                with open("manifest.json", "r", encoding="utf-8") as f:
                    manifest = json.load(f)
                    cur_v = manifest.get("version", "1.0")
                    self.lbl_current_version.config(text=f"v{cur_v}")
                    
                    # Tự động gợi ý phiên bản mới (VD: 1.0 -> 1.1)
                    parts = cur_v.split('.')
                    if len(parts) > 1 and parts[-1].isdigit():
                        parts[-1] = str(int(parts[-1]) + 1)
                        self.new_version_entry.insert(0, ".".join(parts))
                    else:
                        self.new_version_entry.insert(0, cur_v + ".1")
            except Exception as e:
                self.log(f"[-] Lỗi đọc manifest.json: {e}")
        else:
            self.log("[-] Không tìm thấy file manifest.json trong thư mục!")
            
    def browse_zip(self):
        file_path = filedialog.askopenfilename(
            title="Chọn file ZIP bản cập nhật", 
            filetypes=[("ZIP files", "*.zip"), ("All files", "*.*")]
        )
        if file_path:
            self.zip_path_entry.delete(0, tk.END)
            self.zip_path_entry.insert(0, file_path)

    def save_token(self):
        token = self.token_entry.get().strip()
        with open(TOKEN_FILE, "w", encoding="utf-8") as f:
            f.write(token)
        messagebox.showinfo("Thành công", "Đã lưu Token GitHub!")
        self.log("[+] Đã lưu Token mới.")

    def start_update(self):
        token = self.token_entry.get().strip()
        new_version = self.new_version_entry.get().strip()
        update_message = self.notes_text.get("1.0", tk.END).strip()
        zip_path = self.zip_path_entry.get().strip()
        
        if not token:
            messagebox.showerror("Lỗi", "Vui lòng nhập Token GitHub!")
            return
        if not new_version:
            messagebox.showerror("Lỗi", "Vui lòng nhập số phiên bản mới!")
            return
        if not zip_path or not os.path.exists(zip_path):
            messagebox.showerror("Lỗi", "Vui lòng chọn file ZIP hợp lệ!")
            return
            
        # Khóa nút bấm để tránh double-click
        self.btn_release.config(state="disabled", bg="#7f8c8d", text="⏳ ĐANG XỬ LÝ...")
        self.log("="*60)
        self.log(f"[*] BẮT ĐẦU QUÁ TRÌNH PHÁT HÀNH BẢN v{new_version}")
        
        # Đưa tiến trình nặng chạy ngầm bằng Thread để không bị đơ giao diện
        threading.Thread(target=self.process_update, args=(token, new_version, update_message, zip_path), daemon=True).start()

    def process_update(self, token, new_version, update_message, zip_path):
        try:
            # --- KIỂM TRA ĐỒNG BỘ VERSION TRONG FILE ZIP ---
            try:
                with zipfile.ZipFile(zip_path, 'r') as z:
                    if "manifest.json" in z.namelist():
                        with z.open("manifest.json") as mf:
                            manifest_data = json.loads(mf.read().decode('utf-8'))
                            zip_version = manifest_data.get("version")
                            if str(zip_version) != str(new_version):
                                self.log(f"[-] LỖI TỪ CHỐI: Nhập v{new_version} nhưng file ZIP chứa v{zip_version}!")
                                self.root.after(0, lambda: messagebox.showerror(
                                    "Lỗi Sai Lệch Phiên Bản", 
                                    f"Số phiên bản bạn nhập: {new_version}\nNhưng bên trong file ZIP lại là: {zip_version}\n\nNếu tiếp tục, khách hàng sẽ bị kẹt trong vòng lặp cập nhật vô tận!\n\nCÁCH SỬA:\n1. Mở file manifest.json sửa 'version' thành {new_version}.\n2. Nén lại thành file ZIP mới.\n3. Chọn lại file ZIP mới đó và phát hành."
                                ))
                                return
                    else:
                        self.log("[-] Cảnh báo: Không tìm thấy file manifest.json bên trong file ZIP này!")
            except Exception as e:
                self.log(f"[-] Lỗi đọc file ZIP: {str(e)}")
                return
            # -----------------------------------------------

            zip_filename = os.path.basename(zip_path)
            self.log(f"[*] Kích thước tệp Zip: {os.path.getsize(zip_path) / 1024:.2f} KB")
            
            # 3. Upload to GitHub Releases
            self.log(f"[*] 1/2 Đang kết nối GitHub và Upload file {zip_filename}...")
            headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
            release_data = {"tag_name": f"v{new_version}", "name": f"Bản cập nhật v{new_version}", "body": update_message}
            
            res_release = requests.post(f"https://api.github.com/repos/{GITHUB_REPO}/releases", headers=headers, json=release_data)
            if res_release.status_code != 201:
                err_handled = False
                try:
                    err_data = res_release.json()
                    if err_data.get("errors") and err_data["errors"][0].get("code") == "already_exists":
                        self.log(f"[*] Cảnh báo: Phiên bản v{new_version} ĐÃ TỒN TẠI trên GitHub.")
                        self.log(f"[*] Hệ thống đang tự động XÓA bản cũ để GHI ĐÈ bản mới...")
                        
                        # 1. Tìm và xóa Release cũ
                        get_rel = requests.get(f"https://api.github.com/repos/{GITHUB_REPO}/releases/tags/v{new_version}", headers=headers)
                        if get_rel.status_code == 200:
                            rel_id = get_rel.json().get("id")
                            requests.delete(f"https://api.github.com/repos/{GITHUB_REPO}/releases/{rel_id}", headers=headers)
                        
                        # 2. Xóa thẻ Tag cũ
                        requests.delete(f"https://api.github.com/repos/{GITHUB_REPO}/git/refs/tags/v{new_version}", headers=headers)
                        
                        # 3. Tạo lại Release mới
                        res_release = requests.post(f"https://api.github.com/repos/{GITHUB_REPO}/releases", headers=headers, json=release_data)
                        if res_release.status_code == 201:
                            self.log(f"[+] Đã ghi đè Release cũ thành công!")
                            err_handled = True
                except Exception:
                    pass
                
                if not err_handled:
                    self.log(f"[-] LỖI Tạo Release! Kiểm tra lại Token hoặc Repo: {res_release.text}")
                    return
                
            upload_url = res_release.json()["upload_url"].split("{")[0] + f"?name={zip_filename}"
            headers_zip = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "Content-Type": "application/zip"}
            
            with open(zip_path, "rb") as f:
                res_upload = requests.post(upload_url, headers=headers_zip, data=f)
                
            if res_upload.status_code != 201:
                self.log(f"[-] LỖI Upload ZIP: {res_upload.text}")
                return
                
            update_link = res_upload.json()["browser_download_url"]
            self.log(f"[+] Đã có Link Direct Download: {update_link}")
            
            # 2. Update Gist
            self.log("[*] 2/2 Đang phát lệnh khóa App cũ lên Gist Server...")
            gist_url = f"https://api.github.com/gists/{GIST_ID}"
            response = requests.get(gist_url, headers=headers)
            if response.status_code != 200:
                self.log(f"[-] LỖI đọc Gist: {response.text}")
                return
                
            gist_data = response.json()
            if "ext_config.json" not in gist_data["files"]:
                self.log("[-] LỖI: Không tìm thấy 'ext_config.json' trên Gist.")
                return
                
            config = json.loads(gist_data["files"]["ext_config.json"]["content"])
            config["latest_version"] = new_version
            config["update_link"] = update_link
            config["update_message"] = update_message
            
            patch_data = {"files": {"ext_config.json": {"content": json.dumps(config, indent=4, ensure_ascii=False)}}}
            patch_res = requests.patch(gist_url, headers=headers, json=patch_data)
            
            if patch_res.status_code == 200:
                self.log("\n[✔] HOÀN TẤT! CÁC MÁY KHÁCH SẼ BỊ ÉP UPDATE NGAY LẬP TỨC.")
                messagebox.showinfo("Hoàn Tất", f"Đã phát hành thành công bản cập nhật v{new_version}!")
            else:
                self.log(f"[-] LỖI cập nhật Gist: {patch_res.text}")
                
        except Exception as e:
            self.log(f"[-] Lỗi hệ thống: {str(e)}")
        finally:
            # Mở khóa lại giao diện khi chạy xong
            self.root.after(0, lambda: self.btn_release.config(state="normal", bg="#E53935", text="🚀 PHÁT HÀNH BẢN CẬP NHẬT"))
            self.root.after(0, lambda: self.lbl_current_version.config(text=f"v{new_version}"))

if __name__ == "__main__":
    root = tk.Tk()
    app = AdminUpdaterGUI(root)
    root.mainloop()