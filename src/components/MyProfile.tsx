import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Avatar,
  Grid,
  Card,
  CardContent,
  Divider,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  CalendarToday as CalendarIcon,
  Security as SecurityIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';

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

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'System Administrator';
      case 'editor':
        return 'Editor';
      case 'user':
        return 'User';
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'editor':
        return 'warning';
      case 'user':
        return 'primary';
      default:
        return 'default';
    }
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

      <Paper
        elevation={3}
        sx={{
          p: { xs: 2, md: 4 },
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(33, 203, 243, 0.05) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
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
          
          <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            <Typography
              variant="h4"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 700, color: 'primary.main' }}
            >
              {profile.username}
            </Typography>
            
            <Chip
              icon={<SecurityIcon />}
              label={getRoleDisplayName(profile.role)}
              color={getRoleColor(profile.role) as any}
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            
            {profile.is_verified && (
              <Chip
                                 label="Verified"
                color="success"
                size="small"
                sx={{ ml: 1, fontWeight: 600 }}
              />
            )}
          </Box>
        </Box>

        {/* Profile Details Grid */}
        <Grid container spacing={3}>
          {/* Personal Information */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: '100%',
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
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Email
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {profile.email}
                      </Typography>
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
          </Grid>

          {/* Statistics */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: '100%',
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
                  <AccessTimeIcon />
                                     Statistics
                </Typography>
                
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                                             Games Played
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {profile.total_games || 0}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                                             Tables Created
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {profile.total_tables || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default MyProfile; 