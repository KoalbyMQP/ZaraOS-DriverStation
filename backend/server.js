const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
// const passport = require('passport');
// const OIDCStrategy = require('passport-azure-ad').OIDCStrategy;
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { Client } = require('ssh2');
const http = require('http');
const {WebSocketServer} = require("ws");

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
// app.use(passport.initialize());

const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => {
//   console.log(`Auth server running on port ${PORT}`);
// });

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create tables on startup
const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      email_verified BOOLEAN DEFAULT false,
      verification_token VARCHAR(255),
      reset_token VARCHAR(255),
      reset_token_expires TIMESTAMP,
      oauth_provider VARCHAR(50),
      oauth_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_verification_token ON users(verification_token);
    CREATE INDEX IF NOT EXISTS idx_reset_token ON users(reset_token);
  `);
};

const initProjectsDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      git_url VARCHAR(500),
      git_token VARCHAR(500),
      organization VARCHAR(255),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_organization ON projects(organization);
  `);
};

initDB();
initProjectsDB();

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  tls: {
    rejectUnauthorized: false, 
  },
});

// JWT token generation
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.userId = user.userId;
    next();
  });
};

// Microsoft OAuth (eventually)
// passport.use(new OIDCStrategy({
//     identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration`,
//     clientID: process.env.AZURE_CLIENT_ID,
//     clientSecret: process.env.AZURE_CLIENT_SECRET,
//     responseType: 'code',
//     responseMode: 'form_post',
//     redirectUrl: `${process.env.API_URL}/auth/microsoft/callback`,
//     allowHttpForRedirectUrl: false,
//     scope: ['profile', 'email', 'openid'],
//   },
//   async (iss, sub, profile, accessToken, refreshToken, done) => {
//     try {
//       const email = profile._json.email || profile._json.preferred_username;
//       const firstName = profile._json.given_name || profile.displayName?.split(' ')[0];
//       const lastName = profile._json.family_name || profile.displayName?.split(' ')[1];
      
//       let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
//       let user;
      
//       if (result.rows.length === 0) {
//         // Create new user
//         result = await pool.query(
//           `INSERT INTO users (email, first_name, last_name, email_verified, oauth_provider, oauth_id) 
//            VALUES ($1, $2, $3, true, 'microsoft', $4) RETURNING *`,
//           [email, firstName, lastName, sub]
//         );
//         user = result.rows[0];
//       } else {
//         user = result.rows[0];
//       }
      
//       return done(null, user);
//     } catch (error) {
//       return done(error);
//     }
//   }
// ));

// Routes 

