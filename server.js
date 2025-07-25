const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply rate limiter to all routes
app.use(limiter);

// Middleware
app.use(cors({
  origin: 'https://www.king7offsuit.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(morgan('combined'));

// Database setup
const DATA_DIR = process.env.RENDER ? '/opt/render/project/src/data' : path.join(__dirname, 'data');
const dbPath = path.join(DATA_DIR, 'poker.db');
const backupPath = path.join(DATA_DIR, 'backup');



// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure backup directory exists
if (!fs.existsSync(backupPath)) {
  
  fs.mkdirSync(backupPath, { recursive: true });
}

// If we're on Render and the database doesn't exist in the data directory,
// but exists in the root, move it to the data directory
if (process.env.RENDER && !fs.existsSync(dbPath) && fs.existsSync(path.join(__dirname, 'poker.db'))) {
  
  fs.copyFileSync(path.join(__dirname, 'poker.db'), dbPath);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[DB] Error connecting to database:', err);
  } else {
    
    
    // Verify database is writable
    db.run('PRAGMA quick_check', (err) => {
      if (err) {
        console.error('[DB] Database write check failed:', err);
      } else {
        
      }
    });

    // Create groups table
    db.run(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        createdAt TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        owner_id TEXT,
        isActive INTEGER DEFAULT 1,
        FOREIGN KEY (createdBy) REFERENCES users(id),
        FOREIGN KEY (owner_id) REFERENCES users(id)
      )
    `);

    // Add owner_id column if it doesn't exist (for existing databases)
    db.run(`
      ALTER TABLE groups ADD COLUMN owner_id TEXT REFERENCES users(id)
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('[DB] Error adding owner_id column:', err);
      } else if (!err) {
        
      }
    });

    // Create users table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        createdAt TEXT NOT NULL,
        isVerified INTEGER DEFAULT 0,
        verificationCode TEXT
      )
    `, (err) => {
      if (err) {
        console.error('[DB] Error creating users table:', err);
      } else {
        
      }
    });

    // Add email column to users table if it doesn't exist
    db.run(`
      ALTER TABLE users ADD COLUMN email TEXT
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('[DB] Error adding email column:', err);
      } else if (!err) {
        
      }
    });

    // Note: group_join_requests table already exists with INTEGER columns
    // but groups and users tables use TEXT (UUID) columns
    // We'll handle this mismatch in the code by not using foreign keys
    

    // Create notifications table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        group_id TEXT,
        request_id INTEGER,
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) { console.error('[DB] Error creating notifications table:', err); }
      else { }
    });
  }
});

// Backup function
function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupPath, `poker_${timestamp}.db`);
  
  fs.copyFile(dbPath, backupFile, (err) => {
    if (err) {
      console.error('Error creating backup:', err);
    } else {
      console.log('Database backup created:', backupFile);
      
      // Clean up old backups (keep last 5)
      fs.readdir(backupPath, (err, files) => {
        if (err) {
          console.error('Error reading backup directory:', err);
          return;
        }
        
        const backups = files
          .filter(file => file.startsWith('poker_'))
          .sort()
          .reverse();
        
        if (backups.length > 5) {
          backups.slice(5).forEach(file => {
            fs.unlink(path.join(backupPath, file), err => {
              if (err) console.error('Error deleting old backup:', err);
            });
          });
        }
      });
    }
  });
}

// Schedule daily backups
setInterval(backupDatabase, 24 * 60 * 60 * 1000);

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    
    // Check if user is blocked
    db.get('SELECT isBlocked FROM users WHERE id = ?', [decoded.id], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      if (user.isBlocked) {
        return res.status(403).json({ 
          error: 'Your account has been blocked. Please contact an administrator.',
          blocked: true 
        });
      }
      
    next();
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Authorization middleware
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    
    next();
  };
};

// Group authorization middleware
const authorizeGroupAccess = (requiredRole) => {
  return (req, res, next) => {
    const groupId = req.params.id || req.params.groupId;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    // ADMIN can do everything always
    if (userRole === 'admin') {
      req.groupMember = { role: 'admin' };
      return next();
    }

    // Check if user is group owner
    db.get('SELECT owner_id FROM groups WHERE id = ?', [groupId], (err, group) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // If user is owner, they have all permissions
      if (group.owner_id === userId) {
        req.groupMember = { role: 'owner' };
        return next();
      }

      // Check if user is member with required role
      db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (err, member) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!member) {
          return res.status(403).json({ error: 'Access denied to this group' });
        }

        // For EDITOR users, check their group role
        if (userRole === 'editor') {
          // Check role hierarchy: owner > editor > viewer
          const roleHierarchy = { owner: 3, editor: 2, viewer: 1 };
          const userRoleLevel = roleHierarchy[member.role] || 0;
          const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

          if (userRoleLevel < requiredRoleLevel) {
            return res.status(403).json({ error: 'Insufficient permissions for this group' });
          }

          req.groupMember = member;
          return next();
        }

        // For other users (viewer, user), they can only view
        if (requiredRole === 'viewer') {
          req.groupMember = member;
          return next();
        }

        return res.status(403).json({ error: 'Insufficient permissions for this group' });
      });
    });
  };
};

// Utility to check if table is active
function checkTableActive(tableId, cb) {
  db.get('SELECT isActive FROM tables WHERE id = ?', [tableId], (err, row) => {
    if (err) return cb(err);
    if (!row) return cb(new Error('Table not found'));
    if (!row.isActive) return cb(new Error('This action is not allowed while the table is inactive.'));
    cb(null);
  });
}

// Check table permissions within group context
const checkTablePermissions = (action) => {
  return (req, res, next) => {
    const tableId = req.params.id || req.params.tableId;
    const userId = req.user.id;
    const userRole = req.user.role;
    const groupMember = req.groupMember;

    if (!tableId) {
      return res.status(400).json({ error: 'Table ID is required' });
    }

    // ADMIN can do everything
    if (userRole === 'admin') {
      return next();
    }

    // Get table details
    db.get('SELECT creatorId, groupId FROM tables WHERE id = ?', [tableId], (err, table) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!table) {
        return res.status(404).json({ error: 'Table not found' });
      }

      // If table is not in a group, use regular permissions
      if (!table.groupId) {
        if (userRole === 'editor') {
          // Check if editor created the table
          if (action === 'delete' && table.creatorId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to delete this table' });
          }
          if (action === 'edit' && !table.isActive && table.creatorId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to edit this table' });
          }
        }
        return next();
      }

      // Table is in a group - check group permissions
      if (!groupMember) {
        return res.status(403).json({ error: 'You do not have access to this group' });
      }

      // GROUP OWNER can do everything
      if (groupMember.role === 'owner') {
        return next();
      }

      // GROUP MANAGER (editor) can do table operations
      if (groupMember.role === 'editor') {
        if (action === 'delete' && table.creatorId !== userId) {
          return res.status(403).json({ error: 'You can only delete tables you created' });
        }
        if (action === 'edit' && !table.isActive && table.creatorId !== userId) {
          return res.status(403).json({ error: 'You can only edit inactive tables you created' });
        }
        return next();
      }

      // GROUP MEMBER (viewer) cannot perform table operations
      return res.status(403).json({ error: 'Members can only view tables. Contact a manager or owner for modifications.' });
    });
  };
};

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

// Routes
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }

  // Check if the user exists by email
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked. Please contact an administrator.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    // Compare passwords
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '10y' }
      );

      res.json({ 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role 
        } 
      });
    });
  });
});

// Get all tables (filtered by user permissions)
app.get('/api/tables', authenticate, (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  let query, params;

  if (isAdmin) {
    // Admin gets all tables
    query = 'SELECT * FROM tables ORDER BY createdAt DESC';
    params = [];
  } else {
    // Non-admin gets only tables from groups they have access to
    query = `
      SELECT DISTINCT t.* 
      FROM tables t
      WHERE t.groupId IN (
        SELECT g.id FROM groups g WHERE g.owner_id = ?
        UNION
        SELECT gm.group_id FROM group_members gm WHERE gm.user_id = ?
      )
      ORDER BY t.createdAt DESC
    `;
    params = [userId, userId];
  }

  db.all(query, params, (err, tables) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const tablePromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM players WHERE tableId = ?', [table.id], (err, players) => {
          if (err) {
            reject(err);
            return;
          }

          const playerPromises = players.map(player => {
            return new Promise((resolve, reject) => {
              db.all('SELECT * FROM buyins WHERE playerId = ?', [player.id], (err, buyIns) => {
                if (err) {
                  reject(err);
                  return;
                }

                db.all('SELECT * FROM cashouts WHERE playerId = ?', [player.id], (err, cashOuts) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  resolve({ ...player, buyIns, cashOuts });
                });
              });
            });
          });

          Promise.all(playerPromises)
            .then(playersWithTransactions => {
              resolve({ ...table, players: playersWithTransactions });
            })
            .catch(reject);
        });
      });
    });

    Promise.all(tablePromises)
      .then(tablesWithPlayers => {
        res.json(tablesWithPlayers);
      })
      .catch(err => {
        res.status(500).json({ error: err.message });
      });
  });
});

// Get all tables (public access)
app.get('/api/public/tables', (req, res) => {
  db.all('SELECT * FROM tables ORDER BY createdAt DESC', [], (err, tables) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const tablePromises = tables.map(table => {
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM players WHERE tableId = ?', [table.id], (err, players) => {
          if (err) {
            reject(err);
            return;
          }

          const playerPromises = players.map(player => {
            return new Promise((resolve, reject) => {
              db.all('SELECT * FROM buyins WHERE playerId = ?', [player.id], (err, buyIns) => {
                if (err) {
                  reject(err);
                  return;
                }

                db.all('SELECT * FROM cashouts WHERE playerId = ?', [player.id], (err, cashOuts) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  resolve({ ...player, buyIns, cashOuts });
                });
              });
            });
          });

          Promise.all(playerPromises)
            .then(playersWithTransactions => {
              resolve({ ...table, players: playersWithTransactions });
            })
            .catch(reject);
        });
      });
    });

    Promise.all(tablePromises)
      .then(tablesWithPlayers => {
        res.json(tablesWithPlayers);
      })
      .catch(err => {
        res.status(500).json({ error: err.message });
      });
  });
});

// Create new table
app.post('/api/tables', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { name, smallBlind, bigBlind, location, groupId, minimumBuyIn, gameDate } = req.body;
  
  if (!groupId) {
    return res.status(400).json({ error: 'Group ID is required' });
  }

  // Check group permissions
  const userId = req.user.id;
  const userRole = req.user.role;

  const createTableInDB = () => {
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const creatorId = req.user.id;
    const isActive = true;
    const gameDateStr = gameDate ? new Date(gameDate).toISOString() : createdAt;

    db.run(
      'INSERT INTO tables (id, name, smallBlind, bigBlind, location, isActive, createdAt, creatorId, groupId, minimumBuyIn, gameDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, smallBlind, bigBlind, location, isActive, createdAt, creatorId, groupId, minimumBuyIn, gameDateStr],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ ...req.body, id, players: [] });
      }
    );
  };

  // ADMIN can do everything
  if (userRole === 'admin') {
    return createTableInDB();
  }

  // Check if user is group owner
  db.get('SELECT owner_id FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // If user is owner, they have all permissions
    if (group.owner_id === userId) {
      return createTableInDB();
    }

    // Check if user is member with editor role
    db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!member) {
        return res.status(403).json({ error: 'Access denied to this group' });
      }

      // Check role hierarchy: owner > editor > viewer
      const roleHierarchy = { owner: 3, editor: 2, viewer: 1 };
      const userRoleLevel = roleHierarchy[member.role] || 0;
      const requiredRoleLevel = roleHierarchy['editor'] || 0;

      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({ error: 'Insufficient permissions for this group' });
      }

      // Continue with table creation
      return createTableInDB();
    });
  });
});

