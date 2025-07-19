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
  
  // Transfer ownership state
  const [transferOwnershipDialog, setTransferOwnershipDialog] = useState(false);
  const [transferTargetMember, setTransferTargetMember] = useState<GroupMember | null>(null);
  
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
    // Check if this is an ownership transfer
    if (newRole === 'owner') {
      const targetMember = allMembers.find(member => member.id === memberId);
      if (targetMember) {
        setTransferTargetMember(targetMember);
        setTransferOwnershipDialog(true);
        return;
      }
    }

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

  const handleTransferOwnership = async () => {
    if (!transferTargetMember) return;

    try {
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/groups/${groupId}/members/${transferTargetMember.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: 'owner' })
      }, logout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to transfer ownership');
      }

      setSuccess('Ownership transferred successfully');
      setEditingMember(null);
      setTransferOwnershipDialog(false);
      setTransferTargetMember(null);
      
      // Refresh members list
      await fetchMembers();
    } catch (err) {
      if (err instanceof Error && err.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setError(err instanceof Error ? err.message : 'Failed to transfer ownership');
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

  // Sort members by role priority and join date
  const allMembers = membersData ? (() => {
    const members = [membersData.owner, ...membersData.members];
    
    // Define role priority (lower number = higher priority)
    const getRolePriority = (role: string) => {
      switch (role) {
        case 'owner': return 1;
        case 'editor': return 2;
        case 'viewer': return 3;
        default: return 4;
      }
    };
    
    // Sort by role priority first, then by join date (oldest first)
    return members.sort((a, b) => {
      const rolePriorityA = getRolePriority(a.role);
      const rolePriorityB = getRolePriority(b.role);
      
      // If roles are different, sort by role priority
      if (rolePriorityA !== rolePriorityB) {
        return rolePriorityA - rolePriorityB;
      }
      
      // If roles are the same, sort by join date (oldest first)
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateA - dateB;
    });
  })() : [];

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
                    mb: { 
                      xs: editingMember === member.id ? 4 : 1,
                      sm: 1
                    },
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    minHeight: editingMember === member.id ? { xs: 'auto', sm: 'auto' } : 'auto',
                    pb: editingMember === member.id ? { xs: 2, sm: 0 } : 0,
                    flexDirection: editingMember === member.id ? { xs: 'column', sm: 'row' } : 'row',
                    alignItems: editingMember === member.id ? { xs: 'flex-start', sm: 'center' } : 'center'
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
                    position: editingMember === member.id ? { xs: 'static', sm: 'absolute' } : 'absolute',
                    right: editingMember === member.id ? { xs: 'auto', sm: 16 } : 16,
                    top: editingMember === member.id ? { xs: 'auto', sm: '50%' } : '50%',
                    transform: editingMember === member.id ? { xs: 'none', sm: 'translateY(-50%)' } : 'translateY(-50%)',
                    mt: editingMember === member.id ? { xs: 2, sm: 0 } : 0,
                    width: editingMember === member.id ? { xs: '100%', sm: 'auto' } : 'auto'
                  }}>
                    {member.role !== 'owner' && (
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: editingMember === member.id ? { xs: 'flex-start', sm: 'flex-end' } : 'flex-end' }}>
                        {editingMember === member.id ? (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                            <FormControl size="small">
                              <Select
                                value={editingRole}
                                onChange={(e) => setEditingRole(e.target.value)}
                                sx={{ color: 'white', minWidth: 100 }}
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
                                {currentUser?.id === membersData?.owner.id && member.role !== 'owner' && (
                                  <MenuItem value="owner">Owner</MenuItem>
                                )}
                              </Select>
                            </FormControl>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleUpdateMemberRole(member.id, editingRole)}
                            >
                              Save
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setEditingMember(null)}
                            >
                              Cancel
                            </Button>
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

      {/* Transfer Ownership Confirmation Dialog */}
      <Dialog
        open={transferOwnershipDialog}
        onClose={() => {
          setTransferOwnershipDialog(false);
          setTransferTargetMember(null);
          setEditingMember(null);
        }}
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ color: '#ff9800', fontWeight: 'bold' }}>
          ⚠️ Transfer Group Ownership
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontWeight: 'bold' }}>
            You are about to transfer ownership of the group "{groupName}" to {transferTargetMember?.username}.
          </Typography>
          <Typography sx={{ mb: 2, color: '#ff9800' }}>
            This action will:
          </Typography>
          <Box component="ul" sx={{ pl: 2, mb: 2 }}>
            <Typography component="li" sx={{ mb: 1 }}>
              Remove your ownership of this group
            </Typography>
            <Typography component="li" sx={{ mb: 1 }}>
              Transfer full control to {transferTargetMember?.username}
            </Typography>
            <Typography component="li" sx={{ mb: 1 }}>
              Change your role to Manager
            </Typography>
          </Box>
          <Typography sx={{ color: '#f44336', fontWeight: 'bold' }}>
            This action cannot be undone. Are you sure you want to proceed?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setTransferOwnershipDialog(false);
              setTransferTargetMember(null);
              setEditingMember(null);
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleTransferOwnership}
            color="warning" 
            variant="contained"
            sx={{ fontWeight: 'bold' }}
          >
            Transfer Ownership
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default GroupMembersDialog; 