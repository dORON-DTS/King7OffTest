import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Box,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Tooltip,
  Divider
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EditIcon from '@mui/icons-material/Edit';
import { useUser } from '../context/UserContext';
import { apiFetch } from '../utils/apiInterceptor';

interface GroupMember {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

interface GroupMembersData {
  owner: GroupMember;
  members: GroupMember[];
}

interface GroupMembersDialogProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

const GroupMembersDialog: React.FC<GroupMembersDialogProps> = ({ 
  open, 
  onClose, 
  groupId, 
  groupName 
}) => {
  const [membersData, setMembersData] = useState<GroupMembersData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('viewer');
  const [addingMember, setAddingMember] = useState(false);
  
  // Edit member state
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState('');
  
  // Remove member state
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  
  const { user: currentUser, logout } = useUser();

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, groupId]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/groups/${groupId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, logout);

      if (!response.ok) {
        throw new Error('Failed to fetch group members');
      }

      const data = await response.json();
      setMembersData(data);
    } catch (err) {
      if (err instanceof Error && err.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setAddingMember(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // First, find user by email
      const userResponse = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users/by-email/${encodeURIComponent(newMemberEmail.trim())}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, logout);

      if (!userResponse.ok) {
        throw new Error('User not found with this email');
      }

      const userData = await userResponse.json();

      // Add member to group
      const addResponse = await apiFetch(`${process.env.REACT_APP_API_URL}/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: userData.id,
          role: newMemberRole
        })
      }, logout);

      if (!addResponse.ok) {
        const errorText = await addResponse.text();
        throw new Error(errorText || 'Failed to add member');
      }

      setSuccess('Member added successfully');
      setNewMemberEmail('');
      setNewMemberRole('viewer');
      setShowAddMember(false);
      
      // Refresh members list
      await fetchMembers();
    } catch (err) {
      if (err instanceof Error && err.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/groups/${groupId}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      }, logout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update member role');
      }

      setSuccess('Member role updated successfully');
      setEditingMember(null);
      
      // Refresh members list
      await fetchMembers();
    } catch (err) {
      if (err instanceof Error && err.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setError(err instanceof Error ? err.message : 'Failed to update member role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/groups/${groupId}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, logout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to remove member');
      }

      setSuccess('Member removed successfully');
      setRemovingMember(null);
      
      // Refresh members list
      await fetchMembers();
    } catch (err) {
      if (err instanceof Error && err.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return '#FFD700'; // Gold
      case 'editor':
        return '#4caf50'; // Green
      case 'viewer':
        return '#757575'; // Gray
      default:
        return '#757575';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'editor':
        return 'Manager';
      case 'viewer':
        return 'Member';
      default:
        return 'Member';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('he-IL');
  };

  const allMembers = membersData ? [membersData.owner, ...membersData.members] : [];

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1e1e1e',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.12)'
        }
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <EmojiEventsIcon sx={{ color: '#FFD700' }} />
        Manage Members - {groupName}
      </DialogTitle>
      
      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Add Member Section */}
            <Box sx={{ mb: 3 }}>
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon />}
                onClick={() => setShowAddMember(!showAddMember)}
                sx={{ mb: 2 }}
              >
                Add Member
              </Button>
              
              {showAddMember && (
                <Box sx={{ 
                  p: 2, 
                  border: '1px solid rgba(255, 255, 255, 0.12)', 
                  borderRadius: 1,
                  mb: 2
                }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Add New Member
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                    <TextField
                      label="Email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      placeholder="Enter user's email"
                      sx={{ flex: 1 }}
                      InputLabelProps={{ sx: { color: 'grey.400' } }}
                      InputProps={{ sx: { color: 'white' } }}
                    />
                    <FormControl sx={{ minWidth: 120 }}>
                      <InputLabel sx={{ color: 'grey.400' }}>Role</InputLabel>
                      <Select
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value)}
                        sx={{ color: 'white' }}
                      >
                        <MenuItem value="viewer">Member</MenuItem>
                        <MenuItem value="editor">Manager</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      variant="contained"
                      onClick={handleAddMember}
                      disabled={addingMember || !newMemberEmail.trim()}
                    >
                      {addingMember ? 'Adding...' : 'Add'}
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Members List */}
            <Typography variant="h6" sx={{ mb: 2 }}>
              Group Members ({allMembers.length})
            </Typography>
            
            <List>
              {allMembers.map((member) => (
                <ListItem
                  key={member.id}
                  sx={{
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 1,
                    mb: 1,
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    p: { xs: 2, sm: 1 }
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {member.username}
                        </Typography>
                        {member.role === 'owner' && (
                          <EmojiEventsIcon sx={{ color: '#FFD700', fontSize: 20 }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ color: 'grey.400', mb: 0.5 }}>
                          {member.email}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={getRoleLabel(member.role)}
                            size="small"
                            sx={{
                              bgcolor: getRoleColor(member.role),
                              color: 'white',
                              fontWeight: 'bold'
                            }}
                          />
                          <Typography variant="caption" sx={{ color: 'grey.500' }}>
                            Joined: {formatDate(member.created_at)}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                  
                  <ListItemSecondaryAction sx={{ 
                    position: { xs: 'static', sm: 'absolute' },
                    right: { xs: 'auto', sm: 16 },
                    top: { xs: 'auto', sm: '50%' },
                    transform: { xs: 'none', sm: 'translateY(-50%)' },
                    mt: { xs: 2, sm: 0 }
                  }}>
                    {member.role !== 'owner' && (
                      <Box sx={{ 
                        display: 'flex', 
                        gap: 1,
                        flexDirection: { xs: 'column', sm: 'row' },
                        width: { xs: '100%', sm: 'auto' }
                      }}>
                        {editingMember === member.id ? (
                          <Box sx={{ 
                            display: 'flex', 
                            gap: 1, 
                            alignItems: 'center',
                            flexDirection: { xs: 'column', sm: 'row' },
                            width: { xs: '100%', sm: 'auto' }
                          }}>
                            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 100 } }}>
                              <Select
                                value={editingRole}
                                onChange={(e) => setEditingRole(e.target.value)}
                                sx={{ 
                                  color: 'white',
                                  '& .MuiSelect-select': {
                                    py: 1
                                  }
                                }}
                                MenuProps={{
                                  PaperProps: {
                                    sx: {
                                      bgcolor: '#1e1e1e',
                                      color: 'white',
                                      border: '1px solid rgba(255, 255, 255, 0.12)',
                                      zIndex: 9999
                                    }
                                  }
                                }}
                              >
                                <MenuItem value="viewer">Member</MenuItem>
                                <MenuItem value="editor">Manager</MenuItem>
                              </Select>
                            </FormControl>
                            <Box sx={{ 
                              display: 'flex', 
                              gap: 1,
                              width: { xs: '100%', sm: 'auto' }
                            }}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleUpdateMemberRole(member.id, editingRole)}
                                sx={{ flex: { xs: 1, sm: 'none' } }}
                              >
                                Save
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setEditingMember(null)}
                                sx={{ flex: { xs: 1, sm: 'none' } }}
                              >
                                Cancel
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <>
                            <Tooltip title="Edit Role">
                              <IconButton
                                edge="end"
                                onClick={() => {
                                  setEditingMember(member.id);
                                  setEditingRole(member.role);
                                }}
                                sx={{ color: 'grey.400' }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove Member">
                              <IconButton
                                edge="end"
                                onClick={() => setRemovingMember(member.id)}
                                sx={{ color: '#f44336' }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>

      {/* Remove Member Confirmation Dialog */}
      <Dialog
        open={!!removingMember}
        onClose={() => setRemovingMember(null)}
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }
        }}
      >
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove this member from the group? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemovingMember(null)}>
            Cancel
          </Button>
          <Button 
            onClick={() => removingMember && handleRemoveMember(removingMember)}
            color="error" 
            variant="contained"
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default GroupMembersDialog; 