// Delete table
app.delete('/api/tables/:id', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const tableId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;

  const deleteTableFromDB = () => {
    db.run('DELETE FROM tables WHERE id = ?', [tableId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Table deleted' });
    });
  };

  // ADMIN can do everything
  if (userRole === 'admin') {
    return deleteTableFromDB();
  }

  // Get table details to check permissions
  db.get('SELECT creatorId, groupId FROM tables WHERE id = ?', [tableId], (err, table) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // If table is not in a group, use regular permissions
    if (!table.groupId) {
      if (userRole === 'editor') {
        // Check if editor created the table
        if (table.creatorId !== userId) {
          return res.status(403).json({ error: 'You do not have permission to delete this table' });
        }
      }
      return deleteTableFromDB();
    }

    // Table is in a group - check group permissions
    db.get('SELECT owner_id FROM groups WHERE id = ?', [table.groupId], (err, group) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // GROUP OWNER can do everything
      if (group.owner_id === userId) {
        return deleteTableFromDB();
      }

      // Check if user is member with required role
      db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [table.groupId, userId], (err, member) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!member) {
          return res.status(403).json({ error: 'You do not have access to this group' });
        }

        // GROUP MANAGER (editor) can delete tables they created
        if (member.role === 'editor') {
          if (table.creatorId !== userId) {
            return res.status(403).json({ error: 'You can only delete tables you created' });
          }
          return deleteTableFromDB();
        }

        // GROUP MEMBER (viewer) cannot delete tables
        return res.status(403).json({ error: 'Members can only view tables. Contact a manager or owner for modifications.' });
      });
    });
  });
});

// Add player to table
app.post('/api/tables/:tableId/players', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { name, nickname, chips, active = true, showMe = true } = req.body;
  const tableId = req.params.tableId;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Check permissions first
  db.get('SELECT creatorId, groupId FROM tables WHERE id = ?', [tableId], (err, table) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // ADMIN can do everything
    if (userRole === 'admin') {
      return addPlayerToTable();
    }

    // If table is not in a group, use regular permissions
    if (!table.groupId) {
      return addPlayerToTable();
    }

    // Table is in a group - check group permissions
    db.get('SELECT owner_id FROM groups WHERE id = ?', [table.groupId], (err, group) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // GROUP OWNER can do everything
      if (group.owner_id === userId) {
        return addPlayerToTable();
      }

      // Check if user is member with required role
      db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [table.groupId, userId], (err, member) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!member) {
          return res.status(403).json({ error: 'You do not have access to this group' });
        }

        // GROUP MANAGER (editor) can add players
        if (member.role === 'editor') {
          return addPlayerToTable();
        }

        // GROUP MEMBER (viewer) cannot add players
        return res.status(403).json({ error: 'Members can only view tables. Contact a manager or owner for modifications.' });
      });
    });
  });

  function addPlayerToTable() {
    checkTableActive(tableId, (err) => {
      if (err) {
        return res.status(403).json({ error: err.message });
      }
      
      const playerId = uuidv4();
      const initialBuyInId = uuidv4();
      const timestamp = new Date().toISOString();
      
      db.get('SELECT minimumBuyIn FROM tables WHERE id = ?', [tableId], (err, table) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to get table information' });
        }

        const initialBuyInAmount = Number(chips) || 0;

        db.serialize(() => {
          db.run(
            'INSERT INTO players (id, tableId, name, nickname, chips, totalBuyIn, active, showMe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [playerId, tableId, name, nickname, initialBuyInAmount, initialBuyInAmount, active, showMe],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Failed to add player' });
              }

              // Only add buy-in record if there's an initial buy-in amount
              if (initialBuyInAmount > 0) {
                db.run(
                  'INSERT INTO buyins (id, playerId, amount, timestamp) VALUES (?, ?, ?, ?)',
                  [initialBuyInId, playerId, initialBuyInAmount, timestamp],
                  function(buyinErr) {
                    if (buyinErr) {
                      // Continue even if buy-in recording fails
                    }
                    
                    const newPlayerResponse = {
                      id: playerId,
                      tableId: tableId,
                      name: name,
                      nickname: nickname,
                      chips: initialBuyInAmount,
                      totalBuyIn: initialBuyInAmount,
                      active: active,
                      showMe: showMe,
                      buyIns: [
                        {
                          id: initialBuyInId,
                          playerId: playerId,
                          amount: initialBuyInAmount,
                          timestamp: timestamp
                        }
                      ],
                      cashOuts: []
                    };
                    res.status(201).json(newPlayerResponse);
                  }
                );
              } else {
                // No initial buy-in
                const newPlayerResponse = {
                  id: playerId,
                  tableId: tableId,
                  name: name,
                  nickname: nickname,
                  chips: 0,
                  totalBuyIn: 0,
                  active: active,
                  showMe: showMe,
                  buyIns: [],
                  cashOuts: []
                };
                res.status(201).json(newPlayerResponse);
              }
            }
          );
        });
      });
    });
  }
});

// Remove player from table
app.delete('/api/tables/:tableId/players/:playerId', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const tableId = req.params.tableId;
  checkTableActive(tableId, (err) => {
    if (err) {
      return res.status(403).json({ error: err.message });
    }
    db.run('DELETE FROM players WHERE id = ? AND tableId = ?', [req.params.playerId, req.params.tableId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Player removed' });
    });
  });
});

// Update player chips
app.put('/api/tables/:tableId/players/:playerId/chips', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { chips } = req.body;
  db.run(
    'UPDATE players SET chips = ? WHERE id = ? AND tableId = ?',
    [chips, req.params.playerId, req.params.tableId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ chips });
    }
  );
});

// Add buy-in for player
app.post('/api/tables/:tableId/players/:playerId/buyins', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const tableId = req.params.tableId;
  checkTableActive(tableId, (err) => {
    if (err) {
      return res.status(403).json({ error: err.message });
    }
    const { amount } = req.body;
    const buyInId = uuidv4();
    const playerId = req.params.playerId;
    const timestamp = new Date().toISOString();
    
    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      return res.status(400).json({ error: 'Invalid amount for buyin' });
    }

    db.serialize(() => {
      db.run(
        'INSERT INTO buyins (id, playerId, amount, timestamp) VALUES (?, ?, ?, ?)',
        [buyInId, playerId, amount, timestamp],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to record buyin' });
          }

          db.run(
            'UPDATE players SET chips = COALESCE(chips, 0) + ?, totalBuyIn = COALESCE(totalBuyIn, 0) + ? WHERE id = ?',
            [numericAmount, numericAmount, playerId],
            function(updateErr) {
              if (updateErr) {
                return res.status(500).json({ error: 'Failed to update player after buyin' });
              }
              res.json({ id: buyInId, amount: numericAmount, timestamp });
            }
          );
        }
      );
    });
  });
});

// Delete buy-in for player
app.delete('/api/tables/:tableId/buyins/:buyinId', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const tableId = req.params.tableId;
  const buyinId = req.params.buyinId;
  
  checkTableActive(tableId, (err) => {
    if (err) {
      return res.status(403).json({ error: err.message });
    }

    db.serialize(() => {
      // First, get the buy-in details
      db.get('SELECT playerId, amount FROM buyins WHERE id = ?', [buyinId], (err, buyin) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to get buy-in details' });
        }
        
        if (!buyin) {
          return res.status(404).json({ error: 'Buy-in not found' });
        }

        const numericAmount = Number(buyin.amount);
        if (isNaN(numericAmount)) {
          return res.status(400).json({ error: 'Invalid buy-in amount' });
        }

        // Delete the buy-in
        db.run('DELETE FROM buyins WHERE id = ?', [buyinId], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to delete buy-in' });
          }

          // Update player's totalBuyIn and chips
          db.run(
            'UPDATE players SET totalBuyIn = COALESCE(totalBuyIn, 0) - ?, chips = COALESCE(chips, 0) - ? WHERE id = ?',
            [numericAmount, numericAmount, buyin.playerId],
            function(updateErr) {
              if (updateErr) {
                return res.status(500).json({ error: 'Failed to update player after buy-in deletion' });
              }

              // Get updated player data
              db.get(
                `SELECT p.*, 
                 GROUP_CONCAT(b.id || '|' || b.amount || '|' || b.timestamp) as buyIns,
                 GROUP_CONCAT(c.id || '|' || c.amount || '|' || c.timestamp) as cashOuts
                 FROM players p 
                 LEFT JOIN buyins b ON p.id = b.playerId 
                 LEFT JOIN cashouts c ON p.id = c.playerId 
                 WHERE p.id = ?
                 GROUP BY p.id`,
                [buyin.playerId],
                (err, player) => {
                  if (err) {
                    return res.status(500).json({ error: 'Failed to get updated player data' });
                  }

                  // Parse buy-ins and cash-outs
                  const parsedPlayer = {
                    ...player,
                    buyIns: player.buyIns ? player.buyIns.split(',').map(buyin => {
                      const [id, amount, timestamp] = buyin.split('|');
                      return { id, amount: Number(amount), timestamp };
                    }) : [],
                    cashOuts: player.cashOuts ? player.cashOuts.split(',').map(cashout => {
                      const [id, amount, timestamp] = cashout.split('|');
                      return { id, amount: Number(amount), timestamp };
                    }) : []
                  };

                  res.json({ 
                    message: 'Buy-in deleted successfully',
                    player: parsedPlayer
                  });
                }
              );
            }
          );
        });
      });
    });
  });
});

// Add cash-out for player
app.post('/api/tables/:tableId/players/:playerId/cashouts', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const tableId = req.params.tableId;
  checkTableActive(tableId, (err) => {
    if (err) {
      return res.status(403).json({ error: err.message });
    }
    const { amount } = req.body;
    const cashOutId = uuidv4();
    const playerId = req.params.playerId;
    const timestamp = new Date().toISOString();

    db.serialize(() => {
      db.run('DELETE FROM cashouts WHERE playerId = ?', [playerId], function(deleteErr) {
        if (deleteErr) {
        }

        db.run(
          'INSERT INTO cashouts (id, playerId, amount, timestamp) VALUES (?, ?, ?, ?)',
          [cashOutId, playerId, amount, timestamp],
          function(insertErr) {
            if (insertErr) {
              return res.status(500).json({ error: 'Failed to record cashout' });
            }

            const numericAmount = Number(amount);
            if (isNaN(numericAmount)) {
              return res.status(400).json({ error: 'Invalid amount for cashout' });
            }

            db.run(
              'UPDATE players SET active = false, chips = 0 WHERE id = ?',
              [playerId],
              function(updateErr) {
                if (updateErr) {
                  return res.status(500).json({ error: 'Failed to update player status after cashout' });
                }
                res.json({ id: cashOutId, amount: numericAmount, timestamp });
              }
            );
          }
        );
      });
    });
  });
});

