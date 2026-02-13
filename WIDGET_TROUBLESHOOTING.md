# Widget Troubleshooting Guide

## Issue: Not seeing "Device Status: allowed" in console

### Root Cause
The widget only loads on **protected paths**:
- `/collections/all`
- `/pages/contact`

If you're on the homepage or other pages, the widget won't run.

---

## Quick Fix: Check Which Page You're On

### Step 1: Open Console on ANY Page
```javascript
// Run this in browser console:
console.log('Current path:', window.location.pathname);
```

**Expected results:**
- ❌ If you're on `/` (homepage) → Widget won't load
- ❌ If you're on `/products/something` → Widget won't load
- ✅ If you're on `/collections/all` → Widget WILL load
- ✅ If you're on `/pages/contact` → Widget WILL load

---

## Solution Options

### Option A: Visit a Protected Page (Easiest)

1. Go to your Shopify store
2. Navigate to: `https://cm4-securify2-2.myshopify.com/collections/all`
3. Open DevTools → Console
4. Refresh page
5. You should see:
   ```
   [DeviceWidget] Current path: /collections/all
   [DeviceWidget] Widget will load: true
   [DeviceWidget] 🎯 Widget activated for path: /collections/all
   [DeviceWidget] 🚀 Starting access check...
   [DeviceWidget] 🔍 Fingerprint: fp_a1b2c3d4...
   [DeviceWidget] 📡 Calling API: https://kcplus-dev.otp.plus/api/device/register
   [DeviceWidget] 📥 Response status: 200 OK
   [DeviceWidget] ✨ Device Status: allowed
   [DeviceWidget] ✅ Access granted
   ```

### Option B: Load Widget on All Pages (For Testing)

Replace the widget code in Shopify with this version that loads everywhere:

```liquid
{% comment %}
  Device Fingerprint Widget - TEST VERSION (loads on all pages)
{% endcomment %}

<script>
(function() {
  const CONFIG = {
    apiUrl: 'https://kcplus-dev.otp.plus',
    cookieName: 'device_access_token',
    debug: true
  };

  function log(...args) {
    if (CONFIG.debug) {
      console.log('[DeviceWidget]', ...args);
    }
  }

  log('🎯 Widget activated for path:', window.location.pathname);

  async function generateFingerprint() {
    log('⏳ Generating fingerprint...');
    const c = {};
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 200; canvas.height = 50;
      ctx.textBaseline = 'top'; ctx.font = '14px Arial';
      ctx.fillStyle = '#f60'; ctx.fillRect(0, 0, 100, 50);
      ctx.fillStyle = '#069'; ctx.fillText('DeviceFingerprint', 2, 15);
      c.canvas = canvas.toDataURL().slice(0, 100);
    } catch (e) { c.canvas = 'n/a'; }
    c.userAgent = navigator.userAgent;
    c.screen = { w: screen.width, h: screen.height };
    c.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const str = JSON.stringify(c);
    const data = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return 'fp_' + Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('').substring(0,32);
  }

  function getCookie(n) {
    const v = `; ${document.cookie}`;
    const p = v.split(`; ${n}=`);
    if (p.length === 2) return p.pop().split(';').shift();
    return null;
  }

  function setCookie(n, v, d) {
    document.cookie = `${n}=${v}; path=/; max-age=${d}; SameSite=Lax; Secure`;
    log('🍪 Cookie set:', n);
  }

  async function checkAccess() {
    log('🚀 Starting access check...');

    try {
      const fp = await generateFingerprint();
      log('🔍 Fingerprint:', fp);

      const apiUrl = `${CONFIG.apiUrl}/api/device/register`;
      log('📡 Calling API:', apiUrl);

      const r = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: fp,
          metadata: {
            userAgent: navigator.userAgent,
            path: window.location.pathname
          }
        })
      });

      log('📥 Response status:', r.status, r.statusText);

      const d = await r.json();
      log('📦 Full API Response:', d);
      log('✨ Device Status:', d.status);

      if (d.status === 'allowed') {
        setCookie(CONFIG.cookieName, d.token, 90*24*60*60);
        log('✅ Access granted');
      } else {
        log('🚫 Access denied:', d.message);
      }
    } catch (e) {
      log('❌ Error:', e.message);
    }
  }

  log('📄 Widget script loaded');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAccess);
  } else {
    checkAccess();
  }
})();
</script>
```

### Option C: Use the Improved Widget (Recommended)

1. In Shopify Admin:
   - Go to: Online Store → Themes → Actions → Edit code
   - Find: `snippets/keycloak-widget.liquid` (or wherever you have it)
   - Replace with content from: `keycloak-widget-IMPROVED.liquid`

2. The improved version logs even when NOT on protected pages:
   ```
   [DeviceWidget] Current path: /
   [DeviceWidget] Protected paths: ["/collections/all", "/pages/contact"]
   [DeviceWidget] Widget will load: false
   [DeviceWidget] ⏭️ Skipping - current path not in protected list
   [DeviceWidget] To activate, visit: /collections/all or /pages/contact
   ```

---

## Testing Checklist

### ✅ Widget Working Correctly When You See:

**On Protected Page (`/collections/all`):**
```
[DeviceWidget] Widget will load: true
[DeviceWidget] 🚀 Starting access check...
[DeviceWidget] 🔍 Fingerprint: fp_xxxxx
[DeviceWidget] 📡 Calling API: https://kcplus-dev.otp.plus/api/device/register
[DeviceWidget] 📥 Response status: 200 OK
[DeviceWidget] ✨ Device Status: allowed
[DeviceWidget] ✅ Access granted
```

