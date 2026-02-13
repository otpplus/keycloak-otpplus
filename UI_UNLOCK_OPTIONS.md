# Keycloak UI Options to Unlock Users

## Option 1: Clear All Login Failures (Realm-Wide)

### Location:
```
Keycloak Admin Console
→ Select "device-fingerprint" realm (top-left dropdown)
→ Left menu: Realm Settings
→ Tab: Security Defenses
→ Section: Brute Force Detection
→ Bottom of page: "Clear all login failures" button
```

**What it does:**
- Clears brute force counters for **ALL users** in the realm
- Unlocks everyone who was locked due to failed attempts
- Nuclear option - affects all 34+ device users

**When to use:**
- After testing/demos when multiple users got locked
- When you want to reset all counters at once
- Not ideal for production (affects all users)

---

## Option 2: View and Clear Individual User Failures (Events)

### Location:
```
Keycloak Admin Console
→ Select "device-fingerprint" realm
→ Left menu: Events
→ Tab: Login Events
→ Filter by user
```

**What you can do:**
- **View** failed login attempts for specific users
- **See** IP addresses, timestamps, error types
- **Cannot** directly unlock from this view (read-only)

**Useful for:**
- Investigating which users are locked
- Seeing attack patterns
- Forensics and auditing

---

## Option 3: Clear User Sessions (Indirect Unlock)

### Location:
```
Keycloak Admin Console
→ Select "device-fingerprint" realm
→ Left menu: Users
→ Search for user (e.g., "device-fp_0k2ljjkekzmkx")
→ Click on user
→ Tab: Sessions
→ Button: "Logout all sessions"
```

**What it does:**
- Logs out all active sessions for that user
- Does **NOT** clear brute force counter
- Does **NOT** unlock the user

**Not helpful for brute force unlock** ❌

---

## Option 4: Disable/Enable User (Workaround - NOT RECOMMENDED)

### Location:
```
Keycloak Admin Console
→ Select "device-fingerprint" realm
→ Left menu: Users
→ Search for user
→ Click on user
→ Toggle "Enabled" OFF, then ON
→ Click "Save"
```

**What it does:**
- Temporarily disables the entire user account
- Re-enabling *might* reset some states
- **NOT guaranteed to clear brute force counter**
- Can cause other issues

**Not recommended** ⚠️

---

## Option 5: Reset Password (Clears Credentials, NOT Brute Force)

### Location:
```
Keycloak Admin Console
→ Select "device-fingerprint" realm
→ Left menu: Users
→ Search for user
→ Click on user
→ Tab: Credentials
→ Button: "Reset password"
→ Enter new password
→ Click "Reset password"
```

**What it does:**
- Changes the user's password
- Does **NOT** clear brute force counter in most cases
- User will need new password to authenticate

**Not effective for unlocking** ❌

---

## **RECOMMENDED UI METHOD**

### Clear All Login Failures (Easiest)

1. **Login to Keycloak Admin**: https://kcplus-dev.otp.plus/admin/
   - Username: `admin`
   - Password: `y4m44EKK8bVk`

2. **Select Realm**: Top-left dropdown → `device-fingerprint`

3. **Navigate**:
   - Left menu → **Realm Settings**
   - Tab → **Security Defenses**

4. **Scroll Down** to "Brute Force Detection" section

5. **Click Button**: **"Clear all login failures"** or **"Clear all user failures"**

6. **Confirm** the action

7. **Result**: All locked users are now unlocked ✅

---

## Screenshots Location in UI

### Path to Clear All Failures:
```
┌─────────────────────────────────────┐
│ Keycloak Admin Console              │
├─────────────────────────────────────┤
│ 📍 device-fingerprint (realm)       │
│                                     │
│ ┌─────────────────┐                │
│ │ Realm Settings  │ ← Click here   │
│ └─────────────────┘                │
│                                     │
│ Tabs:                              │
│ [ General ] [ Login ] [ Email ]    │
│ [ Themes ] [ Localization ]        │
│ [ Security Defenses ] ← Click      │
│                                     │
│ ┌─────────────────────────────┐   │
│ │ Brute Force Detection        │   │
│ │                              │   │
│ │ [✓] Enabled                  │   │
│ │ Permanent Lockout: [ ]       │   │
│ │ Max Login Failures: 5        │   │
│ │ Wait Increment Seconds: 60   │   │
│ │ ...                          │   │
│ │                              │   │
│ │ ┌──────────────────────────┐│   │
│ │ │ Clear all login failures ││   │
│ │ └──────────────────────────┘│   │
│ │         ↑                    │   │
│ │    Click this button         │   │
│ └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## Comparison: UI vs API

| Method | Affects | Speed | Precision | Use Case |
|--------|---------|-------|-----------|----------|
| **Clear All (UI)** | All users | Fast | Realm-wide | Testing/demos |
| **API per user** | One user | Fast | Precise | Production |
| **Wait 5 min** | One user | Slow | Precise | Automatic |

---

## For Your Demo

### Best UI approach:

1. **Before demo**:
   - Clear all login failures (start fresh)

2. **During demo**:
   - Show bot attack locking a user
   - Show in UI: Realm Settings → Security Defenses

3. **After demo**:
   - Click "Clear all login failures" to reset
   - Or wait 5 minutes for auto-unlock

---

## Summary

### ✅ Available in UI:
1. **Clear all login failures** (Realm Settings → Security Defenses)
2. **View failed login events** (Events → Login Events)
3. **View brute force settings** (Realm Settings → Security Defenses)

### ❌ NOT Available in UI:
1. Clear brute force for **individual user** (need API)
2. Toggle "Temporarily Locked" for specific user (read-only)

### 🎯 Best Practice:
- **Testing/Demos**: Use "Clear all login failures" button
- **Production**: Use API to unlock specific users
- **Automatic**: Wait 5 minutes for auto-unlock