// Update table status
app.put('/api/tables/:tableId/status', authenticate, authorize(['admin', 'editor']), async (req, res) => {
  const { isActive } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;
  const tableId = req.params.tableId;

  try {
    if (userRole === 'editor') {
      const tableRow = await new Promise((resolve, reject) => {
        db.get('SELECT creatorId, isActive FROM tables WHERE id = ?', [tableId], (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
      if (!tableRow) {
        return res.status(404).json({ error: 'Table not found' });
      }
      // אם השולחן לא אקטיבי, רק היוצר יכול להפעיל/להשבית
      if (!tableRow.isActive && tableRow.creatorId !== userId) {
        return res.status(403).json({ error: 'You do not have permission to change status for this table' });
      }
      // אם השולחן אקטיבי, כל עורך יכול להפעיל/להשבית
    }

    db.run(
      'UPDATE tables SET isActive = ? WHERE id = ?',
      [isActive, tableId],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ isActive });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reactivate player
app.put('/api/tables/:tableId/players/:playerId/reactivate', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const tableId = req.params.tableId;
  const playerId = req.params.playerId;
  
  checkTableActive(tableId, (err) => {
    if (err) {
      return res.status(403).json({ error: err.message });
    }
    
    db.serialize(() => {
      // Delete the player's cash-out
      db.run('DELETE FROM cashouts WHERE playerId = ?', [playerId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete cash-out' });
        }
        
        // Reactivate the player
        db.run(
          'UPDATE players SET active = true WHERE id = ? AND tableId = ?',
          [playerId, tableId],
          function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            // Get updated player data with empty cashOuts
            db.get(
              `SELECT p.*, 
               GROUP_CONCAT(b.id || '|' || b.amount || '|' || b.timestamp) as buyIns,
               GROUP_CONCAT(c.id || '|' || c.amount || '|' || c.timestamp) as cashOuts
               FROM players p 
               LEFT JOIN buyins b ON p.id = b.playerId 
               LEFT JOIN cashouts c ON p.id = c.playerId 
               WHERE p.id = ?
               GROUP BY p.id`,
              [playerId],
              (err, player) => {
                if (err) {
                  return res.status(500).json({ error: 'Failed to get updated player data' });
                }

                // Parse buy-ins and cash-outs
                const parsedPlayer = {
                  ...player,
                  buyIns: player.buyIns ? player.buyIns.split(',').map(buyin => {
                    const [id, amount, timestamp] = buyin.split('|');
                    return { id, amount: Number(amount), timestamp };
                  }) : [],
                  cashOuts: player.cashOuts ? player.cashOuts.split(',').map(cashout => {
                    const [id, amount, timestamp] = cashout.split('|');
                    return { id, amount: Number(amount), timestamp };
                  }) : []
                };

                res.json({ 
                  active: true,
                  player: parsedPlayer
                });
              }
            );
          }
        );
      });
    });
  });
});

// Update player showMe status
app.put('/api/tables/:tableId/players/:playerId/showme', authenticate, authorize(['admin', 'editor']), authorizeGroupAccess('editor'), checkTablePermissions('edit'), (req, res) => {
  const tableId = req.params.tableId;
  checkTableActive(tableId, (err) => {
    if (err) {
      return res.status(403).json({ error: err.message });
    }
    const { showMe } = req.body;

    db.run(
      'UPDATE players SET showMe = ? WHERE id = ? AND tableId = ?',
      [showMe, req.params.playerId, req.params.tableId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, showMe });
      }
    );
  });
});

// Get current user info
app.get('/api/users/me', authenticate, (req, res) => {
  db.get('SELECT id, username, email, role FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  });
});

// Get all users
app.get('/api/users', authenticate, authorize(['admin']), (req, res) => {

  db.all('SELECT id, username, email, role, isVerified, isBlocked, createdAt FROM users', [], (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json(users);
  });
});

// Delete user
app.delete('/api/users/:id', authenticate, authorize(['admin']), (req, res) => {
  const userId = req.params.id;


  // First check if user exists
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {

      return res.status(404).json({ error: 'User not found' });
    }



    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ message: 'User deleted successfully' });
    });
  });
});

// Update user role
app.put('/api/users/:id/role', authenticate, authorize(['admin']), (req, res) => {
  const userId = req.params.id;
  const { role } = req.body;



  // First check if user exists
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {

      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[Users] User found, proceeding with role update:', {
      id: user.id,
      username: user.username,
      currentRole: user.role,
      newRole: role
    });

    db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ message: 'User role updated successfully' });
    });
  });
});

// Update user password (admin only)
app.put('/api/users/:id/password', authenticate, authorize(['admin']), (req, res) => {
  const userId = req.params.id;
  const { password } = req.body;

  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password is required and must be at least 4 characters' });
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    db.run('UPDATE users SET password = ? WHERE id = ?', [hash, userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ message: 'Password updated successfully' });
    });
  });
});

// Update user email (admin only)
app.put('/api/users/:id/email', authenticate, authorize(['admin']), (req, res) => {
  const userId = req.params.id;
  const { email } = req.body;



  // Validate email format if provided
  if (email && email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
  }

  // Check if email is already in use by another user
  if (email && email.trim()) {
    db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email.trim(), userId], (err, existingUser) => {
      if (err) {
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (existingUser) {
        return res.status(409).json({ error: 'Email is already in use by another user' });
      }

      // Update email and set isVerified to true if email is being added
      const emailToSave = email.trim() || null;
      
      // Check if user currently has no email (to determine if we're adding one)
      db.get('SELECT email FROM users WHERE id = ?', [userId], (err, currentUser) => {
        if (err) {
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        const isAddingEmail = !currentUser.email && emailToSave;
        const updateQuery = isAddingEmail 
          ? 'UPDATE users SET email = ?, isVerified = 1 WHERE id = ?'
          : 'UPDATE users SET email = ? WHERE id = ?';
        const updateParams = isAddingEmail ? [emailToSave, userId] : [emailToSave, userId];
        
        db.run(updateQuery, updateParams, function(err) {
          if (err) {
            return res.status(500).json({ error: 'Internal server error' });
          }
          const message = isAddingEmail 
            ? 'Email added and user verified successfully' 
            : 'Email updated successfully';
          res.json({ message });
        });
      });
    });
  } else {
    // Update with null/empty email
    db.run('UPDATE users SET email = ? WHERE id = ?', [null, userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ message: 'Email updated successfully' });
    });
  }
});

// Update user blocked status (admin only)
app.put('/api/users/:id/blocked', authenticate, authorize(['admin']), (req, res) => {
  const userId = req.params.id;
  const { isBlocked } = req.body;



  // First check if user exists
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {

      return res.status(404).json({ error: 'User not found' });
    }



    db.run('UPDATE users SET isBlocked = ? WHERE id = ?', [isBlocked, userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({ message: 'User blocked status updated successfully' });
    });
  });
});

// Add a debug endpoint to check database status
app.get('/api/debug/db', (req, res) => {
  // Check if database file exists
  const dbExists = fs.existsSync(dbPath);
  
  if (!dbExists) {
    return res.status(500).json({ error: 'Database file not found', path: dbPath });
  }

  // Get all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Get all users
    db.all('SELECT id, username, role FROM users', [], (err, users) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Get admin user specifically
      db.get('SELECT id, username, role FROM users WHERE username = ?', ['admin'], (err, admin) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.json({
          dbPath,
          dbExists,
          tables,
          users,
          admin,
          timestamp: new Date().toISOString()
        });
      });
    });
  });
});

// Get table by ID (with access control)
app.get('/api/tables/:id', authenticate, (req, res) => {
  const tableId = req.params.id;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  db.get('SELECT * FROM tables WHERE id = ?', [tableId], (err, table) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Check access permissions
    const checkAccess = () => {
      if (isAdmin) {
        return true; // Admin can access any table
      }

      // If table is not in a group, check if user created it
      if (!table.groupId) {
        return table.creatorId === userId;
      }

      // For grouped tables, we'll check in the next step
      return null; // Need to check group membership
    };

    const accessResult = checkAccess();
    if (accessResult === false) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (accessResult === null) {
      // Need to check group membership
      db.get('SELECT owner_id FROM groups WHERE id = ?', [table.groupId], (err, group) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        if (!group) {
          return res.status(404).json({ error: 'Group not found' });
        }

        if (group.owner_id === userId) {
          // Group owner can access - continue to get players
          getPlayers();
        } else {
          // Check if user is member
          db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [table.groupId, userId], (err, member) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            if (!member) {
              return res.status(403).json({ error: 'Access denied' });
            }
            // Member can access - continue to get players
            getPlayers();
          });
        }
      });
    } else {
      // Direct access granted - get players
      getPlayers();
    }

    function getPlayers() {
      // Get players for the table
      db.all('SELECT * FROM players WHERE tableId = ?', [tableId], (err, players) => {
        if (err) {
          return res.status(500).json({ error: 'Internal server error' });
        }

        const playerPromises = players.map(player => {
          return new Promise((resolve, reject) => {
            // Get buy-ins
            db.all('SELECT * FROM buyins WHERE playerId = ?', [player.id], (err, buyIns) => {
              if (err) {
                reject(err);
                return;
              }

              // Get cash-outs
              db.all('SELECT * FROM cashouts WHERE playerId = ?', [player.id], (err, cashOuts) => {
                if (err) {
                  reject(err);
                  return;
                }

                resolve({ ...player, buyIns, cashOuts });
              });
            });
          });
        });

        Promise.all(playerPromises)
          .then(playersWithTransactions => {
            res.json({ ...table, players: playersWithTransactions });
          })
          .catch(err => {
            res.status(500).json({ error: 'Internal server error' });
          });
      });
    }
  });
});

