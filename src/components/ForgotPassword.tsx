import React, { useState, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper,
  Container,
  Alert,
  useTheme,
  alpha,
  Link
} from '@mui/material';
import { useUser } from '../context/UserContext';
import { keyframes } from '@mui/system';
import { useNavigate, Link as RouterLink } from 'react-router-dom';

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

const pulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`;

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUser();
  const theme = useTheme();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const response = await fetch(`${apiUrl}/api/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.error && data.error.includes('blocked')) {
          setError('Your account has been blocked. Please contact an administrator.');
          return;
        }
        throw new Error(data.error || data.message || 'Failed to send reset email');
      }

      setSuccess('Password reset email sent! Please check your inbox for the verification code.');
      setTimeout(() => {
        navigate('/reset-password', { state: { email } });
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.dark, 0.2)} 100%)`,
    }}>
      <Box sx={{
        width: '100%',
        animation: `${fadeIn} 0.8s ease-out`,
      }}>
        <Paper elevation={12} sx={{
          p: 4,
          borderRadius: 2,
          background: `linear-gradient(to bottom, ${theme.palette.background.paper}, ${alpha(theme.palette.background.paper, 0.9)})`,
          backdropFilter: 'blur(10px)',
          boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
        }}>
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mb: 4,
          }}>
            <Box sx={{
              width: 120,
              height: 120,
              mb: 2,
              animation: `${pulse} 2s infinite ease-in-out`,
              '& img': {
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }
            }}>
              <img src="/logo.png" alt="Poker Management Logo" />
            </Box>
            <Typography 
              component="h1" 
              variant="h4" 
              sx={{
                fontWeight: 700,
                background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                backgroundClip: 'text',
                textFillColor: 'transparent',
                mb: 1,
              }}
            >
              Reset Password
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" align="center">
              Enter your email to receive a password reset code
            </Typography>
          </Box>
          
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                animation: `${fadeIn} 0.3s ease-out`,
              }}
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert 
              severity="success" 
              sx={{ 
                mb: 3,
                animation: `${fadeIn} 0.3s ease-out`,
              }}
            >
              {success}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Email Address"
              type="email"
              variant="filled"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
              disabled={isLoading}
              sx={{
                '& .MuiFilledInput-root': {
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.primary.light, 0.07),
                  paddingLeft: 1.5,
                  paddingRight: 1.5,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.light, 0.13),
                  },
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{
                mt: 4,
                mb: 2,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 2,
                background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
                },
                '&:disabled': {
                  transform: 'none',
                  boxShadow: 'none',
                }
              }}
            >
              {isLoading ? 'Sending...' : 'Send Reset Code'}
            </Button>
            
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Remember your password?{' '}
                <Link 
                  component={RouterLink} 
                  to="/login" 
                  sx={{ 
                    color: theme.palette.primary.main,
                    textDecoration: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      textDecoration: 'underline',
                    }
                  }}
                >
                  Sign in here
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ForgotPassword; 