import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSwipeable } from 'react-swipeable';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import CancelIcon from '@mui/icons-material/Cancel';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Notification {
  id: string;
  type: 'join_request' | 'request_approved' | 'request_rejected';
  title: string;
  message: string;
  groupName?: string;
  requestingUser?: string;
  createdAt: string;
  isRead: boolean;
  groupId?: string;
  requestId?: string;
}

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  onNotificationCountChange: (count: number) => void;
}

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': {
    backgroundColor: '#1e1e1e',
    color: 'white',
    width: 400,
    [theme.breakpoints.down('sm')]: {
      width: '100vw',
    },
    transition: 'transform 0.3s ease-in-out',
  },
}));

const StyledListItem = styled(ListItem)({
  '&:hover': {
    backgroundColor: '#2a2a2a',
  },
  '&.unread': {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderLeft: '4px solid #2196f3',
  },
});

const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  onClose,
  onNotificationCountChange
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Swipe handlers for mobile
  const swipeHandlers = useSwipeable({
    onSwipedRight: (eventData) => {
      // Only close on swipe right if it's a significant swipe
      if (eventData.deltaX > 50) {
        onClose();
      }
    },
    preventScrollOnSwipe: true,
    trackMouse: false,
    delta: 10,
    swipeDuration: 500,
  });

  useEffect(() => {
    if (open) {
      fetchNotifications();
      markAllAsRead();
    }
  }, [open]);

  useEffect(() => {
    const unreadCount = notifications.filter(n => !n.isRead).length;
    onNotificationCountChange(unreadCount);
  }, [notifications, onNotificationCountChange]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();

      
      // Ensure data is an array and has valid structure
      if (Array.isArray(data)) {
        const validNotifications = data.map(notification => ({
          id: notification.id || 'unknown',
          type: notification.type || 'unknown',
          title: notification.title || 'No title',
          message: notification.message || 'No message',
          groupName: notification.groupName || '',
          requestingUser: notification.requestingUser || '',
          createdAt: notification.created_at || notification.createdAt || new Date().toISOString(),
          isRead: notification.is_read || notification.isRead || false,
          groupId: notification.group_id || notification.groupId || '',
          requestId: notification.request_id || notification.requestId || ''
        }));
        setNotifications(validNotifications);
      } else {
        console.error('Notifications data is not an array:', data);
        setNotifications([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }

      const result = await response.json();
      
      
      // Update local notifications to mark them as read
      setNotifications(prev => prev.map(notification => ({
        ...notification,
        isRead: true
      })));
    } catch (err) {
      console.error('Error marking notifications as read:', err);
      // Don't show error to user, just log it
    }
  };

  const handleApproveRequest = async (notification: Notification) => {
    if (!notification.groupId || !notification.requestId) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }



      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/groups/${notification.groupId}/join-request/${notification.requestId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve request');
      }

      // Refresh notifications
      fetchNotifications();
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Failed to approve request. Please try again.');
    }
  };

  const handleRejectRequest = async (notification: Notification) => {
    if (!notification.groupId || !notification.requestId) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }



      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/groups/${notification.groupId}/join-request/${notification.requestId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject request');
      }

      // Refresh notifications
      fetchNotifications();
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('Failed to reject request. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    // Check if dateString is valid
    if (!dateString || typeof dateString !== 'string') {
      return 'Unknown date';
    }
    
    // Force UTC parsing - assume the date from DB is in UTC
    let date: Date;
    if (dateString.includes('T')) {
      // ISO format - force UTC parsing
      date = new Date(dateString + 'Z'); // Add Z to force UTC
    } else if (dateString.includes('-')) {
      // SQLite format - force UTC parsing
      date = new Date(dateString.replace(' ', 'T') + 'Z'); // Add Z to force UTC
    } else {
      // Try direct parsing with UTC
      date = new Date(dateString + 'Z');
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown date';
    }
    
    // Get current time in local timezone
    const now = new Date();
    
    // Calculate difference in milliseconds between local times
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    // Return relative time based on local time difference
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    // For older dates, show the actual date in local timezone
    return date.toLocaleDateString('he-IL', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'join_request':
        return <GroupIcon sx={{ color: '#2196f3' }} />;
      case 'request_approved':
        return <CheckIcon sx={{ color: '#4caf50' }} />;
      case 'request_rejected':
        return <CancelIcon sx={{ color: '#f44336' }} />;
      default:
        return <AccessTimeIcon sx={{ color: '#ff9800' }} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'join_request':
        return '#2196f3';
      case 'request_approved':
        return '#4caf50';
      case 'request_rejected':
        return '#f44336';
      default:
        return '#ff9800';
    }
  };

  return (
    <StyledDrawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="temporary"
      disableEscapeKeyDown={false}
      BackdropProps={{
        onClick: onClose
      }}
      {...swipeHandlers}
    >
      <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Notifications
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={fetchNotifications} sx={{ color: 'white' }}>
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={onClose} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        <Divider sx={{ mb: 2, bgcolor: '#444' }} />

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : notifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <Typography variant="body2" sx={{ color: '#aaa' }}>
                No notifications yet
              </Typography>
            </Box>
          ) : (
            <List>
              {notifications.map((notification) => (
                <StyledListItem
                  key={notification.id}
                  className={notification.isRead ? '' : 'unread'}
                  sx={{ flexDirection: 'column', alignItems: 'flex-start', p: 2 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, width: '100%' }}>
                    {getNotificationIcon(notification.type)}
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', flex: 1 }}>
                      {notification.title}
                    </Typography>
                    <Chip
                      label={formatDate(notification.createdAt)}
                      size="small"
                      sx={{ 
                        bgcolor: '#333', 
                        color: '#aaa',
                        fontSize: '0.7rem'
                      }}
                    />
                  </Box>
                  
                  <Typography variant="body2" sx={{ color: '#ccc', mb: 1 }}>
                    {notification.message}
                  </Typography>

                  {notification.type === 'join_request' && notification.groupId && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CheckIcon />}
                        onClick={() => handleApproveRequest(notification)}
                        sx={{ 
                          bgcolor: '#4caf50',
                          '&:hover': { bgcolor: '#388e3c' }
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CancelIcon />}
                        onClick={() => handleRejectRequest(notification)}
                        sx={{ 
                          bgcolor: '#f44336',
                          '&:hover': { bgcolor: '#d32f2f' }
                        }}
                      >
                        Reject
                      </Button>
                    </Box>
                  )}
                  
                  {(notification.type === 'request_approved' || notification.type === 'request_rejected') && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Chip
                        label={notification.type === 'request_approved' ? 'Approved' : 'Rejected'}
                        size="small"
                        sx={{ 
                          bgcolor: notification.type === 'request_approved' ? '#4caf50' : '#f44336',
                          color: 'white',
                          fontSize: '0.7rem'
                        }}
                      />
                    </Box>
                  )}
                </StyledListItem>
              ))}
            </List>
          )}
        </Box>
      </Box>
    </StyledDrawer>
  );
};

export default NotificationsDrawer; 