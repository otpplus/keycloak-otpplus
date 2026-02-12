const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const https = require('https');
const http = require('http');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ===========================================
// SECURE CONFIG - Read from environment variables
// ===========================================
const CONFIG = {
  keycloak: {
    url: process.env.KEYCLOAK_URL || 'http://keycloak:8080',
    externalUrl: process.env.KEYCLOAK_EXTERNAL_URL || 'https://kcplus-dev.otp.plus',
    realm: process.env.KEYCLOAK_REALM || 'device-fingerprint',
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'shopify-widget',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    adminUser: 'admin',
    adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD
  },
  jwt: {
    secret: process.env.JWT_SECRET
  },
  cookie: { 
    secret: process.env.JWT_SECRET || 'change-me-in-production'
  }
};

// Validate required environment variables
const requiredEnvVars = ['KEYCLOAK_CLIENT_SECRET', 'KEYCLOAK_ADMIN_PASSWORD', 'JWT_SECRET'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing.join(', '));
  process.exit(1);
}

app.use(express.json());
// CORS handled by nginx
// // CORS is handled by nginx proxy
app.use((req, res, next) => { next(); });

// ===========================================
// Keycloak Admin Client
// ===========================================
class KeycloakAdmin {
  constructor(config) {
    this.config = config;
    this.adminToken = null;
    this.tokenExpiry = null;
  }

  async getAdminToken() {
    if (this.adminToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.adminToken;
    }
    
    const tokenUrl = `${this.config.url}/realms/master/protocol/openid-connect/token`;
    console.log(`🔑 Getting admin token from: ${tokenUrl}`);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: 'admin-cli',
        username: this.config.adminUser,
        password: this.config.adminPassword,
        grant_type: 'password'
      })
    });
    
    const data = await response.json();
    if (!data.access_token) {
      console.error('❌ Failed to get admin token:', data);
      throw new Error('Failed to get admin token');
    }
    
    this.adminToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 30) * 1000;
    console.log('✅ Admin token obtained successfully');
    return this.adminToken;
  }

  async findUserByAttribute(attribute, value) {
    const token = await this.getAdminToken();
    const url = `${this.config.url}/admin/realms/${this.config.realm}/users?q=${attribute}:${value}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    return response.json();
  }

  async createUser(userData) {
    const token = await this.getAdminToken();
    const url = `${this.config.url}/admin/realms/${this.config.realm}/users`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });
    
    if (response.status === 201) {
      const location = response.headers.get('Location');
      const userId = location ? location.split('/').pop() : null;
      return { success: true, userId };
    }
    
    const error = await response.text();
    return { success: false, error };
  }

  async getUserGroups(userId) {
    const token = await this.getAdminToken();
    const url = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}/groups`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    return response.json();
  }

  async addUserToGroup(userId, groupId) {
    const token = await this.getAdminToken();
    const url = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}/groups/${groupId}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    return response.ok;
  }

  async getGroupByName(groupName) {
    const token = await this.getAdminToken();
    const url = `${this.config.url}/admin/realms/${this.config.realm}/groups?search=${groupName}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const groups = await response.json();
    return groups.find(g => g.name === groupName);
  }
}

const keycloakAdmin = new KeycloakAdmin(CONFIG.keycloak);

// ===========================================
// Health Check Endpoint
// ===========================================
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ===========================================
// Device Registration Endpoint
// ===========================================
app.post('/api/device/register', async (req, res) => {
  try {
    const { fingerprint, metadata } = req.body;
    
    if (!fingerprint) {
      return res.status(400).json({ error: 'Fingerprint required' });
    }

    console.log(`📱 Device registration request: ${fingerprint.substring(0, 16)}...`);

    // Check if device already exists
    const existingUsers = await keycloakAdmin.findUserByAttribute('deviceFingerprint', fingerprint);
    
    if (existingUsers && existingUsers.length > 0) {
      const user = existingUsers[0];
      const groups = await keycloakAdmin.getUserGroups(user.id);
      const isBlocked = groups.some(g => g.name === 'blocked-devices');
      
      if (isBlocked) {
        console.log(`🚫 Blocked device attempted access: ${fingerprint.substring(0, 16)}...`);
        return res.status(403).json({ 
          status: 'blocked',
          message: 'This device has been blocked'
        });
      }
      
      // Generate token for existing allowed device
      const token = jwt.sign(
        { deviceId: user.id, fingerprint, status: 'allowed' },
        CONFIG.jwt.secret,
        { expiresIn: '24h' }
      );
      
      console.log(`✅ Existing device verified: ${fingerprint.substring(0, 16)}...`);
      return res.json({ status: 'allowed', token });
    }

    // Create new device user
    const deviceUser = {
      username: `device-${fingerprint.substring(0, 16)}`,
      enabled: true,
      attributes: {
        deviceFingerprint: [fingerprint],
        userAgent: [metadata?.userAgent || 'unknown'],
        registeredAt: [new Date().toISOString()]
      }
    };

    const createResult = await keycloakAdmin.createUser(deviceUser);
    
    if (!createResult.success) {
      console.error('❌ Failed to create device user:', createResult.error);
      return res.status(500).json({ error: 'Failed to register device' });
    }

    // Add to allowed-devices group
    const allowedGroup = await keycloakAdmin.getGroupByName('allowed-devices');
    if (allowedGroup) {
      await keycloakAdmin.addUserToGroup(createResult.userId, allowedGroup.id);
    }

    // Generate token
    const token = jwt.sign(
      { deviceId: createResult.userId, fingerprint, status: 'allowed' },
      CONFIG.jwt.secret,
      { expiresIn: '24h' }
    );

    console.log(`✅ New device registered: ${fingerprint.substring(0, 16)}...`);
    res.json({ status: 'allowed', token, isNew: true });

  } catch (error) {
    console.error('❌ Device registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===========================================
// Device Verification Endpoint
// ===========================================
app.post('/api/device/verify', async (req, res) => {
  try {
    const { token, fingerprint } = req.body;
    
    if (!token || !fingerprint) {
      return res.status(400).json({ error: 'Token and fingerprint required' });
    }

    // Verify JWT
    const decoded = jwt.verify(token, CONFIG.jwt.secret);
    
    if (decoded.fingerprint !== fingerprint) {
      return res.status(403).json({ status: 'blocked', message: 'Fingerprint mismatch' });
    }

    // Double-check with Keycloak
    const users = await keycloakAdmin.findUserByAttribute('deviceFingerprint', fingerprint);
    
    if (!users || users.length === 0) {
      return res.status(403).json({ status: 'blocked', message: 'Device not found' });
    }

    const groups = await keycloakAdmin.getUserGroups(users[0].id);
    const isBlocked = groups.some(g => g.name === 'blocked-devices');

    if (isBlocked) {
      return res.status(403).json({ status: 'blocked', message: 'Device has been blocked' });
    }

    res.json({ status: 'allowed', verified: true });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ status: 'blocked', message: 'Invalid or expired token' });
    }
    console.error('❌ Verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===========================================
// Start Server (HTTP only - nginx handles SSL)
// ===========================================
const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log('===========================================');
  console.log(`🚀 Device Fingerprint API running on port ${PORT}`);
  console.log(`📡 Keycloak URL: ${CONFIG.keycloak.url}`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('===========================================');
});
