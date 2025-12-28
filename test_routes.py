import requests

BASE_URL = "http://localhost:3010/api"

def test_routes():
    # 1. Test Bot Stats (Will fail 404/400 if ID invalid, but checks route existence)
    print("Testing Bot Stats...")
    try:
        res = requests.get(f"{BASE_URL}/bots/test-id/stats")
        print(f"Stats Status: {res.status_code}") # 404 is expected if bot doesn't exist, which means route works
    except Exception as e:
        print(f"Stats Failed: {e}")

    # 2. Test Admin Health (Will likely fail 403/401 due to missing token in this simple script, 
    # but confirms route is protected or reachable)
    print("Testing Admin Health...")
    try:
        res = requests.get(f"{BASE_URL}/admin/system/health")
        print(f"Health Status: {res.status_code}")
    except Exception as e:
        print(f"Health Failed: {e}")

if __name__ == "__main__":
    test_routes()
