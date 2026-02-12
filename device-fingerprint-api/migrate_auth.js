#!/usr/bin/env node

// POC Auth Migration Script
// Migrates from Keycloak lookup to authentication flow

const KEYCLOAK_URL = 'http://keycloak:8080';
const REALM = 'device-fingerprint';
const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'CHANGE_ME';

console.log('==========================================');
console.log('POC Auth Migration Script');
console.log('==========================================');
console.log('');

async function main() {
  try {
    // Step 1: Get admin token
    console.log('[1/5] Getting admin access token...');
    const tokenResponse = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: ADMIN_USER,
        password: ADMIN_PASSWORD,
        grant_type: 'password',
        client_id: 'admin-cli'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error('❌ Failed to get admin token:', tokenData);
      process.exit(1);
    }

    const token = tokenData.access_token;
    console.log('✅ Admin token obtained');
    console.log('');

    // Step 2: Create device-client
    console.log('[2/5] Creating device-client in Keycloak...');
    const clientConfig = {
      clientId: 'device-client',
      name: 'Device Authentication Client',
      description: 'Client for device fingerprint authentication with brute force protection',
      enabled: true,
      protocol: 'openid-connect',
      publicClient: true,
      directAccessGrantsEnabled: true,
      standardFlowEnabled: false,
      implicitFlowEnabled: false,
      serviceAccountsEnabled: false,
      redirectUris: ['*'],
      webOrigins: ['*'],
      attributes: {
        'access.token.lifespan': '3600'
      }
    };

    const createResponse = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/clients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(clientConfig)
    });

    if (createResponse.status === 201) {
      console.log('✅ device-client created successfully');
    } else if (createResponse.status === 409) {
      console.log('ℹ️  device-client already exists');
    } else {
      const error = await createResponse.text();
      console.log(`⚠️  Unexpected response (HTTP ${createResponse.status}): ${error}`);
    }
    console.log('');

    // Step 3: Get all users
    console.log('[3/5] Fetching all users in device-fingerprint realm...');
    const usersResponse = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/users?max=100`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const users = await usersResponse.json();
    console.log(`Found ${users.length} users`);
    console.log('');

    // Step 4: Migrate passwords
    console.log('[4/5] Migrating user passwords (password = username)...');
    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      console.log(`  Setting password for user: ${user.username} (ID: ${user.id.substring(0, 8)}...)`);

      const passwordConfig = {
        type: 'password',
        value: user.username,
        temporary: false
      };

      const pwdResponse = await fetch(
        `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user.id}/reset-password`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(passwordConfig)
        }
      );

      if (pwdResponse.status === 204) {
        console.log('    ✅ Password set');
        successCount++;
      } else {
        const error = await pwdResponse.text();
        console.log(`    ❌ Failed (HTTP ${pwdResponse.status}): ${error}`);
        failCount++;
      }
    }

    console.log('');
    console.log('✅ Password migration completed');
    console.log('');

    // Step 5: Summary
    console.log('[5/5] Migration Summary');
    console.log('==========================================');
    console.log('✅ device-client created/verified');
    console.log(`✅ ${successCount} user passwords migrated successfully`);
    if (failCount > 0) {
      console.log(`⚠️  ${failCount} user passwords failed to migrate`);
    }
    console.log('✅ Passwords set to match usernames');
    console.log('');
    console.log('Next steps:');
    console.log('1. Update API code to use authentication flow');
    console.log('2. Test authentication with existing users');
    console.log('3. Test brute force protection');
    console.log('==========================================');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
