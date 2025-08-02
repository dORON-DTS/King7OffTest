import React, { useState, useEffect, useRef } from 'react';
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
  Divider,
  Button,
  Snackbar
} from '@mui/material';
import {
  Casino as CasinoIcon,
  AccessTime as AccessTimeIcon,
  AccountBalance as AccountBalanceIcon,
  EmojiEvents as EmojiEventsIcon,
  Share as ShareIcon
} from '@mui/icons-material';
import html2canvas from 'html2canvas';


interface UserStatistics {
  total_games: number;
  games_won: number;
  games_lost: number;
  total_earnings: number;
  total_losses: number;
  total_buy_in: number;
  last_game_date?: string;
}

const MyStatistics: React.FC = () => {
  const [statistics, setStatistics] = useState<UserStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const statisticsRef = useRef<HTMLDivElement>(null);

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

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const generateStatisticsImage = async () => {
    if (!statisticsRef.current) return null;
    
    setSharing(true);
    try {
      const canvas = await html2canvas(statisticsRef.current, {
        backgroundColor: '#1a1a1a',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      return canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `poker-statistics-${new Date().toISOString().split('T')[0]}.png`;
          link.click();
          URL.revokeObjectURL(url);
          setSnackbarMessage('Statistics image downloaded successfully!');
        }
        setSharing(false);
      }, 'image/png');
    } catch (error) {
      console.error('Error generating image:', error);
      setSnackbarMessage('Error generating image');
      setSharing(false);
    }
  };

  const handleShare = async () => {
    if (isMobile()) {
      // Use Web Share API directly on mobile
      try {
        const canvas = await html2canvas(statisticsRef.current!, {
          backgroundColor: '#1a1a1a',
          scale: 2,
          useCORS: true,
          allowTaint: true
        });
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], 'poker-statistics.png', { type: 'image/png' });
            
            // Check if Web Share API supports file sharing
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  title: 'My Poker Statistics',
                  text: 'Check out my poker statistics!',
                  files: [file]
                });
                return; // Success, exit early
              } catch (shareError) {
                console.error('Share cancelled or failed:', shareError);
                // Don't fallback to download on mobile - let user try again
                return;
              }
            } else {
              // Web Share API not supported or doesn't support files
              setSnackbarMessage('Sharing not supported in this browser. Try Safari or download the image.');
              return;
            }
          }
        }, 'image/png');
      } catch (error) {
        console.error('Error sharing:', error);
        setSnackbarMessage('Error sharing statistics');
      }
    } else {
      await generateStatisticsImage();
    }
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
      {/* Desktop Layout */}
      <Box sx={{ 
        display: { xs: 'none', md: 'flex' }, 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4 
      }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(90deg, #1976d2 0%, #21cbf3 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textFillColor: 'transparent'
          }}
        >
          My Statistics
        </Typography>
        
        <Button
          variant="contained"
          startIcon={<ShareIcon />}
          onClick={handleShare}
          disabled={sharing}
          sx={{
            background: 'linear-gradient(135deg, #1976d2 0%, #21cbf3 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #1565c0 0%, #1e88e5 100%)'
            }
          }}
        >
          {sharing ? 'Generating...' : 'Share Statistics'}
        </Button>
      </Box>

      {/* Mobile Layout */}
      <Box sx={{ 
        display: { xs: 'block', md: 'none' }, 
        mb: 4 
      }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(90deg, #1976d2 0%, #21cbf3 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textFillColor: 'transparent',
            textAlign: 'center',
            mb: 2
          }}
        >
          My Statistics
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<ShareIcon />}
            onClick={handleShare}
            disabled={sharing}
            sx={{
              background: 'linear-gradient(135deg, #1976d2 0%, #21cbf3 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1565c0 0%, #1e88e5 100%)'
              }
            }}
          >
            {sharing ? 'Generating...' : 'Share Statistics'}
          </Button>
        </Box>
      </Box>

      <Paper
        ref={statisticsRef}
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
          <Grid item xs={6} sm={6} md={3}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(33, 203, 243, 0.1) 100%)',
                border: '1px solid rgba(25, 118, 210, 0.2)',
                borderRadius: 2,
                textAlign: 'center',
                p: 2,
                height: { xs: 160, sm: 160, md: 'auto' },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <CardContent sx={{ p: 1 }}>
                                 <CasinoIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                 <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
                   {statistics.total_games}
                 </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Games Played
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Last Game */}
          <Grid item xs={6} sm={6} md={3}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.1) 0%, rgba(186, 104, 200, 0.1) 100%)',
                border: '1px solid rgba(156, 39, 176, 0.2)',
                borderRadius: 2,
                textAlign: 'center',
                p: 2,
                height: { xs: 160, sm: 160, md: 'auto' },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <CardContent sx={{ p: 1 }}>
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

          {/* Total Buy In */}
          <Grid item xs={6} sm={6} md={3}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 235, 59, 0.1) 100%)',
                border: '1px solid rgba(255, 193, 7, 0.2)',
                borderRadius: 2,
                textAlign: 'center',
                p: 2,
                height: { xs: 160, sm: 160, md: 'auto' },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <CardContent sx={{ p: 1 }}>
                <AccountBalanceIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main', mb: 1 }}>
                  {formatCurrency(statistics.total_buy_in)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Buy In
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Wins vs Losses */}
          <Grid item xs={6} sm={6} md={3}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(129, 199, 132, 0.1) 100%)',
                border: '1px solid rgba(76, 175, 80, 0.2)',
                borderRadius: 2,
                textAlign: 'center',
                p: 2,
                height: { xs: 160, sm: 160, md: 'auto' },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <CardContent sx={{ p: 1 }}>
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

      

      {/* Snackbar for notifications */}
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={3000}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Container>
  );
};

export default MyStatistics; 