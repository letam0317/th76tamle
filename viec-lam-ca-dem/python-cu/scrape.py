import browser_cookie3
import requests
import json
import re

def scrape_fb():
    print("Loading Edge cookies...")
    try:
        cj = browser_cookie3.edge(domain_name='facebook.com')
        print(f"Found {len(cj)} Facebook cookies")
    except Exception as e:
        print(f"Failed to load cookies: {e}")
        return
    
    url = "https://m.facebook.com/search/posts/?q=việc%20làm%20ca%20đêm"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    print("Fetching Facebook search results...")
    try:
        res = requests.get(url, cookies=cj, headers=headers)
        res.raise_for_status()
        text = res.text
        # We need to extract the text content. Mobile facebook returns simpler HTML.
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(text, 'html.parser')
        
        posts = soup.find_all('div', {'data-sigil': 'story-div'})
        if not posts:
            posts = soup.find_all('div', class_='story_body_container')
        
        if not posts:
            # Maybe the new mobile UI doesn't have these. Let's just find paragraph tags.
            paragraphs = soup.find_all('p')
            for p in paragraphs:
                if 'ca đêm' in p.text.lower() or 'việc làm' in p.text.lower():
                    print("-", p.text)
        else:
            for p in posts[:10]:
                print("-", p.get_text(separator=' ', strip=True))
                print('---')
                
        # Also print out the text just in case
        print("\n\nFull text sample:")
        print(soup.get_text()[:1000])
        
    except Exception as e:
        print(f"Failed to fetch: {e}")

if __name__ == "__main__":
    scrape_fb()
