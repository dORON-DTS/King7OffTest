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
  origin: [
    'https://www.king7offsuit.com',
    'https://king7offsuit.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://poker-management.onrender.com'
  ],
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

console.log('[DB] Using data directory:', DATA_DIR);
console.log('[DB] Using database path:', dbPath);
console.log('[DB] Using backup path:', backupPath);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  console.log('[DB] Creating data directory:', DATA_DIR);
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure backup directory exists
if (!fs.existsSync(backupPath)) {
  console.log('[DB] Creating backup directory:', backupPath);
  fs.mkdirSync(backupPath, { recursive: true });
}

// If we're on Render and the database doesn't exist in the data directory,
// but exists in the root, move it to the data directory
if (process.env.RENDER && !fs.existsSync(dbPath) && fs.existsSync(path.join(__dirname, 'poker.db'))) {
  console.log('[DB] Moving database from root to data directory');
  fs.copyFileSync(path.join(__dirname, 'poker.db'), dbPath);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[DB] Error connecting to database:', err);
  } else {
    console.log('[DB] Connected to SQLite database at:', dbPath);
    
    // Verify database is writable
    db.run('PRAGMA quick_check', (err) => {
      if (err) {
        console.error('[DB] Database write check failed:', err);
      } else {
        console.log('[DB] Database is writable and healthy');
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
        console.log('[DB] owner_id column added to groups table');
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
        console.log('[DB] Users table ready');
      }
    });

    // Add email column to users table if it doesn't exist
    db.run(`
      ALTER TABLE users ADD COLUMN email TEXT
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('[DB] Error adding email column:', err);
      } else if (!err) {
        console.log('[DB] Email column added to users table');
      }
    });

    // Note: group_join_requests table already exists with INTEGER columns
    // but groups and users tables use TEXT (UUID) columns
    // We'll handle this mismatch in the code by not using foreign keys
    console.log('[DB] group_join_requests table exists (using INTEGER columns)');
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

    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
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

        // Check role hierarchy: owner > editor > viewer
        const roleHierarchy = { owner: 3, editor: 2, viewer: 1 };
        const userRoleLevel = roleHierarchy[member.role] || 0;
        const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

        if (userRoleLevel < requiredRoleLevel) {
          return res.status(403).json({ error: 'Insufficient permissions for this group' });
        }

        req.groupMember = member;
        next();
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

// Get all tables
app.get('/api/tables', authenticate, (req, res) => {
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
  const { name, smallBlind, bigBlind, location, groupId, minimumBuyIn } = req.body;
  
  if (!groupId) {
    return res.status(400).json({ error: 'Group ID is required' });
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const creatorId = req.user.id;
  const isActive = true;

  db.run(
    'INSERT INTO tables (id, name, smallBlind, bigBlind, location, isActive, createdAt, creatorId, groupId, minimumBuyIn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, smallBlind, bigBlind, location, isActive, createdAt, creatorId, groupId, minimumBuyIn],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ ...req.body, id, players: [] });
    }
  );
});

// Delete table
app.delete('/api/tables/:id', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const tableId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;

  // אם המשתמש הוא editor, נבדוק שהוא יצר את השולחן
  if (userRole === 'editor') {
    db.get('SELECT creatorId FROM tables WHERE id = ?', [tableId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Table not found' });
      }
      if (row.creatorId !== userId) {
        return res.status(403).json({ error: 'You do not have permission to delete this table' });
      }
      // אם עובר, מוחקים
      db.run('DELETE FROM tables WHERE id = ?', [tableId], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Table deleted' });
      });
    });
  } else {
    // admin מוחק הכל
    db.run('DELETE FROM tables WHERE id = ?', [tableId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Table deleted' });
    });
  }
});

// Add player to table
app.post('/api/tables/:tableId/players', authenticate, authorize(['admin', 'editor']), (req, res) => {
  const { name, nickname, chips, active = true, showMe = true } = req.body;
  const tableId = req.params.tableId;
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

      const initialBuyInAmount = Number(chips) || table.minimumBuyIn || 0;

      db.serialize(() => {
        db.run(
          'INSERT INTO players (id, tableId, name, nickname, chips, totalBuyIn, active, showMe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [playerId, tableId, name, nickname, initialBuyInAmount, initialBuyInAmount, active, showMe],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to add player' });
            }

            db.run(
              'INSERT INTO buyins (id, playerId, amount, timestamp) VALUES (?, ?, ?, ?)',
              [initialBuyInId, playerId, initialBuyInAmount, timestamp],
              function(buyinErr) {
                if (buyinErr) {
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
          }
        );
      });
    });
  });
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
app.put('/api/tables/:tableId/players/:playerId/showme', authenticate, authorize(['admin', 'editor']), (req, res) => {
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
  console.log('[Users] Fetching all users - Request received:', {
    user: req.user,
    headers: req.headers,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  console.log('[Users] Executing database query');
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
  console.log('[Users] Delete request received:', {
    userId,
    requestingUser: req.user,
    timestamp: new Date().toISOString()
  });

  // First check if user exists
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      console.log('[Users] User not found for deletion:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[Users] User found, proceeding with deletion:', {
      id: user.id,
      username: user.username,
      role: user.role
    });

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

  console.log('[Users] Role update request received:', {
    userId,
    newRole: role,
    requestingUser: req.user,
    timestamp: new Date().toISOString()
  });

  // First check if user exists
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      console.log('[Users] User not found for role update:', userId);
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

  console.log('[Users] Email update request received:', {
    userId,
    newEmail: email,
    requestingUser: req.user,
    timestamp: new Date().toISOString()
  });

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

  console.log('[Users] Blocked status update request received:', {
    userId,
    newBlockedStatus: isBlocked,
    requestingUser: req.user,
    timestamp: new Date().toISOString()
  });

  // First check if user exists
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      console.log('[Users] User not found for blocked status update:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[Users] User found, proceeding with blocked status update:', {
      id: user.id,
      username: user.username,
      currentBlockedStatus: user.isBlocked,
      newBlockedStatus: isBlocked
    });

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

// Get table by ID
app.get('/api/tables/:id', authenticate, (req, res) => {
  const tableId = req.params.id;
  db.get('SELECT * FROM tables WHERE id = ?', [tableId], (err, table) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

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
  });
});

// Update table
app.put('/api/tables/:id', authenticate, authorize(['admin', 'editor']), async (req, res) => {
  const tableId = req.params.id;
  const { name, smallBlind, bigBlind, location, food, groupId, minimumBuyIn, createdAt } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

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
      // אם השולחן לא אקטיבי, רק היוצר יכול לערוך
      if (!tableRow.isActive && tableRow.creatorId !== userId) {
        return res.status(403).json({ error: 'You do not have permission to edit this table' });
      }
      // אם השולחן אקטיבי, כל עורך יכול לערוך
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

    // Update table - add food and createdAt to SQL
    await new Promise((resolve, reject) => {
      const updateQuery = `
        UPDATE tables 
        SET name = ?, smallBlind = ?, bigBlind = ?, location = ?, food = ?, groupId = ?, minimumBuyIn = ?, createdAt = ?
        WHERE id = ?
      `;
      const createdAtStr = createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString();
      db.run(updateQuery, [name, smallBlind, bigBlind, location, food, groupId, minimumBuyIn, createdAtStr, tableId], function(err) {
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

// Get shared table by ID (public access)
app.get('/api/share/:id', (req, res) => {
  const tableId = req.params.id;
  db.get('SELECT * FROM tables WHERE id = ?', [tableId], (err, table) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

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
  });
});

// Get unique player names from statistics
app.get('/api/statistics/players', (req, res) => {
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

// Get all groups
app.get('/api/groups', (req, res) => {
  db.all('SELECT * FROM groups ORDER BY name', [], (err, groups) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(groups);
  });
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
    // Admin gets all groups with their actual roles
    db.all(`
      SELECT g.*, 
        CASE 
          WHEN g.owner_id = ? THEN 'owner'
          WHEN gm.role IS NOT NULL THEN gm.role
          ELSE 'none'
        END as userRole
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = ?
      ORDER BY g.name
    `, [userId, userId], (err, allGroups) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(allGroups);
    });
  } else {
    // Non-admin gets only groups where they are owner or member
    db.all('SELECT *, "owner" as userRole FROM groups WHERE owner_id = ?', [userId], (err, ownedGroups) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      db.all(`
        SELECT g.*, gm.role as userRole 
        FROM groups g 
        JOIN group_members gm ON g.id = gm.group_id 
        WHERE gm.user_id = ?
      `, [userId], (err, memberGroups) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        const allGroups = [...ownedGroups, ...memberGroups].sort((a, b) => a.name.localeCompare(b.name));
        res.json(allGroups);
      });
    });
  }
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

// Get group members
app.get('/api/groups/:id/members', authenticate, (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  // Check if user has access to this group
  db.get('SELECT owner_id FROM groups WHERE id = ?', [groupId], (err, group) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
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

  if (!role || !['editor', 'viewer'].includes(role)) {
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

    // Update member role
    db.run('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?', 
      [role, groupId, memberUserId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Member not found' });
      }
      res.json({ message: 'Member role updated successfully' });
    });
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

// Handle OPTIONS for join request
app.options('/api/groups/:id/join-request', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://www.king7offsuit.com');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
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
      res.header('Access-Control-Allow-Origin', 'https://www.king7offsuit.com');
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(404).json({ error: 'Group not found or inactive' });
    }

    // Check if user is not the owner
    if (group.owner_id === userId) {
      res.header('Access-Control-Allow-Origin', 'https://www.king7offsuit.com');
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
      console.log('[DB] Checking for existing join request:', { groupId, userId });
      
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
        console.log('[DB] Attempting to insert join request:', { groupId, userId });
        
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
          const transporter = nodemailer.createTransporter({
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
              <p>You can approve or reject this request from your group management panel.</p>
              <p>Best regards,<br>Poker Management System</p>
            `
          };

          transporter.sendMail(mailOptions, (emailErr) => {
            if (emailErr) {
              console.error('Error sending email:', emailErr);
              // Don't fail the request if email fails
            }
          });

          res.header('Access-Control-Allow-Origin', 'https://www.king7offsuit.com');
          res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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