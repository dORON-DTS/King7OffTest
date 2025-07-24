import React, { useState, useEffect, useCallback } from 'react';
import { 
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  Outlet,
  Navigate,
  Link as RouterLink,
  useLocation
} from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Container, AppBar, Toolbar, Typography, Button, CircularProgress, Avatar, Menu, MenuItem, IconButton, Box, Tooltip, Badge } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsDrawer from './components/NotificationsDrawer';
import ErrorBoundary from './components/ErrorBoundary';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { useUser } from './context/UserContext';
import TableList from './components/TableList';
import TableDetail from './components/TableDetail';
import SharedTableView from './components/SharedTableView';
import StatisticsView from './components/StatisticsView';
import Login from './components/Login';
import Register from './components/Register';
import VerifyEmail from './components/VerifyEmail';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import UserManagement from './components/UserManagement';
import PersonIcon from '@mui/icons-material/Person';
import LandingPage from './components/LandingPage';
import Footer from './components/Footer';
import MyGroups from './components/MyGroups';
import './App.css';

// Create emotion cache
const cache = createCache({
  key: 'css',
  prepend: true,
});

// Create a responsive theme that works well on mobile
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

const AppLayout = () => {
  const { user, logout, isLoading } = useUser();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const open = Boolean(anchorEl);

  const fetchNotificationCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const notifications = await response.json();
        if (Array.isArray(notifications)) {
          const unreadCount = notifications.filter((n: any) => !n.is_read && !n.isRead).length;
          setNotificationCount(unreadCount);
  
        } else {
          console.error('Notifications is not an array:', notifications);
          setNotificationCount(0);
        }
      }
    } catch (err) {
      console.error('Error fetching notification count:', err);
    }
  }, []);

  // Fetch notification count when user is available
  useEffect(() => {
    if (user) {
      fetchNotificationCount();
    }
  }, [user, fetchNotificationCount]);

  // Check notifications when user navigates between pages
  useEffect(() => {
    if (user) {
      fetchNotificationCount();
    }
  }, [location.pathname, user, fetchNotificationCount]);

  // Periodic notification check every 30 minutes
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchNotificationCount();
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, [user, fetchNotificationCount]);

  // Check notifications when user returns to tab
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchNotificationCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, fetchNotificationCount]);

  // Check notifications on user activity (clicks, key presses)
  useEffect(() => {
    if (!user) return;

    let lastCheck = Date.now();
    const minInterval = 30000; // Minimum 30 seconds between checks

    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastCheck > minInterval) {
        fetchNotificationCount();
        lastCheck = now;
      }
    };

    // Listen for user interactions
    document.addEventListener('click', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);
    document.addEventListener('scroll', handleUserActivity);

    return () => {
      document.removeEventListener('click', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
      document.removeEventListener('scroll', handleUserActivity);
    };
  }, [user, fetchNotificationCount]);
  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const handleLogout = () => {
    handleClose();
    logout();
  };

  if (isLoading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  // Allow unauthenticated access to landing page, login, register, and password reset pages
  const isPublicRoute =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/reset-password' ||
    location.pathname === '/verify-email';

  if (!user && !isPublicRoute) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="App">
      <AppBar 
        position="sticky" 
        sx={{ 
          bgcolor: '#121212',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          zIndex: (theme) => theme.zIndex.drawer + 1
        }}
      >
        <Toolbar sx={{ position: 'relative', minHeight: { xs: 64, sm: 72 } }}>
          <IconButton component={RouterLink} to="/" edge="start" sx={{ p: 0 }}>
            <img src="/logo.png" alt="King 7 Offsuit Logo" className="app-logo" />
          </IconButton>
          <Typography
            variant="h4"
            component="div"
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              fontWeight: 900,
              letterSpacing: 2,
              background: 'linear-gradient(90deg, #1976d2 0%, #21cbf3 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textFillColor: 'transparent',
              whiteSpace: 'nowrap',
              fontSize: { xs: '1.5rem', sm: '2.2rem', md: '2.5rem' },
              px: 1,
              maxWidth: { xs: '90vw', sm: 'unset' },
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              zIndex: 1
            }}
          >
            King 7 Offsuit
          </Typography>
          {/* LOGIN/PROFILE BUTTON - ABSOLUTE RIGHT */}
          {(user || !user) && (
            <Box sx={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              {user ? (
                <>
                  <Tooltip title="Notifications" arrow>
                    <IconButton
                      size="large"
                      color="inherit"
                      onClick={() => setNotificationsOpen(true)}
                      sx={{ p: 1 }}
                    >
                      <Badge badgeContent={notificationCount} color="error">
                        <NotificationsIcon />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={user.username} arrow>
                  <IconButton
                    size="large"
                    edge="end"
                    color="inherit"
                    onClick={handleMenu}
                    sx={{ p: 0 }}
                  >
                    <Avatar sx={{ bgcolor: '#1976d2' }}>
                        {user.username && user.username[0].toUpperCase()}
                    </Avatar>
                  </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={anchorEl}
                    open={open}
                    onClose={handleClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    {user.role === 'admin' && (
                      <MenuItem component={RouterLink} to="/users" onClick={handleClose}>
                        User Management
                      </MenuItem>
                    )}
                    {(user.role === 'admin' || user.role === 'editor') && (
                      <MenuItem component={RouterLink} to="/my-groups" onClick={handleClose}>
                        My Groups
                      </MenuItem>
                    )}
                    <MenuItem onClick={handleLogout}>Logout</MenuItem>
                  </Menu>
                </>
              ) : (
                <Button
                  color="secondary"
                  variant="contained"
                  size="large"
                  component={RouterLink}
                  to="/tableslist"
                  sx={{ 
                    fontWeight: 700, 
                    borderRadius: 3, 
                    boxShadow: 2,
                    minWidth: { xs: 'auto', sm: 'auto' },
                    px: { xs: 1, sm: 2 },
                    '& .MuiButton-startIcon': {
                      margin: { xs: 0, sm: 'auto' }
                    }
                  }}
                  startIcon={<PersonIcon />}
                >
                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  LOGIN
                  </Box>
                </Button>
              )}
            </Box>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth={false} sx={{ py: 2 }}>
        <Outlet />
      </Container>
      <Footer />
      
      {/* Notifications Drawer */}
      {user && (
        <ErrorBoundary>
          <NotificationsDrawer
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
            onNotificationCountChange={setNotificationCount}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

// Protected Route component
const ProtectedRoute = ({ children, requiredRole, allowedRoles }: { children: React.ReactNode, requiredRole?: string, allowedRoles?: string[] }) => {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!user) {
    return <Navigate to="/tableslist" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/tableslist" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/tableslist" replace />;
  }

  return <>{children}</>;
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      path="/"
      element={<AppLayout />}
    >
      <Route index element={<LandingPage />} />
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      <Route path="verify-email" element={<VerifyEmail />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
      <Route path="tableslist" element={<TableList />} />
      <Route path="tables" element={<TableList />} />
      <Route path="table/:id" element={
        <ProtectedRoute>
          <TableDetail />
        </ProtectedRoute>
      } />
      <Route path="share/:id" element={
        <ProtectedRoute>
          <SharedTableView />
        </ProtectedRoute>
      } />
      <Route path="statistics" element={
        <ProtectedRoute>
          <StatisticsView />
        </ProtectedRoute>
      } />
      <Route path="users" element={
        <ProtectedRoute requiredRole="admin">
          <UserManagement />
        </ProtectedRoute>
      } />
      <Route path="my-groups" element={
        <ProtectedRoute allowedRoles={['admin', 'editor']}>
          <MyGroups />
        </ProtectedRoute>
      } />
    </Route>
  )
);

function App() {
  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </CacheProvider>
  );
}

export default App;
