import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box
} from '@mui/material';

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ open, onClose, onSuccess }) => {
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: groupName.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create group');
      }

      setGroupName('');
      setError('');
      onSuccess();
      onClose();
    } catch (error) {
      setError('Failed to create group');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Group</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <TextField
            autoFocus
            label="Group Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            error={!!error}
            helperText={error}
            fullWidth
            required
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit}
          variant="contained"
          disabled={!groupName.trim()}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateGroupDialog; 