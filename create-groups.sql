-- Insert 365Scores group
INSERT INTO groups (id, name, description, createdAt, createdBy, isActive)
VALUES (
  '365scores-' || lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(4))),
  '365Scores',
  '365Scores Poker Group',
  datetime('now'),
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1),
  1
);

-- Insert Doron & Friends group
INSERT INTO groups (id, name, description, createdAt, createdBy, isActive)
VALUES (
  'doron-friends-' || lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(4))),
  'Doron & Friends',
  'Doron & Friends Poker Group',
  datetime('now'),
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1),
  1
); 