// Check email (determines signup/login)
app.post('/auth/check_email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // sso eventually 
    // const emailDomain = email.split('@')[1];
    // const ssoOrganizations = process.env.SSO_DOMAINS?.split(',') || [];
    
    // if (ssoOrganizations.includes(emailDomain)) {
    //   return res.json({ action: 'sso', provider: 'microsoft.com' });
    // }
    
    // Check if user exists
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length > 0) {
      return res.json({ action: 'login' });
    } else {
      return res.json({ action: 'signup' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Signup
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if user exists
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, verification_token) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, verification_token`,
      [email, passwordHash, firstName, lastName, verificationToken]
    );
    
    const user = result.rows[0];
    console.log('Verification token stored in DB:', user.verification_token);
    
    // Send verification email  (will fix eventually)
    // const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    // await transporter.sendMail({
    //   from: process.env.SMTP_FROM,
    //   to: email,
    //   subject: 'Verify your email',
    //   html: `<p>Click <a href="${verificationUrl}">here</a> to verify your email.</p>`,
    // });
    // console.log('Verification email sent to:', user.email);
    
    // res.json({ 
    //   message: 'Signup successful. Please check your email to verify your account.',
    //   userId: user.id 
    // });

    await pool.query(
      'UPDATE users SET email_verified = true WHERE id = $1',
      [user.id]
    );

    res.json({ 
      message: 'Signup successful (email verification skipped).',
      userId: user.id 
    });
    

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // if (!user.email_verified) {
    //   return res.status(403).json({ error: 'Please verify your email first by signing up', emailVerified: false });
    // }
    
    // Generate token
    const token = generateToken(user.id);
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
  console.log("Successful login"); 
});

// Verify email
app.get('/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    console.log('Received verification token:', token);
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    const result = await pool.query(
      'UPDATE users SET email_verified = true, verification_token = NULL WHERE verification_token = $1 RETURNING *',
      [token]
    );
    console.log('Token lookup result:', result.rows);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Request password reset
app.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      // Don't reveal if email exists
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }
    
    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour
    
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetTokenExpires, user.id]
    );
    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Password Reset',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    });
    
    res.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password
app.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    
    const result = await pool.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    
    const user = result.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Microsoft OAuth routes
// app.get('/auth/microsoft', passport.authenticate('azuread-openidconnect'));

// app.post('/auth/microsoft/callback',
//   passport.authenticate('azuread-openidconnect', { session: false }),
//   (req, res) => {
//     const token = generateToken(req.user.id);
//     // Redirect to frontend with token
//     res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
//   }
// );

// Get current user
app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, email_verified FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/terminal/command', authenticateToken, async (req, res) => {
  const { command } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'No command provided' });
  }
  // TODO: wire to SSH (e.g. uncomment /api/ssh/run logic) or run locally
  res.json({ output: `$ ${command}\n(terminal backend not yet connected)` });
});

app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const email = userResult.rows[0].email;
    const organization = email.split('@')[1];

    const projectsResult = await pool.query(
      'SELECT id, name, git_url, organization, created_at FROM projects WHERE organization = $1 ORDER BY created_at DESC',
      [organization]
    );

    res.json({ projects: projectsResult.rows });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get specific project
app.get('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    
    const result = await pool.query(
      'SELECT id, name, git_url, organization, created_at FROM projects WHERE id = $1',
      [projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify user has access (same organization)
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [req.userId]
    );
    
    const userOrg = userResult.rows[0].email.split('@')[1];
    const projectOrg = result.rows[0].organization;

    if (userOrg !== projectOrg) {
      return res.status(403).json({ error: 'Access denied, different organization' });
    }

    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
  try {
    const { name, git_url, git_token } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [req.userId]
    );

    const organization = userResult.rows[0].email.split('@')[1];

    const result = await pool.query(
      `INSERT INTO projects (name, git_url, git_token, organization, created_by) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, git_url, organization, created_at`,
      [name, git_url, git_token, organization, req.userId]
    );

    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { name, git_url, git_token } = req.body;

    // Verify access
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    const userOrg = userResult.rows[0].email.split('@')[1];

    const projectResult = await pool.query('SELECT organization FROM projects WHERE id = $1', [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (projectResult.rows[0].organization !== userOrg) {
      return res.status(403).json({ error: 'Access denied, wrong organization' });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (git_url !== undefined) {
      updateFields.push(`git_url = $${paramCount++}`);
      values.push(git_url);
    }
    if (git_token !== undefined) {
      updateFields.push(`git_token = $${paramCount++}`);
      values.push(git_token);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(projectId);

    const result = await pool.query(
      `UPDATE projects SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING id, name, git_url, organization, created_at`,
      values
    );

    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete project
app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);

    // Verify access
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    const userOrg = userResult.rows[0].email.split('@')[1];

    const projectResult = await pool.query('SELECT organization FROM projects WHERE id = $1', [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (projectResult.rows[0].organization !== userOrg) {
      return res.status(403).json({ error: 'Access denied, wrong organization' });
    }

    await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`Auth server running on port ${PORT}`);
});


const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  console.log('Client connected to SSH WS');

  const conn = new Client();

  conn.on('ready', () => {
    console.log('SSH connection ready');

    conn.shell((err, stream) => {
      if (err) {
        console.error('SSH shell failed:', err.message);
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
        ws.close();
        return;
      }

      stream.on('data', (data) => {
        ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
      });

      stream.stderr.on('data', (data) => {
        ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
      });

      stream.on('close', () => {
        ws.close();
        conn.end();
      });

      ws.on('message', (msg) => {
        try {
          const parsed = JSON.parse(msg);
          if (parsed.type === 'input') {
            stream.write(parsed.data);
          }
          if (parsed.type === 'resize') {
            stream.setWindow(parsed.rows, parsed.cols, parsed.rows, parsed.cols);
          }
        } catch (e) {
          console.error('Bad WS message:', msg);
        }
      });

      ws.on('close', () => {
        conn.end();
      });
    });
  });

  conn.on('error', (err) => {
    console.error('SSH connection failed:', err.message);
    try { ws.send(JSON.stringify({ type: 'error', message: err.message })); } catch {}
    ws.close();
  });

  conn.connect({
    host: process.env.SSH_HOST,
    port: 22,
    username: process.env.SSH_USER,
    password: process.env.SSH_PASSWORD,
  });
});





//
// app.post('/api/ssh/run', authenticateToken, async (req, res) => {
//   const { command } = req.body;
//
//   if (!command) {
//     return res.status(400).json({ error: 'No command provided' });
//   }
//
//   const conn = new Client();
//
//   conn.on('ready', () => {
//     conn.exec(command, (err, stream) => {
//       if (err) {
//         conn.end();
//         return res.status(500).json({ error: err.message });
//       }
//
//       let output = '';
//
//       stream.on('data', (data) => {
//         output += data.toString();
//       });
//
//       stream.stderr.on('data', (data) => {
//         output += data.toString();
//       });
//
//       stream.on('close', () => {
//         conn.end();
//         res.json({ output });
//       });
//     });
//   });
//
//   conn.on('error', (err) => {
//     res.status(500).json({ error: err.message });
//   });
//
//   conn.connect({
//     host: process.env.SSH_HOST,
//     port: 22,
//     username: process.env.SSH_USER,
//     password: process.env.SSH_PASSWORD,
//     // OR:
//     // privateKey: require('fs').readFileSync(process.env.SSH_KEY_PATH)
//   });
// });
