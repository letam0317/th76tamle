import sqlite3
import os

edge_user_data = os.path.join(os.environ["LOCALAPPDATA"], "Microsoft", "Edge", "User Data")
cookie_db_path = os.path.join(edge_user_data, "Default", "Network", "Cookies")

try:
    conn = sqlite3.connect(f"file:{cookie_db_path}?mode=ro", uri=True)
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) FROM cookies")
    print("Success! Row count:", cursor.fetchone()[0])
except Exception as e:
    print("Failed:", e)
