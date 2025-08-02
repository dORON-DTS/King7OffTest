import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  Casino as CasinoIcon,
  AccessTime as AccessTimeIcon,
  AccountBalance as AccountBalanceIcon,
  EmojiEvents as EmojiEventsIcon
} from '@mui/icons-material';

interface UserStatistics {
  total_games: number;
  games_won: number;
  games_lost: number;
  total_earnings: number;
  total_losses: number;
  last_game_date?: string;
}

const MyStatistics: React.FC = () => {
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found');
          setLoading(false);
          return;
        }

        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/statistics`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setStatistics(data);
        } else {
          setError('Failed to fetch statistics data');
        }
      } catch (err) {
        setError('Error loading statistics');
        console.error('Error fetching statistics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  if (!statistics) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">
          Unable to load statistics
        </Alert>
      </Container>
    );
  }

  const totalBalance = statistics.total_earnings - statistics.total_losses;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
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
        My Statistics
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
        <Grid container spacing={3}>
          {/* Total Games Played */}
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(33, 203, 243, 0.1) 100%)',
                border: '1px solid rgba(25, 118, 210, 0.2)',
                borderRadius: 2,
                textAlign: 'center',
                p: 2
              }}
            >
              <CardContent>
                <CasinoIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
                  {statistics.total_games}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Games Played
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Last Game */}
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.1) 0%, rgba(186, 104, 200, 0.1) 100%)',
                border: '1px solid rgba(156, 39, 176, 0.2)',
                borderRadius: 2,
                textAlign: 'center',
                p: 2
              }}
            >
              <CardContent>
                <AccessTimeIcon sx={{ fontSize: 40, color: 'secondary.main', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main', mb: 1 }}>
                  {statistics.last_game_date ? formatDate(statistics.last_game_date) : 'No games yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last Game
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Total Money Balance */}
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 235, 59, 0.1) 100%)',
                border: '1px solid rgba(255, 193, 7, 0.2)',
                borderRadius: 2,
                textAlign: 'center',
                p: 2
              }}
            >
              <CardContent>
                <AccountBalanceIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main', mb: 1 }}>
                  {formatCurrency(totalBalance)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Balance
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Wins vs Losses */}
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(129, 199, 132, 0.1) 100%)',
                border: '1px solid rgba(76, 175, 80, 0.2)',
                borderRadius: 2,
                textAlign: 'center',
                p: 2
              }}
            >
              <CardContent>
                <EmojiEventsIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main', mb: 1 }}>
                  {statistics.games_won} / {statistics.games_lost}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Wins / Losses
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4 }} />

        {/* Detailed Balance Breakdown */}
        <Card
          sx={{
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
              <AccountBalanceIcon />
              Balance Breakdown
            </Typography>
            
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Earnings
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {formatCurrency(statistics.total_earnings)}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Losses
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {formatCurrency(statistics.total_losses)}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Net Balance
                  </Typography>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 700, 
                      color: totalBalance >= 0 ? 'success.main' : 'error.main'
                    }}
                  >
                    {formatCurrency(totalBalance)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Paper>
    </Container>
  );
};

export default MyStatistics; 