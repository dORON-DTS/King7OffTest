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
  Switch,
  FormControlLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Group } from '../types';
import { useUser } from '../context/UserContext';

interface GroupManagementDialogProps {
  open: boolean;
  onClose: () => void;
}

const GroupManagementDialog: React.FC<GroupManagementDialogProps> = ({ open, onClose }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const { user } = useUser();

  useEffect(() => {
    if (open) {
      fetchGroups();
    }
  }, [open]);

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/groups`);
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleCreateGroup = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newGroup),
      });

      if (!response.ok) throw new Error('Failed to create group');
      
      await fetchGroups();
      setNewGroup({ name: '', description: '' });
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/groups/${editingGroup.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingGroup),
      });

      if (!response.ok) throw new Error('Failed to update group');
      
      await fetchGroups();
      setEditingGroup(null);
    } catch (error) {
      console.error('Error updating group:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/groups/${groupId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete group');
      
      await fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Manage Groups</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Create New Group</Typography>
          <TextField
            label="Group Name"
            value={newGroup.name}
            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Description"
            value={newGroup.description}
            onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            onClick={handleCreateGroup}
            disabled={!newGroup.name.trim()}
          >
            Create Group
          </Button>
        </Box>

        <Typography variant="h6" sx={{ mb: 2 }}>Existing Groups</Typography>
        <List>
          {groups.map((group) => (
            <ListItem key={group.id}>
              {editingGroup?.id === group.id ? (
                <Box sx={{ width: '100%' }}>
                  <TextField
                    label="Group Name"
                    value={editingGroup.name}
                    onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                    fullWidth
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    label="Description"
                    value={editingGroup.description || ''}
                    onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                    fullWidth
                    sx={{ mb: 1 }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editingGroup.isActive}
                        onChange={(e) => setEditingGroup({ ...editingGroup, isActive: e.target.checked })}
                      />
                    }
                    label="Active"
                  />
                  <Box sx={{ mt: 1 }}>
                    <Button onClick={() => setEditingGroup(null)} sx={{ mr: 1 }}>
                      Cancel
                    </Button>
                    <Button variant="contained" onClick={handleUpdateGroup}>
                      Save
                    </Button>
                  </Box>
                </Box>
              ) : (
                <>
                  <ListItemText
                    primary={group.name}
                    secondary={group.description}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => setEditingGroup(group)}
                      sx={{ mr: 1 }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteGroup(group.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </>
              )}
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default GroupManagementDialog; 