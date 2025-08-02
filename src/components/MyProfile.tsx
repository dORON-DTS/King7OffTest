import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Avatar,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Alert,
  TextField,
  IconButton,
  Snackbar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  CalendarToday as CalendarIcon,
  AccessTime as AccessTimeIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
  last_login?: string;
  is_verified: boolean;
  total_games?: number;
  total_tables?: number;
}

const MyProfile: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const { user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found');
          setLoading(false);
          return;
        }

        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setProfile(data);
          setNewUsername(data.username);
          setNewEmail(data.email);
        } else {
          setError('Failed to fetch profile data');
        }
      } catch (err) {
        setError('Error loading profile');
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSaveUsername = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setSnackbarMessage('No authentication token found');
        setSnackbarSeverity('error');
        return;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${user.id}/username`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: newUsername })
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setProfile(updatedUser);
        setEditingUsername(false);
        setSnackbarMessage('Username updated successfully!');
        setSnackbarSeverity('success');
      } else {
        const errorData = await response.json();
        setSnackbarMessage(errorData.detail || 'Failed to update username');
        setSnackbarSeverity('error');
      }
    } catch (err) {
      setSnackbarMessage('Error updating username');
      setSnackbarSeverity('error');
      console.error('Error updating username:', err);
    }
  };

  const handleSaveEmail = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setSnackbarMessage('No authentication token found');
        setSnackbarSeverity('error');
        return;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${user.id}/email`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: newEmail })
      });

      if (response.ok) {
        // Email updated successfully - logout and redirect to verification
        localStorage.removeItem('token');
        setSnackbarMessage('Email updated successfully! Please check your new email for verification.');
        setSnackbarSeverity('success');
        
        // Redirect to verification page with new email
        setTimeout(() => {
          navigate(`/verify-email?email=${encodeURIComponent(newEmail)}`);
        }, 2000);
      } else {
        const errorData = await response.json();
        setSnackbarMessage(errorData.detail || 'Failed to update email');
        setSnackbarSeverity('error');
      }
    } catch (err) {
      setSnackbarMessage('Error updating email');
      setSnackbarSeverity('error');
      console.error('Error updating email:', err);
    }
  };

  const handleCancelUsername = () => {
    setNewUsername(profile?.username || '');
    setEditingUsername(false);
  };

  const handleCancelEmail = () => {
    setNewEmail(profile?.email || '');
    setEditingEmail(false);
  };

  const handleEditUsername = () => {
    setEditingUsername(true);
  };

  const handleEditEmail = () => {
    setEditingEmail(true);
  };

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarMessage('');
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setDeletingAccount(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setSnackbarMessage('No authentication token found');
        setSnackbarSeverity('error');
        return;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Account deleted successfully
        localStorage.removeItem('token');
        setSnackbarMessage('Account deleted successfully');
        setSnackbarSeverity('success');
        
        // Redirect to login page
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        const errorData = await response.json();
        setSnackbarMessage(errorData.detail || 'Failed to delete account');
        setSnackbarSeverity('error');
      }
    } catch (err) {
      setSnackbarMessage('Error deleting account');
      setSnackbarSeverity('error');
      console.error('Error deleting account:', err);
    } finally {
      setDeletingAccount(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleOpenDeleteDialog = () => {
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
  };


  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">
          Unable to load profile data
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography
        variant="h3"
        component="h1"
        gutterBottom
        sx={{
          fontWeight: 700,
          textAlign: 'center',
          mb: 4,
          background: 'linear-gradient(90deg, #1976d2 0%, #21cbf3 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textFillColor: 'transparent'
        }}
      >
        My Profile
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Paper
          elevation={3}
          sx={{
            p: { xs: 2, md: 4 },
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(33, 203, 243, 0.05) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            width: '100%',
            maxWidth: { xs: '100%', md: 600 }
          }}
        >
          {/* Header Section */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'center', md: 'flex-start' },
              gap: 3,
              mb: 4,
              pb: 3,
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <Avatar
              sx={{
                width: { xs: 80, md: 120 },
                height: { xs: 80, md: 120 },
                bgcolor: '#1976d2',
                fontSize: { xs: '2rem', md: '3rem' },
                fontWeight: 700
              }}
            >
              {profile.username[0].toUpperCase()}
            </Avatar>
            
            <Box sx={{ textAlign: { xs: 'center', md: 'left' }, flex: 1 }}>
              {editingUsername ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    variant="outlined"
                    size="small"
                    sx={{ flex: 1 }}
                  />
                  <IconButton onClick={handleSaveUsername} color="primary">
                    <SaveIcon />
                  </IconButton>
                  <IconButton onClick={handleCancelUsername} color="error">
                    <CancelIcon />
                  </IconButton>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="h4"
                    component="h2"
                    gutterBottom
                    sx={{ fontWeight: 700, color: 'primary.main', mb: 0 }}
                  >
                    {profile.username}
                  </Typography>
                  <IconButton onClick={handleEditUsername} color="primary" size="small">
                    <EditIcon />
                  </IconButton>
                </Box>
              )}
            </Box>
          </Box>

          {/* Personal Information Card */}
          <Card
            sx={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 2
            }}
          >
            <CardContent>
              <Typography
                variant="h6"
                component="h3"
                gutterBottom
                sx={{
                  fontWeight: 600,
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <PersonIcon />
                Personal Information
              </Typography>
              
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <EmailIcon color="action" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Email
                    </Typography>
                    {editingEmail ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <TextField
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          variant="outlined"
                          size="small"
                          type="email"
                          sx={{ flex: 1 }}
                        />
                        <IconButton onClick={handleSaveEmail} color="primary">
                          <SaveIcon />
                        </IconButton>
                        <IconButton onClick={handleCancelEmail} color="error">
                          <CancelIcon />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {profile.email}
                        </Typography>
                        <IconButton onClick={handleEditEmail} color="primary" size="small">
                          <EditIcon />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CalendarIcon color="action" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Join Date
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formatDate(profile.created_at)}
                    </Typography>
                  </Box>
                </Box>
                
                {profile.last_login && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <AccessTimeIcon color="action" />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Last Login
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {formatDate(profile.last_login)}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Paper>
      </Box>

      {/* Delete Account Section */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={handleOpenDeleteDialog}
          sx={{
            borderColor: '#d32f2f',
            color: '#d32f2f',
            '&:hover': {
              borderColor: '#b71c1c',
              backgroundColor: 'rgba(211, 47, 47, 0.04)'
            }
          }}
        >
          Delete Account
        </Button>
      </Box>

      {/* Delete Account Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        aria-labelledby="delete-account-dialog-title"
        aria-describedby="delete-account-dialog-description"
      >
        <DialogTitle id="delete-account-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          Delete Account
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-account-dialog-description">
            <strong>Warning: This action cannot be undone!</strong>
            <br /><br />
            By deleting your account, you will:
            <ul>
              <li>Permanently lose access to all your groups and data</li>
              <li>Be removed from all groups you're a member of</li>
              <li>Have your account completely deleted from the system</li>
            </ul>
            <br />
            <strong>Note:</strong> Your player data in existing tables and statistics will remain visible, but will no longer be linked to your account.
            <br /><br />
            Are you absolutely sure you want to delete your account?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteAccount} 
            color="error" 
            variant="contained"
            disabled={deletingAccount}
            startIcon={deletingAccount ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deletingAccount ? 'Deleting...' : 'Delete Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default MyProfile; 