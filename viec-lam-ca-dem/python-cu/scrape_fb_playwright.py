import os
import time
from playwright.sync_api import sync_playwright

def scrape_facebook_jobs():
    # Đường dẫn đến profile Edge của bạn (nơi đã đăng nhập sẵn Facebook)
    user_data_dir = os.path.join(os.environ["LOCALAPPDATA"], "Microsoft", "Edge", "User Data")
    
    print("=== BẮT ĐẦU CÀO DỮ LIỆU TỪ TRÌNH DUYỆT ẨN ===")
    print(f"Đang sử dụng Profile: {user_data_dir}")
    print("Lưu ý: Bạn phải ĐÓNG HOÀN TOÀN trình duyệt Edge trước khi chạy script này để tránh lỗi 'Profile Locked'.")
    
    try:
        with sync_playwright() as p:
            # Khởi chạy Edge ở chế độ ẩn (headless=True) và dùng chung profile hiện tại
            browser = p.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                channel="msedge",
                headless=True,
                args=["--disable-blink-features=AutomationControlled"]
            )
            
            page = browser.new_page()
            
            print("[+] Đang truy cập Facebook...")
            # Truy cập thẳng vào trang tìm kiếm bài viết Facebook (giao diện mobile cho nhẹ)
            page.goto("https://m.facebook.com/search/posts/?q=việc%20làm%20ca%20đêm%20tphcm")
            
            # Đợi tải trang
            page.wait_for_timeout(5000)
            
            # Cuộn trang xuống vài lần để tải thêm kết quả
            for _ in range(3):
                page.keyboard.press("End")
                page.wait_for_timeout(2000)
            
            print("[+] Đang bóc tách dữ liệu...")
            # Facebook dùng nhiều thẻ div có thuộc tính data-sigil="story-div" cho bài đăng trên giao diện mobile
            posts = page.query_selector_all('div[data-sigil="story-div"]')
            
            results = []
            if not posts:
                # Fallback: Quét toàn bộ các thẻ p và span
                elements = page.query_selector_all('p, span, div[dir="auto"]')
                for el in elements:
                    text = el.inner_text().strip()
                    if len(text) > 30 and 'ca đêm' in text.lower():
                        if text not in results:
                            results.append(text)
            else:
                for post in posts:
                    text = post.inner_text().strip()
                    if len(text) > 10 and text not in results:
                        results.append(text)
                        
            print("\n=== KẾT QUẢ TÌM THẤY ===")
            if results:
                for i, res in enumerate(results[:15], 1):
                    # In ra 150 ký tự đầu tiên để xem qua
                    snippet = res[:250].replace('\n', ' ')
                    print(f"{i}. {snippet}...")
                    print("-" * 50)
                print(f"-> Đã cào được {len(results)} bài đăng thật từ Facebook của bạn.")
            else:
                print("-> Không lấy được bài đăng. Có thể bạn chưa đăng nhập Facebook trên Edge hoặc cấu trúc web đã đổi.")
                
            browser.close()
            
    except Exception as e:
        print("\n[LỖI THỰC THI]:", e)
        if "Target closed" in str(e) or "lock" in str(e).lower():
            print("\n=> NGUYÊN NHÂN: Trình duyệt Edge đang mở. Vui lòng tắt hoàn toàn Edge (tắt cả dưới thanh Taskbar/System Tray) rồi chạy lại.")

if __name__ == "__main__":
    scrape_facebook_jobs()
