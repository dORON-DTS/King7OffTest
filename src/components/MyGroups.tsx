import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Chip,
  CircularProgress,
  Alert,
  useTheme,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import { styled } from '@mui/material/styles';
import GroupIcon from '@mui/icons-material/Group';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import { Group } from '../types';
import GroupMembersDialog from './GroupMembersDialog';
import CreateGroupDialog from './CreateGroupDialog';
import { useUser } from '../context/UserContext';

// Styled card with different border colors based on role
const StyledCard = styled(Card)<{ userRole: string }>(({ theme, userRole }) => {
  let borderColor = '#E0E0E0';
  let shadowColor = 'rgba(224,224,224,0.2)';
  
  switch (userRole) {
    case 'owner':
      borderColor = '#FFD700'; // Gold for owner
      shadowColor = 'rgba(255,215,0,0.4)';
      break;
    case 'editor':
      borderColor = '#4caf50'; // Green for editor
      shadowColor = 'rgba(76,175,80,0.4)';
      break;
    case 'viewer':
      borderColor = '#757575'; // Gray for viewer
      shadowColor = 'rgba(117,117,117,0.2)';
      break;
  }

  return {
    position: 'relative',
    transition: 'all 0.3s ease',
    border: `2px solid ${borderColor}`,
    boxShadow: `0 4px 20px 0 rgba(0,0,0,0.08), 0 7px 10px -5px ${shadowColor}`,
    '&:hover': {
      transform: 'translateY(-8px)',
      boxShadow: `0 8px 30px 0 rgba(0,0,0,0.1), 0 10px 15px -5px ${shadowColor}`,
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
      border: `2.5px solid ${borderColor}`,
      borderRadius: 'inherit',
      pointerEvents: 'none',
      opacity: 0,
      transition: 'opacity 0.3s ease',
    },
    '& .MuiCardContent-root': {
      background: '#181818',
      color: 'white',
    },
  };
});

const MyGroups: React.FC = () => {
  const { user } = useUser();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const theme = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMyGroups();
  }, []);

  const fetchMyGroups = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/my-groups`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }

      const data = await response.json();
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch groups');
    } finally {
      setLoading(false);
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
        return 'Editor';
      case 'viewer':
        return 'Viewer';
      default:
        return 'Member';
    }
  };

  const formatDate = (date: Date | string) => {
    if (!date) return 'Unknown';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('he-IL');
  };

  // Check if user can create groups (admin or editor)
  const canCreateGroups = user?.role === 'admin' || user?.role === 'editor';

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 6, p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

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
          MY GROUPS
        </Typography>
        <Typography variant="subtitle1" sx={{ 
          color: 'rgba(255,255,255,0.7)',
          fontStyle: 'italic',
          letterSpacing: '1px'
        }}>
          Groups you own or are a member of
        </Typography>
      </Box>

      {/* Create Group Button */}
      {canCreateGroups && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          mb: 3 
        }}>
          <Button 
            variant="contained" 
            color="secondary"
            onClick={() => setCreateGroupDialogOpen(true)}
            startIcon={<AddIcon />}
            sx={{ 
              borderRadius: 2,
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              background: '#dc004e',
              boxShadow: '0 3px 5px 2px rgba(220, 0, 78, .3)',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 5px 8px 2px rgba(220, 0, 78, .4)',
                background: '#9a0036'
              }
            }}
          >
            CREATE NEW GROUP
          </Button>
        </Box>
      )}

      <Box sx={{ width: '100%', maxWidth: { xs: 400, sm: '100%' }, mx: { xs: 'auto', sm: 0 } }}>
        {groups.length === 0 ? (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
            color: 'white',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            bgcolor: 'rgba(33,150,243,0.07)',
            borderRadius: 2,
            boxShadow: 2,
            mt: 4,
            mb: 4
          }}>
            You are not a member of any groups yet.
          </Box>
        ) : (
          <Grid container spacing={2} sx={{ 
            width: '100%', 
            m: 0,
            px: { xs: 0, sm: 2 },
            justifyContent: { xs: 'center', sm: 'flex-start' }
          }}>
            {groups.map((group) => (
              <Grid item xs={12} sm={6} md={2.4} key={group.id} sx={{ ml: { xs: '-8px', sm: 0 } }}>
                <StyledCard
                  userRole={group.userRole || 'viewer'}
                  onClick={() => navigate(`/tables?group=${group.id}`)}
                  sx={{ 
                    cursor: 'pointer', 
                    '&:hover': { 
                      boxShadow: `0 0 24px 4px ${getRoleColor(group.userRole || 'viewer')}40, 0 12px 32px rgba(0,0,0,0.5)` 
                    } 
                  }}
                >
                  <CardContent sx={{ p: 1 }}>
                    <Box sx={{ position: 'relative', mb: 1, minHeight: 32 }}>
                      <Typography variant="h6" sx={{ 
                        color: 'white', 
                        fontWeight: 'bold', 
                        fontSize: '1rem', 
                        textAlign: 'center', 
                        width: '100%' 
                      }}>
                        {group.name}
                      </Typography>
                      
                      {/* Management button for owners */}
                      {group.userRole === 'owner' && (
                        <Tooltip title="Manage Group Members" arrow>
                          <IconButton
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              color: '#FFD700',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                                transform: 'scale(1.1)',
                              },
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroup(group);
                              setMembersDialogOpen(true);
                            }}
                          >
                            <SettingsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <Chip
                        label={getRoleLabel(group.userRole || 'viewer')}
                        sx={{ 
                          bgcolor: getRoleColor(group.userRole || 'viewer'), 
                          color: 'white', 
                          fontWeight: 'bold', 
                          fontSize: '0.75rem', 
                          height: 22 
                        }}
                      />
                      <Chip
                        icon={<GroupIcon />}
                        label="Group"
                        sx={{ bgcolor: '#2196f3', color: 'white', fontSize: '0.75rem', height: 22 }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {group.description && (
                        <Typography variant="body2" sx={{ 
                          color: 'rgba(255,255,255,0.7)', 
                          fontSize: '0.85rem',
                          textAlign: 'center',
                          fontStyle: 'italic'
                        }}>
                          {group.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon sx={{ color: '#FFD700' }} />
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                          Role: {getRoleLabel(group.userRole || 'viewer')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarTodayIcon sx={{ color: '#2196f3' }} />
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                          Created: {formatDate(group.createdAt)}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </StyledCard>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Group Members Management Dialog */}
      {selectedGroup && (
        <GroupMembersDialog
          open={membersDialogOpen}
          onClose={() => {
            setMembersDialogOpen(false);
            setSelectedGroup(null);
          }}
          groupId={selectedGroup.id}
          groupName={selectedGroup.name}
        />
      )}

      {/* Create Group Dialog */}
      <CreateGroupDialog
        open={createGroupDialogOpen}
        onClose={() => setCreateGroupDialogOpen(false)}
        onSuccess={() => {
          setCreateGroupDialogOpen(false);
          fetchMyGroups(); // Refresh the groups list
        }}
      />
    </Box>
  );
};

export default MyGroups; 