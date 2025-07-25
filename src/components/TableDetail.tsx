import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePoker } from '../context/PokerContext';
import { useUser } from '../context/UserContext';
import { Player, BuyIn, CashOut, EditForm, EditFormErrors, Group } from '../types';
import { getPlayerDisplayName } from '../utils/apiInterceptor';
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
  Autocomplete,
  MenuItem,
  AppBar,
  Toolbar,
  TableCell
} from '@mui/material';
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete';
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
import PaymentIcon from '@mui/icons-material/Payment';

interface HistoryDialogProps {
  open: boolean;
  onClose: () => void;
  player: Player | null;
}

const HistoryDialog: React.FC<HistoryDialogProps> = ({ open, onClose, player }) => {
  const { user } = useUser();
  const canEdit = user?.role === 'admin' || user?.role === 'editor';
  const playerIsActive = player?.active === true;

  const handleDeleteClick = (buyInId: any) => {

  };

  if (!player) return null;

  const combinedHistory = [
    ...(player.buyIns?.map(item => ({ ...item, type: 'buy-in' })) || []),
    ...(player.cashOuts?.map(item => ({ ...item, type: 'cash-out' })) || []),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>History for {player.name}</DialogTitle>
      <DialogContent dividers>
        <List>
          {combinedHistory.map((item, index) => {
            if (item.type === 'buy-in') {
              return (
                <ListItem key={`buyin-${item.id}-${index}`} secondaryAction={
                  canEdit && playerIsActive && (
                    <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteClick(item.id)}>
                      <DeleteIcon />
                    </IconButton>
                  )
                }>
                  <ListItemText
                    primary={`Buy In #${index + 1}: $${item.amount}`}
                    secondary={new Date(item.timestamp).toLocaleString()}
                  />
                </ListItem>
              );
            }
            // Render cash-outs without delete icon for now
            return (
              <ListItem key={`cashout-${item.id}-${index}`}>
                <ListItemText
                  primary={`Cash Out: $${item.amount}`}
                  secondary={new Date(item.timestamp).toLocaleString()}
                />
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const TableDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pokerContext = usePoker();
  const { getTable, addPlayer, removePlayer, addBuyIn, cashOut, toggleTableStatus, reactivatePlayer, disableShowMe, updateTable, groups, tables: allTables, fetchTables, updatePlayerPayment, deleteBuyIn } = pokerContext;
  const { user } = useUser();
  
  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState<string | null>(null);
  const [newPlayerNickname, setNewPlayerNickname] = useState('');
  const [newPlayerChips, setNewPlayerChips] = useState<number | ''>('');
  const [showShareAlert, setShowShareAlert] = useState(false);
  
  // Buy In dialog
  const [buyInDialogOpen, setBuyInDialogOpen] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState<number | ''>(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Buy In history dialog
  const [buyInHistoryDialogOpen, setBuyInHistoryDialogOpen] = useState(false);
  const [selectedPlayerIdForHistory, setSelectedPlayerIdForHistory] = useState<string | null>(null);

  // Cash Out dialog
  const [cashOutDialogOpen, setCashOutDialogOpen] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState<string>('');

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
    gameDate: new Date(),
    food: '',
    groupId: '',
    minimumBuyIn: ''
  });
  const [editFormErrors, setEditFormErrors] = useState<EditFormErrors>({});

  // סטייטים ופונקציות מתאימות בראש הקומפוננטה:
  const [paymentDialogOpen, setPaymentDialogOpen] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');

  // Add new state for delete confirmation
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [buyInToDelete, setBuyInToDelete] = useState<{ id: number; amount: number; playerName: string } | null>(null);
  const [displayNames, setDisplayNames] = useState<{ [key: string]: string }>({});

  const table = id ? getTable(id) : null;

  // אתחול ערכי הטופס בכל פתיחה של הדיאלוג
  useEffect(() => {
    if (editDialogOpen && table) {
      setEditForm({
        name: table.name || '',
        smallBlind: table.smallBlind?.toString() || '',
        bigBlind: table.bigBlind?.toString() || '',
        location: table.location || '',
        gameDate: new Date(table.gameDate || table.createdAt),
        food: table.food || '',
        groupId: table.groupId || '',
        minimumBuyIn: table.minimumBuyIn?.toString() || ''
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
      // Get all player names from tables with the same groupId as the current table
      if (table && table.groupId && allTables) {
        const relevantTables = allTables.filter(t => t.groupId === table.groupId);
        const namesSet = new Set<string>();
        relevantTables.forEach(t => {
          t.players.forEach(p => {
            namesSet.add(p.name);
          });
        });
        // Exclude players already at the current table
        const currentTableNames = new Set(table.players.map(p => p.name));
        const filteredNames = Array.from(namesSet).filter(name => !currentTableNames.has(name));
        setUniquePlayerNames(filteredNames.sort((a, b) => a.localeCompare(b)));
      } else {
        setUniquePlayerNames([]);
      }
    } catch (error) {
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

  // Load display names for players
  useEffect(() => {
    const loadDisplayNames = async () => {
      if (!table || !table.groupId || !table.players.length) return;

      const namesToLoad: { [key: string]: string } = {};
      
      // Load display names for each player in the table
      for (const player of table.players) {
        if (!displayNames[player.name]) {
          try {
            const displayName = await getPlayerDisplayName(player.name, table.groupId, () => {});
            namesToLoad[player.name] = displayName;
          } catch (error) {
            // Fallback to player name
            namesToLoad[player.name] = player.name;
          }
        }
      }

      if (Object.keys(namesToLoad).length > 0) {
        setDisplayNames(prev => ({ ...prev, ...namesToLoad }));
      }
    };

    loadDisplayNames();
  }, [table, displayNames]);

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

  const handleOpenAddPlayerDialog = () => {
    setNewPlayerChips('');
    setOpenDialog(true);
  };

  const handleAddPlayer = async () => {
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
      try {
        await addPlayer(
          id,
          newPlayerName.trim(),
          newPlayerChips || 0,
          newPlayerNickname.trim()
        );
        setOpenDialog(false);
        setNewPlayerName(null);
        setNewPlayerNickname('');
        setNewPlayerChips('');
      } catch (error: any) {
        if (error.message?.includes('403') || error.message?.includes('permission')) {
          showTransientError('You do not have permission to perform this action');
        } else {
          showTransientError('Failed to add player');
        }
      }
    }
  };

  const handleBuyIn = async () => {
    if (selectedPlayerId && buyInAmount && buyInAmount > 0) {
      try {
        await addBuyIn(id, selectedPlayerId, Number(buyInAmount));
        setBuyInDialogOpen(false);
        setBuyInAmount(0);
      } catch (error: any) {
        if (error.message?.includes('403') || error.message?.includes('permission')) {
          showTransientError('You do not have permission to perform this action');
        } else {
          showTransientError('Failed to add buy-in');
        }
      }
    }
  };

  const handleCashOut = (playerId: string) => {
    setSelectedPlayerId(playerId);
    const player = table.players.find(p => p.id === playerId);
    if (player) {
      setCashOutAmount('');
      setCashOutDialogOpen(true);
    }
  };

  const confirmCashOut = async () => {
    if (selectedPlayerId) {
      const amount = cashOutAmount === '' ? 0 : Number(cashOutAmount);
      if (amount >= 0) {
        try {
          await cashOut(id, selectedPlayerId, amount);
          setCashOutDialogOpen(false);
          setCashOutAmount('');
        } catch (error: any) {
          if (error.message?.includes('403') || error.message?.includes('permission')) {
            showTransientError('You do not have permission to perform this action');
          } else {
            showTransientError('Failed to cash out');
          }
        }
      }
    }
  };

  const openBuyInDialog = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setBuyInAmount(table.minimumBuyIn || 0);
    setBuyInDialogOpen(true);
  };

  const openBuyInHistory = (playerId: string) => {
    setSelectedPlayerIdForHistory(playerId);
    setBuyInHistoryDialogOpen(true);
  };

  const selectedPlayerForHistory = selectedPlayerIdForHistory
    ? table?.players.find(p => p.id === selectedPlayerIdForHistory) ?? null
    : null;

  const calculatePlayerBalance = (player: Player | null): number => {
    if (!player) return 0;
    const totalBuyIn = player.totalBuyIn ?? 0;
    const totalCashOut = Array.isArray(player.cashOuts)
      ? player.cashOuts.reduce((sum, cashOut) => sum + (cashOut.amount ?? 0), 0)
      : 0;
    return totalCashOut - totalBuyIn;
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
  const handleTableStatusChange = async () => {
    if (table.isActive) {
      setDeactivateDialogOpen(true);
    } else {
      try {
        await toggleTableStatus(id, table.creatorId);
      } catch (error: any) {
        if (error.message?.includes('403') || error.message?.includes('permission')) {
          showTransientError('You do not have permission to perform this action');
        } else {
          showTransientError('Failed to change table status');
        }
      }
    }
  };

  const handleDeactivateConfirm = async () => {
    const validation = validateTableDeactivation();
    if (!validation.allPlayersInactive || !validation.isBalanceMatching) {
      return; // Don't allow deactivation if validations fail
    }
    try {
      await toggleTableStatus(id, table.creatorId);
      setDeactivateDialogOpen(false);
    } catch (error: any) {
      if (error.message?.includes('403') || error.message?.includes('permission')) {
        showTransientError('You do not have permission to perform this action');
      } else {
        showTransientError('Failed to deactivate table');
      }
    }
  };

  // Add handler for remove player
  const handleRemovePlayer = (playerId: string) => {
    setPlayerToRemove(playerId);
    setRemovePlayerDialogOpen(true);
  };

  const confirmRemovePlayer = async () => {
    if (playerToRemove) {
      try {
        await removePlayer(id, playerToRemove);
        setRemovePlayerDialogOpen(false);
        setPlayerToRemove(null);
      } catch (error: any) {
        if (error.message?.includes('403') || error.message?.includes('permission')) {
          showTransientError('You do not have permission to perform this action');
        } else {
          showTransientError('Failed to remove player');
        }
      }
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
  const validateEditForm = (): boolean => {
    const errors: EditFormErrors = {};
    
    if (!editForm.name.trim()) {
      errors.name = 'Table name is required';
    }
    
    const smallBlind = Number(editForm.smallBlind);
    if (!editForm.smallBlind || isNaN(smallBlind) || smallBlind <= 0) {
      errors.smallBlind = 'Small blind must be a positive number';
    }
    
    const bigBlind = Number(editForm.bigBlind);
    if (!editForm.bigBlind || isNaN(bigBlind) || bigBlind <= 0) {
      errors.bigBlind = 'Big blind must be a positive number';
    } else if (bigBlind < smallBlind) {
      errors.bigBlind = 'Big blind must be at least equal to small blind';
    }

    if (editForm.food && !table?.players.find(p => p.id === editForm.food)) {
      errors.food = 'Selected player is not in the table';
    }
    
    if (!editForm.minimumBuyIn || isNaN(Number(editForm.minimumBuyIn)) || Number(editForm.minimumBuyIn) <= 0) {
      errors.minimumBuyIn = 'Minimum buy-in is required and must be greater than 0';
    } else if (Number(editForm.minimumBuyIn) < Number(editForm.bigBlind) * 2) {
      errors.minimumBuyIn = 'Minimum buy-in must be at least 2x big blind';
    }
    
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // שמירה (TODO: לממש עדכון לשרת)
  const handleEditSubmit = () => {
    if (!validateEditForm()) {
      return;
    }

    // Check if user is trying to change groups
    if (table && editForm.groupId !== table.groupId) {
      const currentGroup = groups.find(g => g.id === table.groupId);
      const targetGroup = groups.find(g => g.id === editForm.groupId);
      
      // Check if user is owner of both groups (unless admin)
      if (user?.role !== 'admin') {
        const isOwnerOfCurrentGroup = currentGroup?.userRole === 'owner';
        const isOwnerOfTargetGroup = targetGroup?.userRole === 'owner';
        
        if (!isOwnerOfCurrentGroup || !isOwnerOfTargetGroup) {
          setEditFormErrors(prev => ({
            ...prev,
            groupId: 'You can only change groups if you are the owner of both the current and target groups'
          }));
          return;
        }
      }
    }

    const updatedTable = {
      name: editForm.name,
      smallBlind: Number(editForm.smallBlind),
      bigBlind: Number(editForm.bigBlind),
      location: editForm.location,
      food: editForm.food,
      groupId: editForm.groupId,
      minimumBuyIn: Number(editForm.minimumBuyIn),
      gameDate: editForm.gameDate
    };

    updateTable(id, updatedTable)
      .then(() => {
        setEditDialogOpen(false);
        fetchTables();
      })
      .catch(error => {
        console.error('Failed to update table:', error);
      });
  };

  const showTransientError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(null), 3000);
  };

  const sortedPlayers = [...(table?.players || [])].sort((a, b) => a.name.localeCompare(b.name));

  // --- Food Order Turn Logic ---
  // Minimum games to be considered for food order turn
  const MIN_GAMES_FOR_FOOD = 3;

  // Use allTables from context (already destructured above)
  // Only consider tables that are not active and belong to the same group as the current table
  const relevantTables = allTables.filter(t => !t.isActive && t.groupId === table.groupId);

  // Debug logs
  console.log('Relevant tables:', relevantTables);
  console.log('All food values in relevant tables:', relevantTables.map(t => t.food));
  if (relevantTables.length > 0) {
    console.log('Sample relevant table:', relevantTables[0]);
  }
  if (table && table.players) {
    console.log('Current table player ids:', table.players.map(p => p.id));
    console.log('Current table player names:', table.players.map(p => p.name));
  }

  // Build a mapping from food id to player name for all relevant tables
  const foodIdToName: Record<string, string> = {};
  relevantTables.forEach(t => {
    if (t.food && Array.isArray(t.players)) {
      const foodPlayer = t.players.find(p => p.id === t.food);
      if (foodPlayer) {
        foodIdToName[t.food] = foodPlayer.name;
      }
    }
  });
  console.log('Food id to name mapping:', foodIdToName);

  const playerFoodStats = (table?.players || []).map(player => {
    // Count participations (games played)
    const participations = relevantTables.filter(t => t.players.some(p => p.id === player.id || p.name === player.name)).length;
    // Count food orders: t.food is id, match to player.name
    const foodOrders = relevantTables.filter(t => t.food !== undefined && foodIdToName[t.food] === player.name).length;
    // Find last time ordered food (timestamp or null)
    const lastOrderTable = relevantTables
      .filter(t => t.food !== undefined && foodIdToName[t.food] === player.name)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const lastOrderTime = lastOrderTable ? new Date(lastOrderTable.createdAt).getTime() : null;
    const foodOrderPercent = participations > 0 ? foodOrders / participations : 0;
    const isEligible = participations >= MIN_GAMES_FOR_FOOD;
    // Detailed log for this player
    console.log(`Player: ${player.name}, Participations: ${participations}, Food Orders: ${foodOrders}, Percent: ${(foodOrderPercent*100).toFixed(1)}%, Last Order: ${lastOrderTime ? new Date(lastOrderTime).toLocaleString('he-IL') : 'Never'}, Eligible: ${isEligible}`);
    return {
      ...player,
      participations,
      foodOrders,
      foodOrderPercent,
      lastOrderTime,
      isEligible
    };
  });

  console.log('Player food stats:', playerFoodStats);

  // Split eligible and new players
  const eligiblePlayers = playerFoodStats.filter(p => p.isEligible);
  const newPlayers = playerFoodStats.filter(p => !p.isEligible);

  console.log('Eligible players:', eligiblePlayers);
  console.log('New players:', newPlayers);

  // Sort eligible by: lowest percent, then oldest last order
  eligiblePlayers.sort((a, b) => {
    if (a.foodOrderPercent !== b.foodOrderPercent) {
      return a.foodOrderPercent - b.foodOrderPercent;
    }
    // If percent equal, pick the one who ordered least recently
    if (a.lastOrderTime !== b.lastOrderTime) {
      if (a.lastOrderTime === null) return -1;
      if (b.lastOrderTime === null) return 1;
      return a.lastOrderTime - b.lastOrderTime;
    }
    return a.name.localeCompare(b.name);
  });
  // Sort new players alphabetically
  newPlayers.sort((a, b) => a.name.localeCompare(b.name));

  // Merge for dropdown: eligible first, then new
  const foodDropdownPlayers = [...eligiblePlayers, ...newPlayers];

  // Color logic for top 3 eligible
  const getFoodCandidateColor = (idx: number, isEligible: boolean) => {
    if (!isEligible) return undefined;
    if (idx === 0) return '#e53935'; // red
    if (idx === 1) return '#fb8c00'; // orange
    if (idx === 2) return '#fdd835'; // yellow
    return undefined;
  };

  const handleOpenPaymentDialog = (playerId: string) => {
    const player = table.players.find(p => p.id === playerId);
    if (player) {
      setPaymentMethod(player.payment_method || '');
      setComment(player.payment_comment || '');
    }
    setPaymentDialogOpen(playerId);
  };
  const handleClosePaymentDialog = () => {
    setPaymentDialogOpen(null);
    setPaymentMethod('');
    setComment('');
    setCommentError('');
  };
  const handleSavePayment = async () => {
    if (comment.length > 100) {
      setCommentError('Comment cannot exceed 100 characters');
      return;
    }
    
    if (paymentDialogOpen && id) {
      try {
        await updatePlayerPayment(id, paymentDialogOpen, paymentMethod, comment);
      } catch (error: any) {
        showTransientError(error.message || 'Failed to save payment method');
      } finally {
        handleClosePaymentDialog();
      }
    }
  };

  const handleOpenHistoryDialog = (player: Player) => {
    setSelectedPlayerIdForHistory(player.id);
    setBuyInHistoryDialogOpen(true);
  };

  const handleCloseHistoryDialog = () => {
    setBuyInHistoryDialogOpen(false);
    setSelectedPlayerIdForHistory(null);
  };

  const handleDeleteBuyIn = (buyIn: any, playerName: string) => {
    setBuyInToDelete({ id: buyIn.id, amount: buyIn.amount, playerName });
    setDeleteConfirmationOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (buyInToDelete && selectedPlayerForHistory) {
      try {
        await deleteBuyIn(table?.id || '', buyInToDelete.id.toString());
        // Close the confirmation dialog
        setDeleteConfirmationOpen(false);
        setBuyInToDelete(null);
        // Close the history dialog as well
        setBuyInHistoryDialogOpen(false);
        setSelectedPlayerIdForHistory(null);
      } catch (error) {
        console.error('Error deleting buy-in:', error);
        // Keep the dialogs open if there was an error
      }
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmationOpen(false);
    setBuyInToDelete(null);
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
          <IconButton size="small" onClick={() => setEditDialogOpen(true)}>
            <EditIcon />
          </IconButton>
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
                {table.isActive ? 'Close Table' : 'Reopen Table'}
              </Button>
            </Box>
            {table.food && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Food: {table.players.find(p => p.id === table.food)?.name || 'Unknown'}
              </Typography>
            )}
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
          onClick={handleOpenAddPlayerDialog}
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
                      {displayNames[player.name] || player.name}
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
                          disabled={!table.isActive}
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

                  <Typography variant="body2">Total Buy In: {player.totalBuyIn ?? 0}</Typography>

                  <Button 
                    size="small"
                    onClick={() => handleOpenHistoryDialog(player)}
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
                    {/* כפתור אמצעי תשלום - רק לשחקן לא אקטיבי עם CASHOUT */}
                    {!player.active && player.cashOuts && player.cashOuts.length > 0 && (
                      <Grid item xs={12} sx={{ mt: 1 }}>
                        <Button
                          variant="outlined"
                          fullWidth
                          color="secondary"
                          startIcon={<PaymentIcon />}
                          onClick={() => handleOpenPaymentDialog(player.id)}
                        >
                          Payment Method
                        </Button>
                      </Grid>
                    )}
                  </Grid>
                  <PaymentDialog
                    open={paymentDialogOpen === player.id}
                    onClose={handleClosePaymentDialog}
                    onSave={handleSavePayment}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    comment={comment}
                    setComment={setComment}
                    commentError={commentError}
                    setCommentError={setCommentError}
                  />
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
            label="Initial Chips (Optional)"
            type="number"
            fullWidth
            value={newPlayerChips}
            onChange={(e) => setNewPlayerChips(e.target.value === '' ? '' : Number(e.target.value) || 0)}
            InputLabelProps={{ sx: { color: 'grey.400' } }}
            InputProps={{
              sx: { color: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.700' } },
              inputProps: { min: 0 }
            }}
            helperText="Leave empty to add player without buy-in"
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.12)', p: '16px' }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ color: 'grey.400' }}>Cancel</Button>
          <Button onClick={handleAddPlayer} variant="contained" disabled={!isFormValid()}>Add Player</Button>
        </DialogActions>
      </Dialog>

      {/* Buy In Dialog */}
      <Dialog open={buyInDialogOpen} onClose={() => setBuyInDialogOpen(false)}>
        <DialogTitle>Add Buy In for {(() => {
          const player = table.players.find(p => p.id === selectedPlayerId);
          return player ? (displayNames[player.name] || player.name) : '';
        })()}</DialogTitle>
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
        onClose={handleCloseHistoryDialog} 
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
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)'}}>
          History for {selectedPlayerForHistory ? (displayNames[selectedPlayerForHistory.name] || selectedPlayerForHistory.name) : ''}
        </DialogTitle>
        <DialogContent>
          {selectedPlayerForHistory ? (
            <>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#2196f3', mb: 1 }}>
                <AttachMoneyIcon />
                Buy Ins
              </Typography>
              <List>
                {selectedPlayerForHistory.buyIns.map((buyIn, index) => (
                  <ListItem
                    key={`buyin-${buyIn.id}`}
                    secondaryAction={
                      user && (user.role === 'admin' || user.role === 'editor') && selectedPlayerForHistory.active
                      ? (
                        <IconButton 
                          edge="end" 
                          aria-label="delete" 
                          onClick={() => handleDeleteBuyIn(buyIn, selectedPlayerForHistory.name)}
                        >
                          <DeleteIcon sx={{ color: '#d32f2f' }}/>
                        </IconButton>
                      )
                      : null
                    }
                    sx={{ bgcolor: 'rgba(33, 150, 243, 0.1)', borderRadius: 1, mb: 1 }}
                  >
                    <ListItemText 
                      primary={<Typography sx={{ color: 'white' }}>{`Buy In #${index + 1}: $${buyIn.amount}`}</Typography>}
                      secondary={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{new Date(buyIn.timestamp).toLocaleString()}</Typography>}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#4caf50', mb: 1 }}>
                <AccountBalanceIcon />
                Cash Outs
              </Typography>
              <List>
                {selectedPlayerForHistory.cashOuts.map((cashOut, index) => (
                  <ListItem key={`cashout-${cashOut.id}`} sx={{ bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1, mb: 1 }}>
                    <ListItemText 
                      primary={<Typography sx={{ color: 'white' }}>{`Cash Out #${index + 1}: $${cashOut.amount}`}</Typography>}
                      secondary={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{new Date(cashOut.timestamp).toLocaleString()}</Typography>}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
            
            <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(255, 255, 255, 0.05)', borderRadius: 1 }}>
              <Typography variant="h6" sx={{ color: '#ff9800', mb: 1 }}>Summary</Typography>
              <Typography sx={{ color: 'white' }}>Total Buy In: ${selectedPlayerForHistory.totalBuyIn || 0}</Typography>
              <Typography sx={{ color: 'white' }}>Total Cash Out: ${selectedPlayerForHistory.cashOuts.reduce((sum, co) => sum + (co.amount || 0), 0)}</Typography>
              {selectedPlayerForHistory.cashOuts && selectedPlayerForHistory.cashOuts.length > 0 && (
                <Typography sx={{ color: 'white', mt: 1, fontWeight: 'bold' }}>Current Balance: ${calculatePlayerBalance(selectedPlayerForHistory)}</Typography>
              )}
            </Box>
            </>
          ) : (
            <Typography>No player selected.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <Button onClick={handleCloseHistoryDialog} sx={{ color: 'white' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Cash Out Dialog */}
      <Dialog open={cashOutDialogOpen} onClose={() => setCashOutDialogOpen(false)}>
        <DialogTitle>Cash Out for {(() => {
          const player = table.players.find(p => p.id === selectedPlayerId);
          return player ? (displayNames[player.name] || player.name) : '';
        })()}</DialogTitle>
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
              onChange={(e) => setCashOutAmount(e.target.value)}
              InputProps={{ 
                inputProps: { 
                  min: 0
                } 
              }}
              helperText="Enter the amount you want to cash out (leave empty for 0)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCashOutDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={confirmCashOut} 
            variant="contained" 
            color="primary"
            disabled={!selectedPlayerId}
          >
            Confirm Cash Out
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate Table Confirmation Dialog */}
      <Dialog open={deactivateDialogOpen} onClose={() => setDeactivateDialogOpen(false)}>
        <DialogTitle>Close Table</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to close this table? 
            This will prevent any new actions until the table is reopened.
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
              Close Table
            </Button>
        </DialogActions>
      </Dialog>

      {/* Add Remove Player Confirmation Dialog */}
      <Dialog open={removePlayerDialogOpen} onClose={() => setRemovePlayerDialogOpen(false)}>
        <DialogTitle>Remove Player</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to remove {(() => {
              const player = playerToRemove ? table.players.find(p => p.id === playerToRemove) : null;
              return player ? (displayNames[player.name] || player.name) : '';
            })()} from the table?
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
            label="Minimum Buy-In"
            required
            type="number"
            value={editForm.minimumBuyIn}
            onChange={handleEditInputChange('minimumBuyIn')}
            error={!!editFormErrors.minimumBuyIn}
            helperText={editFormErrors.minimumBuyIn}
            fullWidth
            sx={{ mb: 2 }}
            InputProps={{ startAdornment: '$' }}
          />
          <GooglePlacesAutocomplete
            label="Location"
            value={editForm.location}
            onChange={(value) => {
              setEditForm(prev => ({ ...prev, location: value }));
            }}
            placeholder="Start typing to search for a location..."
            sx={{ mb: 2 }}
          />
          <TextField
            select
            label="Group"
            required
            value={editForm.groupId}
            onChange={handleEditInputChange('groupId')}
            error={!!editFormErrors.groupId}
            helperText={editFormErrors.groupId || (table && editForm.groupId !== table.groupId ? 'You can only change groups if you are the owner of both the current and target groups' : '')}
            fullWidth
            sx={{ mb: 2 }}
            disabled={!user || (user.role !== 'admin' && user.role !== 'editor')}
          >
            {groups.map((group) => {
              // Check if user can select this group
              const isCurrentGroup = table?.groupId === group.id;
              const isOwnerOfCurrentGroup = table?.groupId === group.id && group.userRole === 'owner';
              const isOwnerOfTargetGroup = group.userRole === 'owner';
              const canSelect = isCurrentGroup || (isOwnerOfCurrentGroup && isOwnerOfTargetGroup) || user?.role === 'admin';
              
              return (
                <MenuItem 
                  key={group.id} 
                  value={group.id}
                  disabled={!canSelect}
                  sx={{ 
                    opacity: canSelect ? 1 : 0.5,
                    color: canSelect ? 'inherit' : 'grey'
                  }}
                >
                  {group.name} {!canSelect && '(Owner access required)'}
                </MenuItem>
              );
            })}
          </TextField>
          <Autocomplete
            options={foodDropdownPlayers}
            getOptionLabel={(option) => option.name}
            value={foodDropdownPlayers.find(p => p.id === editForm.food) || null}
            onChange={(_, newValue) => {
              setEditForm(prev => ({
                ...prev,
                food: newValue?.id || ''
              }));
            }}
            renderOption={(props, option, { index }) => (
              <li {...props} key={option.id}>
                <span style={{
                  color: getFoodCandidateColor(index, option.isEligible),
                  fontWeight: getFoodCandidateColor(index, option.isEligible) ? 700 : 400
                }}>
                  {option.name}
                </span>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Food"
                fullWidth
                sx={{ mb: 2 }}
                placeholder="Select player responsible for food"
              />
            )}
          />
          <TextField
            label="Game Date"
            type="datetime-local"
            value={editForm.gameDate.toISOString().slice(0, 16)}
            onChange={(e) => setEditForm(prev => ({ ...prev, gameDate: new Date(e.target.value) }))}
            fullWidth
            sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSubmit} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmationOpen}
        onClose={handleCancelDelete}
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
          Confirm Deletion
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'white', mt: 1 }}>
            Are you sure you want to delete this buy-in of ${buyInToDelete?.amount} for player "{buyInToDelete?.playerName}"?
          </Typography>
          <Typography sx={{ color: '#ff6b6b', mt: 2, fontWeight: 'bold' }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <Button onClick={handleCancelDelete} sx={{ color: 'white' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            sx={{ 
              color: 'white', 
              bgcolor: '#d32f2f',
              '&:hover': {
                bgcolor: '#b71c1c'
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

function PaymentDialog({ open, onClose, onSave, paymentMethod, setPaymentMethod, comment, setComment, commentError, setCommentError }: any) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Select Payment Method</DialogTitle>
      <DialogContent>
        <TextField
          select
          label="Payment Method"
          value={paymentMethod}
          onChange={e => setPaymentMethod(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        >
          <MenuItem value="Paybox">Paybox</MenuItem>
          <MenuItem value="Bit">Bit</MenuItem>
          <MenuItem value="Cash">Cash</MenuItem>
          <MenuItem value="Other">Other</MenuItem>
        </TextField>
        <TextField
          label="Comment"
          value={comment}
          onChange={e => {
            setComment(e.target.value);
            if (e.target.value.length > 100) {
              setCommentError('Comment cannot exceed 100 characters');
            } else {
              setCommentError('');
            }
          }}
          fullWidth
          multiline
          rows={2}
          inputProps={{ maxLength: 100 }}
          helperText={commentError || `${comment.length}/100`}
          error={!!commentError}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={!paymentMethod || !!commentError} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TableDetail; 