// Update table
app.put('/api/tables/:id', authenticate, authorize(['admin', 'editor']), async (req, res) => {
  const tableId = req.params.id;
  const { name, smallBlind, bigBlind, location, food, groupId, minimumBuyIn, createdAt, gameDate } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // Check permissions first
    const tableRow = await new Promise((resolve, reject) => {
      db.get('SELECT creatorId, groupId, isActive FROM tables WHERE id = ?', [tableId], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });

    if (!tableRow) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // ADMIN can do everything
    if (userRole === 'admin') {
      // Continue with update
    } else {
      // If table is not in a group, use regular permissions
      if (!tableRow.groupId) {
        if (userRole === 'editor') {
          // Check if editor created the table
          if (!tableRow.isActive && tableRow.creatorId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to edit this table' });
          }
        }
      } else {
        // Table is in a group - check group permissions
        const group = await new Promise((resolve, reject) => {
          db.get('SELECT owner_id FROM groups WHERE id = ?', [tableRow.groupId], (err, row) => {
            if (err) return reject(err);
            resolve(row);
          });
        });

        if (!group) {
          return res.status(404).json({ error: 'Group not found' });
        }

        // GROUP OWNER can do everything
        if (group.owner_id === userId) {
          // Continue with update
        } else {
          // Check if user is member with required role
          const member = await new Promise((resolve, reject) => {
            db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [tableRow.groupId, userId], (err, row) => {
              if (err) return reject(err);
              resolve(row);
            });
          });

          if (!member) {
            return res.status(403).json({ error: 'You do not have access to this group' });
          }

          // GROUP MANAGER (editor) can edit tables
          if (member.role === 'editor') {
            if (!tableRow.isActive && tableRow.creatorId !== userId) {
              return res.status(403).json({ error: 'You can only edit inactive tables you created' });
            }
          } else {
            // GROUP MEMBER (viewer) cannot edit tables
            return res.status(403).json({ error: 'Members can only view tables. Contact a manager or owner for modifications.' });
          }
        }
      }
    }

    // Validate required fields
    if (!name || !smallBlind || !bigBlind) {
      return res.status(400).json({ error: 'Name, small blind, and big blind are required' });
    }

    // Check if table exists
    const tableExists = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tables WHERE id = ?', [tableId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row !== undefined);
      });
    });

    if (!tableExists) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Update table - add gameDate to SQL
    await new Promise((resolve, reject) => {
      const updateQuery = `
        UPDATE tables 
        SET name = ?, smallBlind = ?, bigBlind = ?, location = ?, food = ?, groupId = ?, minimumBuyIn = ?, gameDate = ?
        WHERE id = ?
      `;
      const gameDateStr = gameDate instanceof Date ? gameDate.toISOString() : new Date(gameDate).toISOString();
      db.run(updateQuery, [name, smallBlind, bigBlind, location, food, groupId, minimumBuyIn, gameDateStr, tableId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    // Get updated table
    const updatedTable = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM tables WHERE id = ?', [tableId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });

    res.json(updatedTable);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new endpoint to update passwords
app.post('/api/update-passwords', authenticate, authorize(['admin']), (req, res) => {
  const users = [
    { username: 'Doron', password: '365Scores!' },
    { username: 'Ran', password: 'Rabad123456' },
    { username: 'Bar', password: 'Baroni123456' },
    { username: 'OdedD', password: '123456789' },
    { username: 'OrAz', password: '123456789' },
    { username: 'Maor', password: 'Rocky123456' },
    { username: 'Omer', password: 'Tavor123456' },
    { username: 'Iftach', password: 'Iftach123' },
    { username: 'Ali', password: 'Sarsur123' },
    { username: 'Daniel', password: '1234' },
    { username: 'Denis', password: '1234' }
  ];

  let completed = 0;
  let errors = [];

  users.forEach(user => {
    bcrypt.hash(user.password, 10, (err, hash) => {
      if (err) {
        errors.push({ username: user.username, error: err.message });
        checkCompletion();
        return;
      }

      db.run(
        'UPDATE users SET password = ? WHERE username = ?',
        [hash, user.username],
        function(err) {
          if (err) {
            errors.push({ username: user.username, error: err.message });
          }
          completed++;
          checkCompletion();
        }
      );
    });
  });

  function checkCompletion() {
    if (completed === users.length) {
      if (errors.length > 0) {
        res.status(500).json({ 
          message: 'Some passwords failed to update',
          errors 
        });
      } else {
        res.json({ message: 'All passwords updated successfully' });
      }
    }
  }
});

// Public user registration with email verification
app.post('/api/register', (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username and password are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate password length
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Validate username length
  if (username.trim().length < 2) {
    return res.status(400).json({ error: 'Username must be at least 2 characters long' });
  }

  // Check if username already exists
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, existingUserByUsername) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (existingUserByUsername) {
      return res.status(409).json({ error: 'Username already exists' });
    }

  // Check if email already exists
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      if (existingUser.isBlocked) {
        return res.status(403).json({ error: 'Your account has been blocked. Please contact an administrator.' });
      }
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Hash password
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.status(500).json({ error: 'Error creating user' });
      }

      const id = uuidv4();
      const createdAt = new Date().toISOString();
      const role = 'user';
      const verificationCode = generateVerificationCode();
      const isVerified = 0;

      // Insert new user (not verified yet)
      db.run(
        'INSERT INTO users (id, username, email, password, role, createdAt, isVerified, verificationCode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, username, email, hash, role, createdAt, isVerified, verificationCode],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error creating user' });
          }

          // Send verification email
          const verifyUrl = `https://poker-management.onrender.com/verify-email?email=${encodeURIComponent(email)}`;
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'King7Offsuit - Email Verification',
            text: `Welcome to King7Offsuit!\n\nYour verification code is: ${verificationCode}\n\nTo verify your email, click the link below or enter the code in the app:\n${verifyUrl}`,
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              return res.status(500).json({ error: 'Failed to send verification email' });
            }
            res.status(201).json({ message: 'Registration successful! Please check your email for the verification code.' });
          });
        }
      );
      });
    });
  });
});

// Email verification endpoint
app.post('/api/verify-email', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked. Please contact an administrator.' });
    }
    if (user.isVerified) {
      return res.status(400).json({ error: 'User already verified' });
    }
    if (user.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    db.run('UPDATE users SET isVerified = 1, verificationCode = NULL, role = ? WHERE email = ?', ['editor', email], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to verify user' });
      }
      res.json({ message: 'Email verified successfully! You can now log in.' });
    });
  });
});

// Forgot password endpoint
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked. Please contact an administrator.' });
    }

    // Generate new verification code for password reset
    const resetCode = generateVerificationCode();
    
    db.run('UPDATE users SET verificationCode = ? WHERE email = ?', [resetCode, email], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to generate reset code' });
      }

      // Send password reset email
      const resetUrl = `https://poker-management.onrender.com/reset-password?email=${encodeURIComponent(email)}`;
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'King7Offsuit - Password Reset',
        text: `Hello ${user.username},\n\nYou requested a password reset for your King7Offsuit account.\n\nYour reset code is: ${resetCode}\n\nTo reset your password, click the link below or enter the code in the app:\n${resetUrl}\n\nIf you didn't request this reset, please ignore this email.\n\nThis code will expire in 1 hour.`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return res.status(500).json({ error: 'Failed to send reset email' });
        }
        res.json({ message: 'Password reset email sent successfully' });
      });
    });
  });
});

// Reset password endpoint
app.post('/api/reset-password', (req, res) => {
  const { email, verificationCode, newPassword } = req.body;
  if (!email || !verificationCode || !newPassword) {
    return res.status(400).json({ error: 'Email, verification code and new password are required' });
  }

  // Validate password length
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account has been blocked. Please contact an administrator.' });
    }

    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Hash new password
    bcrypt.hash(newPassword, 10, (err, hash) => {
      if (err) {
        return res.status(500).json({ error: 'Error updating password' });
      }

      // Update password and clear verification code
      db.run('UPDATE users SET password = ?, verificationCode = NULL WHERE email = ?', [hash, email], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update password' });
        }
        res.json({ message: 'Password reset successfully' });
      });
    });
  });
});

// Admin user registration (for admin panel)
app.post('/api/admin/register', authenticate, authorize(['admin']), (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password and role are required' });
  }

  // Check if username already exists
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.status(500).json({ error: 'Error creating user' });
      }

      const id = uuidv4();
      const createdAt = new Date().toISOString();

      // Insert new user
      db.run(
        'INSERT INTO users (id, username, password, role, createdAt) VALUES (?, ?, ?, ?, ?)',
        [id, username, hash, role, createdAt],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error creating user' });
          }

          res.status(201).json({
            id,
            username,
            role,
            createdAt
          });
        }
      );
    });
  });
});

// Get shared table by ID (authenticated access only, must be group member)
app.get('/api/share/:id', authenticate, (req, res) => {
  const tableId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;

  db.get('SELECT * FROM tables WHERE id = ?', [tableId], (err, table) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // If table is not in a group, allow access to authenticated users
    if (!table.groupId) {
      return fetchTableData();
    }

    // Table is in a group - check if user has access
    // ADMIN can access any group
    if (userRole === 'admin') {
      return fetchTableData();
    }

    // Check if user is group owner
    db.get('SELECT owner_id FROM groups WHERE id = ?', [table.groupId], (err, group) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // If user is owner, allow access
      if (group.owner_id === userId) {
        return fetchTableData();
      }

      // Check if user is member of the group
      db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [table.groupId, userId], (err, member) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!member) {
          return res.status(403).json({ error: 'You do not have access to this table. You must be a member of the group to view shared tables.' });
        }

        // User is a member, allow access
        return fetchTableData();
      });
    });

    function fetchTableData() {
      db.all('SELECT * FROM players WHERE tableId = ?', [tableId], (err, players) => {
        if (err) {
          return res.status(500).json({ error: 'Error fetching players' });
        }

        const playerPromises = players.map(player => {
          return new Promise((resolve, reject) => {
            db.all('SELECT * FROM buyins WHERE playerId = ?', [player.id], (err, buyIns) => {
              if (err) {
                reject(err);
                return;
              }

              db.all('SELECT * FROM cashouts WHERE playerId = ?', [player.id], (err, cashOuts) => {
                if (err) {
                  reject(err);
                  return;
                }

                resolve({ ...player, buyIns, cashOuts });
              });
            });
          });
        });

        Promise.all(playerPromises)
          .then(playersWithTransactions => {
            res.json({ ...table, players: playersWithTransactions });
          })
          .catch(err => {
            res.status(500).json({ error: 'Error processing player data' });
          });
      });
    }
  });
});

// Get unique player names from statistics (authenticated access only)
app.get('/api/statistics/players', authenticate, (req, res) => {
  const query = `
    SELECT DISTINCT p.name 
    FROM players p
    INNER JOIN tables t ON p.tableId = t.id
    WHERE t.isActive = 0
    ORDER BY p.name
  `;
  
  db.all(query, [], (err, players) => {
    if (err) {
      res.status(500).json({ error: 'Failed to fetch player names' });
      return;
    }
    
    const playerNames = players.map(player => player.name);
    res.json(playerNames);
  });
});

// Get all groups (admin only) - or user's groups for non-admin
app.get('/api/groups', authenticate, (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (isAdmin) {
    // Admin gets all groups
    db.all('SELECT * FROM groups ORDER BY name', [], (err, groups) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(groups);
    });
  } else {
    // Non-admin gets only groups where they are owner or member
    db.all('SELECT *, "owner" as userRole FROM groups WHERE owner_id = ?', [userId], (err, ownedGroups) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.all(`
        SELECT g.*, gm.role as userRole 
        FROM groups g 
        JOIN group_members gm ON g.id = gm.group_id 
        WHERE gm.user_id = ?
      `, [userId], (err, memberGroups) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        const allGroups = [...ownedGroups, ...memberGroups].sort((a, b) => a.name.localeCompare(b.name));
        res.json(allGroups);
      });
    });
  }
});

// Search groups for joining (excludes groups user is already member of)
app.get('/api/groups/search', authenticate, (req, res) => {
  const { q } = req.query;
  const userId = req.user.id;

  if (!q || q.length < 3) {
    return res.json([]);
  }

  // Get groups that match search term and user is not a member of
  db.all(`
    SELECT g.id, g.name, g.description, g.createdAt,
           u.username as owner_username, u.email as owner_email
    FROM groups g
    JOIN users u ON g.owner_id = u.id
    WHERE g.name LIKE ? 
    AND g.id NOT IN (
      SELECT group_id FROM group_members WHERE user_id = ?
    )
    AND g.owner_id != ?
    AND g.isActive = 1
    ORDER BY g.name
    LIMIT 20
  `, [`%${q}%`, userId, userId], (err, groups) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(groups);
  });
});

