import React from 'react';
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
import { ThemeProvider, createTheme, CssBaseline, Container, AppBar, Toolbar, Typography, Button, CircularProgress, Avatar, Menu, MenuItem, IconButton, Box } from '@mui/material';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { useUser } from './context/UserContext';
import TableList from './components/TableList';
import TableDetail from './components/TableDetail';
import SharedTableView from './components/SharedTableView';
import StatisticsView from './components/StatisticsView';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import PersonIcon from '@mui/icons-material/Person';
import LandingPage from './components/LandingPage';
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
  const open = Boolean(anchorEl);
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

  // Allow unauthenticated access to /statistics and /share/:id and landing page
  const isPublicRoute =
    location.pathname.startsWith('/share/') ||
    location.pathname === '/statistics' ||
    location.pathname === '/';

  if (!user && !isPublicRoute) {
    return <Login />;
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
            <Box sx={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}>
              {user ? (
                <>
                  <IconButton
                    size="large"
                    edge="end"
                    color="inherit"
                    onClick={handleMenu}
                    sx={{ p: 0 }}
                  >
                    <Avatar sx={{ bgcolor: '#1976d2' }}>
                      <PersonIcon />
                    </Avatar>
                  </IconButton>
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
                  sx={{ fontWeight: 700, borderRadius: 3, boxShadow: 2 }}
                >
                  LOGIN
                </Button>
              )}
            </Box>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth={false} sx={{ py: 2 }}>
        <Outlet />
      </Container>
    </div>
  );
};

// Protected Route component
const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) => {
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

  return <>{children}</>;
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      path="/"
      element={<AppLayout />}
    >
      <Route index element={<LandingPage />} />
      <Route path="tableslist" element={<TableList />} />
      <Route path="tables" element={<TableList />} />
      <Route path="table/:id" element={
        <ProtectedRoute>
          <TableDetail />
        </ProtectedRoute>
      } />
      <Route path="share/:id" element={<SharedTableView />} />
      <Route path="statistics" element={<StatisticsView />} />
      <Route path="users" element={
        <ProtectedRoute requiredRole="admin">
          <UserManagement />
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
