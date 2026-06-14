import os
import json
import requests
import zipfile
import threading
import tkinter as tk
from tkinter import messagebox, scrolledtext, filedialog

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
        self.root.geometry("700x780")
        self.root.configure(bg="#0D1117")
        self.root.resizable(False, False)
        
        # --- THIẾT LẬP GIAO DIỆN (THEME) ---
        bg_main = "#0D1117"
        bg_panel = "#161b22"
        fg_text = "#c9d1d9"
        border_col = "#30363d"
        font_title = ("Segoe UI", 11, "bold")
        font_normal = ("Segoe UI", 10)
        font_code = ("Consolas", 10)
        
        def create_panel(parent, title):
            panel = tk.Frame(parent, bg=bg_panel, highlightbackground=border_col, highlightthickness=1)
            title_frame = tk.Frame(panel, bg="#21262d")
            title_frame.pack(fill="x")
            lbl = tk.Label(title_frame, text=title, bg="#21262d", fg="#58a6ff", font=font_title, anchor="w")
            lbl.pack(side="left", padx=15, pady=8)
            content = tk.Frame(panel, bg=bg_panel)
            content.pack(fill="both", expand=True, padx=20, pady=15)
            return panel, content
            
        def create_button(parent, text, command, bg="#1f6feb", hover_bg="#388bfd", fg="#ffffff", font=font_normal):
            btn = tk.Button(parent, text=text, command=command, bg=bg, fg=fg, font=font,
                            relief="flat", cursor="hand2", activebackground=hover_bg, activeforeground=fg, bd=0, padx=15, pady=6)
            btn.bind("<Enter>", lambda e: btn.config(bg=hover_bg) if btn['state'] != 'disabled' else None)
            btn.bind("<Leave>", lambda e: btn.config(bg=bg) if btn['state'] != 'disabled' else None)
            return btn
            
        def create_entry(parent, width=50):
            frame = tk.Frame(parent, bg=bg_main, highlightbackground=border_col, highlightthickness=1)
            entry = tk.Entry(frame, bg=bg_main, fg=fg_text, font=font_normal, relief="flat", insertbackground=fg_text, width=width)
            entry.pack(fill="both", expand=True, padx=8, pady=6)
            return frame, entry

        # --- HEADER ---
        header_frame = tk.Frame(root, bg=bg_main)
        header_frame.pack(fill="x", pady=(20, 10))
        tk.Label(header_frame, text="HỆ THỐNG PHÁT HÀNH BẢN CẬP NHẬT", bg=bg_main, fg="#00E5FF", font=("Segoe UI", 16, "bold")).pack()
        tk.Label(header_frame, text="Quản lý và đẩy phiên bản mới cho người dùng", bg=bg_main, fg="#8b949e", font=("Segoe UI", 10)).pack()
        
        # --- PANEL 1: THÔNG TIN ---
        panel1, p1_content = create_panel(root, "Cấu hình & Phiên bản")
        panel1.pack(fill="x", padx=25, pady=10)
        
        p1_content.columnconfigure(1, weight=1)
        
        tk.Label(p1_content, text="Mã Token GitHub:", bg=bg_panel, fg=fg_text, font=font_normal).grid(row=0, column=0, sticky="w", pady=8)
        _, self.token_entry = create_entry(p1_content, width=40)
        _.grid(row=0, column=1, padx=(15, 10), pady=8, sticky="we")
        self.btn_save_token = create_button(p1_content, "Lưu Token", self.save_token)
        self.btn_save_token.grid(row=0, column=2, sticky="e")
        
        tk.Label(p1_content, text="Phiên bản hiện tại:", bg=bg_panel, fg=fg_text, font=font_normal).grid(row=1, column=0, sticky="w", pady=8)
        self.lbl_current_version = tk.Label(p1_content, text="Đang tải...", bg=bg_panel, fg="#00FF41", font=("Segoe UI", 11, "bold"))
        self.lbl_current_version.grid(row=1, column=1, sticky="w", padx=15, pady=8)
        
        tk.Label(p1_content, text="Phiên bản MỚI:", bg=bg_panel, fg=fg_text, font=font_normal).grid(row=2, column=0, sticky="w", pady=8)
        _, self.new_version_entry = create_entry(p1_content, width=20)
        _.grid(row=2, column=1, sticky="w", padx=(15, 10), pady=8)
        
        tk.Label(p1_content, text="File ZIP tải lên:", bg=bg_panel, fg=fg_text, font=font_normal).grid(row=3, column=0, sticky="w", pady=8)
        frame_zip = tk.Frame(p1_content, bg=bg_panel)
        frame_zip.grid(row=3, column=1, columnspan=2, sticky="we", padx=(15, 0), pady=8)
        
        _, self.zip_path_entry = create_entry(frame_zip, width=32)
        _.pack(side="left", fill="x", expand=True)
        self.btn_browse = create_button(frame_zip, "Chọn File", self.browse_zip, bg="#238636", hover_bg="#2ea043")
        self.btn_browse.pack(side="left", padx=(10, 0))
        
        # --- MIDDLE FRAME: GHI CHÚ ---
        panel2, p2_content = create_panel(root, "Ghi chú cập nhật (Sẽ hiện trên màn hình khách)")
        panel2.pack(fill="x", padx=25, pady=5)
        
        frame_text = tk.Frame(p2_content, bg=bg_main, highlightbackground=border_col, highlightthickness=1)
        frame_text.pack(fill="x")
        self.notes_text = tk.Text(frame_text, height=4, font=font_code, bg=bg_main, fg=fg_text, relief="flat", insertbackground=fg_text)
        self.notes_text.pack(fill="x", padx=8, pady=8)
        
        # --- ACTION BUTTON ---
        self.btn_release = create_button(root, "🚀 PHÁT HÀNH BẢN CẬP NHẬT", self.start_update, bg="#E53935", hover_bg="#ef5350", font=("Segoe UI", 13, "bold"))
        self.btn_release.config(pady=12)
        self.btn_release.pack(fill="x", padx=25, pady=10)
        
        # --- BOTTOM FRAME: LOG ---
        panel3, p3_content = create_panel(root, "Nhật ký hệ thống")
        panel3.pack(fill="both", expand=True, padx=25, pady=(5, 25))
        
        frame_log = tk.Frame(p3_content, bg=bg_main, highlightbackground=border_col, highlightthickness=1)
        frame_log.pack(fill="both", expand=True)
        self.log_area = scrolledtext.ScrolledText(frame_log, height=8, bg=bg_main, fg="#00FF41", font=font_code, relief="flat", insertbackground=fg_text)
        self.log_area.pack(fill="both", expand=True, padx=5, pady=5)
        
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