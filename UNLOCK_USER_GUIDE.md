# Unlock User Guide - Clear Brute Force Lock

## Quick Answer

**"Temporarily Locked" toggle is disabled in UI** - This is normal. Use the API endpoint instead.

---

## Full API Endpoint

```
DELETE http://keycloak:8080/admin/realms/device-fingerprint/attack-detection/brute-force/users/{userId}
```

**What it does:** Clears the brute force failure counter and immediately unlocks the user.

---

## How to Unlock (Easy Method)

### On Server:

```bash
ssh root@216.219.95.237
# Password: ask the server owner; never write it into a tracked file (SEC-1247)

# Unlock a specific user
docker exec device-fingerprint-api node /tmp/unlock.js device-fp_0k2ljjkekzmkx

# Or any other user
docker exec device-fingerprint-api node /tmp/unlock.js device-fp_YOUR_USERNAME_HERE
```

### Expected Output:

```
🔓 Unlocking user: device-fp_0k2ljjkekzmkx
========================================

[1/3] Getting admin token...
✅ Token obtained

[2/3] Finding user...
✅ Found: device-fp_0k2ljjkekzmkx
   User ID: 70db577c-c200-484d-b3fb-0ba5d4f02b0c

[3/3] Clearing brute force counter...
   HTTP Status: 204 No Content

========================================
✅ USER UNLOCKED SUCCESSFULLY!
========================================

User can now authenticate again.

Full endpoint used:
DELETE http://keycloak:8080/admin/realms/device-fingerprint/attack-detection/brute-force/users/70db577c-c200-484d-b3fb-0ba5d4f02b0c
```

---

## Why "Temporarily Locked" Toggle is Disabled

In some Keycloak versions/configurations:
- The **"Temporarily Locked"** field in the UI is **read-only**
- It shows the status but cannot be manually toggled
- You **must use the API** to clear the lock

This is by design - Keycloak wants you to use the attack detection API endpoint.

---

## Alternative: One-Line Command

If you want to run it from your local machine (no SSH):

```bash
ssh root@216.219.95.237 "docker exec device-fingerprint-api node /tmp/unlock.js device-fp_0k2ljjkekzmkx"
```

---

## Manual curl Commands (If You Want Full Control)

### Step 1: Get Admin Token

```bash
TOKEN=$(curl -s http://keycloak:8080/realms/master/protocol/openid-connect/token \
  -d "username=admin" \
  -d "password=y4m44EKK8bVk" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

echo $TOKEN
```

### Step 2: Get User ID

```bash
USER_ID=$(curl -s "http://keycloak:8080/admin/realms/device-fingerprint/users?username=device-fp_0k2ljjkekzmkx" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

echo $USER_ID
```

### Step 3: Clear Brute Force Lock

```bash
curl -X DELETE \
  "http://keycloak:8080/admin/realms/device-fingerprint/attack-detection/brute-force/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -v
```

**Expected:** HTTP 204 No Content

---

## Check If User Is Currently Locked

```bash
ssh root@216.219.95.237

docker exec device-fingerprint-api node -e "
(async () => {
  const tokenResp = await fetch('http://keycloak:8080/realms/master/protocol/openid-connect/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      username: 'admin',
      password: 'y4m44EKK8bVk',
      grant_type: 'password',
      client_id: 'admin-cli'
    })
  });
  const tokenData = await tokenResp.json();

  const usersResp = await fetch('http://keycloak:8080/admin/realms/device-fingerprint/users?username=device-fp_0k2ljjkekzmkx', {
    headers: {'Authorization': 'Bearer ' + tokenData.access_token}
  });
  const users = await usersResp.json();

  if (users.length > 0) {
    const userId = users[0].id;

    const attackResp = await fetch('http://keycloak:8080/admin/realms/device-fingerprint/attack-detection/brute-force/users/' + userId, {
      headers: {'Authorization': 'Bearer ' + tokenData.access_token}
    });

    if (attackResp.ok) {
      const attackData = await attackResp.json();
      console.log('User:', users[0].username);
      console.log('Failures:', attackData.numFailures || 0);
      console.log('Locked:', attackData.disabled || false);
      console.log('Last Failure:', attackData.lastFailure ? new Date(attackData.lastFailure).toISOString() : 'None');
    } else {
      console.log('No brute force data (user not locked)');
    }
  }
})();
"
```

---

## Files on Server

| File | Purpose | Location |
|------|---------|----------|
| `unlock.js` | Unlock script (Node.js) | `/tmp/unlock.js` (inside container) |
| `unlock_user.js` | Same script | `/tmp/unlock_user.js` (on host) |

---

## Full Endpoint Reference

### Clear Brute Force Lock

```http
DELETE /admin/realms/device-fingerprint/attack-detection/brute-force/users/{userId}
Authorization: Bearer {admin_token}
```

**Response:** `204 No Content` on success

### Get Brute Force Status

```http
GET /admin/realms/device-fingerprint/attack-detection/brute-force/users/{userId}
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "numFailures": 5,
  "disabled": true,
  "lastFailure": 1739456789000,
  "lastIPFailure": "192.168.1.1"
}
```

### Get User ID by Username

```http
GET /admin/realms/device-fingerprint/users?username={username}
Authorization: Bearer {admin_token}
```

**Response:**
```json
[
  {
    "id": "70db577c-c200-484d-b3fb-0ba5d4f02b0c",
    "username": "device-fp_0k2ljjkekzmkx",
    "enabled": true,
    ...
  }
]
```

---

## Summary

✅ **"Temporarily Locked" toggle disabled in UI** = Normal behavior
✅ **Use API to unlock**: `DELETE /attack-detection/brute-force/users/{userId}`
✅ **Easy command**: `docker exec device-fingerprint-api node /tmp/unlock.js USERNAME`
✅ **HTTP 204** = Success

The unlock script is ready to use on the server! 🔓
