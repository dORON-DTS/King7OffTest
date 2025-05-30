import React, { useState, useEffect } from 'react';
import { usePoker } from '../context/PokerContext';
import { Link, useNavigate } from 'react-router-dom';
import { Table, CreateTableFormData, Group } from '../types';
import { useUser } from '../context/UserContext';
import CreateGroupDialog from './CreateGroupDialog';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Snackbar,
  Alert,
  Grid,
  Card,
  CardContent,
  Tooltip,
  Zoom,
  Chip,
  MenuItem
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import GroupIcon from '@mui/icons-material/Group';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AddIcon from '@mui/icons-material/Add';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BarChartIcon from '@mui/icons-material/BarChart';
import { styled } from '@mui/material/styles';

const StyledCard = styled(Card)<{ isActive: boolean }>(({ theme, isActive }) => ({
  position: 'relative',
  transition: 'all 0.3s ease',
  border: isActive ? '2px solid #4caf50' : '2px solid #E0E0E0',
  boxShadow: isActive
    ? '0 4px 20px 0 rgba(0,0,0,0.14), 0 7px 10px -5px rgba(76,175,80,0.4)'
    : '0 4px 20px 0 rgba(0,0,0,0.08), 0 7px 10px -5px rgba(224,224,224,0.2)',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: isActive
      ? '0 8px 30px 0 rgba(0,0,0,0.2), 0 10px 15px -5px rgba(76,175,80,0.5)'
      : '0 8px 30px 0 rgba(0,0,0,0.1), 0 10px 15px -5px rgba(224,224,224,0.3)',
    '&::after': {
      opacity: 1,
    },
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    border: isActive ? '2.5px solid #43e96b' : '2.5px solid #e0e0e0',
    borderRadius: 'inherit',
    pointerEvents: 'none',
    opacity: 0,
    transition: 'opacity 0.3s ease',
  },
  '& .MuiCardContent-root': {
    background: '#181818',
    color: 'white',
  },
}));

const ActionButtons = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  display: 'flex',
  gap: theme.spacing(1),
  opacity: 1,
  transform: 'translateY(-10px)',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-5px)',
  },
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  color: 'rgba(255, 255, 255, 0.7)',
  transition: 'all 0.2s ease',
  '&:hover': {
    color: 'white',
    transform: 'scale(1.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
}));

