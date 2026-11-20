import base64, json, time
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
uid = "00000000-0000-4000-8000-000000000001"
jwt = b64({"alg": "HS256", "typ": "JWT"}) + "." + b64({"sub": uid, "aud": "authenticated", "role": "authenticated", "exp": int(time.time()) + 86400 * 30, "iat": int(time.time()), "email": "didi@example.org", "session_id": "s1"}) + ".sig"
sess = {"access_token": jwt, "refresh_token": "r1", "expires_at": int(time.time()) + 86400 * 30, "expires_in": 86400 * 30, "token_type": "bearer",
        "user": {"id": uid, "email": "didi@example.org", "aud": "authenticated", "role": "authenticated", "app_metadata": {}, "user_metadata": {}, "created_at": "2026-10-01T10:00:00Z"}}
open("/home/claude/pruefung/cookie.txt", "w").write("base64-" + base64.b64encode(json.dumps(sess).encode()).decode())
