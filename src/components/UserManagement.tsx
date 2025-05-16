import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Alert,
  Typography,
  Card,
  CardContent,
  Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useUser } from '../context/UserContext';

interface User {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const { user: currentUser } = useUser();
  const currentUserId = currentUser?.id;

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Error loading users');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create user');
      }

      await fetchUsers();
      setNewUsername('');
      setNewPassword('');
      setNewRole('viewer');
      setShowAddUser(false);
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Error creating user');
    }
  };

  const handleOpenAddUser = () => {
    setNewUsername('');
    setNewPassword('');
    setNewRole('viewer');
    setShowAddUser(true);
  };

  const handleDeleteConfirm = (userId: string) => {
    setUserToDelete(userId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${userToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      await fetchUsers();
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Error deleting user');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      await fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      setError('Error updating role');
    }
  };

  return (
    <Box sx={{ mt: 4, maxWidth: 1200, mx: 'auto' }}>
      <Card sx={{ mb: 4, bgcolor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 3,
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 2, sm: 0 }
          }}>
            <Typography 
              variant="h4" 
              component="h1" 
              sx={{ 
                color: 'primary.main', 
                fontWeight: 'bold',
                fontSize: { xs: '1.5rem', sm: '2rem' }
              }}
            >
              User Management
            </Typography>
            <Button
              variant="outlined"
              onClick={handleOpenAddUser}
              sx={{
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': { 
                  bgcolor: 'primary.main',
                  color: 'white'
                },
                borderRadius: 2,
                px: { xs: 3, sm: 4 },
                py: { xs: 1, sm: 1.5 },
                fontSize: { xs: '0.875rem', sm: '1rem' },
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              Add New User
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'background.default' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
                  <TableCell sx={{ 
                    fontWeight: 'bold',
                    display: { xs: 'none', sm: 'table-cell' }
                  }}>Role</TableCell>
                  <TableCell sx={{ 
                    fontWeight: 'bold',
                    display: { xs: 'none', sm: 'table-cell' }
                  }}>Created At</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        {user.username}
                        <Box sx={{ 
                          display: { xs: 'flex', sm: 'none' },
                          flexDirection: 'column',
                          gap: 0.5,
                          mt: 1,
                          fontSize: '0.875rem',
                          color: 'text.secondary'
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            Role: 
                            <Select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              disabled={user.id === currentUserId}
                              size="small"
                              sx={{ 
                                minWidth: 100,
                                height: '30px',
                                '.MuiSelect-select': {
                                  py: 0.5
                                }
                              }}
                            >
                              <MenuItem value="viewer">Viewer</MenuItem>
                              <MenuItem value="editor">Editor</MenuItem>
                              <MenuItem value="admin">Admin</MenuItem>
                            </Select>
                          </Box>
                          <Box>Created: {new Date(user.createdAt).toLocaleDateString()}</Box>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={user.id === currentUserId}
                        sx={{ minWidth: 120 }}
                      >
                        <MenuItem value="viewer">Viewer</MenuItem>
                        <MenuItem value="editor">Editor</MenuItem>
                        <MenuItem value="admin">Admin</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Delete User">
                        <span>
                          <IconButton
                            onClick={() => handleDeleteConfirm(user.id)}
                            disabled={user.id === currentUserId}
                            sx={{ 
                              color: 'error.main',
                              '&:hover': { 
                                bgcolor: 'error.main',
                                color: 'white'
                              }
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog 
        open={showAddUser} 
        onClose={() => setShowAddUser(false)}
        PaperProps={{
          sx: { 
            borderRadius: 2,
            width: '100%',
            maxWidth: { xs: '100%', sm: '400px' },
            m: { xs: 0, sm: 2 }
          }
        }}
        fullScreen={false}
      >
        <DialogTitle 
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            bgcolor: 'primary.main',
            color: 'white',
            py: 2
          }}
        >
          Add New User
        </DialogTitle>
        <DialogContent sx={{ mt: 3, px: 3 }}>
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              autoFocus
              label="Username"
              fullWidth
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            />
            <TextField
              label="Password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            />
            <Select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              sx={{ 
                minWidth: 120,
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            >
              <MenuItem value="viewer">Viewer</MenuItem>
              <MenuItem value="editor">Editor</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </Box>
        </DialogContent>
        <DialogActions 
          sx={{ 
            p: 2.5, 
            borderTop: 1, 
            borderColor: 'divider',
            gap: 1,
            flexDirection: { xs: 'column', sm: 'row' },
            '& > button': {
              width: { xs: '100%', sm: 'auto' }
            }
          }}
        >
          <Button 
            onClick={() => setShowAddUser(false)}
            variant="outlined"
            fullWidth
            sx={{
              color: 'text.secondary',
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'text.primary',
                bgcolor: 'action.hover'
              },
              order: { xs: 2, sm: 1 }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateUser} 
            variant="contained"
            disabled={!newUsername || !newPassword}
            fullWidth
            sx={{
              bgcolor: 'success.main',
              '&:hover': { bgcolor: 'success.dark' },
              '&.Mui-disabled': {
                bgcolor: 'action.disabledBackground',
                color: 'action.disabled'
              },
              order: { xs: 1, sm: 2 }
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider' }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>
            Are you sure you want to delete this user? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteUser}
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement; 