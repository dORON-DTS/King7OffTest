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
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';

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

  // Mock data for now - will be replaced with API call
  const mockGroups: Group[] = [
    { id: 1, name: 'Poker Masters', description: 'Professional poker group', owner: { id: 1, username: 'john_doe' } },
    { id: 2, name: 'Weekend Warriors', description: 'Casual weekend games', owner: { id: 2, username: 'jane_smith' } },
    { id: 3, name: 'High Stakes Club', description: 'High stakes games only', owner: { id: 3, username: 'mike_wilson' } },
    { id: 4, name: 'Beginner Friendly', description: 'New players welcome', owner: { id: 4, username: 'sarah_jones' } },
    { id: 5, name: 'Tournament Pros', description: 'Tournament focused group', owner: { id: 5, username: 'david_brown' } },
  ];

  useEffect(() => {
    if (searchTerm.length >= 3) {
      setLoading(true);
      // Simulate API call delay
      setTimeout(() => {
        const filteredGroups = mockGroups.filter(group =>
          group.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setGroups(filteredGroups);
        setLoading(false);
      }, 300);
    } else {
      setGroups([]);
    }
  }, [searchTerm]);

  const handleGroupSelect = (group: Group) => {
    setSelectedGroup(group);
  };

  const handleJoinRequest = async () => {
    if (!selectedGroup) return;
    
    // TODO: Implement API call to request joining the group
    console.log('Requesting to join group:', selectedGroup.id);
    
    // For now, just close the dialog
    onClose();
    if (onSuccess) {
      onSuccess();
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
  );
};

export default JoinGroupDialog; 