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

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<React.ReactNode>('');
  const { login, user } = useUser();
  const theme = useTheme();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const response = await fetch(`${apiUrl}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.message && data.message.includes('verify your email')) {
          setError(
            <span>
              Please verify your email before logging in.<br />
              <Link component={RouterLink} to="/verify-email" sx={{ color: theme.palette.primary.main, fontWeight: 600 }}>
                Click here to verify
              </Link>
            </span>
          );
          return;
        }
        if (response.status === 403 && data.message && data.message.includes('blocked')) {
          setError('Your account has been blocked. Please contact an administrator.');
          return;
        }
        if (response.status === 400 && data.message && data.message.includes('valid email')) {
          setError('Please enter a valid email address');
          return;
        }
        throw new Error(data.error || data.message || 'Login failed');
      }

      await login(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login error');
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
              King 7 Offsuit
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" align="center">
              Welcome back! Please login to continue
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
            <TextField
              margin="normal"
              required
              fullWidth
              label="Password"
              type="password"
              variant="filled"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
              }}
            >
              Sign In
            </Button>
            
            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <Link 
                component={RouterLink} 
                to="/forgot-password" 
                sx={{ 
                  color: theme.palette.text.secondary,
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  '&:hover': {
                    color: theme.palette.primary.main,
                    textDecoration: 'underline',
                  }
                }}
              >
                Forgot your password?
              </Link>
            </Box>
            
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Don't have an account?{' '}
                <Link 
                  component={RouterLink} 
                  to="/register" 
                  sx={{ 
                    color: theme.palette.primary.main,
                    textDecoration: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      textDecoration: 'underline',
                    }
                  }}
                >
                  Create one here
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login; 