const DeleteButton = styled(StyledIconButton)(({ theme }) => ({
  '&:hover': {
    color: '#f44336',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
}));

const ShareButton = styled(StyledIconButton)(({ theme }) => ({
  '&:hover': {
    color: '#2196f3',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
}));

const TableList: React.FC = () => {
  const { tables = [], createTable, deleteTable } = usePoker();
  const { user } = useUser();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);
  const [showShareAlert, setShowShareAlert] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [formData, setFormData] = useState<CreateTableFormData>({
    name: '',
    smallBlind: '',
    bigBlind: '',
    location: '',
    groupId: ''
  });
  const [formErrors, setFormErrors] = useState<Partial<CreateTableFormData>>({});
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Sort tables by creation date (newest first)
  const sortedTables = [...tables].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB.getTime() - dateA.getTime();
  });

  // Fetch groups when dialog opens
  useEffect(() => {
    if (createDialogOpen) {
      fetchGroups();
    }
  }, [createDialogOpen]);

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/groups`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleCreateDialogOpen = () => {
    setCreateDialogOpen(true);
    setFormData({
      name: '',
      smallBlind: '',
      bigBlind: '',
      location: '',
      groupId: ''
    });
    setFormErrors({});
  };

  const handleCreateDialogClose = () => {
    setCreateDialogOpen(false);
  };

  const validateForm = (): boolean => {
    const errors: Partial<CreateTableFormData> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Table name is required';
    }
    
    if (!formData.groupId) {
      errors.groupId = 'Group is required';
    }
    
    const smallBlind = Number(formData.smallBlind);
    if (!formData.smallBlind || isNaN(smallBlind) || smallBlind <= 0) {
      errors.smallBlind = 'Small blind must be a positive number';
    }
    
    const bigBlind = Number(formData.bigBlind);
    if (!formData.bigBlind || isNaN(bigBlind) || bigBlind <= 0) {
      errors.bigBlind = 'Big blind must be a positive number';
    } else if (bigBlind < smallBlind) {
      errors.bigBlind = 'Big blind must be at least equal to small blind';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isFormValid = () => {
    return formData.name.trim() !== '' && 
           Number(formData.smallBlind) > 0 && 
           Number(formData.bigBlind) > 0 && 
           Number(formData.bigBlind) >= Number(formData.smallBlind);
  };

  const handleCreateTable = async () => {
    if (!formData.name || !formData.smallBlind || !formData.bigBlind || !formData.groupId) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      await createTable(
        formData.name,
        Number(formData.smallBlind),
        Number(formData.bigBlind),
        formData.groupId,
        formData.location
      );
      handleCreateDialogClose();
    } catch (error) {
      setError('Failed to create table');
    }
  };

  const handleInputChange = (field: keyof CreateTableFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleDeleteClick = (tableId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setTableToDelete(tableId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (tableToDelete) {
      deleteTable(tableToDelete);
      setDeleteDialogOpen(false);
      setTableToDelete(null);
    }
  };

  const handleShare = async (tableId: string, event: React.MouseEvent) => {
    event.preventDefault();
    const shareUrl = `${window.location.origin}/share/${tableId}`;
    
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API not available');
      }
      
      await navigator.clipboard.writeText(shareUrl);
      setShowShareAlert(true);
      // Open in new tab
      window.open(shareUrl, '_blank');
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
        setShowShareAlert(true);
        // Open in new tab
        window.open(shareUrl, '_blank');
      } catch (err) {
        console.error('Failed to copy:', err);
        alert('Failed to copy share link. Please copy this URL manually: ' + shareUrl);
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const formatDate = (date: Date) => {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    return date.toLocaleDateString('he-IL');
  };

  return (
    <Box sx={{ 
      p: 3, 
      bgcolor: '#121212', 
      minHeight: '100vh',
      color: 'white',
      background: 'radial-gradient(circle at top right, #1a1a1a, #121212)',
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.5)',
      transition: 'all 0.3s ease',
    }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h2" component="h1" sx={{ 
          mb: 1,
          background: 'linear-gradient(45deg, #FFF 30%, #AAA 90%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 2px 10px rgba(0,0,0,0.3)',
          letterSpacing: '2px',
          fontFamily: 'Roboto, sans-serif',
          fontWeight: 'bold',
        }}>
          POKER TABLES
        </Typography>
        <Typography variant="subtitle1" sx={{ 
          color: 'rgba(255,255,255,0.7)',
          fontStyle: 'italic',
          letterSpacing: '1px'
        }}>
          Manage your poker games with ease
        </Typography>
      </Box>

      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: { xs: 2, sm: 2 }, 
        mb: 4 
      }}>
        <Button 
          variant="contained" 
          color="primary"
          onClick={handleCreateDialogOpen}
          startIcon={<AddIcon />}
          sx={{ 
            borderRadius: 2,
            px: { xs: 2, sm: 4 },
            py: { xs: 1, sm: 1.5 },
            fontSize: { xs: '1rem', sm: '1.1rem' },
            background: '#2196f3',
            boxShadow: '0 3px 5px 2px rgba(33, 150, 243, .3)',
            transition: 'all 0.3s ease',
            width: { xs: '100%', sm: 'auto' },
            mb: { xs: 1, sm: 0 },
            '&:hover': {
              transform: { xs: 'none', sm: 'translateY(-2px)' },
              boxShadow: '0 5px 8px 2px rgba(33, 150, 243, .4)',
              background: '#1976d2'
            }
          }}
        >
          CREATE NEW TABLE
        </Button>
        {user?.role === 'admin' && (
          <Button 
            variant="contained" 
            color="secondary"
            onClick={() => setCreateGroupDialogOpen(true)}
            startIcon={<GroupIcon />}
            sx={{ 
              borderRadius: 2,
              px: { xs: 2, sm: 4 },
              py: { xs: 1, sm: 1.5 },
              fontSize: { xs: '1rem', sm: '1.1rem' },
              background: '#dc004e',
              boxShadow: '0 3px 5px 2px rgba(220, 0, 78, .3)',
              transition: 'all 0.3s ease',
              width: { xs: '100%', sm: 'auto' },
              mb: { xs: 1, sm: 0 },
              '&:hover': {
                transform: { xs: 'none', sm: 'translateY(-2px)' },
                boxShadow: '0 5px 8px 2px rgba(220, 0, 78, .4)',
                background: '#9a0036'
              }
            }}
          >
            CREATE NEW GROUP
          </Button>
        )}
        <Button 
          variant="outlined" 
          color="secondary"
          onClick={() => navigate('/statistics')} 
          startIcon={<BarChartIcon />}
          sx={{ 
            borderRadius: 2,
            px: { xs: 2, sm: 4 },
            py: { xs: 1, sm: 1.5 },
            fontSize: { xs: '1rem', sm: '1.1rem' },
            transition: 'all 0.3s ease',
            width: { xs: '100%', sm: 'auto' },
            mb: { xs: 0, sm: 0 },
            '&:hover': {
              transform: { xs: 'none', sm: 'translateY(-2px)' },
              boxShadow: '0 5px 8px 2px rgba(220, 0, 78, .3)',
              background: 'rgba(220, 0, 78, 0.1)'
            }
          }}
        >
          VIEW STATISTICS
        </Button>
      </Box>

      <Box sx={{ width: '100%', maxWidth: { xs: 400, sm: '100%' }, mx: { xs: 'auto', sm: 0 } }}>
        <Grid container spacing={2} sx={{ 
          width: '100%', 
          m: 0,
          px: { xs: 0, sm: 2 },
          justifyContent: { xs: 'center', sm: 'flex-start' }
        }}>
          {sortedTables.map((table) => (
            <Grid item xs={12} sm={6} md={2.4} key={table.id}>
              <StyledCard
                isActive={table.isActive}
                onClick={() => navigate(`/table/${table.id}`)}
                sx={{ cursor: 'pointer', '&:hover': { boxShadow: '0 0 24px 4px rgba(33,150,243,0.2), 0 12px 32px rgba(0,0,0,0.5)' } }}
              >
                <CardContent sx={{ p: 1 }}>
                  <Box sx={{ position: 'relative', mb: 1, minHeight: 32 }}>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold', fontSize: '1rem', textAlign: 'center', width: '100%' }}>
                      {table.name}
                    </Typography>
                    <ActionButtons className="action-buttons" sx={{ position: 'absolute', top: 0, right: 0 }}>
                      <Tooltip title="Delete Table" TransitionComponent={Zoom}>
                        <DeleteButton onClick={(e) => { e.stopPropagation(); handleDeleteClick(table.id, e); }}>
                          <DeleteIcon />
                        </DeleteButton>
                      </Tooltip>
                      <Tooltip title="Share Table" TransitionComponent={Zoom}>
                        <ShareButton onClick={(e) => { e.stopPropagation(); handleShare(table.id, e); }}>
                          <ShareIcon />
                        </ShareButton>
                      </Tooltip>
                    </ActionButtons>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Chip
                      label={table.isActive ? 'Active' : 'Inactive'}
                      color={table.isActive ? 'success' : 'default'}
                      sx={{ bgcolor: table.isActive ? '#4caf50' : '#757575', color: 'white', fontWeight: 'bold', fontSize: '0.75rem', height: 22 }}
                    />
                    <Chip
                      icon={<GroupIcon />}
                      label={`${table.players.length} Players`}
                      sx={{ bgcolor: '#2196f3', color: 'white', fontSize: '0.75rem', height: 22 }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AttachMoneyIcon sx={{ color: '#4caf50' }} />
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                        Blinds: {table.smallBlind}/{table.bigBlind}
                      </Typography>
                    </Box>
                    {table.location && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocationOnIcon sx={{ color: '#2196f3' }} />
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                          {table.location}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarTodayIcon sx={{ color: '#2196f3' }} />
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                        {formatDate(table.createdAt)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </StyledCard>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Snackbar 
        open={showShareAlert} 
        autoHideDuration={3000} 
        onClose={() => setShowShareAlert(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          Share link copied to clipboard!
        </Alert>
      </Snackbar>

      {/* Create Table Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={handleCreateDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Table</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Table Name"
              required
              value={formData.name}
              onChange={handleInputChange('name')}
              error={!!formErrors.name}
              helperText={formErrors.name}
              fullWidth
            />
            <TextField
              label="Small Blind"
              required
              type="number"
              value={formData.smallBlind}
              onChange={handleInputChange('smallBlind')}
              error={!!formErrors.smallBlind}
              helperText={formErrors.smallBlind}
              fullWidth
              InputProps={{
                startAdornment: '$'
              }}
            />
            <TextField
              label="Big Blind"
              required
              type="number"
              value={formData.bigBlind}
              onChange={handleInputChange('bigBlind')}
              error={!!formErrors.bigBlind}
              helperText={formErrors.bigBlind}
              fullWidth
              InputProps={{
                startAdornment: '$'
              }}
            />
            <TextField
              label="Location"
              value={formData.location}
              onChange={handleInputChange('location')}
              fullWidth
              placeholder="Optional"
            />
            <TextField
              select
              label="Group"
              required
              value={formData.groupId}
              onChange={handleInputChange('groupId')}
              error={!!formErrors.groupId}
              helperText={formErrors.groupId}
              fullWidth
            >
              {groups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateDialogClose}>Cancel</Button>
          <Button 
            onClick={handleCreateTable} 
            color="primary" 
            variant="contained"
            disabled={!isFormValid()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Table</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this table? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Group Dialog */}
      <CreateGroupDialog
        open={createGroupDialogOpen}
        onClose={() => setCreateGroupDialogOpen(false)}
        onSuccess={() => {
          setCreateGroupDialogOpen(false);
          fetchGroups();
        }}
      />
    </Box>
  );
};

export default TableList; 