// Get user's groups (groups where user is owner or member, or all groups for admin)
app.get('/api/my-groups', authenticate, (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (isAdmin) {
    // Admin gets all groups with their actual roles and table counts
    db.all(`
      SELECT g.*, 
        CASE 
          WHEN g.owner_id = ? THEN 'owner'
          WHEN gm.role IS NOT NULL THEN gm.role
          ELSE 'none'
        END as userRole,
        COALESCE(table_counts.table_count, 0) as tableCount,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) + 1 as memberCount
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = ?
      LEFT JOIN (
        SELECT groupId, COUNT(*) as table_count 
        FROM tables 
        WHERE groupId IS NOT NULL 
        GROUP BY groupId
      ) table_counts ON g.id = table_counts.groupId
      ORDER BY 
        CASE 
          WHEN g.owner_id = ? THEN 1
          WHEN gm.role = 'editor' THEN 2
          WHEN gm.role = 'viewer' THEN 3
          ELSE 4
        END,
        COALESCE(table_counts.table_count, 0) DESC,
        g.name
    `, [userId, userId, userId], (err, allGroups) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(allGroups);
    });
  } else {
    // Non-admin gets only groups where they are owner or member
    db.all(`
      SELECT g.*, "owner" as userRole,
        COALESCE(table_counts.table_count, 0) as tableCount,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) + 1 as memberCount
      FROM groups g
      LEFT JOIN (
        SELECT groupId, COUNT(*) as table_count 
        FROM tables 
        WHERE groupId IS NOT NULL 
        GROUP BY groupId
      ) table_counts ON g.id = table_counts.groupId
      WHERE g.owner_id = ?
      ORDER BY COALESCE(table_counts.table_count, 0) DESC, g.name
    `, [userId], (err, ownedGroups) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      db.all(`
        SELECT g.*, gm.role as userRole,
          COALESCE(table_counts.table_count, 0) as tableCount,
          (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) + 1 as memberCount
        FROM groups g 
        JOIN group_members gm ON g.id = gm.group_id 
        LEFT JOIN (
          SELECT groupId, COUNT(*) as table_count 
          FROM tables 
          WHERE groupId IS NOT NULL 
          GROUP BY groupId
        ) table_counts ON g.id = table_counts.groupId
        WHERE gm.user_id = ?
        ORDER BY 
          CASE 
            WHEN gm.role = 'editor' THEN 1
            WHEN gm.role = 'viewer' THEN 2
            ELSE 3
          END,
          COALESCE(table_counts.table_count, 0) DESC,
          g.name
      `, [userId], (err, memberGroups) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        const allGroups = [...ownedGroups, ...memberGroups];
        res.json(allGroups);
      });
    });
  }
});

// Get user's group memberships (admin only)
app.get('/api/users/:userId/groups', authenticate, authorize(['admin']), (req, res) => {
  const targetUserId = req.params.userId;
  
  // Get groups where user is owner
  db.all(`
    SELECT g.id as groupId, g.name as groupName, 'owner' as role, g.createdAt as joinedAt,
           COALESCE(table_counts.table_count, 0) as tableCount
    FROM groups g
    LEFT JOIN (
      SELECT groupId, COUNT(*) as table_count 
      FROM tables 
      WHERE groupId IS NOT NULL 
      GROUP BY groupId
    ) table_counts ON g.id = table_counts.groupId
    WHERE g.owner_id = ?
    ORDER BY g.name
  `, [targetUserId], (err, ownedGroups) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Get groups where user is member
    db.all(`
      SELECT g.id as groupId, g.name as groupName, gm.role, gm.created_at as joinedAt,
             COALESCE(table_counts.table_count, 0) as tableCount
      FROM groups g 
      JOIN group_members gm ON g.id = gm.group_id 
      LEFT JOIN (
        SELECT groupId, COUNT(*) as table_count 
        FROM tables 
        WHERE groupId IS NOT NULL 
        GROUP BY groupId
      ) table_counts ON g.id = table_counts.groupId
      WHERE gm.user_id = ?
      ORDER BY g.name
    `, [targetUserId], (err, memberGroups) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const allMemberships = [...ownedGroups, ...memberGroups];
      res.json({ groupMemberships: allMemberships });
    });
  });
});

// Create new group (admin and editor only)
app.post('/api/groups', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { name, description } = req.body;
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const createdBy = req.user.id;

  db.run(
    'INSERT INTO groups (id, name, description, createdAt, createdBy, owner_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, description, createdAt, createdBy, createdBy],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, name, description, createdAt, createdBy, owner_id: createdBy, isActive: true });
    }
  );
});

// Update group (admin only)
app.put('/api/groups/:id', authenticate, authorize(['admin']), (req, res) => {
  const { name, description, isActive } = req.body;
  const groupId = req.params.id;

  db.run(
    'UPDATE groups SET name = ?, description = ?, isActive = ? WHERE id = ?',
    [name, description, isActive ? 1 : 0, groupId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: groupId, name, description, isActive });
    }
  );
});

// Delete group (admin or group owner only)
app.delete('/api/groups/:id', authenticate, (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  // Check if user is admin or group owner
  db.get('SELECT owner_id FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = group.owner_id === userId;

    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: 'Only admin or group owner can delete this group' });
      return;
    }

    // First check if there are any tables using this group
    db.get('SELECT COUNT(*) as count FROM tables WHERE groupId = ?', [groupId], (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      if (result.count > 0) {
        res.status(400).json({ error: 'Cannot delete group that has tables assigned to it' });
        return;
      }

      db.run('DELETE FROM groups WHERE id = ?', [groupId], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ message: 'Group deleted successfully' });
      });
    });
  });
});

// ===== GROUP MEMBERS MANAGEMENT =====

// Helper function to check if user is group owner
const isGroupOwner = (groupId, userId, callback) => {
  db.get('SELECT owner_id FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) {
      callback(err);
      return;
    }
    if (!group) {
      callback(new Error('Group not found'));
      return;
    }
    callback(null, group.owner_id === userId);
  });
};

// Helper function to check if user is group member with specific role
const getGroupMemberRole = (groupId, userId, callback) => {
  db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (err, member) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, member ? member.role : null);
  });
};

// Get specific group details (with access control)
app.get('/api/groups/:id', authenticate, (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  // Check if group exists
  db.get('SELECT * FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Admin can access any group
    if (isAdmin) {
      return res.json(group);
    }

    // Check if user is owner
    if (group.owner_id === userId) {
      return res.json({ ...group, userRole: 'owner' });
    }

    // Check if user is member
    db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!member) {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.json({ ...group, userRole: member.role });
    });
  });
});

// Get group members
app.get('/api/groups/:id/members', authenticate, (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  // Check if user has access to this group
  db.get('SELECT owner_id FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // ADMIN can access any group
    if (isAdmin) {
      return fetchGroupMembers();
    }

    // Check if user is owner or member
    const isOwner = group.owner_id === userId;
    if (!isOwner) {
      // Check if user is a member
      db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (err, member) => {
        if (err || !member) {
          return res.status(403).json({ error: 'Access denied' });
        }
        // Continue to fetch members
        fetchGroupMembers();
      });
    } else {
      fetchGroupMembers();
    }

    function fetchGroupMembers() {
      // Get owner info
      db.get('SELECT id, username, email FROM users WHERE id = ?', [group.owner_id], (err, owner) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Get all members
        db.all(`
          SELECT gm.role, gm.created_at, u.id, u.username, u.email 
          FROM group_members gm 
          JOIN users u ON gm.user_id = u.id 
          WHERE gm.group_id = ?
          ORDER BY gm.created_at ASC
        `, [groupId], (err, members) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          res.json({
            owner: { ...owner, role: 'owner' },
            members: members || []
          });
        });
      });
    }
  });
});

// Add member to group (owner only)
app.post('/api/groups/:id/members', authenticate, (req, res) => {
  const groupId = req.params.id;
  const { userId, role } = req.body;
  const requestingUserId = req.user.id;

  if (!userId || !role) {
    return res.status(400).json({ error: 'User ID and role are required' });
  }

  if (!['editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be editor or viewer' });
  }

  // Check if requesting user is group owner
  isGroupOwner(groupId, requestingUserId, (err, isOwner) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!isOwner) {
      return res.status(403).json({ error: 'Only group owner can add members' });
    }

    // Check if user exists
    db.get('SELECT id FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user is already a member
      db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (err, existingMember) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        if (existingMember) {
          return res.status(409).json({ error: 'User is already a member of this group' });
        }

        // Add member
        const memberId = uuidv4();
        db.run('INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, ?)', 
          [memberId, groupId, userId, role], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.status(201).json({ message: 'Member added successfully' });
        });
      });
    });
  });
});

// Update member role (owner only)
app.put('/api/groups/:id/members/:userId', authenticate, (req, res) => {
  const groupId = req.params.id;
  const memberUserId = req.params.userId;
  const { role } = req.body;
  const requestingUserId = req.user.id;

  if (!role || !['editor', 'viewer', 'owner'].includes(role)) {
    return res.status(400).json({ error: 'Valid role is required' });
  }

  // Check if requesting user is group owner
  isGroupOwner(groupId, requestingUserId, (err, isOwner) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!isOwner) {
      return res.status(403).json({ error: 'Only group owner can update member roles' });
    }

    // Check if this is an ownership transfer
    if (role === 'owner') {
      // Start transaction for ownership transfer
      db.serialize(() => {
        // Update group owner
        db.run('UPDATE groups SET owner_id = ? WHERE id = ?', [memberUserId, groupId], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          // Remove the new owner from group_members table (since they're now the owner)
          db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, memberUserId], function(err) {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Add the old owner as a manager in group_members
            db.run('INSERT INTO group_members (group_id, user_id, role, created_at) VALUES (?, ?, ?, ?)', 
              [groupId, requestingUserId, 'editor', new Date().toISOString()], function(err) {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }
              
              // Get group name and new owner email for notifications
              db.get('SELECT name FROM groups WHERE id = ?', [groupId], (err, group) => {
                if (err) {
                  console.error('Error fetching group name:', err);
                }
                
                db.get('SELECT email, username FROM users WHERE id = ?', [memberUserId], (err, newOwner) => {
                  if (err) {
                    console.error('Error fetching new owner details:', err);
                  }
                  
                  // Send email to new owner
                  if (newOwner && newOwner.email) {
                    try {
                      const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                          user: process.env.EMAIL_USER,
                          pass: process.env.EMAIL_PASS
                        }
                      });

                      const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: newOwner.email,
                        subject: `You are now the owner of: ${group ? group.name : 'Group'}`,
                        html: `
                          <h2>Congratulations! You are now the group owner</h2>
                          <p>You have been transferred ownership of the group <strong>${group ? group.name : 'Group'}</strong>.</p>
                          <p><strong>What this means:</strong></p>
                          <ul>
                            <li>You now have full control over this group</li>
                            <li>You can manage all members and their roles</li>
                            <li>You can create and manage tables within this group</li>
                            <li>You can transfer ownership to another member if needed</li>
                          </ul>
                          <p><strong>Group Details:</strong></p>
                          <ul>
                            <li><strong>Group Name:</strong> ${group ? group.name : 'Group'}</li>
                            <li><strong>Transfer Date:</strong> ${new Date().toLocaleString()}</li>
                          </ul>
                          <p>You can access your group management panel from the main menu.</p>
                          <p>Best regards,<br>Poker Management System</p>
                        `
                      };

                      transporter.sendMail(mailOptions, (emailErr) => {
                        if (emailErr) {
                          console.error('Error sending ownership transfer email:', emailErr);
                        } else {
                          
                        }
                      });
                    } catch (emailError) {
                      console.error('Error setting up ownership transfer email:', emailError);
                    }
                  }
                  
                  // Create notification for new owner
                  db.run(`
                    INSERT INTO notifications (user_id, type, title, message, group_id)
                    VALUES (?, 'ownership_transfer', 'New Group Ownership', ?, ?)
                  `, [
                    memberUserId,
                    `You are now the owner of "${group ? group.name : 'Group'}"`,
                    groupId
                  ], function(err) {
                    if (err) {
                      console.error('Error creating ownership transfer notification:', err);
                    } else {
                      
                    }
                  });
                  
                  res.json({ message: 'Ownership transferred successfully' });
                });
              });
            });
          });
        });
      });
    } else {
      // Regular role update
      db.run('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?', 
        [role, groupId, memberUserId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Member not found' });
        }
        
        // Check if this is a promotion to manager (editor role)
        if (role === 'editor') {
          // Get group name and member details for notifications
          db.get('SELECT name FROM groups WHERE id = ?', [groupId], (err, group) => {
            if (err) {
              console.error('Error fetching group name:', err);
            }
            
            db.get('SELECT email, username FROM users WHERE id = ?', [memberUserId], (err, newManager) => {
              if (err) {
                console.error('Error fetching new manager details:', err);
              }
              
              // Send email to new manager
              if (newManager && newManager.email) {
                try {
                  const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                      user: process.env.EMAIL_USER,
                      pass: process.env.EMAIL_PASS
                    }
                  });

                  const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: newManager.email,
                    subject: `You are now a Manager in: ${group ? group.name : 'Group'}`,
                    html: `
                      <h2>Congratulations! You are now a Manager</h2>
                      <p>Your role has been upgraded to <strong>Manager</strong> in the group <strong>${group ? group.name : 'Group'}</strong>.</p>
                      <p><strong>What this means:</strong></p>
                      <ul>
                        <li>You can create and manage poker tables within this group</li>
                        <li>You can add and remove players from tables</li>
                        <li>You can manage buy-ins and cash-outs for players</li>
                        <li>You can edit table settings and player information</li>
                        <li>You have enhanced permissions to help manage this group's activities</li>
                      </ul>
                      <p><strong>Group Details:</strong></p>
                      <ul>
                        <li><strong>Group Name:</strong> ${group ? group.name : 'Group'}</li>
                        <li><strong>Promotion Date:</strong> ${new Date().toLocaleString()}</li>
                      </ul>
                      <p>You can access your enhanced group features from the main menu.</p>
                      <p>Best regards,<br>Poker Management System</p>
                    `
                  };

                  transporter.sendMail(mailOptions, (emailErr) => {
                    if (emailErr) {
                      console.error('Error sending manager promotion email:', emailErr);
                    } else {
                      
                    }
                  });
                } catch (emailError) {
                  console.error('Error setting up manager promotion email:', emailError);
                }
              }
              
              // Create notification for new manager
              db.run(`
                INSERT INTO notifications (user_id, type, title, message, group_id)
                VALUES (?, 'role_promotion', 'Role Promotion', ?, ?)
              `, [
                memberUserId,
                `You are now a Manager in "${group ? group.name : 'Group'}"`,
                groupId
              ], function(err) {
                if (err) {
                  console.error('Error creating manager promotion notification:', err);
                } else {
                  
                }
              });
            });
          });
        }
        
        res.json({ message: 'Member role updated successfully' });
      });
    }
  });
});

