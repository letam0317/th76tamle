import os
import shutil
import sqlite3
import json
import base64
import requests
from bs4 import BeautifulSoup
import win32crypt
from Cryptodome.Cipher import AES

def get_encryption_key(local_state_path):
    with open(local_state_path, "r", encoding="utf-8") as f:
        local_state = f.read()
        local_state = json.loads(local_state)
    key = base64.b64decode(local_state["os_crypt"]["encrypted_key"])
    key = key[5:]
    return win32crypt.CryptUnprotectData(key, None, None, None, 0)[1]

def decrypt_data(data, key):
    try:
        iv = data[3:15]
        data = data[15:]
        cipher = AES.new(key, AES.MODE_GCM, iv)
        return cipher.decrypt(data)[:-16].decode()
    except:
        try:
            return str(win32crypt.CryptUnprotectData(data, None, None, None, 0)[1])
        except:
            return ""

def get_fb_cookies():
    edge_user_data = os.path.join(os.environ["LOCALAPPDATA"], "Microsoft", "Edge", "User Data")
    local_state_path = os.path.join(edge_user_data, "Local State")
    cookie_db_path = os.path.join(edge_user_data, "Default", "Network", "Cookies")
    
    if not os.path.exists(cookie_db_path):
        # check profile 1, etc
        cookie_db_path = os.path.join(edge_user_data, "Profile 1", "Network", "Cookies")
        if not os.path.exists(cookie_db_path):
            print("Could not find Edge cookies database.")
            return None

    # Copy to avoid locking
    temp_db = "temp_cookies.db"
    shutil.copy2(cookie_db_path, temp_db)
    
    key = get_encryption_key(local_state_path)
    conn = sqlite3.connect(temp_db)
    cursor = conn.cursor()
    cursor.execute("SELECT host_key, name, encrypted_value FROM cookies WHERE host_key LIKE '%facebook.com%'")
    
    cookies = {}
    for host_key, name, encrypted_value in cursor.fetchall():
        val = decrypt_data(encrypted_value, key)
        cookies[name] = val
        
    conn.close()
    if os.path.exists(temp_db):
        os.remove(temp_db)
        
    return cookies

def scrape():
    print("Extracting cookies from Edge...")
    cookies = get_fb_cookies()
    if not cookies or 'c_user' not in cookies:
        print("Facebook cookies not found or you are not logged in.")
        return
        
    print(f"Loaded {len(cookies)} Facebook cookies. Logged in user: {cookies.get('c_user')}")
    
    url = "https://m.facebook.com/search/posts/?q=vi%E1%BB%87c%20l%C3%A0m%20ca%20%C4%91%C3%AAm"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    print("Fetching posts from Facebook...")
    res = requests.get(url, cookies=cookies, headers=headers)
    
    soup = BeautifulSoup(res.text, 'html.parser')
    
    # Try finding typical post structures in mobile web
    # mobile Facebook uses various obfuscated classes, but text is usually in <p> or <span>
    posts = []
    
    for div in soup.find_all('div', attrs={'data-sigil': 'story-div'}):
        posts.append(div.get_text(separator=' ', strip=True))
        
    if not posts:
        # Fallback to search all text that mentions 'ca đêm'
        for text_el in soup.find_all(['p', 'span', 'div']):
            text = text_el.get_text(separator=' ', strip=True)
            if len(text) > 20 and 'ca đêm' in text.lower() and text not in posts:
                posts.append(text)
                
    print("\n--- RESULTS ---")
    if posts:
        # Deduplicate roughly
        seen = set()
        for p in posts[:15]:
            if p[:30] not in seen:
                print("-", p)
                print("-------------------------")
                seen.add(p[:30])
    else:
        print("No matching posts found. The layout might have changed or results are empty.")

if __name__ == "__main__":
    scrape()