**On Non-Protected Page (`/`):**
```
[DeviceWidget] Current path: /
[DeviceWidget] Widget will load: false
[DeviceWidget] ⏭️ Skipping - current path not in protected list
```

---

## Common Issues & Fixes

### Issue 1: No Console Output at All

**Cause:** Widget file not included in theme
**Fix:**
1. Check that `keycloak-widget.liquid` is in `snippets/` folder
2. Check that it's included in `theme.liquid`:
   ```liquid
   {% render 'keycloak-widget' %}
   ```
3. Or check in section/template where it should load

### Issue 2: CORS Error in Console

**Error:**
```
Access to fetch at 'https://kcplus-dev.otp.plus/api/device/register'
from origin 'https://cm4-securify2-2.myshopify.com' has been blocked by CORS
```

**Fix:** Check nginx config on server allows Shopify domain:
```bash
ssh root@216.219.95.237
cat /opt/device-fingerprint/nginx.conf | grep -A 5 "add_header"
```

Should include:
```nginx
add_header 'Access-Control-Allow-Origin' '*';
```

### Issue 3: API Returns 500 Error

**Error:**
```
[DeviceWidget] 📥 Response status: 500 Internal Server Error
```

**Fix:** Check API logs:
```bash
ssh root@216.219.95.237
docker logs --tail 50 device-fingerprint-api
```

### Issue 4: Widget Loads But No API Call

**Symptoms:**
```
[DeviceWidget] 🚀 Starting access check...
[DeviceWidget] 🔍 Fingerprint: fp_xxxxx
[DeviceWidget] 📡 Calling API: https://kcplus-dev.otp.plus/api/device/register
[DeviceWidget] ❌ Error: Failed to fetch
```

**Causes:**
1. API server down
2. SSL certificate issue
3. Network blocked

**Fix:**
```bash
# Test API directly
curl -k https://kcplus-dev.otp.plus/api/device/register \
  -H "Content-Type: application/json" \
  -d '{"fingerprint":"test-123"}'

# Should return: {"status":"allowed","token":"..."}
```

---

## Quick Test URLs

### Test on Your Shopify Store:

1. **Homepage (widget should skip):**
   ```
   https://cm4-securify2-2.myshopify.com/
   ```
   Expected: `Widget will load: false`

2. **Collections page (widget should run):**
   ```
   https://cm4-securify2-2.myshopify.com/collections/all
   ```
   Expected: `✨ Device Status: allowed`

3. **Contact page (widget should run):**
   ```
   https://cm4-securify2-2.myshopify.com/pages/contact
   ```
   Expected: `✨ Device Status: allowed`

---

## API Testing Without Widget

Test the API directly from browser console:

```javascript
// Run this in console on ANY page
(async function() {
  const response = await fetch('https://kcplus-dev.otp.plus/api/device/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      fingerprint: 'manual-test-' + Date.now(),
      metadata: {userAgent: navigator.userAgent}
    })
  });

  const data = await response.json();
  console.log('API Response:', data);
  console.log('Device Status:', data.status);
})();
```

**Expected output:**
```javascript
API Response: {status: "allowed", token: "eyJhbGci...", isNew: true}
Device Status: allowed
```

---

## Debug Mode: See Everything

Add this to console to see ALL widget activity:

```javascript
// Override console.log to see EVERYTHING
const originalLog = console.log;
console.log = function(...args) {
  originalLog.apply(console, args);
  if (args[0] && args[0].includes && args[0].includes('DeviceWidget')) {
    // Highlight widget logs
    originalLog('%c' + args.join(' '), 'background: #4CAF50; color: white; padding: 2px 5px;');
  }
};
```

---

## For Demo: Force Widget to Block You

To demo brute force protection:

1. Get your current fingerprint:
   ```javascript
   // In console
   async function getMyFingerprint() {
     const c = {
       userAgent: navigator.userAgent,
       screen: {w: screen.width, h: screen.height},
       timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
     };
     const data = new TextEncoder().encode(JSON.stringify(c));
     const hash = await crypto.subtle.digest('SHA-256', data);
     const fp = 'fp_' + Array.from(new Uint8Array(hash))
       .map(b => b.toString(16).padStart(2,'0'))
       .join('')
       .substring(0,32);
     console.log('Your fingerprint:', fp);
     return fp;
   }
   getMyFingerprint();
   ```

2. SSH to server and trigger brute force on that fingerprint:
   ```bash
   ssh root@216.219.95.237

   # Replace fp_xxxxx with your actual fingerprint
   for i in {1..6}; do
     curl -k https://kcplus-dev.otp.plus/realms/device-fingerprint/protocol/openid-connect/token \
       -d "grant_type=password" \
       -d "client_id=device-client" \
       -d "username=device-fp_YOUR_FINGERPRINT_HERE" \
       -d "password=WRONG" -s > /dev/null
   done
   ```

3. Refresh Shopify page → Should see "rate_limited" status

---

## Support

If still not working:

1. **Export console logs:**
   - Right-click in console → "Save as..."
   - Attach to support request

2. **Check server logs:**
   ```bash
   ssh root@216.219.95.237
   docker logs --tail 100 device-fingerprint-api > /tmp/api-logs.txt
   cat /tmp/api-logs.txt
   ```

3. **Verify API is running:**
   ```bash
   docker ps | grep device-fingerprint-api
   # Should show: Up X hours (healthy)
   ```

---

## Summary

**Most common issue:** You're not on a protected page!

**Quick fix:** Navigate to `/collections/all` and check console again.

**Best practice:** Use the improved widget that tells you why it's not loading.
