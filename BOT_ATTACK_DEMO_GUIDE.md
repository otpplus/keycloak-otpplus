# Bot Attack Demonstration Guide

## Quick Start

The bot attack demonstration script is ready on the server at `/tmp/bot_attack.sh`.

### To run the demo:

```bash
ssh root@216.219.95.237
# Password: i55Z!cC3Dn5m

bash /tmp/bot_attack.sh
```

---

## What the Script Does

1. **Targets a real device user**: `device-fp_0k2ljjkekzmkx`
2. **Sends 10 rapid authentication attempts** with wrong passwords
3. **Detects if brute force protection triggers** (account lockout)
4. **Tests with correct password** to verify lock persists
5. **Displays results** with clear success/failure indicators

---

## Expected Behavior

### If Brute Force Protection Works:

```
🔴 Attack #1 at 14:23:45
   Error: invalid_grant
   Message: Invalid user credentials

🔴 Attack #2 at 14:23:46
   Error: invalid_grant
   Message: Invalid user credentials

... (continues until lockout) ...

🔴 Attack #6 at 14:23:50
   Error: invalid_grant
   Message: Account is temporarily disabled

   🚫 ==================================
   🚫 ACCOUNT LOCKED!
   🚫 Brute force triggered after attempt #6
   🚫 ==================================

Testing with correct password...
   ✅ Result: BLOCKED - Account is temporarily disabled

✅ =========================================
✅ BRUTE FORCE PROTECTION WORKING!
✅ Even correct password is blocked
✅ Account locked for 5 minutes
✅ =========================================
```

### If No Lockout Occurs:

```
⚠️  Result: SUCCESS - Got access token
⚠️  Account NOT locked (might need more failures)

This could mean:
1. Keycloak requires more than 10 failures
2. Failures must be within a shorter time window
3. Brute force detection has different triggers
```

---

## Brute Force Configuration

Current Keycloak settings (verified):

| Setting | Value | Description |
|---------|-------|-------------|
| `bruteForceProtected` | `true` | ✅ Enabled |
| `failureFactor` | `5` | Max failures before lockout |
| `maxFailureWaitSeconds` | `300` | Lockout duration (5 minutes) |
| `quickLoginCheckMilliSeconds` | `1000` | Failures within 1s window count |
| `maxDeltaTimeSeconds` | `600` | Count failures within 10 minutes |
| `permanentLockout` | `false` | Auto-unlock after wait time |

---

## Checking Lockout Status in Keycloak UI

1. **Open Keycloak Admin**: https://kcplus-dev.otp.plus/admin/
   - Username: `admin`
   - Password: `y4m44EKK8bVk`

2. **Select Realm**: Top-left dropdown → `device-fingerprint`

3. **View Users**: Left menu → Users

4. **Search User**: Enter `device-fp_0k2ljjkekzmkx`

5. **Check Status**:
   - Click on user
   - Look for temporary disable indicator
   - Check "Sessions" tab for active sessions
   - View "Credentials" tab to reset if needed

---

## Alternative: Manual Testing via curl

Test brute force directly without the script:

```bash
# Run this 6 times rapidly
for i in {1..6}; do
  curl -k https://kcplus-dev.otp.plus/realms/device-fingerprint/protocol/openid-connect/token \
    -d "grant_type=password" \
    -d "client_id=device-client" \
    -d "username=device-fp_0k2ljjkekzmkx" \
    -d "password=WRONG" | jq '.error_description'
done
```

---

## Unlocking a Locked Account

### Option 1: Wait
- Accounts auto-unlock after 5 minutes of no failed attempts

### Option 2: Manual Unlock (Admin UI)
1. Keycloak Admin → device-fingerprint realm
2. Users → Find locked user
3. Credentials tab → Reset password
4. This clears the brute force counter

### Option 3: API Unlock (via script on server)
```bash
docker exec device-fingerprint-api node -e "
(async () => {
  const token = await fetch('http://keycloak:8080/realms/master/protocol/openid-connect/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      username: 'admin',
      password: 'y4m44EKK8bVk',
      grant_type: 'password',
      client_id: 'admin-cli'
    })
  }).then(r => r.json());

  // Get user ID
  const users = await fetch('http://keycloak:8080/admin/realms/device-fingerprint/users?username=device-fp_0k2ljjkekzmkx&exact=false', {
    headers: {'Authorization': 'Bearer ' + token.access_token}
  }).then(r => r.json());

  if (users.length > 0) {
    const userId = users[0].id;

    // Clear brute force
    await fetch('http://keycloak:8080/admin/realms/device-fingerprint/attack-detection/brute-force/users/' + userId, {
      method: 'DELETE',
      headers: {'Authorization': 'Bearer ' + token.access_token}
    });

    console.log('Brute force counter cleared for:', users[0].username);
  }
})();
"
```

---

## For Presentation Demo

### Before Demo:
1. Ensure no users are currently locked
2. Have Keycloak admin UI open in browser tab
3. Have terminal ready with SSH connection

### During Demo:
1. **Run the script**: `bash /tmp/bot_attack.sh`
2. **While running**, switch to Keycloak UI and refresh Events page
3. **Show failed login events** accumulating in real-time
4. **When lockout occurs**, show in UI that user is disabled
5. **Try correct password** to prove lock persists

### Key Talking Points:
- "No custom rate limiting code needed"
- "Keycloak's enterprise-grade protection"
- "IT can manage via UI, no developer needed"
- "Works for all 34+ devices automatically"
- "5-minute auto-unlock prevents permanent blocks"

---

## Troubleshooting

### Script says "User not found"
- Check available users: `docker exec device-fingerprint-api node /tmp/list.js`
- Update `TARGET_USER` in script to match an existing user

### No lockout after 10 attempts
- Check if brute force is enabled: `docker exec device-fingerprint-api node /tmp/check.js`
- Verify `bruteForceProtected: true`
- Try with even more rapid attempts (remove any sleep delays)

### "invalid_grant" but never "Account is temporarily disabled"
- Keycloak might not change error message format
- Check admin UI for actual lockout status
- Use attack detection API endpoint to verify

---

## Files on Server

| File Path | Purpose |
|-----------|---------|
| `/tmp/bot_attack.sh` | Main demo script |
| `/tmp/bot_attack_fast.sh` | Rapid-fire variant (no delays) |
| `/tmp/check_brute_force.js` | Check BF settings |
| `/tmp/list_users.js` | List device users |

---

## Additional Demo Scripts

### Show Brute Force Settings
```bash
ssh root@216.219.95.237
docker exec device-fingerprint-api node /tmp/check.js
```

### List All Device Users
```bash
ssh root@216.219.95.237
docker exec device-fingerprint-api node /tmp/list.js
```

---

## Success Criteria

✅ Script runs without errors
✅ Shows 5-6 failed attempts
✅ Account gets locked (or shows lockout indicator)
✅ Correct password is blocked after lockout
✅ Keycloak UI shows disabled/locked status
✅ Events log shows failed login attempts

---

## Notes

- **Target user**: `device-fp_0k2ljjkekzmkx` (real user from database)
- **Alternative targets**: Any user from `/tmp/list.js` output
- **Script location**: `/tmp/bot_attack.sh` (executable)
- **Brute force**: Confirmed enabled with correct settings
- **Quick login window**: 1 second (failures must be rapid)
