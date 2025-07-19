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
  ListItemButton,
  Typography,
  Box,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';

// Define animations
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

interface Group {
  id: number;
  name: string;
  description?: string;
  owner: {
    id: number;
    username: string;
  };
}

interface JoinGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: '#1e1e1e',
    color: 'white',
    borderRadius: 12,
    minWidth: 400,
    [theme.breakpoints.down('sm')]: {
      minWidth: '90vw',
      margin: 16,
    },
  },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    color: 'white',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    '& fieldset': {
      borderColor: '#444',
    },
    '&:hover fieldset': {
      borderColor: '#666',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#2196f3',
    },
  },
  '& .MuiInputLabel-root': {
    color: '#aaa',
    '&.Mui-focused': {
      color: '#2196f3',
    },
  },
}));

const StyledList = styled(List)({
  backgroundColor: '#2a2a2a',
  borderRadius: 8,
  marginTop: 8,
  maxHeight: 300,
  overflow: 'auto',
  '& .MuiListItem-root': {
    borderBottom: '1px solid #444',
    '&:last-child': {
      borderBottom: 'none',
    },
  },
});

const StyledListItemButton = styled(ListItemButton)({
  '&:hover': {
    backgroundColor: '#3a3a3a',
  },
  '&.Mui-selected': {
    backgroundColor: '#2196f3',
    '&:hover': {
      backgroundColor: '#1976d2',
    },
  },
});

const JoinGroupDialog: React.FC<JoinGroupDialogProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchTerm, setSearchTerm] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (searchTerm.length >= 3) {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      fetch(`${process.env.REACT_APP_API_URL}/api/groups/search?q=${encodeURIComponent(searchTerm)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to search groups');
        }
        return response.json();
      })
      .then(data => {
        // Transform API response to match our interface
        const transformedGroups = data.map((group: any) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          owner: {
            id: group.owner_id || 'unknown',
            username: group.owner_username || 'Unknown'
          }
        }));
        setGroups(transformedGroups);
      })
      .catch(err => {
        setError(err.message);
        setGroups([]);
      })
      .finally(() => {
        setLoading(false);
      });
    } else {
      setGroups([]);
    }
  }, [searchTerm]);

  const handleGroupSelect = (group: Group) => {
    setSelectedGroup(group);
  };

  const handleJoinRequest = async () => {
    if (!selectedGroup) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/groups/${selectedGroup.id}/join-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          throw new Error('You already have a pending request to join this group. Please wait for the owner to respond.');
        }
        throw new Error(errorData.error || 'Failed to send join request');
      }

      const result = await response.json();
      
      // Show success message
      setSuccess('Join request sent successfully! The group owner will be notified.');
      
      // Close dialog and refresh
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      }, 2000);
    } catch (err) {
      console.error('Error sending join request:', err);
      setError(err instanceof Error ? err.message : 'Failed to send join request');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setGroups([]);
    setSelectedGroup(null);
    setError(null);
    onClose();
  };

  return (
    <>
      <StyledDialog 
        open={open} 
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
      <DialogTitle sx={{ 
        textAlign: 'center',
        background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
        color: 'white',
        fontWeight: 'bold',
        fontSize: isMobile ? '1.2rem' : '1.5rem'
      }}>
        JOIN GROUP
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body2" sx={{ mb: 2, color: '#aaa', textAlign: 'center' }}>
          Search for groups to join. Type at least 3 characters to see results.
        </Typography>

        <StyledTextField
          fullWidth
          label="Search groups..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          variant="outlined"
          sx={{ mb: 2 }}
        />

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert 
            severity="success" 
            sx={{ 
              mb: 2,
              animation: `${fadeIn} 0.3s ease-out`,
            }}
          >
            {success}
          </Alert>
        )}

        {groups.length > 0 && (
          <StyledList>
            {groups.map((group) => (
              <ListItem key={group.id} disablePadding>
                <StyledListItemButton
                  selected={selectedGroup?.id === group.id}
                  onClick={() => handleGroupSelect(group)}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <GroupIcon sx={{ color: '#2196f3', fontSize: 20 }} />
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {group.name}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <PersonIcon sx={{ color: '#FFD700', fontSize: 16 }} />
                        <Typography variant="body2" sx={{ color: '#aaa' }}>
                          Owner: {group.owner.username}
                        </Typography>
                      </Box>
                    }
                  />
                </StyledListItemButton>
              </ListItem>
            ))}
          </StyledList>
        )}

        {searchTerm.length > 0 && searchTerm.length < 3 && (
          <Typography variant="body2" sx={{ color: '#ff9800', textAlign: 'center', mt: 2 }}>
            Please enter at least 3 characters to search
          </Typography>
        )}

        {searchTerm.length >= 3 && groups.length === 0 && !loading && (
          <Typography variant="body2" sx={{ color: '#aaa', textAlign: 'center', mt: 2 }}>
            No groups found matching "{searchTerm}"
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button 
          onClick={handleClose}
          sx={{ 
            color: '#aaa',
            '&:hover': { color: 'white' }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleJoinRequest}
          disabled={!selectedGroup}
          sx={{
            background: selectedGroup ? '#dc004e' : '#666',
            '&:hover': {
              background: selectedGroup ? '#9a0036' : '#666',
            },
            '&:disabled': {
              background: '#666',
              color: '#aaa',
            },
            borderRadius: 2,
            px: 3,
            py: 1,
          }}
        >
          Ask to Join
        </Button>
      </DialogActions>
    </StyledDialog>
    </>
  );
};

export default JoinGroupDialog; 