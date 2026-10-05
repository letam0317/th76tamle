import urllib.request
import json
import urllib.parse
from bs4 import BeautifulSoup

def scrape_public_fb():
    print("Searching Google for public Facebook posts about 'việc làm ca đêm'...")
    query = urllib.parse.quote('site:facebook.com "việc làm ca đêm" tphcm')
    url = f"https://html.duckduckgo.com/html/?q={query}"
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    
    try:
        html = urllib.request.urlopen(req).read()
        soup = BeautifulSoup(html, 'html.parser')
        results = soup.find_all('a', class_='result__snippet')
        
        print("\n=== KẾT QUẢ TÌM KIẾM (CÔNG KHAI) ===")
        found = False
        for a in results:
            text = a.text
            href = a.get('href')
            if 'ca đêm' in text.lower() or 'tphcm' in text.lower():
                print(f"- {text}")
                print(f"  Link: {href}\n")
                found = True
                
        if not found:
            print("Không tìm thấy kết quả phù hợp từ DuckDuckGo.")
    except Exception as e:
        print(f"Error fetching data: {e}")

if __name__ == "__main__":
    scrape_public_fb()
