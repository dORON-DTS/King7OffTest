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
app.use(cors());
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
        isActive INTEGER DEFAULT 1,
        FOREIGN KEY (createdBy) REFERENCES users(id)
      )
    `);
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
    next();
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

// Utility to check if table is active
function checkTableActive(tableId, cb) {
  db.get('SELECT isActive FROM tables WHERE id = ?', [tableId], (err, row) => {
    if (err) return cb(err);
    if (!row) return cb(new Error('Table not found'));
    if (!row.isActive) return cb(new Error('This action is not allowed while the table is inactive.'));
    cb(null);
  });
}

// Routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  // First, let's check if the user exists
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
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
  db.get('SELECT id, username, role FROM users WHERE id = ?', [req.user.id], (err, user) => {
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
  db.all('SELECT id, username, role, createdAt FROM users', [], (err, users) => {
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

// Register new user
app.post('/api/register', authenticate, authorize(['admin']), (req, res) => {
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

// Create new group (admin only)
app.post('/api/groups', authenticate, authorize(['admin']), (req, res) => {
  const { name, description } = req.body;
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const createdBy = req.user.id;

  db.run(
    'INSERT INTO groups (id, name, description, createdAt, createdBy) VALUES (?, ?, ?, ?, ?)',
    [id, name, description, createdAt, createdBy],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, name, description, createdAt, createdBy, isActive: true });
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

// Delete group (admin only)
app.delete('/api/groups/:id', authenticate, authorize(['admin']), (req, res) => {
  const groupId = req.params.id;

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