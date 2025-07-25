import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Alert,
  Typography,
  Card,
  CardContent,
  Tooltip,
  Switch,
  Pagination,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Avatar,
  Autocomplete
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import LockResetIcon from '@mui/icons-material/LockReset';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import VerifiedIcon from '@mui/icons-material/Verified';
import BlockIcon from '@mui/icons-material/Block';
import { useUser } from '../context/UserContext';
import { apiFetch } from '../utils/apiInterceptor';

interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
  isVerified?: boolean;
  isBlocked?: boolean | number;
  createdAt: string;
}

interface GroupMembership {
  groupId: string;
  groupName: string;
  role: string;
  joinedAt: string;
  tableCount: number;
}

interface UserDetails {
  user: User;
  groupMemberships: GroupMembership[];
}

interface SearchFilters {
  searchTerm: string;
  role: string;
  verified: string;
  blocked: string;
  fromDate: string;
}

interface Group {
  id: string;
  name: string;
}

interface Player {
  playerName: string;
}

interface GroupMember {
  id: string;
  username: string;
  email: string;
}

interface PlayerAlias {
  id: string;
  user_id: string;
  player_name: string;
  group_id: string;
  created_at: string;
  is_active: number;
  username: string;
  email: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState('');
  const [emailError, setEmailError] = useState('');
  