// Remove member from group (owner only)
app.delete('/api/groups/:id/members/:userId', authenticate, (req, res) => {
  const groupId = req.params.id;
  const memberUserId = req.params.userId;
  const requestingUserId = req.user.id;

  // Check if requesting user is group owner
  isGroupOwner(groupId, requestingUserId, (err, isOwner) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!isOwner) {
      return res.status(403).json({ error: 'Only group owner can remove members' });
    }

    // Remove member
    db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', 
      [groupId, memberUserId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Member not found' });
      }
      res.json({ message: 'Member removed successfully' });
    });
  });
});

// Get user by email (for adding members to groups)
app.get('/api/users/by-email/:email', authenticate, (req, res) => {
  const email = decodeURIComponent(req.params.email);
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  db.get('SELECT id, username, email FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  });
});

// Transfer group ownership (owner only)
app.put('/api/groups/:id/transfer-ownership', authenticate, (req, res) => {
  const groupId = req.params.id;
  const { newOwnerId } = req.body;
  const currentOwnerId = req.user.id;

  if (!newOwnerId) {
    return res.status(400).json({ error: 'New owner ID is required' });
  }

  // Check if requesting user is current group owner
  isGroupOwner(groupId, currentOwnerId, (err, isOwner) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!isOwner) {
      return res.status(403).json({ error: 'Only current owner can transfer ownership' });
    }

    // Check if new owner exists
    db.get('SELECT id FROM users WHERE id = ?', [newOwnerId], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!user) {
        return res.status(404).json({ error: 'New owner not found' });
      }

      // Check if new owner is already a member
      db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, newOwnerId], (err, member) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Start transaction
        db.serialize(() => {
          // Update group owner
          db.run('UPDATE groups SET owner_id = ? WHERE id = ?', [newOwnerId, groupId], function(err) {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }

            // If new owner was a member, remove them from members table
            if (member) {
              db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, newOwnerId], function(err) {
                if (err) {
                  return res.status(500).json({ error: 'Database error' });
                }
                res.json({ message: 'Ownership transferred successfully' });
              });
            } else {
              res.json({ message: 'Ownership transferred successfully' });
            }
          });
        });
      });
    });
  });
});

// Request to join a group
app.post('/api/groups/:id/join-request', authenticate, (req, res) => {
  
  const groupId = req.params.id;
  const userId = req.user.id;

  // Check if group exists and is active
  db.get('SELECT g.*, u.username as owner_username, u.email as owner_email FROM groups g JOIN users u ON g.owner_id = u.id WHERE g.id = ? AND g.isActive = 1', [groupId], (err, group) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!group) {
      return res.status(404).json({ error: 'Group not found or inactive' });
    }

    // Check if user is not the owner
    if (group.owner_id === userId) {
      return res.status(400).json({ error: 'You cannot request to join your own group' });
    }

    // Check if user is already a member
    db.get('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (member) {
        return res.status(409).json({ error: 'You are already a member of this group' });
      }

      // Check if there's already a pending request
      
      
      // Convert UUIDs to integers for checking
      const groupIdInt = parseInt(groupId.replace(/[^0-9]/g, '').substring(0, 9), 10);
      const userIdInt = parseInt(userId.replace(/[^0-9]/g, '').substring(0, 9), 10);
      
      db.get('SELECT id FROM group_join_requests WHERE group_id = ? AND user_id = ? AND status = "pending"', [groupIdInt, userIdInt], (err, existingRequest) => {
        if (err) {
          console.error('[DB] Error checking existing join request:', err);
          return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        if (existingRequest) {
          return res.status(409).json({ error: 'You already have a pending request to join this group. Please wait for the owner to respond.' });
        }

        // Create join request
        
        
        // Convert UUID strings to integers for the group_join_requests table
        // We'll use a simple hash function to convert UUID to integer
        const groupIdInt = parseInt(groupId.replace(/[^0-9]/g, '').substring(0, 9), 10);
        const userIdInt = parseInt(userId.replace(/[^0-9]/g, '').substring(0, 9), 10);
        
        console.log('[DB] Converting UUIDs to integers:', { 
          groupId, groupIdInt, 
          userId, userIdInt 
        });
        
        db.run('INSERT INTO group_join_requests (group_id, user_id, status) VALUES (?, ?, "pending")', 
          [groupIdInt, userIdInt], function(err) {
          if (err) {
            console.error('[DB] Error inserting join request:', err);
            return res.status(500).json({ error: 'Database error: ' + err.message });
          }

          // Send email to group owner
          try {
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
              }
            });

            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: group.owner_email,
              subject: `New Join Request for Group: ${group.name}`,
              html: `
                <h2>New Join Request</h2>
                <p>A user has requested to join your group <strong>${group.name}</strong>.</p>
                <p><strong>Request Details:</strong></p>
                <ul>
                  <li><strong>Group:</strong> ${group.name}</li>
                  <li><strong>Requesting User:</strong> ${req.user.username}</li>
                  <li><strong>Request Date:</strong> ${new Date().toLocaleString()}</li>
                </ul>
                <p>You can approve or reject this request from your notifications panel (click the bell icon in the top right).</p>
                <p>Best regards,<br>Poker Management System</p>
              `
            };

            transporter.sendMail(mailOptions, (emailErr) => {
              if (emailErr) {
                console.error('Error sending email:', emailErr);
                // Don't fail the request if email fails
              } else {
                
              }
            });
          } catch (emailError) {
            console.error('Error setting up email:', emailError);
            // Don't fail the request if email setup fails
          }

          // Create notification for group owner
          
          db.run(`
            INSERT INTO notifications (user_id, type, title, message, group_id, request_id)
            VALUES (?, 'join_request', 'New Join Request', ?, ?, ?)
          `, [
            group.owner_id,
            `${req.user.username} wants to join your group "${group.name}"`,
            groupId,
            this.lastID
          ], function(err) {
            if (err) {
              console.error('Error creating join request notification:', err);
            } else {
              
            }
          });

          res.status(201).json({ 
            message: 'Join request sent successfully',
            requestId: this.lastID
          });
        });
      });
    });
  });
});

// Update payment method and comment for a player in a table
app.post('/api/player/payment', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { playerId, tableId, payment_method, payment_comment } = req.body;

  if (!playerId || !tableId) {
    return res.status(400).json({ error: 'Missing playerId or tableId' });
  }

  db.run(
    `UPDATE players SET payment_method = ?, payment_comment = ? WHERE id = ? AND tableId = ?`,
    [payment_method, payment_comment, playerId, tableId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update payment method' });
      }

      // After updating, fetch the updated player to return it
      db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, player) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch updated player data' });
        }
        if (!player) {
          return res.status(404).json({ error: 'Player not found after update' });
        }
        res.json(player);
      });
    }
  );
});

// Get notifications for a user
app.get('/api/notifications', authenticate, (req, res) => {
  const userId = req.user.id;
  
  
  
  db.all(`
    SELECT id, type, title, message, group_id, request_id, is_read, created_at
    FROM notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC
    LIMIT 50
  `, [userId], (err, notifications) => {
    if (err) {
      console.error('[DB] Error fetching notifications:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json(notifications);
  });
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticate, (req, res) => {
  const notificationId = req.params.id;
  const userId = req.user.id;
  
  db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', 
    [notificationId, userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ message: 'Notification marked as read' });
  });
});

// Mark all notifications as read for a user
app.put('/api/notifications/mark-all-read', authenticate, (req, res) => {
  const userId = req.user.id;
  
  
  
  db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', 
    [userId], function(err) {
    if (err) {
      console.error('[DB] Error marking notifications as read:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ 
      message: 'All notifications marked as read',
      updatedCount: this.changes
    });
  });
});

// Debug endpoint to check join requests
app.get('/api/debug/join-requests', authenticate, (req, res) => {
  db.all('SELECT * FROM group_join_requests ORDER BY created_at DESC LIMIT 20', (err, requests) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(requests);
  });
});

