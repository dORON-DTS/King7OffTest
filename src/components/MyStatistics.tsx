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
            
            // Try Web Share API with files first
            if (navigator.share) {
              try {
                // Method 1: Try with files directly
                await navigator.share({
                  title: 'My Poker Statistics',
                  text: 'Check out my poker statistics!',
                  files: [file]
                });
                return; // Success
              } catch (fileShareError) {
                console.error('File sharing failed:', fileShareError);
              }
              
              // Method 2: Try with canShare check first
              try {
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                  await navigator.share({
                    title: 'My Poker Statistics',
                    text: 'Check out my poker statistics!',
                    files: [file]
                  });
                  return; // Success
                }
              } catch (canShareError) {
                console.error('CanShare check failed:', canShareError);
              }
              
              // Method 3: Try with different file type (JPEG)
              try {
                const jpegBlob = await new Promise<Blob>((resolve) => {
                  canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
                });
                const jpegFile = new File([jpegBlob], 'poker-statistics.jpg', { type: 'image/jpeg' });
                
                await navigator.share({
                  title: 'My Poker Statistics',
                  text: 'Check out my poker statistics!',
                  files: [jpegFile]
                });
                return; // Success
              } catch (jpegShareError) {
                console.error('JPEG sharing failed:', jpegShareError);
              }
              
              // Method 4: Try with data URL
              try {
                const dataUrl = canvas.toDataURL('image/png');
                const response = await fetch(dataUrl);
                const dataBlob = await response.blob();
                const dataFile = new File([dataBlob], 'poker-statistics.png', { type: 'image/png' });
                
                await navigator.share({
                  title: 'My Poker Statistics',
                  text: 'Check out my poker statistics!',
                  files: [dataFile]
                });
                return; // Success
              } catch (dataUrlShareError) {
                console.error('Data URL sharing failed:', dataUrlShareError);
              }
              
              // Method 5: Try text-only sharing as fallback
              try {
                await navigator.share({
                  title: 'My Poker Statistics',
                  text: 'Check out my poker statistics!'
                });
                return; // Success
              } catch (textShareError) {
                console.error('Text sharing failed:', textShareError);
              }
            }
            
            // Method 6: Special handling for iOS Chrome
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const isChrome = /Chrome/.test(navigator.userAgent);
            
            if (isIOS && isChrome) {
              try {
                const dataUrl = canvas.toDataURL('image/png');
                
                // Create a data URL with the sharing page
                const dataUrlContent = `data:text/html;base64,${btoa(`
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Share Statistics</title>
                    <style>
                      body { 
                        margin: 0; 
                        padding: 20px; 
                        background: #1a1a1a; 
                        color: white; 
                        font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
                        text-align: center;
                        min-height: 100vh;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                      }
                      .container { 
                        max-width: 600px; 
                        margin: 0 auto; 
                      }
                      img { 
                        max-width: 100%; 
                        height: auto; 
                        border-radius: 10px; 
                        margin: 20px 0;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                      }
                      .share-btn { 
                        background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); 
                        color: white; 
                        border: none; 
                        padding: 15px 30px; 
                        border-radius: 25px; 
                        font-size: 16px; 
                        font-weight: 600;
                        cursor: pointer; 
                        margin: 20px 0;
                        box-shadow: 0 4px 15px rgba(0,122,255,0.3);
                      }
                      .share-btn:active {
                        transform: scale(0.98);
                      }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <h1>My Poker Statistics</h1>
                      <img src="${dataUrl}" alt="Poker Statistics">
                      <br>
                      <button class="share-btn" onclick="shareImage()">Share Statistics</button>
                    </div>
                    <script>
                      async function shareImage() {
                        try {
                          const response = await fetch('${dataUrl}');
                          const blob = await response.blob();
                          const file = new File([blob], 'poker-statistics.png', { type: 'image/png' });
                          
                          if (navigator.share) {
                            await navigator.share({
                              title: 'My Poker Statistics',
                              text: 'Check out my poker statistics!',
                              files: [file]
                            });
                          } else {
                            alert('Sharing not supported in this browser. Please use Safari.');
                          }
                        } catch (error) {
                          console.error('Sharing failed:', error);
                          alert('Sharing failed. Please try again or use Safari.');
                        }
                      }
                      
                      // Auto-share on page load after a short delay
                      window.onload = function() {
                        setTimeout(shareImage, 1000);
                      };
                    </script>
                  </body>
                  </html>
                `)}`;
                
                // Try to open the data URL directly
                window.location.href = dataUrlContent;
                
                return;
              } catch (safariError) {
                console.error('Safari sharing failed:', safariError);
              }
            }
            
            // If all sharing attempts failed, show message
            setSnackbarMessage('Sharing not supported in this browser. Try Safari or download the image.');
          }
        }, 'image/png');
      } catch (error) {
        console.error('Error generating image:', error);
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