  // Player Alias Connection Tool
  const [groups, setGroups] = useState<Group[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedUser, setSelectedUser] = useState<GroupMember | null>(null);
  const [existingAlias, setExistingAlias] = useState<PlayerAlias | null>(null);
  const [connectConfirmOpen, setConnectConfirmOpen] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connectSuccess, setConnectSuccess] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [blockError, setBlockError] = useState('');

  // User details popup state
  const [userDetailsDialogOpen, setUserDetailsDialogOpen] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState<UserDetails | null>(null);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(20);

  // Search and filters state
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    searchTerm: '',
    role: '',
    verified: '',
    blocked: '',
    fromDate: ''
  });
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>({
    searchTerm: '',
    role: '',
    verified: '',
    blocked: '',
    fromDate: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const { user: currentUser, logout } = useUser();
  const currentUserId = currentUser?.id;

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, logout);
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
      setFilteredUsers(data);
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setError('Error loading users');
    }
  };

  // Player Alias Connection Functions
  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/groups`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, logout);
      
      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }
      const data = await response.json();
      // Ensure data is an array
      setGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return;
      }
      console.error('Error fetching groups:', error);
      setGroups([]); // Set empty array on error
    }
  };

  const fetchPlayers = async (groupId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/groups/${groupId}/players`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, logout);
      
      if (!response.ok) {
        throw new Error('Failed to fetch players');
      }
      const data = await response.json();
      // Ensure data is an array
      setPlayers(Array.isArray(data) ? data : []);
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return;
      }
      console.error('Error fetching players:', error);
      setPlayers([]); // Set empty array on error
    }
  };

  const fetchGroupMembers = async (groupId: string) => {
    try {
      const token = localStorage.getItem('token');
      console.log('[Frontend] Fetching group members for group:', groupId);
      
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/groups/${groupId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, logout);
      
      if (!response.ok) {
        throw new Error('Failed to fetch group members');
      }
      const data = await response.json();
      console.log('[Frontend] Received group members data:', data);
      
      // Handle the new data structure: {owner: {...}, members: [...]}
      let membersArray = [];
      if (data && typeof data === 'object') {
        if (Array.isArray(data)) {
          // Old format - direct array
          membersArray = data;
        } else if (data.owner && data.members) {
          // New format - combine owner and members
          membersArray = [data.owner, ...data.members];
        }
      }
      
      console.log('[Frontend] Setting group members:', membersArray);
      setGroupMembers(membersArray);
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return;
      }
      console.error('Error fetching group members:', error);
      setGroupMembers([]); // Set empty array on error
    }
  };

  const checkExistingAlias = async (playerName: string, groupId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/player-aliases/${encodeURIComponent(playerName)}/${groupId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, logout);
      
      if (!response.ok) {
        throw new Error('Failed to check existing alias');
      }
      const data = await response.json();
      setExistingAlias(data);
      if (data) {
        // Find the user in groupMembers and set it as selected
        const user = groupMembers.find(member => member.id === data.user_id);
        setSelectedUser(user || null);
      } else {
        setSelectedUser(null);
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return;
      }
      console.error('Error checking existing alias:', error);
    }
  };

  const handleGroupChange = (group: Group | null) => {
    setSelectedGroup(group);
    setSelectedPlayer(null);
    setSelectedUser(null);
    setExistingAlias(null);
    setPlayers([]);
    setGroupMembers([]);
    
    if (group) {
      fetchPlayers(group.id);
      fetchGroupMembers(group.id);
    }
  };

  const handlePlayerChange = (player: Player | null) => {
    setSelectedPlayer(player);
    setSelectedUser(null);
    setExistingAlias(null);
    
    if (player && selectedGroup) {
      checkExistingAlias(player.playerName, selectedGroup.id);
    }
  };

  const handleUserChange = (user: GroupMember | null) => {
    setSelectedUser(user);
  };

  const handleConnectPlayer = async () => {
    if (!selectedGroup || !selectedPlayer || !selectedUser) {
      setConnectError('Please select all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/player-aliases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          playerName: selectedPlayer.playerName,
          groupId: selectedGroup.id,
          userId: selectedUser.id
        })
      }, logout);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to connect player');
      }

      setConnectSuccess('Player connected successfully!');
      setConnectError('');
      // Reset form
      setSelectedGroup(null);
      setSelectedPlayer(null);
      setSelectedUser(null);
      setExistingAlias(null);
      setPlayers([]);
      setGroupMembers([]);
      setConnectConfirmOpen(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setConnectSuccess(''), 3000);
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return;
      }
      setConnectError(error instanceof Error ? error.message : 'Error connecting player');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchGroups();
  }, []);

  // Fetch user details with group memberships
  const fetchUserDetails = async (userId: string) => {
    try {
      setLoadingUserDetails(true);
      const token = localStorage.getItem('token');
      
      // Fetch user's group memberships
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users/${userId}/groups`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, logout);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }
      
      const data = await response.json();
      const user = users.find(u => u.id === userId);
      
      if (user) {
        setSelectedUserDetails({
          user,
          groupMemberships: data.groupMemberships || []
        });
        setUserDetailsDialogOpen(true);
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return;
      }
      setError('Error loading user details');
    } finally {
      setLoadingUserDetails(false);
    }
  };

  // Apply filters function
  const applyFilters = () => {
    let filtered = [...users];

    // Search term filter
    if (appliedFilters.searchTerm) {
      const searchLower = appliedFilters.searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.username.toLowerCase().includes(searchLower) ||
        (user.email && user.email.toLowerCase().includes(searchLower))
      );
    }

    // Role filter
    if (appliedFilters.role) {
      filtered = filtered.filter(user => user.role === appliedFilters.role);
    }

    // Verified filter
    if (appliedFilters.verified) {
      const isVerified = appliedFilters.verified === 'yes';
      filtered = filtered.filter(user => user.isVerified === isVerified);
    }

    // Blocked filter
    if (appliedFilters.blocked) {
      const isBlocked = appliedFilters.blocked === 'blocked';
      filtered = filtered.filter(user => !!user.isBlocked === isBlocked);
    }

    // Date filter
    if (appliedFilters.fromDate) {
      const fromDate = new Date(appliedFilters.fromDate);
      filtered = filtered.filter(user => 
        new Date(user.createdAt) >= fromDate
      );
    }

    setFilteredUsers(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Handle search button click
  const handleSearch = () => {
    setAppliedFilters(searchFilters);
  };

  // Handle clear filters
  const handleClearFilters = () => {
    const emptyFilters = {
      searchTerm: '',
      role: '',
      verified: '',
      blocked: '',
      fromDate: ''
    };
    setSearchFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setFilteredUsers(users);
    setCurrentPage(1);
  };

  // Apply filters when appliedFilters change
  useEffect(() => {
    applyFilters();
  }, [appliedFilters, users]);



  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setCurrentPage(value);
  };

  const handleCreateUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/admin/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole
        })
      }, logout);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403 || errorText.includes('permission')) {
          setError('You do not have permission to perform this action');
          return;
        }
        throw new Error('Failed to create user');
      }
      await fetchUsers();
      setNewUsername('');
      setNewPassword('');
      setNewRole('viewer');
      setShowAddUser(false);
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setError('Error creating user');
    }
  };

  const handleOpenAddUser = () => {
    setNewUsername('');
    setNewPassword('');
    setNewRole('viewer');
    setShowAddUser(true);
  };

  const handleDeleteConfirm = (userId: string) => {
    setUserToDelete(userId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users/${userToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, logout);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403 || errorText.includes('permission')) {
          setError('You do not have permission to perform this action');
          return;
        }
        throw new Error('Failed to delete user');
      }
      await fetchUsers();
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setError('Error deleting user');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      }, logout);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403 || errorText.includes('permission')) {
          setError('You do not have permission to perform this action');
          return;
        }
        throw new Error('Failed to update role');
      }
      await fetchUsers();
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setError('Error updating role');
    }
  };

  const handleOpenResetDialog = (userId: string) => {
    setResetUserId(userId);
    setResetPassword('');
    setResetError('');
    setResetSuccess('');
    setResetDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !resetPassword) return;
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users/${resetUserId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: resetPassword })
      }, logout);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403 || errorText.includes('permission')) {
          setResetError('You do not have permission to perform this action');
          return;
        }
        throw new Error('Failed to reset password');
      }
      setResetSuccess('Password reset successfully');
      setTimeout(() => {
        setResetDialogOpen(false);
        setResetUserId(null);
        setResetPassword('');
        setResetSuccess('');
      }, 1200);
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setResetError('Error resetting password');
    }
  };

  const handleStartEditEmail = (userId: string, currentEmail: string) => {
    setEditingEmail(userId);
    setEmailValue(currentEmail || '');
    setEmailError('');
    setEmailSuccess('');
  };

  const handleCancelEditEmail = () => {
    setEditingEmail(null);
    setEmailValue('');
    setEmailError('');
    setEmailSuccess('');
  };

  const validateEmail = (email: string) => {
    if (!email.trim()) return true; // Allow empty email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSaveEmail = async (userId: string) => {
    if (!validateEmail(emailValue)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users/${userId}/email`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: emailValue.trim() || null })
      }, logout);
      
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403 || errorText.includes('permission')) {
          setEmailError('You do not have permission to perform this action');
          return;
        }
        if (response.status === 409) {
          setEmailError('This email is already in use by another user');
          return;
        }
        throw new Error('Failed to update email');
      }
      
      const responseData = await response.json();
      setEmailSuccess(responseData.message || 'Email updated successfully');
      await fetchUsers(); // Refresh the user list
      setTimeout(() => {
        setEditingEmail(null);
        setEmailValue('');
        setEmailError('');
        setEmailSuccess('');
      }, 2000); // Longer timeout to read the message
    } catch (error) {
      if (error instanceof Error && error.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setEmailError('Error updating email');
    }
  };

  const handleToggleBlocked = async (userId: string, currentBlocked: boolean | number) => {
    setBlockError('');
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`${process.env.REACT_APP_API_URL}/api/users/${userId}/blocked`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isBlocked: currentBlocked ? 0 : 1 })
      }, logout);
      
      if (!response.ok) {
        setBlockError('Failed to update blocked status');
        return;
      }
      await fetchUsers();
    } catch (err) {
      if (err instanceof Error && err.message === 'User blocked') {
        return; // User was blocked and logged out
      }
      setBlockError('Error updating blocked status');
    }
  };

  // Role order for sorting
  const getRoleOrder = (role: string) => {
    if (role === 'admin') return 0;
    if (role === 'editor') return 1;
    if (role === 'viewer') return 2;
    return 99;
  };
  
  // Sort filtered users
  const sortedFilteredUsers = [...filteredUsers].sort((a, b) => {
    const roleDiff = getRoleOrder(a.role) - getRoleOrder(b.role);
    if (roleDiff !== 0) return roleDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Update currentUsers to use sorted filtered users
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = sortedFilteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(sortedFilteredUsers.length / usersPerPage);

  return (
    <Box sx={{ mt: 4, maxWidth: 1200, mx: 'auto' }}>
      <Card sx={{ mb: 4, bgcolor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 3,
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 2, sm: 0 }
          }}>
            <Typography 
              variant="h4" 
              component="h1" 
              sx={{ 
                color: 'primary.main', 
                fontWeight: 'bold',
                fontSize: { xs: '1.5rem', sm: '2rem' }
              }}
            >
              User Management ({filteredUsers.length} Users)
            </Typography>
            <Button
              variant="outlined"
              onClick={handleOpenAddUser}
              sx={{
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': { 
                  bgcolor: 'primary.main',
                  color: 'white'
                },
                borderRadius: 2,
                px: { xs: 3, sm: 4 },
                py: { xs: 1, sm: 1.5 },
                fontSize: { xs: '0.875rem', sm: '1rem' },
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              Add New User
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Search and Filters Section */}
          <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <SearchIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Search & Filters
              </Typography>
              <IconButton
                size="small"
                onClick={() => setShowFilters(!showFilters)}
                sx={{ ml: 'auto' }}
              >
                <FilterListIcon />
              </IconButton>
            </Box>

            {/* Search Bar */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search by username or email"
                  value={searchFilters.searchTerm}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  placeholder="Enter search term..."
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={handleSearch}
                  sx={{ height: '40px' }}
                >
                  Search
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                  sx={{ height: '40px' }}
                >
                  Clear
                </Button>
              </Grid>
            </Grid>

            {/* Advanced Filters */}
            {showFilters && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={searchFilters.role}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, role: e.target.value }))}
                      label="Role"
                    >
                      <MenuItem value="">All Roles</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                      <MenuItem value="editor">Manager</MenuItem>
                      <MenuItem value="viewer">Member</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Verified</InputLabel>
                    <Select
                      value={searchFilters.verified}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, verified: e.target.value }))}
                      label="Verified"
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="yes">Verified</MenuItem>
                      <MenuItem value="no">Not Verified</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={searchFilters.blocked}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, blocked: e.target.value }))}
                      label="Status"
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="blocked">Blocked</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="From Date"
                    value={searchFilters.fromDate}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            )}

            {/* Active Filters Display */}
            {(appliedFilters.searchTerm || appliedFilters.role || appliedFilters.verified || appliedFilters.blocked || appliedFilters.fromDate) && (
              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" sx={{ mr: 1, alignSelf: 'center' }}>
                  Active Filters:
                </Typography>
                {appliedFilters.searchTerm && (
                  <Chip 
                    label={`Search: "${appliedFilters.searchTerm}"`} 
                    size="small" 
                    onDelete={() => {
                      setSearchFilters(prev => ({ ...prev, searchTerm: '' }));
                      setAppliedFilters(prev => ({ ...prev, searchTerm: '' }));
                    }}
                  />
                )}
                {appliedFilters.role && (
                  <Chip 
                    label={`Role: ${appliedFilters.role}`} 
                    size="small" 
                    onDelete={() => {
                      setSearchFilters(prev => ({ ...prev, role: '' }));
                      setAppliedFilters(prev => ({ ...prev, role: '' }));
                    }}
                  />
                )}
                {appliedFilters.verified && (
                  <Chip 
                    label={`Verified: ${appliedFilters.verified === 'yes' ? 'Yes' : 'No'}`} 
                    size="small" 
                    onDelete={() => {
                      setSearchFilters(prev => ({ ...prev, verified: '' }));
                      setAppliedFilters(prev => ({ ...prev, verified: '' }));
                    }}
                  />
                )}
                {appliedFilters.blocked && (
                  <Chip 
                    label={`Status: ${appliedFilters.blocked}`} 
                    size="small" 
                    onDelete={() => {
                      setSearchFilters(prev => ({ ...prev, blocked: '' }));
                      setAppliedFilters(prev => ({ ...prev, blocked: '' }));
                    }}
                  />
                )}
                {appliedFilters.fromDate && (
                  <Chip 
                    label={`From: ${new Date(appliedFilters.fromDate).toLocaleDateString()}`} 
                    size="small" 
                    onDelete={() => {
                      setSearchFilters(prev => ({ ...prev, fromDate: '' }));
                      setAppliedFilters(prev => ({ ...prev, fromDate: '' }));
                    }}
                  />
                )}
              </Box>
            )}
          </Paper>

          <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'background.default' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
                  <TableCell sx={{ 
                    fontWeight: 'bold',
                    display: { xs: 'none', sm: 'table-cell' }
                  }}>Role</TableCell>
                  <TableCell sx={{ 
                    fontWeight: 'bold',
                    display: { xs: 'none', md: 'table-cell' }
                  }}>Email</TableCell>
                  <TableCell sx={{ 
                    fontWeight: 'bold',
                    display: { xs: 'none', lg: 'table-cell' }
                  }}>Verified</TableCell>
                  <TableCell sx={{ 
                    fontWeight: 'bold',
                    display: { xs: 'none', sm: 'table-cell' }
                  }}>Created At</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', display: { xs: 'none', md: 'table-cell' } }}>Blocked</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentUsers.map((user) => {
                  return (
                    <TableRow key={user.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Button
                            variant="text"
                            onClick={() => fetchUserDetails(user.id)}
                            sx={{ 
                              p: 0, 
                              minWidth: 'auto', 
                              textTransform: 'none',
                              color: 'primary.main',
                              fontWeight: 'bold',
                              '&:hover': {
                                textDecoration: 'underline'
                              }
                            }}
                          >
                            {user.username}
                          </Button>
                          <Box sx={{ 
                            display: { xs: 'flex', sm: 'none' },
                            flexDirection: 'column',
                            gap: 0.5,
                            mt: 1,
                            fontSize: '0.875rem',
                            color: 'text.secondary'
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              Role: 
                              <Select
                                value={user.role}
                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                disabled={user.id === currentUserId}
                                size="small"
                                sx={{ 
                                  minWidth: 100,
                                  height: '30px',
                                  '.MuiSelect-select': {
                                    py: 0.5
                                  }
                                }}
                              >
                                <MenuItem value="viewer">Member</MenuItem>
                                <MenuItem value="editor">Manager</MenuItem>
                                <MenuItem value="admin">Admin</MenuItem>
                              </Select>
                            </Box>
                            {editingEmail === user.id ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                                <TextField
                                  size="small"
                                  value={emailValue}
                                  onChange={(e) => setEmailValue(e.target.value)}
                                  placeholder="Enter email"
                                  sx={{ minWidth: 180 }}
                                />
                                {emailError && (
                                  <Typography variant="caption" color="error">
                                    {emailError}
                                  </Typography>
                                )}
                                {emailSuccess && (
                                  <Typography variant="caption" color="success.main">
                                    {emailSuccess}
                                  </Typography>
                                )}
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleSaveEmail(user.id)}
                                    sx={{ color: 'success.main', '&:hover': { bgcolor: 'success.main', color: 'white' } }}
                                  >
                                    <SaveIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={handleCancelEditEmail}
                                    sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                                  >
                                    <CancelIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                                <span>Email: {user.email || '-'}</span>
                                <IconButton
                                  size="small"
                                  onClick={() => handleStartEditEmail(user.id, user.email || '')}
                                  sx={{ color: 'primary.main', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            )}
                            <Box sx={{ fontSize: '0.75rem', color: user.isVerified ? 'success.main' : 'error.main', fontWeight: user.isVerified ? 'bold' : 'normal', mt: 0.5 }}>
                              Verified: {user.isVerified ? 'Yes' : 'No'}
                            </Box>
                            <Box>Created: {new Date(user.createdAt).toLocaleDateString('he-IL', {
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                })}</Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <span>Status:</span>
                              <Switch
                                checked={!!user.isBlocked}
                                onChange={() => handleToggleBlocked(user.id, user.isBlocked || false)}
                                color={user.isBlocked ? 'error' : 'success'}
                                size="small"
                                inputProps={{ 'aria-label': 'blocked toggle' }}
                              />
                              <Typography variant="caption" sx={{ color: user.isBlocked ? 'error.main' : 'success.main', fontWeight: 600 }}>
                                {user.isBlocked ? 'Blocked' : 'Active'}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={user.id === currentUserId}
                          sx={{ minWidth: 120 }}
                        >
                          <MenuItem value="viewer">Member</MenuItem>
                          <MenuItem value="editor">Manager</MenuItem>
                          <MenuItem value="admin">Admin</MenuItem>
                        </Select>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        {editingEmail === user.id ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <TextField
                              size="small"
                              value={emailValue}
                              onChange={(e) => setEmailValue(e.target.value)}
                              placeholder="Enter email"
                              sx={{ minWidth: 200 }}
                            />
                            {emailError && (
                              <Typography variant="caption" color="error">
                                {emailError}
                              </Typography>
                            )}
                            {emailSuccess && (
                              <Typography variant="caption" color="success.main">
                                {emailSuccess}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton
                                size="small"
                                onClick={() => handleSaveEmail(user.id)}
                                sx={{ color: 'success.main', '&:hover': { bgcolor: 'success.main', color: 'white' } }}
                              >
                                <SaveIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={handleCancelEditEmail}
                                sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{user.email || '-'}</span>
                            <IconButton
                              size="small"
                              onClick={() => handleStartEditEmail(user.id, user.email || '')}
                              sx={{ color: 'primary.main', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1,
                          color: user.isVerified ? 'success.main' : 'error.main',
                          fontWeight: user.isVerified ? 'bold' : 'normal'
                        }}>
                          {user.isVerified ? '✓ Verified' : '✗ Not Verified'}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                                    {new Date(user.createdAt).toLocaleDateString('he-IL', {
                              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                            })}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Switch
                            checked={!!user.isBlocked}
                            onChange={() => handleToggleBlocked(user.id, user.isBlocked || false)}
                            color={user.isBlocked ? 'error' : 'success'}
                            inputProps={{ 'aria-label': 'blocked toggle' }}
                          />
                          <Typography variant="body2" sx={{ color: user.isBlocked ? 'error.main' : 'success.main', fontWeight: 600 }}>
                            {user.isBlocked ? 'Blocked' : 'Active'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Delete User">
                          <span>
                            <IconButton
                              onClick={() => handleDeleteConfirm(user.id)}
                              disabled={user.id === currentUserId}
                              sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.main', color: 'white' } }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Reset Password">
                          <span>
                            <IconButton
                              onClick={() => { handleOpenResetDialog(user.id); }}
                              disabled={user.id === currentUserId}
                              sx={{ color: 'primary.main', ml: 1, '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                            >
                              <LockResetIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              mt: 3,
              gap: 2
            }}>
              <Typography variant="body2" color="text.secondary">
                Showing {indexOfFirstUser + 1}-{Math.min(indexOfLastUser, sortedFilteredUsers.length)} of {sortedFilteredUsers.length} users
              </Typography>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                size="large"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog 
        open={showAddUser} 
        onClose={() => setShowAddUser(false)}
        PaperProps={{
          sx: { 
            borderRadius: 2,
            width: '100%',
            maxWidth: { xs: '100%', sm: '400px' },
            m: { xs: 0, sm: 2 }
          }
        }}
        fullScreen={false}
      >
        <DialogTitle 
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            bgcolor: 'primary.main',
            color: 'white',
            py: 2
          }}
        >
          Add New User
        </DialogTitle>
        <DialogContent sx={{ mt: 3, px: 3 }}>
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              autoFocus
              label="Username"
              fullWidth
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            />
            <TextField
              label="Password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            />
            <Select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              sx={{ 
                minWidth: 120,
                '& .MuiOutlinedInput-root': {
                  '&:hover fieldset': {
                    borderColor: 'primary.main',
                  },
                },
              }}
            >
              <MenuItem value="viewer">Member</MenuItem>
              <MenuItem value="editor">Manager</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </Box>
        </DialogContent>
        <DialogActions 
          sx={{ 
            p: 2.5, 
            borderTop: 1, 
            borderColor: 'divider',
            gap: 1,
            flexDirection: { xs: 'column', sm: 'row' },
            '& > button': {
              width: { xs: '100%', sm: 'auto' }
            }
          }}
        >
          <Button 
            onClick={() => setShowAddUser(false)}
            variant="outlined"
            fullWidth
            sx={{
              color: 'text.secondary',
              borderColor: 'divider',
              '&:hover': {
                borderColor: 'text.primary',
                bgcolor: 'action.hover'
              },
              order: { xs: 2, sm: 1 }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateUser} 
            variant="contained"
            disabled={!newUsername || !newPassword}
            fullWidth
            sx={{
              bgcolor: 'success.main',
              '&:hover': { bgcolor: 'success.dark' },
              '&.Mui-disabled': {
                bgcolor: 'action.disabledBackground',
                color: 'action.disabled'
              },
              order: { xs: 1, sm: 2 }
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider' }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>
            Are you sure you want to delete this user? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteUser}
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 2, width: '100%', maxWidth: { xs: '100%', sm: '400px' }, m: { xs: 0, sm: 2 } } }}
        fullScreen={false}
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'primary.main', color: 'white', py: 2 }}>
          Reset Password
        </DialogTitle>
        <DialogContent sx={{ mt: 3, px: 3 }}>
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="New Password"
              type="password"
              fullWidth
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              autoFocus
            />
            {resetError && <Alert severity="error">{resetError}</Alert>}
            {resetSuccess && <Alert severity="success">{resetSuccess}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: 'divider', gap: 1, flexDirection: { xs: 'column', sm: 'row' }, '& > button': { width: { xs: '100%', sm: 'auto' } } }}>
          <Button onClick={() => setResetDialogOpen(false)} variant="outlined" fullWidth sx={{ color: 'text.secondary', borderColor: 'divider', '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' }, order: { xs: 2, sm: 1 } }}>
            Cancel
          </Button>
          <Button onClick={handleResetPassword} variant="contained" disabled={!resetPassword} fullWidth sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' }, order: { xs: 1, sm: 2 } }}>
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      {blockError && <Alert severity="error">{blockError}</Alert>}

      {/* User Details Dialog */}
      <Dialog
        open={userDetailsDialogOpen}
        onClose={() => setUserDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: 1, 
          borderColor: 'divider',
          bgcolor: 'primary.main',
          color: 'white',
          py: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'white', color: 'primary.main' }}>
              <PersonIcon />
            </Avatar>
            <Typography variant="h6">
              {selectedUserDetails?.user.username} - User Details
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {loadingUserDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <Typography>Loading user details...</Typography>
            </Box>
          ) : selectedUserDetails ? (
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon color="primary" />
                      Basic Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Username</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {selectedUserDetails.user.username}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Email</Typography>
                        <Typography variant="body1">
                          {selectedUserDetails.user.email || 'Not provided'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Role</Typography>
                        <Chip 
                          label={selectedUserDetails.user.role.toUpperCase()} 
                          color={selectedUserDetails.user.role === 'admin' ? 'error' : selectedUserDetails.user.role === 'editor' ? 'warning' : 'default'}
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Account Created</Typography>
                        <Typography variant="body1">
                          {new Date(selectedUserDetails.user.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                          })}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Verification Status</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {selectedUserDetails.user.isVerified ? (
                            <>
                              <VerifiedIcon color="success" fontSize="small" />
                              <Typography variant="body1" color="success.main">Verified</Typography>
                            </>
                          ) : (
                            <>
                              <BlockIcon color="error" fontSize="small" />
                              <Typography variant="body1" color="error.main">Not Verified</Typography>
                            </>
                          )}
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Account Status</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {selectedUserDetails.user.isBlocked ? (
                            <>
                              <BlockIcon color="error" fontSize="small" />
                              <Typography variant="body1" color="error.main">Blocked</Typography>
                            </>
                          ) : (
                            <>
                              <VerifiedIcon color="success" fontSize="small" />
                              <Typography variant="body1" color="success.main">Active</Typography>
                            </>
                          )}
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Group Memberships */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GroupIcon color="primary" />
                      Group Memberships ({selectedUserDetails.groupMemberships.length} groups)
                    </Typography>
                    {selectedUserDetails.groupMemberships.length > 0 ? (
                      <List>
                        {selectedUserDetails.groupMemberships.map((membership, index) => (
                          <React.Fragment key={membership.groupId}>
                            <ListItem sx={{ px: 0 }}>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                      {membership.groupName}
                                    </Typography>
                                    <Chip 
                                      label={membership.role.toUpperCase()} 
                                      color={membership.role === 'owner' ? 'error' : membership.role === 'editor' ? 'warning' : 'default'}
                                      size="small"
                                    />
                                  </Box>
                                }
                                secondary={
                                  <Box sx={{ mt: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                      Joined: {new Date(membership.joinedAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                                      })}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      Tables in group: {membership.tableCount}
                                    </Typography>
                                  </Box>
                                }
                              />
                            </ListItem>
                            {index < selectedUserDetails.groupMemberships.length - 1 && (
                              <Divider />
                            )}
                          </React.Fragment>
                        ))}
                      </List>
                    ) : (
                      <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        User is not a member of any groups.
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Typography>No user details available.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={() => setUserDetailsDialogOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connect Player to User Tool */}
      <Box sx={{ mt: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h5" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
              <PersonIcon />
              CONNECT PLAYERS TO USERS
            </Typography>
            
            {connectSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {connectSuccess}
              </Alert>
            )}
            
            {connectError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {connectError}
              </Alert>
            )}

            <Grid container spacing={3}>
              {/* Select Group */}
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={groups}
                  getOptionLabel={(option) => option.name}
                  value={selectedGroup}
                  onChange={(event, newValue) => handleGroupChange(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Group"
                      required
                      fullWidth
                    />
                  )}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                />
              </Grid>

              {/* Select Player */}
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={players}
                  getOptionLabel={(option) => option.playerName}
                  value={selectedPlayer}
                  onChange={(event, newValue) => handlePlayerChange(newValue)}
                  disabled={!selectedGroup}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Player"
                      required
                      fullWidth
                      helperText={existingAlias ? `Already connected to: ${existingAlias.username} (${existingAlias.email})` : ''}
                    />
                  )}
                  isOptionEqualToValue={(option, value) => option.playerName === value.playerName}
                />
              </Grid>

              {/* Select User */}
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={groupMembers}
                  getOptionLabel={(option) => `${option.username} (${option.email})`}
                  value={selectedUser}
                  onChange={(event, newValue) => handleUserChange(newValue)}
                  disabled={!selectedPlayer}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select User"
                      required
                      fullWidth
                    />
                  )}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                />
              </Grid>

              {/* Connect Button */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    onClick={() => setConnectConfirmOpen(true)}
                    disabled={!selectedGroup || !selectedPlayer || !selectedUser}
                    sx={{
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 'bold'
                    }}
                  >
                    CONNECT USER
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>

      {/* Connect Confirmation Dialog */}
      <Dialog
        open={connectConfirmOpen}
        onClose={() => setConnectConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: 2, width: '100%', maxWidth: { xs: '100%', sm: '500px' }, m: { xs: 0, sm: 2 } } }}
        fullScreen={false}
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'warning.main', color: 'white', py: 2 }}>
          Confirm Connection
        </DialogTitle>
        <DialogContent sx={{ mt: 3, px: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to connect the player <strong>"{selectedPlayer?.playerName}"</strong> to the user <strong>"{selectedUser?.username}"</strong> in the group <strong>"{selectedGroup?.name}"</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This action cannot be undone and will link all future statistics for this player to this user account.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: 'divider', gap: 1, flexDirection: { xs: 'column', sm: 'row' }, '& > button': { width: { xs: '100%', sm: 'auto' } } }}>
          <Button onClick={() => setConnectConfirmOpen(false)} variant="outlined" fullWidth sx={{ color: 'text.secondary', borderColor: 'divider', '&:hover': { borderColor: 'text.primary', bgcolor: 'action.hover' }, order: { xs: 2, sm: 1 } }}>
            Cancel
          </Button>
          <Button onClick={handleConnectPlayer} variant="contained" color="warning" fullWidth sx={{ bgcolor: 'warning.main', '&:hover': { bgcolor: 'warning.dark' }, order: { xs: 1, sm: 2 } }}>
            Confirm Connection
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement; 