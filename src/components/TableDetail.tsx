import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePoker } from '../context/PokerContext';
import { Player, BuyIn, CashOut, EditForm, EditFormErrors } from '../types';
import { 
  Box, 
  Typography, 
  Button, 
  TextField, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Snackbar,
  Alert,
  Autocomplete
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ShareIcon from '@mui/icons-material/Share';
import GroupIcon from '@mui/icons-material/Group';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

const TableDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTable, addPlayer, removePlayer, addBuyIn, cashOut, toggleTableStatus, reactivatePlayer, disableShowMe, updateTable } = usePoker();
  
  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState<string | null>(null);
  const [newPlayerNickname, setNewPlayerNickname] = useState('');
  const [newPlayerChips, setNewPlayerChips] = useState(50);
  const [showShareAlert, setShowShareAlert] = useState(false);
  
  // Buy In dialog
  const [buyInDialogOpen, setBuyInDialogOpen] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState<number | ''>(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Buy In history dialog
  const [buyInHistoryDialogOpen, setBuyInHistoryDialogOpen] = useState(false);
  const [selectedPlayerForHistory, setSelectedPlayerForHistory] = useState<string | null>(null);

  // Cash Out dialog
  const [cashOutDialogOpen, setCashOutDialogOpen] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState(0);

  // Add new state for confirmation dialog
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);

  // Add new state for remove player dialog
  const [removePlayerDialogOpen, setRemovePlayerDialogOpen] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<string | null>(null);

  // State for unique player names
  const [uniquePlayerNames, setUniquePlayerNames] = useState<string[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add inputValue state for Autocomplete
  const [playerNameInput, setPlayerNameInput] = useState('');

  // סטייט לפתיחת דיאלוג עריכת שולחן
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // סטייטים לעריכת טופס שולחן
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    smallBlind: '',
    bigBlind: '',
    location: '',
    date: new Date()
  });
  const [editFormErrors, setEditFormErrors] = useState<EditFormErrors>({});

  const table = id ? getTable(id) : null;

  // אתחול ערכי הטופס בכל פתיחה של הדיאלוג
  useEffect(() => {
    if (editDialogOpen && table) {
      setEditForm({
        name: table.name || '',
        smallBlind: table.smallBlind?.toString() || '',
        bigBlind: table.bigBlind?.toString() || '',
        location: table.location || '',
        date: new Date(table.createdAt)
      });
      setEditFormErrors({});
    }
  }, [editDialogOpen, table]);

  // Fetch unique player names when dialog opens
  useEffect(() => {
    if (openDialog) {
      fetchUniquePlayerNames();
    }
  }, [openDialog]);

  const fetchUniquePlayerNames = async () => {
    try {
      setLoadingNames(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/statistics/players`);
      if (!response.ok) {
        throw new Error('Failed to fetch player names');
      }
      const names = await response.json();
      setUniquePlayerNames(names);
    } catch (error) {
      console.error('Error fetching player names:', error);
      showTransientError('Failed to load player names');
    } finally {
      setLoadingNames(false);
    }
  };

  // Fetch table data when id changes
  useEffect(() => {
    if (id) {
      // No need to call fetchTableData since it's not defined
      // and the table data is already available through getTable
    }
  }, [id]); // Remove fetchTableData from dependencies

  if (!id) {
    return <Typography>Invalid table ID</Typography>;
  }

  if (!table) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Table not found</Typography>
        <Button variant="contained" onClick={() => navigate('/tables')}>Back to Tables</Button>
      </Box>
    );
  }

  const handleShare = async () => {
    if (id && table) {
      const shareUrl = `${window.location.origin}/share/${id}`;
      
      try {
        if (!navigator.clipboard) {
          throw new Error('Clipboard API not available');
        }
        
        await navigator.clipboard.writeText(shareUrl);
        setShowShareAlert(true);
        // Open in new tab
        window.open(shareUrl, '_blank');
      } catch (error) {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
          document.execCommand('copy');
          setShowShareAlert(true);
          // Open in new tab
          window.open(shareUrl, '_blank');
        } catch (err) {
          console.error('Failed to copy:', err);
          alert('Failed to copy share link. Please copy this URL manually: ' + shareUrl);
        } finally {
          document.body.removeChild(textArea);
        }
      }
    }
  };

  const isFormValid = () => {
    return newPlayerName && newPlayerName.trim() !== '';
  };

  const handleAddPlayer = () => {
    if (isFormValid() && newPlayerName) {
      // Check for duplicate names and nicknames
      const isDuplicate = table.players.some(
        player =>
          player.name.toLowerCase() === newPlayerName.trim().toLowerCase() &&
          (player.nickname || '').toLowerCase() === newPlayerNickname.trim().toLowerCase()
      );

      if (isDuplicate) {
        alert('A player with this exact name and nickname combination already exists at this table');
        return;
      }

      addPlayer(
        id,
        newPlayerName.trim(),
        newPlayerChips,
        newPlayerNickname.trim()
      );
      setOpenDialog(false);
      setNewPlayerName(null);
      setNewPlayerNickname('');
      setNewPlayerChips(50);
    } else {
        console.error("Form validation failed or player name is missing.");
    }
  };

  const handleBuyIn = () => {
    if (selectedPlayerId && buyInAmount && buyInAmount > 0) {
      addBuyIn(id, selectedPlayerId, Number(buyInAmount));
      setBuyInDialogOpen(false);
      setBuyInAmount(0);
    }
  };

  const handleCashOut = (playerId: string) => {
    setSelectedPlayerId(playerId);
    const player = table.players.find(p => p.id === playerId);
    if (player) {
      setCashOutAmount(player.chips ?? 0);
      setCashOutDialogOpen(true);
    }
  };

  const confirmCashOut = () => {
    if (selectedPlayerId && cashOutAmount >= 0) {
      cashOut(id, selectedPlayerId, cashOutAmount);
      setCashOutDialogOpen(false);
      setCashOutAmount(0);
    }
  };

  const openBuyInDialog = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setBuyInAmount(0);
    setBuyInDialogOpen(true);
  };

  const openBuyInHistory = (playerId: string) => {
    setSelectedPlayerForHistory(playerId);
    setBuyInHistoryDialogOpen(true);
  };

  const selectedPlayer = selectedPlayerForHistory 
    ? table.players.find(p => p.id === selectedPlayerForHistory)
    : null;

  const calculatePlayerBalance = (player: any): number => {
    if (!player) return 0;
    const totalBuyIn = player.totalBuyIn ?? 0;
    const totalCashOut = Array.isArray(player.cashOuts)
      ? player.cashOuts.reduce((sum: number, cashOut: { amount: number }) => sum + cashOut.amount, 0)
      : 0;
    return (player.chips ?? 0) + totalCashOut - totalBuyIn;
  };

  // Add validation checks for table deactivation
  const calculateTableBalance = () => {
    // Total buy-ins
    const totalBuyIns = table.players.reduce((sum, player) => sum + (player.totalBuyIn ?? 0), 0);
    
    // Total cash-outs for inactive players + current chips for active players
    const totalCashOutsAndChips = table?.players.reduce((sum, player) => {
      if (player.active) {
        // For active players, only count their current chips
        return sum + (player.chips ?? 0);
      } else {
        // For inactive players, sum their cashouts
        const cashOutsTotal = Array.isArray(player.cashOuts) 
          ? player.cashOuts.reduce((cashOutSum: number, cashOut: { amount: number }) => cashOutSum + cashOut.amount, 0)
          : 0;
        return sum + cashOutsTotal;
      }
    }, 0) ?? 0;

    // Difference remains the same calculation
    const difference = totalBuyIns - totalCashOutsAndChips;
    return { totalBuyIns, totalCashOutsAndChips, difference };
  };

  const validateTableDeactivation = () => {
    // Check if all players are inactive
    const allPlayersInactive = table.players.every(player => !player.active);
    const balance = calculateTableBalance();
    // Balance matching check remains the same (uses the logic we fixed before)
    const isBalanceMatching = balance.difference === 0;

    return {
      allPlayersInactive, // Use this flag instead of allPlayersCashedOut
      isBalanceMatching,
      balance
    };
  };

  // Update the handler
  const handleTableStatusChange = () => {
    if (table.isActive) {
      setDeactivateDialogOpen(true);
    } else {
      toggleTableStatus(id, table.creatorId);
    }
  };

  const handleDeactivateConfirm = () => {
    const validation = validateTableDeactivation();
    // Update condition to check allPlayersInactive
    if (!validation.allPlayersInactive || !validation.isBalanceMatching) {
      return; // Don't allow deactivation if validations fail
    }
    toggleTableStatus(id, table.creatorId);
    setDeactivateDialogOpen(false);
  };

  // Add handler for remove player
  const handleRemovePlayer = (playerId: string) => {
    setPlayerToRemove(playerId);
    setRemovePlayerDialogOpen(true);
  };

  const confirmRemovePlayer = () => {
    if (playerToRemove) {
      removePlayer(id, playerToRemove);
      setRemovePlayerDialogOpen(false);
      setPlayerToRemove(null);
    }
  };

  // Calculate statistics
  const totalBuyInAmount = table.players.reduce((sum, player) => sum + (player.totalBuyIn ?? 0), 0);
  const playersWithBuyIns = table.players.filter((player: Player) => (player.totalBuyIn ?? 0) > 0).length;
  const avgBuyInPerPlayer = playersWithBuyIns > 0 ? totalBuyInAmount / playersWithBuyIns : 0;

  // עדכון ערכים בטופס
  const handleEditInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm(prev => ({ ...prev, [field]: event.target.value }));
    if (editFormErrors[field]) {
      setEditFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // ולידציה בסיסית
  const validateEditForm = () => {
    const errors: any = {};
    if (!editForm.name.trim()) errors.name = 'Name required';
    if (!editForm.smallBlind || isNaN(Number(editForm.smallBlind)) || Number(editForm.smallBlind) <= 0) errors.smallBlind = 'Small blind must be positive';
    if (!editForm.bigBlind || isNaN(Number(editForm.bigBlind)) || Number(editForm.bigBlind) <= 0) errors.bigBlind = 'Big blind must be positive';
    if (Number(editForm.bigBlind) < Number(editForm.smallBlind)) errors.bigBlind = 'Big blind must be at least small blind';
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // שמירה (TODO: לממש עדכון לשרת)
  const handleEditSave = async () => {
    if (!validateEditForm()) return;
    if (!id) return;
    await updateTable(id, {
      name: editForm.name,
      smallBlind: Number(editForm.smallBlind),
      bigBlind: Number(editForm.bigBlind),
      location: editForm.location,
      createdAt: editForm.date,
    });
    setEditDialogOpen(false);
  };

  const showTransientError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 3000);
  };

  return (
    <Box sx={{ p: 2, maxWidth: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/tables')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          {table.name}
        </Typography>
        <IconButton 
          onClick={handleShare}
          sx={{ 
            ml: 2,
            color: 'primary.main',
            '&:hover': {
              color: 'primary.dark'
            }
          }}
        >
          <ShareIcon />
        </IconButton>
      </Box>

      <Snackbar
        open={showShareAlert}
        autoHideDuration={3000}
        onClose={() => setShowShareAlert(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          Share link copied to clipboard!
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={3000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Table Info</Typography>
          {table.isActive && (
            <IconButton size="small" onClick={() => setEditDialogOpen(true)}>
              <EditIcon />
            </IconButton>
          )}
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={4}>
            <Typography variant="body2">Small Blind: {table.smallBlind}</Typography>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Typography variant="body2">Big Blind: {table.bigBlind}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2">Players: {table.players.length}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Location: {table.location || 'Not specified'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">
                Status: {table.isActive ? '🟢 Active' : '🔴 Inactive'}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={handleTableStatusChange}
              >
                {table.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              Total Buy In: {totalBuyInAmount}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="text.secondary">
              Avg Buy In per Player: {avgBuyInPerPlayer.toFixed(2)}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Players</Typography>
        <Button 
          variant="contained" 
          startIcon={<PersonAddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Add Player
        </Button>
      </Box>

      {table.players.length === 0 ? (
        <Typography>No players yet. Add players to get started!</Typography>
      ) : (
        <Grid container spacing={2}>
          {table.players.map(player => (
            <Grid item xs={12} sm={6} md={2.4} key={player.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6">
                      {player.name}
                      {!player.active && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          (Inactive)
                        </Typography>
                      )}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {!player.active && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() => reactivatePlayer(id, player.id)}
                          sx={{ height: 'fit-content' }}
                        >
                          Reactivate
                        </Button>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => disableShowMe(id, player.id)}
                        sx={{
                          color: player.showMe ? '#2196f3' : '#bdbdbd',
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'transparent'
                          }
                        }}
                      >
                        {player.showMe ? <VisibilityIcon /> : <VisibilityOffIcon />}
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleRemovePlayer(player.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>

                  <Typography variant="body2">Chips: {player.chips ?? 0}</Typography>
                  <Typography variant="body2">Total Buy In: {player.totalBuyIn ?? 0}</Typography>

                  <Button 
                    size="small"
                    onClick={() => openBuyInHistory(player.id)}
                    fullWidth
                    sx={{ mb: 2 }}
                  >
                    View History
                  </Button>

                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Button 
                        variant="outlined" 
                        fullWidth
                        startIcon={<AttachMoneyIcon />}
                        onClick={() => openBuyInDialog(player.id)}
                        disabled={!player.active}
                      >
                        Buy In
                      </Button>
                    </Grid>
                    <Grid item xs={6}>
                      <Button 
                        variant="outlined" 
                        fullWidth
                        startIcon={<AccountBalanceIcon />}
                        onClick={() => handleCashOut(player.id)}
                        disabled={!player.active || (player.totalBuyIn ?? 0) === 0}
                      >
                        Cash Out
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Player Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} PaperProps={{ sx: { bgcolor: '#2e2e2e', color: 'white' } }}>
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>Add New Player</DialogTitle>
        <DialogContent sx={{ pt: '20px !important' }}>
          <Autocomplete
            freeSolo
            options={uniquePlayerNames}
            value={newPlayerName}
            inputValue={playerNameInput}
            loading={loadingNames}
            onInputChange={(event, newInputValue) => {
              setPlayerNameInput(newInputValue);
              setNewPlayerName(newInputValue);
            }}
            onChange={(event, newValue) => {
              setNewPlayerName(newValue);
              setPlayerNameInput(newValue || '');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                margin="dense"
                label="Player Name"
                type="text"
                fullWidth
                variant="outlined"
                required
                InputLabelProps={{ sx: { color: 'grey.400' } }}
                InputProps={{
                  ...params.InputProps,
                  sx: { color: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.700' } },
                  type: 'search',
                }}
              />
            )}
            PaperComponent={(props) => (
              <Paper {...props} sx={{ bgcolor: '#3a3a3a', color: 'white' }} />
            )}
          />
          <TextField
            margin="dense"
            label="Nickname (Optional)"
            type="text"
            fullWidth
            variant="outlined"
            value={newPlayerNickname}
            onChange={(e) => setNewPlayerNickname(e.target.value)}
            InputLabelProps={{ sx: { color: 'grey.400' } }}
            InputProps={{
                sx: { color: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.700' } }
            }}
          />
          <TextField
            margin="dense"
            label="Initial Chips"
            type="number"
            fullWidth
            value={newPlayerChips}
            onChange={(e) => setNewPlayerChips(Number(e.target.value) || 0)}
            required
            InputLabelProps={{ sx: { color: 'grey.400' } }}
            InputProps={{
              sx: { color: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.700' } },
              inputProps: { min: 0 }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.12)', p: '16px' }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ color: 'grey.400' }}>Cancel</Button>
          <Button onClick={handleAddPlayer} variant="contained" disabled={!isFormValid()}>Add Player</Button>
        </DialogActions>
      </Dialog>

      {/* Buy In Dialog */}
      <Dialog open={buyInDialogOpen} onClose={() => setBuyInDialogOpen(false)}>
        <DialogTitle>Add Buy In for {table.players.find(p => p.id === selectedPlayerId)?.name}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Buy In Amount"
            type="number"
            fullWidth
            value={buyInAmount}
            onChange={(e) => setBuyInAmount(parseInt(e.target.value) || '')}
            InputProps={{ inputProps: { min: 1 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuyInDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => selectedPlayerId && handleBuyIn()} 
            variant="contained" 
            color="primary"
            disabled={!buyInAmount || buyInAmount <= 0}
          >
            Add Buy In
          </Button>
        </DialogActions>
      </Dialog>

      {/* Buy In History Dialog */}
      <Dialog 
        open={buyInHistoryDialogOpen} 
        onClose={() => setBuyInHistoryDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <GroupIcon sx={{ color: '#2196f3' }} />
          {selectedPlayer?.name}'s History
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              color: '#2196f3',
              mb: 1 
            }}>
              <AttachMoneyIcon />
              Buy Ins
            </Typography>
            <List>
              {selectedPlayer?.buyIns?.map((buyIn, index) => (
                <ListItem key={buyIn.id} sx={{
                  bgcolor: 'rgba(33, 150, 243, 0.1)',
                  borderRadius: 1,
                  mb: 1
                }}>
                  <ListItemText
                    primary={
                      <Typography sx={{ color: 'white' }}>
                        Buy In #{index + 1}: ${buyIn.amount}
                      </Typography>
                    }
                    secondary={
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {new Date(buyIn.timestamp).toLocaleString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              color: '#4caf50',
              mb: 1 
            }}>
              <AccountBalanceIcon />
              Cash Outs
            </Typography>
            <List>
              {selectedPlayer?.cashOuts?.map((cashOut, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={`Cash Out #${index + 1}: $${cashOut.amount || 0}`}
                    secondary={new Date(cashOut.timestamp).toLocaleString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                    sx={{ color: 'white' }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          <Box sx={{ 
            mt: 3, 
            p: 2, 
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 1
          }}>
            <Typography variant="h6" sx={{ color: '#ff9800', mb: 1 }}>
              Summary
            </Typography>
            <Typography sx={{ color: 'white' }}>
              Total Buy In: ${selectedPlayer?.totalBuyIn || 0}
            </Typography>
            <Typography sx={{ color: 'white' }}>
              Total Cash Out: ${selectedPlayer?.cashOuts?.reduce((sum, cashOut) => sum + (Number(cashOut.amount) || 0), 0) || 0}
            </Typography>
            <Typography sx={{ 
              color: 'white', 
              mt: 1,
              fontWeight: 'bold'
            }}>
              Current Balance: ${selectedPlayer ? calculatePlayerBalance(selectedPlayer) : 0}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <Button 
            onClick={() => setBuyInHistoryDialogOpen(false)}
            sx={{ 
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cash Out Dialog */}
      <Dialog open={cashOutDialogOpen} onClose={() => setCashOutDialogOpen(false)}>
        <DialogTitle>Cash Out for {table.players.find(p => p.id === selectedPlayerId)?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Current Chips: {table.players.find(p => p.id === selectedPlayerId)?.chips}
            </Typography>
            <TextField
              autoFocus
              margin="dense"
              label="Cash Out Amount"
              type="number"
              fullWidth
              value={cashOutAmount}
              onChange={(e) => setCashOutAmount(parseInt(e.target.value) || 0)}
              InputProps={{ 
                inputProps: { 
                  min: 0
                } 
              }}
              helperText="Enter the amount you want to cash out"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCashOutDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={confirmCashOut} 
            variant="contained" 
            color="primary"
            disabled={cashOutAmount < 0 || !selectedPlayerId}
          >
            Confirm Cash Out
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate Table Confirmation Dialog */}
      <Dialog open={deactivateDialogOpen} onClose={() => setDeactivateDialogOpen(false)}>
        <DialogTitle>Deactivate Table</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to deactivate this table? 
            This will prevent any new actions until the table is activated again.
          </Typography>
          {(() => {
            const validation = validateTableDeactivation();
            return (
              <>
                <Typography 
                  variant="body2" 
                  color={validation.allPlayersInactive ? "success.main" : "error.main"} 
                  sx={{ mb: 1 }}
                >
                  {validation.allPlayersInactive ? "✓" : "✗"} All players are inactive
                </Typography>
                <Typography 
                  variant="body2" 
                  color={validation.isBalanceMatching ? "success.main" : "error.main"}
                  sx={{ mb: 1 }}
                >
                  {validation.isBalanceMatching ? "✓" : "✗"} Table balance matches
                </Typography>
                {!validation.isBalanceMatching && (
                  <Box sx={{ mt: 2, pl: 2, borderLeft: 2, borderColor: validation.balance.difference > 0 ? 'success.main' : 'error.main' }}>
                    <Typography variant="body2" color={validation.balance.difference > 0 ? 'success.main' : 'error.main'} sx={{ mb: 1 }}>
                      Total Buy-ins: {validation.balance.totalBuyIns}
                    </Typography>
                    <Typography variant="body2" color={validation.balance.difference > 0 ? 'success.main' : 'error.main'} sx={{ mb: 1 }}>
                      Total Cash-outs (inactive) + Chips (active): {validation.balance.totalCashOutsAndChips}
                    </Typography>
                    <Typography variant="body2" color={validation.balance.difference > 0 ? 'success.main' : 'error.main'} fontWeight="bold">
                      {validation.balance.difference > 0 ? "Excess" : "Missing"} money: {Math.abs(validation.balance.difference)}
                    </Typography>
                  </Box>
                )}
              </>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeactivateConfirm} 
            variant="contained" 
            color="error"
            disabled={!validateTableDeactivation().allPlayersInactive || !validateTableDeactivation().isBalanceMatching}
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Remove Player Confirmation Dialog */}
      <Dialog open={removePlayerDialogOpen} onClose={() => setRemovePlayerDialogOpen(false)}>
        <DialogTitle>Remove Player</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to remove {playerToRemove ? table.players.find(p => p.id === playerToRemove)?.name : ''} from the table?
          </Typography>
          <Typography color="error" variant="body2">
            ⚠️ This action cannot be undone. All player history will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemovePlayerDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={confirmRemovePlayer}
            variant="contained" 
            color="error"
          >
            Remove Player
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog עריכת שולחן */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Table Info</DialogTitle>
        <DialogContent>
          <TextField
            label="Table Name"
            required
            value={editForm.name}
            onChange={handleEditInputChange('name')}
            error={!!editFormErrors.name}
            helperText={editFormErrors.name}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Small Blind"
            required
            type="number"
            value={editForm.smallBlind}
            onChange={handleEditInputChange('smallBlind')}
            error={!!editFormErrors.smallBlind}
            helperText={editFormErrors.smallBlind}
            fullWidth
            sx={{ mb: 2 }}
            InputProps={{ startAdornment: '$' }}
          />
          <TextField
            label="Big Blind"
            required
            type="number"
            value={editForm.bigBlind}
            onChange={handleEditInputChange('bigBlind')}
            error={!!editFormErrors.bigBlind}
            helperText={editFormErrors.bigBlind}
            fullWidth
            sx={{ mb: 2 }}
            InputProps={{ startAdornment: '$' }}
          />
          <TextField
            label="Location"
            value={editForm.location}
            onChange={handleEditInputChange('location')}
            fullWidth
            sx={{ mb: 2 }}
            placeholder="Optional"
          />
          <TextField
            label="Date"
            type="datetime-local"
            value={editForm.date.toISOString().slice(0, 16)}
            onChange={(e) => setEditForm(prev => ({ ...prev, date: new Date(e.target.value) }))}
            fullWidth
            sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TableDetail; 