// Debug endpoint to check users
app.get('/api/debug/users', authenticate, (req, res) => {
  db.all('SELECT id, username, email FROM users ORDER BY id DESC LIMIT 20', (err, users) => {
    if (err) {
      console.error('[DB] Error fetching users:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(users);
  });
});

// Debug endpoint to check specific user
app.get('/api/debug/users/:userId', authenticate, (req, res) => {
  const userId = req.params.userId;
  
  // Try both formats
  db.get('SELECT * FROM users WHERE id = ? OR CAST(id AS TEXT) = ?', 
    [userId, userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  });
});

// Debug endpoint to check group members
app.get('/api/debug/groups/:groupId/members', authenticate, (req, res) => {
  const groupId = req.params.groupId;
  
  db.all('SELECT * FROM group_members WHERE group_id = ?', [groupId], (err, members) => {
    if (err) {
      console.error('[DB] Error fetching group members:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(members);
  });
});

// Debug endpoint to check table structure
app.get('/api/debug/table-structure/:tableName', authenticate, (req, res) => {
  const tableName = req.params.tableName;
  
  db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
    if (err) {
      console.error('[DB] Error fetching table structure:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(columns);
  });
});

// Get request status
app.get('/api/groups/:groupId/join-request/:requestId/status', authenticate, (req, res) => {
  const groupId = req.params.groupId;
  const requestId = req.params.requestId;
  
  const groupIdInt = parseInt(groupId.replace(/[^0-9]/g, '').substring(0, 9), 10);
  
  
  
  db.get('SELECT * FROM group_join_requests WHERE id = ? AND group_id = ?', 
    [requestId, groupIdInt], (err, request) => {
    if (err) {
      console.error('[DB] Error checking request status:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!request) {
      console.error('[DB] Request not found for status check:', { requestId, groupIdInt });
      return res.status(404).json({ error: 'Request not found' });
    }
    
    res.json({ 
      status: request.status,
      request: request
    });
  });
});

// Approve join request
app.post('/api/groups/:groupId/join-request/:requestId/approve', authenticate, (req, res) => {
  const groupId = req.params.groupId;
  const requestId = req.params.requestId;
  const userId = req.user.id;

  

  // Check if user is group owner
  db.get('SELECT owner_id, name FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) {
      console.error('[DB] Error checking group ownership:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!group) {
      console.error('[API] Group not found:', groupId);
      return res.status(404).json({ error: 'Group not found' });
    }
    if (group.owner_id !== userId) {
      console.error('[API] User not group owner:', { userId, ownerId: group.owner_id });
      return res.status(403).json({ error: 'Only group owner can approve requests' });
    }

    // Convert groupId to integer for group_join_requests table
    const groupIdInt = parseInt(groupId.replace(/[^0-9]/g, '').substring(0, 9), 10);
    console.log('[API] Converted groupId:', { original: groupId, converted: groupIdInt });

    // Get the join request
    console.log('[DB] Searching for join request:', { requestId, groupIdInt });
    db.get('SELECT * FROM group_join_requests WHERE id = ? AND group_id = ? AND status = "pending"', 
      [requestId, groupIdInt], (err, request) => {
      if (err) {
        console.error('[DB] Error finding join request:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (!request) {
        console.error('[DB] Join request not found:', { requestId, groupIdInt });
        // Let's check what requests exist for this group
        db.all('SELECT * FROM group_join_requests WHERE group_id = ?', [groupIdInt], (err, allRequests) => {
          if (err) {
            console.error('[DB] Error checking all requests:', err);
          } else {
            console.log('[DB] All requests for group:', allRequests);
          }
        });
        return res.status(404).json({ error: 'Join request not found or already processed' });
      }

      // Get requesting user details (handle both UUID and integer formats)
      const userIdToCheck = typeof request.user_id === 'string' && request.user_id.includes('-') 
        ? request.user_id 
        : request.user_id.toString();
        
      console.log('[DB] Looking for user:', { originalUserId: request.user_id, userIdToCheck });
      
      // Try to find user, but don't fail if not found
      db.get('SELECT username, email FROM users WHERE id = ? OR CAST(id AS TEXT) = ?', 
        [userIdToCheck, userIdToCheck], (err, requestingUser) => {
        if (err) {
          console.error('[DB] Error finding user:', err);
          // Continue anyway - the user might have been deleted
        }
        if (!requestingUser) {
          console.warn('[DB] User not found, but continuing:', { userIdToCheck, originalUserId: request.user_id });
          // Continue with approval even if user not found
        }

        // Start transaction
        db.serialize(() => {
          // Update request status
          db.run('UPDATE group_join_requests SET status = "approved", updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
            [requestId], function(err) {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }

            // Add user to group members
            // Convert the integer user_id back to UUID format
            // We need to find the original UUID by matching the integer hash
            const userIdInt = request.user_id;
            console.log('[DB] Looking for user with integer ID:', userIdInt);
            
            // Find the original UUID by matching the integer hash
            db.all('SELECT id FROM users', (err, allUsers) => {
              if (err) {
                console.error('[DB] Error fetching all users:', err);
                return res.status(500).json({ error: 'Database error' });
              }
              
              // Find the user whose UUID hash matches the integer
              const originalUserId = allUsers.find(user => {
                const userHash = parseInt(user.id.replace(/[^0-9]/g, '').substring(0, 9), 10);
                return userHash === userIdInt;
              });
              
              if (!originalUserId) {
                console.error('[DB] Could not find original user ID for integer:', userIdInt);
                return res.status(500).json({ error: 'Could not find original user ID' });
              }
              
              console.log('[DB] Found original user ID:', { 
                integerId: userIdInt, 
                originalUserId: originalUserId.id,
                groupId, 
                groupName: group.name 
              });
              
              // Check if user is already a member
              db.get('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', 
                [groupId, originalUserId.id], (err, existingMember) => {
                if (err) {
                  console.error('[DB] Error checking existing member:', err);
                  return res.status(500).json({ error: 'Database error' });
                }
                
                if (existingMember) {
                  console.log('[DB] User already a member:', { groupId, userId: originalUserId.id });
                  // Continue with notification update
                } else {
                  // Add new member
                  db.run('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, "viewer")', 
                    [groupId, originalUserId.id], function(err) {
                    if (err) {
                      console.error('[DB] Error adding user to group:', err);
                      return res.status(500).json({ error: 'Database error' });
                    }
                    console.log('[DB] User added to group successfully:', { 
                      groupId, 
                      userId: originalUserId.id,
                      changes: this.changes,
                      lastID: this.lastID
                    });
                  });
                }

                // Update existing notification to mark it as processed
                db.run(`
                  UPDATE notifications 
                  SET type = 'request_approved', 
                      title = 'Join Request Approved',
                      message = ?,
                      is_read = 1
                  WHERE request_id = ? AND type = 'join_request'
                `, [
                  `Your request to join group "${group.name}" has been approved!`,
                  requestId
                ], function(err) {
                  if (err) {
                    console.error('Error updating notification:', err);
                  }
                });

                // Create new notification for requesting user
                db.run(`
                  INSERT INTO notifications (user_id, type, title, message, group_id, request_id)
                  VALUES (?, 'request_approved', 'Join Request Approved', ?, ?, ?)
                `, [
                  originalUserId.id,
                  `Your request to join group "${group.name}" has been approved!`,
                  groupId,
                  requestId
                ], function(err) {
                  if (err) {
                    console.error('Error creating approval notification:', err);
                  }
                });

                // Send email to requesting user
                db.get('SELECT username, email FROM users WHERE id = ?', [originalUserId.id], (err, requestingUser) => {
                  if (err) {
                    console.error('Error fetching requesting user for email:', err);
                    return;
                  }
                  
                  if (!requestingUser || !requestingUser.email) {
                    console.warn('No email found for requesting user:', originalUserId.id);
                    return;
                  }

                  const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: requestingUser.email,
                    subject: `Join Request Approved - ${group.name}`,
                    html: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #4caf50;">Join Request Approved!</h2>
                        <p>Hello ${requestingUser.username},</p>
                        <p>Great news! Your request to join the group <strong>"${group.name}"</strong> has been approved by the group owner.</p>
                        <p>You are now a member of this group with <strong>viewer</strong> permissions. You can:</p>
                        <ul>
                          <li>View all tables in this group</li>
                          <li>See group statistics and member information</li>
                          <li>Access group-specific features</li>
                        </ul>
                        <p>You can manage your group membership and view your groups from the "My Groups" section in your dashboard.</p>
                        <p>If you have any questions, please contact the group owner.</p>
                        <br>
                        <p>Best regards,<br>Poker Management System</p>
                      </div>
                    `
                  };

                  transporter.sendMail(mailOptions, (emailErr) => {
                    if (emailErr) {
                      console.error('Error sending approval email:', emailErr);
                    } else {
                      console.log('Approval email sent successfully to:', requestingUser.email);
                    }
                  });
                });

                res.json({ message: 'Join request approved successfully' });
              });
            });
          });
        });
      });
    });
  });
});

// Reject join request
app.post('/api/groups/:groupId/join-request/:requestId/reject', authenticate, (req, res) => {
  const groupId = req.params.groupId;
  const requestId = req.params.requestId;
  const userId = req.user.id;

  console.log('[API] Reject request received:', { groupId, requestId, userId });

  // Check if user is group owner
  db.get('SELECT owner_id, name FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) {
      console.error('[DB] Error checking group ownership:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!group) {
      console.error('[API] Group not found:', groupId);
      return res.status(404).json({ error: 'Group not found' });
    }
    if (group.owner_id !== userId) {
      console.error('[API] User not group owner:', { userId, ownerId: group.owner_id });
      return res.status(403).json({ error: 'Only group owner can reject requests' });
    }

    // Convert groupId to integer for group_join_requests table
    const groupIdInt = parseInt(groupId.replace(/[^0-9]/g, '').substring(0, 9), 10);
    console.log('[API] Converted groupId:', { original: groupId, converted: groupIdInt });

    // Get the join request
    db.get('SELECT * FROM group_join_requests WHERE id = ? AND group_id = ? AND status = "pending"', 
      [requestId, groupIdInt], (err, request) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!request) {
        console.error('[DB] Join request not found:', { requestId, groupIdInt });
        return res.status(404).json({ error: 'Join request not found or already processed' });
      }

      // Get requesting user details (handle both UUID and integer formats)
      const userIdToCheck = typeof request.user_id === 'string' && request.user_id.includes('-') 
        ? request.user_id 
        : request.user_id.toString();
        
      console.log('[DB] Looking for user in reject:', { originalUserId: request.user_id, userIdToCheck });
      
      // Try to find user, but don't fail if not found
      db.get('SELECT username, email FROM users WHERE id = ? OR CAST(id AS TEXT) = ?', 
        [userIdToCheck, userIdToCheck], (err, requestingUser) => {
        if (err) {
          console.error('[DB] Error finding user in reject:', err);
          // Continue anyway - the user might have been deleted
        }
        if (!requestingUser) {
          console.warn('[DB] User not found in reject, but continuing:', { userIdToCheck, originalUserId: request.user_id });
          // Continue with rejection even if user not found
        }

        // Update request status
        db.run('UPDATE group_join_requests SET status = "rejected", updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
          [requestId], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Update existing notification to mark it as processed
          db.run(`
            UPDATE notifications 
            SET type = 'request_rejected', 
                title = 'Join Request Rejected',
                message = ?,
                is_read = 1
            WHERE request_id = ? AND type = 'join_request'
          `, [
            `Your request to join group "${group.name}" has been rejected.`,
            requestId
          ], function(err) {
            if (err) {
              console.error('Error updating notification:', err);
            }
          });

          // Create new notification for requesting user
          // Convert the integer user_id back to UUID format
          const userIdInt = request.user_id;
          
          // Find the original UUID by matching the integer hash
          db.all('SELECT id FROM users', (err, allUsers) => {
            if (err) {
              console.error('[DB] Error fetching all users for rejection:', err);
              return;
            }
            
            // Find the user whose UUID hash matches the integer
            const originalUserId = allUsers.find(user => {
              const userHash = parseInt(user.id.replace(/[^0-9]/g, '').substring(0, 9), 10);
              return userHash === userIdInt;
            });
            
            if (!originalUserId) {
              console.error('[DB] Could not find original user ID for rejection:', userIdInt);
              return;
            }
            
            db.run(`
              INSERT INTO notifications (user_id, type, title, message, group_id, request_id)
              VALUES (?, 'request_rejected', 'Join Request Rejected', ?, ?, ?)
            `, [
              originalUserId.id,
              `Your request to join group "${group.name}" has been rejected.`,
              groupId,
              requestId
            ], function(err) {
              if (err) {
                console.error('Error creating rejection notification:', err);
              }
            });

            // Send email to requesting user
            db.get('SELECT username, email FROM users WHERE id = ?', [originalUserId.id], (err, requestingUser) => {
              if (err) {
                console.error('Error fetching requesting user for rejection email:', err);
                return;
              }
              
              if (!requestingUser || !requestingUser.email) {
                console.warn('No email found for requesting user (rejection):', originalUserId.id);
                return;
              }

              const mailOptions = {
                from: process.env.EMAIL_USER,
                to: requestingUser.email,
                subject: `Join Request Rejected - ${group.name}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f44336;">Join Request Rejected</h2>
                    <p>Hello ${requestingUser.username},</p>
                    <p>We regret to inform you that your request to join the group <strong>"${group.name}"</strong> has been rejected by the group owner.</p>
                    <p>This decision was made by the group owner and may be due to various reasons such as:</p>
                    <ul>
                      <li>Group capacity limitations</li>
                      <li>Specific membership requirements</li>
                      <li>Group owner's discretion</li>
                    </ul>
                    <p>You can still explore other groups or contact the group owner directly if you have any questions about this decision.</p>
                    <p>Thank you for your interest in joining our community.</p>
                    <br>
                    <p>Best regards,<br>Poker Management System</p>
                  </div>
                `
              };

              transporter.sendMail(mailOptions, (emailErr) => {
                if (emailErr) {
                  console.error('Error sending rejection email:', emailErr);
                } else {
                  console.log('Rejection email sent successfully to:', requestingUser.email);
                }
              });
            });
          });

          res.json({ message: 'Join request rejected successfully' });
        });
      });
    });
  });
});

// Clean up old notifications (older than 1 month)
setInterval(() => {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  db.run('DELETE FROM notifications WHERE created_at < ?', [oneMonthAgo.toISOString()], (err) => {
    if (err) {
      console.error('[DB] Error cleaning up old notifications:', err);
    } else {
      console.log('[DB] Old notifications cleaned up');
    }
  });
}, 24 * 60 * 60 * 1000); // Run daily

// Clean up orphaned join requests (requests with non-existent users)
app.post('/api/debug/cleanup-orphaned-requests', authenticate, (req, res) => {
  db.all(`
    SELECT gjr.* FROM group_join_requests gjr 
    LEFT JOIN users u ON gjr.user_id = u.id OR CAST(gjr.user_id AS TEXT) = CAST(u.id AS TEXT)
    WHERE u.id IS NULL AND gjr.status = 'pending'
  `, (err, orphanedRequests) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (orphanedRequests.length === 0) {
      return res.json({ message: 'No orphaned requests found' });
    }
    
    const requestIds = orphanedRequests.map(r => r.id);
    
    // Start transaction
    db.serialize(() => {
      // Delete orphaned requests
      db.run('DELETE FROM group_join_requests WHERE id IN (' + requestIds.map(() => '?').join(',') + ')', 
        requestIds, function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        // Update notifications to mark them as processed
        db.run(`
          UPDATE notifications 
          SET type = 'request_rejected', 
              title = 'Join Request Cancelled',
              message = 'This join request was cancelled because the requesting user no longer exists.',
              is_read = 1
          WHERE request_id IN (` + requestIds.map(() => '?').join(',') + `) AND type = 'join_request'
        `, requestIds, function(err) {
          if (err) {
            console.error('Error updating notifications:', err);
          }
          
          res.json({ 
            message: `Cleaned up ${this.changes} orphaned requests and updated notifications`,
            cleanedRequests: orphanedRequests
          });
        });
      });
    });
  });
});

// Clean up old notifications manually
app.post('/api/debug/cleanup-old-notifications', authenticate, (req, res) => {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  db.run('DELETE FROM notifications WHERE created_at < ?', [oneMonthAgo.toISOString()], function(err) {
    if (err) {
      console.error('[DB] Error cleaning up old notifications:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ 
      message: `Cleaned up ${this.changes} old notifications`,
      cutoffDate: oneMonthAgo.toISOString()
    });
  });
});

// Clean up notifications with non-existent requests
app.post('/api/debug/cleanup-orphaned-notifications', authenticate, (req, res) => {
  db.all(`
    SELECT n.* FROM notifications n 
    LEFT JOIN group_join_requests gjr ON n.request_id = gjr.id
    WHERE n.type = 'join_request' AND gjr.id IS NULL
  `, (err, orphanedNotifications) => {
    if (err) {
      console.error('[DB] Error finding orphaned notifications:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (orphanedNotifications.length === 0) {
      return res.json({ message: 'No orphaned notifications found' });
    }
    
    const notificationIds = orphanedNotifications.map(n => n.id);
    
    // Update notifications to mark them as cancelled
    db.run(`
      UPDATE notifications 
      SET type = 'request_rejected', 
          title = 'Join Request Cancelled',
          message = 'This join request was cancelled because the request no longer exists.',
          is_read = 1
      WHERE id IN (` + notificationIds.map(() => '?').join(',') + `)
    `, notificationIds, function(err) {
      if (err) {
        console.error('[DB] Error updating orphaned notifications:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ 
        message: `Updated ${this.changes} orphaned notifications`,
        updatedNotifications: orphanedNotifications
      });
    });
  });
});

// ===== PLAYER ALIASES API ENDPOINTS =====

// Get all groups for dropdown
app.get('/api/groups', authenticate, (req, res) => {
  db.all('SELECT id, name FROM groups WHERE isActive = 1 ORDER BY name', (err, groups) => {
    if (err) {
      console.error('[DB] Error fetching groups:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(groups);
  });
});

// Get all players in a group (from all tables)
app.get('/api/groups/:groupId/players', authenticate, (req, res) => {
  const { groupId } = req.params;
  
  db.all(`
    SELECT DISTINCT p.name as playerName 
    FROM players p
    INNER JOIN tables t ON p.tableId = t.id
    WHERE t.groupId = ? AND p.name IS NOT NULL AND p.name != ''
    ORDER BY p.name
  `, [groupId], (err, players) => {
    if (err) {
      console.error('[DB] Error fetching players:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(players.map(p => ({ playerName: p.playerName })));
  });
});

// Get all members of a group (users)
app.get('/api/groups/:groupId/members', authenticate, (req, res) => {
  const { groupId } = req.params;
  
  console.log(`[API] Fetching members for group: ${groupId}`);
  
  db.all(`
    SELECT u.id, u.username, u.email 
    FROM users u
    WHERE u.id IN (
      SELECT owner_id FROM groups WHERE id = ?
      UNION
      SELECT user_id FROM group_members WHERE group_id = ? AND status = 'approved'
    )
    ORDER BY u.username
  `, [groupId, groupId], (err, members) => {
    if (err) {
      console.error('[DB] Error fetching group members:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log(`[API] Found ${members.length} members for group ${groupId}:`, members);
    res.json(members);
  });
});

// Check if player is already connected to a user
app.get('/api/player-aliases/:playerName/:groupId', authenticate, (req, res) => {
  const { playerName, groupId } = req.params;
  
  db.get(`
    SELECT pa.*, u.username, u.email
    FROM player_aliases pa
    INNER JOIN users u ON pa.user_id = u.id
    WHERE pa.player_name = ? AND pa.group_id = ? AND pa.is_active = 1
  `, [playerName, groupId], (err, alias) => {
    if (err) {
      console.error('[DB] Error checking player alias:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(alias || null);
  });
});

// Get username for player name in group (returns username if exists, otherwise playerName)
app.get('/api/player-aliases/username/:playerName/:groupId', authenticate, (req, res) => {
  const { playerName, groupId } = req.params;
  db.get(`
    SELECT u.username
    FROM player_aliases pa
    INNER JOIN users u ON pa.user_id = u.id
    WHERE pa.player_name = ? AND pa.group_id = ? AND pa.is_active = 1
  `, [playerName, groupId], (err, result) => {
    if (err) {
      console.error('[DB] Error getting username for player:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    // Return username if found, otherwise return the original playerName
    res.json({ displayName: result ? result.username : playerName });
  });
});

// Get display names for multiple players in a group (batch endpoint for performance)
app.post('/api/player-aliases/display-names', authenticate, (req, res) => {
  const { playerNames, groupId } = req.body;
  
  console.log('[SERVER] Display names request:', { playerNames, groupId });
  
  if (!playerNames || !Array.isArray(playerNames) || !groupId) {
    return res.status(400).json({ error: 'Missing required fields: playerNames array and groupId' });
  }
  
  if (playerNames.length === 0) {
    return res.json({ displayNames: {}, hasAlias: {} });
  }
  
  // Create placeholders for the IN clause
  const placeholders = playerNames.map(() => '?').join(',');
  
  const query = `
    SELECT pa.player_name, u.username
    FROM player_aliases pa
    INNER JOIN users u ON pa.user_id = u.id
    WHERE pa.player_name IN (${placeholders}) AND pa.group_id = ? AND pa.is_active = 1
  `;
  
  console.log('[SERVER] SQL Query:', query);
  console.log('[SERVER] SQL Parameters:', [...playerNames, groupId]);
  
  db.all(query, [...playerNames, groupId], (err, results) => {
    if (err) {
      console.error('[DB] Error getting display names for players:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log('[SERVER] Database results:', results);
    
    // Create a map of player names to usernames and hasAlias
    const displayNames = {};
    const hasAlias = {};
    
    // First, mark all players as not having alias
    playerNames.forEach(playerName => {
      hasAlias[playerName] = false;
      displayNames[playerName] = playerName; // Default to original name
    });
    
    // Then, update with actual aliases
    results.forEach(row => {
      displayNames[row.player_name] = row.username;
      hasAlias[row.player_name] = true; // This player has an alias
    });
    
    console.log('[SERVER] Final display names:', displayNames);
    console.log('[SERVER] Has alias mapping:', hasAlias);
    res.json({ displayNames, hasAlias });
  });
});

// Create new player alias connection
app.post('/api/player-aliases', authenticate, authorize(['admin']), (req, res) => {
  const { playerName, groupId, userId } = req.body;
  
  console.log('[SERVER] Creating player alias:', { playerName, groupId, userId });
  
  if (!playerName || !groupId || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Check if connection already exists
  db.get('SELECT * FROM player_aliases WHERE player_name = ? AND group_id = ? AND is_active = 1', 
    [playerName, groupId], (err, existing) => {
    if (err) {
      console.error('[DB] Error checking existing alias:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log('[SERVER] Existing alias check result:', existing);
    
    if (existing) {
      return res.status(409).json({ error: 'Player is already connected to a user in this group' });
    }
    
    // Create new connection
    const aliasId = uuidv4();
    const now = new Date().toISOString();
    
    const insertQuery = `
      INSERT INTO player_aliases (id, user_id, player_name, group_id, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `;
    
    console.log('[SERVER] Inserting player alias with query:', insertQuery);
    console.log('[SERVER] Insert parameters:', [aliasId, userId, playerName, groupId, now]);
    
    db.run(insertQuery, [aliasId, userId, playerName, groupId, now], function(err) {
      if (err) {
        console.error('[DB] Error creating player alias:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      console.log('[SERVER] Player alias created successfully with ID:', aliasId);
      
      res.json({ 
        message: 'Player connected successfully',
        aliasId: aliasId
      });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Serve static files from the React build directory in production (MUST be after all API routes)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Handle cleanup on shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
}); 