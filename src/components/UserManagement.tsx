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
  Tooltip,
  Switch
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import LockResetIcon from '@mui/icons-material/LockReset';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import { useUser } from '../context/UserContext';
import { apiFetch } from '../utils/apiInterceptor';

interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
  isVerified?: boolean;
  isBlocked?: boolean | number;
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
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [blockError, setBlockError] = useState('');

  const { user: currentUser, logout } = useUser();
  const currentUserId = currentUser?.id;

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, logout);
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setError('Error loading users');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/register`, {
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
      }, logout);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403 || errorText.includes('permission')) {
          setError('You do not have permission to perform this action');
          return;
        }
        throw new Error('Failed to create user');
      }
      await fetchUsers();
      setNewUsername('');
      setNewPassword('');
      setNewRole('viewer');
      setShowAddUser(false);
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return; // User was blocked and logged out
      }
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
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users/${userToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, logout);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403 || errorText.includes('permission')) {
          setError('You do not have permission to perform this action');
          return;
        }
        throw new Error('Failed to delete user');
      }
      await fetchUsers();
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setError('Error deleting user');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      }, logout);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403 || errorText.includes('permission')) {
          setError('You do not have permission to perform this action');
          return;
        }
        throw new Error('Failed to update role');
      }
      await fetchUsers();
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setError('Error updating role');
    }
  };

  const handleOpenResetDialog = (userId: string) => {
    setResetUserId(userId);
    setResetPassword('');
    setResetError('');
    setResetSuccess('');
    setResetDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !resetPassword) return;
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users/${resetUserId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: resetPassword })
      }, logout);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403 || errorText.includes('permission')) {
          setResetError('You do not have permission to perform this action');
          return;
        }
        throw new Error('Failed to reset password');
      }
      setResetSuccess('Password reset successfully');
      setTimeout(() => {
        setResetDialogOpen(false);
        setResetUserId(null);
        setResetPassword('');
        setResetSuccess('');
      }, 1200);
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setResetError('Error resetting password');
    }
  };

  const handleStartEditEmail = (userId: string, currentEmail: string) => {
    setEditingEmail(userId);
    setEmailValue(currentEmail || '');
    setEmailError('');
    setEmailSuccess('');
  };

  const handleCancelEditEmail = () => {
    setEditingEmail(null);
    setEmailValue('');
    setEmailError('');
    setEmailSuccess('');
  };

  const validateEmail = (email: string) => {
    if (!email.trim()) return true; // Allow empty email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSaveEmail = async (userId: string) => {
    if (!validateEmail(emailValue)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users/${userId}/email`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: emailValue.trim() || null })
      }, logout);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403 || errorText.includes('permission')) {
          setEmailError('You do not have permission to perform this action');
          return;
        }
        if (response.status === 409) {
          setEmailError('This email is already in use by another user');
          return;
        }
        throw new Error('Failed to update email');
      }
      
      const responseData = await response.json();
      setEmailSuccess(responseData.message || 'Email updated successfully');
      await fetchUsers(); // Refresh the user list
      setTimeout(() => {
        setEditingEmail(null);
        setEmailValue('');
        setEmailError('');
        setEmailSuccess('');
      }, 2000); // Longer timeout to read the message
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setEmailError('Error updating email');
    }
  };

  const handleToggleBlocked = async (userId: string, currentBlocked: boolean | number) => {
    setBlockError('');
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users/${userId}/blocked`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isBlocked: currentBlocked ? 0 : 1 })
      }, logout);
      
      if (!response.ok) {
        setBlockError('Failed to update blocked status');
        return;
      }
      await fetchUsers();
    } catch (err) {
      if (err instanceof Error && err.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setBlockError('Error updating blocked status');
    }
  };

  // Role order for sorting
  const getRoleOrder = (role: string) => {
    if (role === 'admin') return 0;
    if (role === 'editor') return 1;
    if (role === 'viewer') return 2;
    return 99;
  };
  const sortedUsers = [...users].sort((a, b) => {
    const roleDiff = getRoleOrder(a.role) - getRoleOrder(b.role);
    if (roleDiff !== 0) return roleDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

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
                    display: { xs: 'none', md: 'table-cell' }
                  }}>Email</TableCell>
                  <TableCell sx={{ 
                    fontWeight: 'bold',
                    display: { xs: 'none', lg: 'table-cell' }
                  }}>Verified</TableCell>
                  <TableCell sx={{ 
                    fontWeight: 'bold',
                    display: { xs: 'none', sm: 'table-cell' }
                  }}>Created At</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', display: { xs: 'none', md: 'table-cell' } }}>Blocked</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedUsers.map((user) => {
                  return (
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
                            {editingEmail === user.id ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                                <TextField
                                  size="small"
                                  value={emailValue}
                                  onChange={(e) => setEmailValue(e.target.value)}
                                  placeholder="Enter email"
                                  sx={{ minWidth: 180 }}
                                />
                                {emailError && (
                                  <Typography variant="caption" color="error">
                                    {emailError}
                                  </Typography>
                                )}
                                {emailSuccess && (
                                  <Typography variant="caption" color="success.main">
                                    {emailSuccess}
                                  </Typography>
                                )}
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleSaveEmail(user.id)}
                                    sx={{ color: 'success.main', '&:hover': { bgcolor: 'success.main', color: 'white' } }}
                                  >
                                    <SaveIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={handleCancelEditEmail}
                                    sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                                  >
                                    <CancelIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                                <span>Email: {user.email || '-'}</span>
                                <IconButton
                                  size="small"
                                  onClick={() => handleStartEditEmail(user.id, user.email || '')}
                                  sx={{ color: 'primary.main', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            )}
                            <Box sx={{ fontSize: '0.75rem', color: user.isVerified ? 'success.main' : 'error.main', fontWeight: user.isVerified ? 'bold' : 'normal', mt: 0.5 }}>
                              Verified: {user.isVerified ? 'Yes' : 'No'}
                            </Box>
                            <Box>Created: {new Date(user.createdAt).toLocaleDateString()}</Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <span>Status:</span>
                              <Switch
                                checked={!!user.isBlocked}
                                onChange={() => handleToggleBlocked(user.id, user.isBlocked || false)}
                                color={user.isBlocked ? 'error' : 'success'}
                                size="small"
                                inputProps={{ 'aria-label': 'blocked toggle' }}
                              />
                              <Typography variant="caption" sx={{ color: user.isBlocked ? 'error.main' : 'success.main', fontWeight: 600 }}>
                                {user.isBlocked ? 'Blocked' : 'Active'}
                              </Typography>
                            </Box>
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
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        {editingEmail === user.id ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <TextField
                              size="small"
                              value={emailValue}
                              onChange={(e) => setEmailValue(e.target.value)}
                              placeholder="Enter email"
                              sx={{ minWidth: 200 }}
                            />
                            {emailError && (
                              <Typography variant="caption" color="error">
                                {emailError}
                              </Typography>
                            )}
                            {emailSuccess && (
                              <Typography variant="caption" color="success.main">
                                {emailSuccess}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton
                                size="small"
                                onClick={() => handleSaveEmail(user.id)}
                                sx={{ color: 'success.main', '&:hover': { bgcolor: 'success.main', color: 'white' } }}
                              >
                                <SaveIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={handleCancelEditEmail}
                                sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{user.email || '-'}</span>
                            <IconButton
                              size="small"
                              onClick={() => handleStartEditEmail(user.id, user.email || '')}
                              sx={{ color: 'primary.main', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1,
                          color: user.isVerified ? 'success.main' : 'error.main',
                          fontWeight: user.isVerified ? 'bold' : 'normal'
                        }}>
                          {user.isVerified ? '✓ Verified' : '✗ Not Verified'}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Switch
                            checked={!!user.isBlocked}
                            onChange={() => handleToggleBlocked(user.id, user.isBlocked || false)}
                            color={user.isBlocked ? 'error' : 'success'}
                            inputProps={{ 'aria-label': 'blocked toggle' }}
                          />
                          <Typography variant="body2" sx={{ color: user.isBlocked ? 'error.main' : 'success.main', fontWeight: 600 }}>
                            {user.isBlocked ? 'Blocked' : 'Active'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Delete User">
                          <span>
                            <IconButton
                              onClick={() => handleDeleteConfirm(user.id)}
                              disabled={user.id === currentUserId}
                              sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Reset Password">
                          <span>
                            <IconButton
                              onClick={() => { handleOpenResetDialog(user.id); }}
                              disabled={user.id === currentUserId}
                              sx={{ color: 'primary.main', ml: 1, '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                            >
                              <LockResetIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      {/* Reset Password Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 2, width: '100%', maxWidth: { xs: '100%', sm: '400px' }, m: { xs: 0, sm: 2 } } }}
        fullScreen={false}
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'primary.main', color: 'white', py: 2 }}>
          Reset Password
        </DialogTitle>
        <DialogContent sx={{ mt: 3, px: 3 }}>
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="New Password"
              type="password"
              fullWidth
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              autoFocus
            />
            {resetError && <Alert severity="error">{resetError}</Alert>}
            {resetSuccess && <Alert severity="success">{resetSuccess}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: 'divider', gap: 1, flexDirection: { xs: 'column', sm: 'row' }, '& > button': { width: { xs: '100%', sm: 'auto' } } }}>
          <Button onClick={() => setResetDialogOpen(false)} variant="outlined" fullWidth sx={{ color: 'text.secondary', borderColor: 'divider', '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' }, order: { xs: 2, sm: 1 } }}>
            Cancel
          </Button>
          <Button onClick={handleResetPassword} variant="contained" disabled={!resetPassword} fullWidth sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' }, order: { xs: 1, sm: 2 } }}>
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      {blockError && <Alert severity="error">{blockError}</Alert>}
    </Box>
  );
};

export default UserManagement; 