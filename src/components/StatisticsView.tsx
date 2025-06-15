import React, { useMemo, useState, useEffect, useRef } from 'react';
import { usePoker } from '../context/PokerContext';
import { Table, PlayerStats, AggregatedPlayerStats } from '../types';
import { useUser } from '../context/UserContext';
import {
  Box,
  Typography,
  Paper,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  AppBar,
  Toolbar,
  IconButton,
  Grid,
  Card,
  CardContent,
  TextField,
  TableSortLabel,
  TablePagination,
  Autocomplete,
  useTheme,
  useMediaQuery,
  Checkbox,
  FormControlLabel,
  Switch,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Button,
  MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import PlayerStatsDialog from './PlayerStatsDialog';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PetsIcon from '@mui/icons-material/Pets';
import styles from './StatisticsView.module.css';

// Add Group interface
interface Group {
  id: string;
  name: string;
}

// Helper type for sorting
type Order = 'asc' | 'desc';

// Helper function for stable sorting
function stableSort<T>(array: readonly T[], comparator: (a: T, b: T) => number): T[] {
  const stabilizedThis = array.map((el, index) => [el, index] as [T, number]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

// Helper function to get comparator
function getComparator<Key extends keyof PlayerStats>(
  order: Order,
  orderBy: Key,
): (a: PlayerStats, b: PlayerStats) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

function descendingComparator<T extends PlayerStats>(a: T, b: T, orderBy: keyof T) {
  // Handle potential undefined for nickname specifically
  let valA = a[orderBy];
  let valB = b[orderBy];

  if (orderBy === 'nickname') {
      // Assert as string after handling undefined
      valA = (valA === undefined ? '' : valA) as T[keyof T];
      valB = (valB === undefined ? '' : valB) as T[keyof T];
  }

  // Ensure consistent comparison for other types
  if (valB < valA) {
    return -1;
  }
  if (valB > valA) {
    return 1;
  }
  return 0;
}

// Custom Hook for Animated Counter
const useAnimatedCounter = (targetValue: number, duration: number = 1000) => {
  const [count, setCount] = useState(0);
  const startValueRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startValueRef.current = count; // Start animation from current count
    startTimeRef.current = null; // Reset start time

    const step = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsedTime = timestamp - startTimeRef.current;
      const progress = Math.min(elapsedTime / duration, 1);
      
      const currentAnimatedValue = Math.floor(
        startValueRef.current + (targetValue - startValueRef.current) * progress
      );
      
      setCount(currentAnimatedValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        setCount(targetValue); // Ensure final value is exact
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetValue, duration]);

  return count;
};

// Update the formatStat and formatResult helpers to round values away from zero and show no decimal point
const formatStat = (value: number | undefined): string => {
  if (value === undefined || value === null) return '-';
  if (value >= 0) return Math.ceil(value).toString();
  return Math.floor(value).toString();
};

const formatResult = (value: number | undefined): string => {
  if (value === undefined || value === null) return '-';
  const rounded = value >= 0 ? Math.ceil(value) : Math.floor(value);
  return value > 0 ? `+${rounded}` : rounded.toString();
};

// Add visuallyHidden style
const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  top: 20,
  width: '1px',
};

// Add HeadCell interface
interface HeadCell {
  id: keyof PlayerStats;
  numeric: boolean;
  disablePadding: boolean;
  label: string;
  width: string;
}

// Add helper to calculate potential games for each player
const getPlayerPotentialGames = (playerName: string, tables: Table[]): number => {
  // Get all tables sorted by date
  const sortedTables = [...tables].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  // Find indexes of first and last appearance
  let firstIdx = -1;
  let lastIdx = -1;
  sortedTables.forEach((table, idx) => {
    if (table.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      if (firstIdx === -1) firstIdx = idx;
      lastIdx = idx;
    }
  });
  if (firstIdx === -1 || lastIdx === -1) return 0;
  return lastIdx - firstIdx + 1;
};

// Helper to get ordinal suffix
function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

interface EnhancedTableToolbarProps {
  numSelected: number;
  onFilterChange: (filter: string) => void;
  onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  rowCount: number;
  selectedPlayers: string[];
  onPlayerSelect: (players: string[]) => void;
  allPlayers: string[];
}

function EnhancedTableToolbar(props: EnhancedTableToolbarProps) {
  const {
    numSelected,
    onFilterChange,
    onSelectAllClick,
    rowCount,
    selectedPlayers,
    onPlayerSelect,
    allPlayers,
  } = props;

  return (
    <Toolbar
      sx={{
        pl: { sm: 2 },
        pr: { xs: 1, sm: 1 },
        ...(numSelected > 0 && {
          bgcolor: (theme) =>
            alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
        }),
      }}
    >
      {numSelected > 0 ? (
        <Typography
          sx={{ flex: '1 1 100%' }}
          color="inherit"
          variant="subtitle1"
          component="div"
        >
          {numSelected} selected
        </Typography>
      ) : (
        <Typography
          sx={{ flex: '1 1 100%' }}
          variant="h6"
          id="tableTitle"
          component="div"
        >
          Statistics
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Autocomplete
          multiple
          id="player-filter"
          options={allPlayers}
          value={selectedPlayers}
          onChange={(event, newValue) => {
            onPlayerSelect(newValue);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              label="Select Players"
              size="small"
              sx={{ minWidth: 200 }}
            />
          )}
          size="small"
          sx={{ minWidth: 200 }}
        />
        <FormControlLabel
          control={
            <Checkbox
              onChange={onSelectAllClick}
              checked={rowCount > 0 && numSelected === rowCount}
              indeterminate={numSelected > 0 && numSelected < rowCount}
            />
          }
          label="Select All"
        />
      </Box>
    </Toolbar>
  );
}

// Helper to render ordinal with gold for 1st
function renderOrdinal(ordinal: string) {
  if (ordinal === '1st') {
    return <span style={{ fontSize: '0.8em', color: '#FFD700', marginLeft: 4, fontWeight: 700 }}>1st</span>;
  }
  return <span style={{ fontSize: '0.8em', color: '#aaa', marginLeft: 4 }}>{ordinal}</span>;
}

const StatisticsView: React.FC = () => {
  const { tables: contextTables, isLoading: contextLoading, error: contextError, fetchTables } = usePoker();
  const { user } = useUser();
  const navigate = useNavigate();
  const [minGamesFilter, setMinGamesFilter] = useState<string>('0');
  const [staticTables, setStaticTables] = useState<Table[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order>('desc');
  const [orderBy, setOrderBy] = useState<keyof PlayerStats>('netResult');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchQuery, setSearchQuery] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Add state to track single game win/loss
  const [singleGameStats, setSingleGameStats] = useState<{ 
    maxWin: number; maxWinPlayer: string; 
    minLoss: number; minLossPlayer: string; 
  }>({ maxWin: 0, maxWinPlayer: '-', minLoss: 0, minLossPlayer: '-' });

  // Re-add state for Dialog
  const [selectedPlayerStats, setSelectedPlayerStats] = useState<PlayerStats | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Add state for top players by net result
  const [topPlayersByNetResult, setTopPlayersByNetResult] = useState<PlayerStats[]>([]);

  // Add state for bottom players by net result
  const [bottomPlayersByNetResult, setBottomPlayersByNetResult] = useState<PlayerStats[]>([]);

  // Calculate the total number of inactive tables for the Games column
  const inactiveTablesCount = staticTables.length;

  // Calculate extra stats for new cards
  const [extraStats, setExtraStats] = useState({
    biggestSingleBuyIn: { value: 0, player: '-' },
    biggestAvgBuyIn: { value: 0, player: '-' },
    bestAvgResult: { value: 0, player: '-' },
  });

  // Add new state for Best Current Streak and Food Order King
  const [bestCurrentStreak, setBestCurrentStreak] = useState<{ value: number, players: string[] }>({ value: 0, players: [] });
  const [foodOrderKing, setFoodOrderKing] = useState<{ player: string, count: number, history: Array<{ date: string, player: string, tableCreatedAt?: string }> }>({ 
    player: '-', 
    count: 0,
    history: []
  });

  // Define which columns are negative (lowest is best)
  const negativeColumns = ['largestLoss']; // Add more if needed

  // Add state for best winning streak
  const [bestWinStreak, setBestWinStreak] = useState<{ value: number; player: string }>({ value: 0, player: '-' });

  // Add state for new dialogs
  const [isStreakDialogOpen, setIsStreakDialogOpen] = useState(false);
  const [isFoodKingDialogOpen, setIsFoodKingDialogOpen] = useState(false);

  // Add state for craziest table
  const [craziestTable, setCraziestTable] = useState<{
    table: Table | null;
    avgBuyIn: number;
  }>({ table: null, avgBuyIn: 0 });

  // Add state for craziest table dialog
  const [isCraziestTableDialogOpen, setIsCraziestTableDialogOpen] = useState(false);

  // Add state for calmest table
  const [calmestTable, setCalmestTable] = useState<{
    table: Table | null;
    avgBuyIn: number;
  }>({ table: null, avgBuyIn: 0 });
  const [isCalmestTableDialogOpen, setIsCalmestTableDialogOpen] = useState(false);

  // Add state for Most Games Played dialog
  const [isMostGamesPlayedDialogOpen, setIsMostGamesPlayedDialogOpen] = useState(false);

  // Add state for Biggest Single Game Win dialog
  const [isBiggestSingleGameWinDialogOpen, setIsBiggestSingleGameWinDialogOpen] = useState(false);

  // Add state for Best Winning Streak dialog
  const [isBestWinningStreakDialogOpen, setIsBestWinningStreakDialogOpen] = useState(false);

  // Add state for Biggest Single Game Buy-In dialog
  const [isBiggestSingleGameBuyInDialogOpen, setIsBiggestSingleGameBuyInDialogOpen] = useState(false);

  // Add state for Biggest Avg Buy-In dialog
  const [isBiggestAvgBuyInDialogOpen, setIsBiggestAvgBuyInDialogOpen] = useState(false);

  // Add state for Best Avg Result dialog
  const [isBestAvgResultDialogOpen, setIsBestAvgResultDialogOpen] = useState(false);

  // Add state for Best Current Streak dialog
  const [isBestCurrentStreakDialogOpen, setIsBestCurrentStreakDialogOpen] = useState(false);

  // Fetch groups on component mount
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/groups`);
        if (!response.ok) throw new Error('Failed to fetch groups');
        const data = await response.json();
        setGroups(data);
        // Set first group as default if available and no group is selected
        if (data.length > 0 && !selectedGroupId) {
          setSelectedGroupId(data[0].id);
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
      }
    };

    fetchGroups();
  }, [selectedGroupId]);

  // Filter tables by selected group
  const filteredTables = useMemo(() => {
    if (!selectedGroupId) return staticTables.filter(table => !table.isActive);
    return staticTables.filter(table => table.groupId === selectedGroupId && !table.isActive);
  }, [staticTables, selectedGroupId]);

  // Get selected group name
  const selectedGroupName = useMemo(() => {
    const group = groups.find(g => g.id === selectedGroupId);
    return group ? group.name : 'All Groups';
  }, [groups, selectedGroupId]);

  // Function to handle sort request
  const handleRequestSort = (event: React.MouseEvent<unknown>, property: keyof PlayerStats) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Function to handle row click
  const handlePlayerRowClick = (playerStat: PlayerStats) => {
    setSelectedPlayerStats(playerStat);
    setIsDetailDialogOpen(true);
  };

  // Function to close dialog
  const handleCloseDetailDialog = () => {
    setIsDetailDialogOpen(false);
    setSelectedPlayerStats(null); // Clear selection on close
  };

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  useEffect(() => {
    setStaticTables(contextTables);
  }, [contextTables]);

  // Calculate player stats
  const playerStats = useMemo(() => {
    const statsMap: { [key: string]: AggregatedPlayerStats & { potentialGames?: number } } = {};
    // Variables to track overall single game max/min and their first occurrence
    let overallMaxWin = 0;
    let overallMaxWinPlayer = '-';
    let overallMaxWinTableIdx = -1;
    let overallMinLoss = 0;
    let overallMinLossPlayer = '-';
    let overallMinLossTableIdx = -1;

    // Sort tables by creation date ascending to process in order
    const sortedTables = [...filteredTables]
      .sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

    sortedTables.forEach((table, tableIdx) => {
      const tableTimestampMs = new Date(table.createdAt).getTime();
      if (table.isActive) return;
      table.players.forEach(player => {
        const playerIdentifier = player.name.toLowerCase();
        if (!statsMap[playerIdentifier]) {
          statsMap[playerIdentifier] = {
            id: player.id,
            name: player.name,
            nickname: player.nickname,
            totalBuyIn: 0,
            totalCashOut: 0,
            netResult: 0,
            tablesPlayed: 0,
            avgBuyIn: 0,
            avgNetResult: 0,
            largestWin: 0,
            largestLoss: 0,
            gamesWon: 0,
            gamesLost: 0,
            latestTableTimestamp: tableTimestampMs
          };
        } else {
          const currentStats = statsMap[playerIdentifier];
          if (tableTimestampMs >= (currentStats.latestTableTimestamp || 0)) {
            currentStats.nickname = player.nickname;
            currentStats.latestTableTimestamp = tableTimestampMs;
          }
        }
        const tableBuyIn = player.totalBuyIn || 0;
        const tableCashOutTotal = player.cashOuts?.reduce((sum, co) => sum + (Number(co.amount) || 0), 0) || 0;
        const tableCurrentChips = player.active ? (player.chips || 0) : 0;
        const tableTotalValue = tableCashOutTotal + tableCurrentChips;
        const tableNetResult = tableTotalValue - tableBuyIn;
        const currentStats = statsMap[playerIdentifier];
        currentStats.totalBuyIn += tableBuyIn;
        currentStats.totalCashOut += tableTotalValue;
        currentStats.tablesPlayed += 1;
        if (tableNetResult > currentStats.largestWin) {
          currentStats.largestWin = tableNetResult;
        }
        if (tableNetResult < currentStats.largestLoss) {
          currentStats.largestLoss = tableNetResult;
        }
        // Track overall single game max win / min loss (first occurrence only)
        if (tableNetResult > overallMaxWin || (tableNetResult === overallMaxWin && overallMaxWinTableIdx === -1)) {
          overallMaxWin = tableNetResult;
          overallMaxWinPlayer = player.name;
          overallMaxWinTableIdx = tableIdx;
        }
        // Only update min loss if it's a new minimum, or first occurrence
        if (tableNetResult < overallMinLoss || (tableNetResult === overallMinLoss && overallMinLossTableIdx === -1)) {
          overallMinLoss = tableNetResult;
          overallMinLossPlayer = player.name;
          overallMinLossTableIdx = tableIdx;
        }
        if (tableNetResult > 0) {
          currentStats.gamesWon += 1;
        } else if (tableNetResult < 0) {
          currentStats.gamesLost += 1;
        }
      });
    });

    // Calculate final aggregate stats (Net, Avgs) and convert map to array
    const statsArray: (PlayerStats & { potentialGames: number })[] = Object.values(statsMap).map(stat => {
      // Calculate potential games for this player
      const potentialGames = getPlayerPotentialGames(stat.name, sortedTables);
      // Calculate netResult, avgBuyIn, avgNetResult based on actual games played
      const netResult = stat.totalCashOut - stat.totalBuyIn;
      const avgBuyIn = stat.tablesPlayed > 0 ? stat.totalBuyIn / stat.tablesPlayed : 0;
      const avgNetResult = stat.tablesPlayed > 0 ? netResult / stat.tablesPlayed : 0;
      return {
        ...stat,
        netResult,
        avgBuyIn,
        avgNetResult,
        potentialGames,
      };
    });

    // Update the state for single game stats after calculation
    setSingleGameStats({ 
        maxWin: overallMaxWin, 
        maxWinPlayer: overallMaxWinPlayer, 
        minLoss: overallMinLoss, 
        minLossPlayer: overallMinLossPlayer 
    });

    // Sort by net result (descending)
    statsArray.sort((a, b) => b.netResult - a.netResult);

    return statsArray;
  }, [filteredTables]);

  // Filtered and sorted stats
  const filteredPlayerStats = useMemo(() => {
    const minGames = Number(minGamesFilter) || 0;
    let filtered = playerStats;
    if (minGames > 0) {
      filtered = playerStats.filter(stat => stat.tablesPlayed >= minGames);
    }
    return filtered;
  }, [playerStats, minGamesFilter]);

  // Calculate overall stats for top cards (using non-filtered stats)
  const overallStats = useMemo(() => {
    if (playerStats.length === 0) {
      return {
        totalBuyIn: 0,
        mostPlayed: null,
      };
    }

    const totalBuyIn = playerStats.reduce((sum, stat) => sum + stat.totalBuyIn, 0);
    
    // Sort by tables played
    const sortedByTablesPlayed = [...playerStats].sort((a, b) => b.tablesPlayed - a.tablesPlayed);
    const mostPlayed = sortedByTablesPlayed.length > 0 ? sortedByTablesPlayed[0] : null;

    return {
      totalBuyIn,
      mostPlayed,
    };
  }, [playerStats]);

  // Use the animated counter hook for totalBuyIn
  const animatedTotalBuyIn = useAnimatedCounter(overallStats.totalBuyIn);

  // Calculate top players by net result
  useEffect(() => {
    const sortedByNetResult = [...playerStats].sort((a, b) => b.netResult - a.netResult);
    setTopPlayersByNetResult(sortedByNetResult.slice(0, 3));
    setBottomPlayersByNetResult(sortedByNetResult.slice(-3).reverse());
  }, [playerStats]);

  // Helper function to get medal for player
  const getMedalForPlayer = (playerId: string) => {
    const index = topPlayersByNetResult.findIndex(p => p.id === playerId);
    if (index === 0) return <EmojiEventsIcon sx={{ color: '#FFD700', fontSize: '1.5rem' }} />;
    if (index === 1) return <EmojiEventsIcon sx={{ color: '#C0C0C0', fontSize: '1.5rem' }} />;
    if (index === 2) return <EmojiEventsIcon sx={{ color: '#CD7F32', fontSize: '1.5rem' }} />;
    return null;
  };

  // Helper function to get sheep icon for player
  const getSheepForPlayer = (playerId: string) => {
    const index = bottomPlayersByNetResult.findIndex(p => p.id === playerId);
    if (index === 0) return <span style={{ 
      backgroundColor: '#FF6B6B', 
      borderRadius: '50%', 
      padding: '2px 6px',
      marginRight: '4px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>🐑</span>;
    if (index === 1) return <span style={{ 
      backgroundColor: '#FF8E53', 
      borderRadius: '50%', 
      padding: '2px 6px',
      marginRight: '4px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>🐑</span>;
    if (index === 2) return <span style={{ 
      backgroundColor: '#FFD166', 
      borderRadius: '50%', 
      padding: '2px 6px',
      marginRight: '4px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>🐑</span>;
    return null;
  };

  // Define headers for sorting
  const headCells: readonly HeadCell[] = [
    {
      id: 'netResult',
      numeric: true,
      disablePadding: false,
      label: 'Net Result',
      width: '100px'
    },
    {
      id: 'tablesPlayed',
      numeric: true,
      disablePadding: false,
      label: 'Games',
      width: '80px'
    },
    {
      id: 'totalBuyIn',
      numeric: true,
      disablePadding: false,
      label: 'Total Buy-In',
      width: '100px'
    },
    {
      id: 'totalCashOut',
      numeric: true,
      disablePadding: false,
      label: 'Total Cash Out',
      width: '100px'
    },
    {
      id: 'avgBuyIn',
      numeric: true,
      disablePadding: false,
      label: 'Avg Buy-In',
      width: '100px'
    },
    {
      id: 'avgNetResult',
      numeric: true,
      disablePadding: false,
      label: 'Avg Result',
      width: '100px'
    },
    {
      id: 'largestWin',
      numeric: true,
      disablePadding: false,
      label: 'Best Result',
      width: '100px'
    },
    {
      id: 'largestLoss',
      numeric: true,
      disablePadding: false,
      label: 'Worst Result',
      width: '100px'
    }
  ];

  useEffect(() => {
    let maxSingleBuyIn = 0;
    let maxSingleBuyInPlayer = '-';
    let maxAvgBuyIn = 0;
    let maxAvgBuyInPlayer = '-';
    let maxAvgResult = 0;
    let maxAvgResultPlayer = '-';
    let maxTableAvgBuyIn = 0;
    let craziestTableData: Table | null = null;
    let minTableAvgBuyIn = Number.POSITIVE_INFINITY;
    let calmestTableData: Table | null = null;

    // Biggest single game buy-in
    filteredTables.forEach(table => {
      // Calculate table's average buy-in
      const totalBuyInAmount = table.players.reduce((sum, player) => sum + (player.totalBuyIn || 0), 0);
      const playersWithBuyIns = table.players.filter(player => (player.totalBuyIn || 0) > 0).length;
      const tableAvgBuyIn = playersWithBuyIns > 0 ? totalBuyInAmount / playersWithBuyIns : 0;

      if (tableAvgBuyIn > maxTableAvgBuyIn) {
        maxTableAvgBuyIn = tableAvgBuyIn;
        craziestTableData = table;
      }

      // Find calmest table (lowest avg buy-in, but only if > 0 and at least 2 players)
      if (tableAvgBuyIn < minTableAvgBuyIn && tableAvgBuyIn > 0 && table.players.length > 1) {
        minTableAvgBuyIn = tableAvgBuyIn;
        calmestTableData = table;
      }

      table.players.forEach(player => {
        if ((player.totalBuyIn || 0) > maxSingleBuyIn) {
          maxSingleBuyIn = player.totalBuyIn || 0;
          maxSingleBuyInPlayer = player.name;
        }
      });
    });

    // Biggest avg buy-in & best avg result
    playerStats.forEach(stat => {
      if (stat.avgBuyIn > maxAvgBuyIn) {
        maxAvgBuyIn = stat.avgBuyIn;
        maxAvgBuyInPlayer = stat.name;
      }
      if (stat.avgNetResult > maxAvgResult) {
        maxAvgResult = stat.avgNetResult;
        maxAvgResultPlayer = stat.name;
      }
    });

    setExtraStats({
      biggestSingleBuyIn: { value: maxSingleBuyIn, player: maxSingleBuyInPlayer },
      biggestAvgBuyIn: { value: maxAvgBuyIn, player: maxAvgBuyInPlayer },
      bestAvgResult: { value: maxAvgResult, player: maxAvgResultPlayer },
    });

    setCraziestTable({
      table: craziestTableData,
      avgBuyIn: maxTableAvgBuyIn
    });
    setCalmestTable({
      table: calmestTableData,
      avgBuyIn: minTableAvgBuyIn === Number.POSITIVE_INFINITY ? 0 : minTableAvgBuyIn
    });
  }, [filteredTables, playerStats]);

  // After playerStats calculation, add effect to calculate best winning streak
  useEffect(() => {
    // For each player, calculate their longest win streak
    let maxStreak = 0;
    let maxStreakPlayer = '-';
    playerStats.forEach(player => {
      // Gather all games for this player
      const games = filteredTables
        .filter(table => table.players.some(p => p.name.toLowerCase() === player.name.toLowerCase()))
        .map(table => {
          const p = table.players.find(p => p.name.toLowerCase() === player.name.toLowerCase());
          const buyIn = p?.totalBuyIn || 0;
          const cashOut = p?.cashOuts?.reduce((sum, co) => sum + (Number(co.amount) || 0), 0) || 0;
          const chips = p?.active ? (p?.chips || 0) : 0;
          const net = cashOut + chips - buyIn;
          return { netResult: net, date: new Date(table.createdAt) };
        });
      // Sort games by date ascending
      games.sort((a, b) => a.date.getTime() - b.date.getTime());
      // Calculate longest win streak
      let streak = 0;
      let maxPlayerStreak = 0;
      for (let i = 0; i < games.length; i++) {
        if (games[i].netResult > 0) {
          streak++;
          if (streak > maxPlayerStreak) maxPlayerStreak = streak;
        } else {
          streak = 0;
        }
      }
      if (maxPlayerStreak > maxStreak) {
        maxStreak = maxPlayerStreak;
        maxStreakPlayer = player.name;
      }
    });
    setBestWinStreak({ value: maxStreak, player: maxStreakPlayer });
  }, [playerStats, filteredTables]);

  // After playerStats calculation, add effect to calculate best current streak
  useEffect(() => {
    // For each player, calculate their current win streak
    const playerStreaks = new Map<string, number>();
    const sortedTables = [...filteredTables].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    playerStats.forEach(player => {
      let currentStreak = 0;
      let foundLoss = false;

      for (const table of sortedTables) {
        const playerInTable = table.players.find(p => p.name.toLowerCase() === player.name.toLowerCase());
        if (!playerInTable) continue;

        const buyIn = playerInTable.totalBuyIn || 0;
        const cashOut = playerInTable.cashOuts?.reduce((sum, co) => sum + (Number(co.amount) || 0), 0) || 0;
        const chips = playerInTable.active ? (playerInTable.chips || 0) : 0;
        const net = cashOut + chips - buyIn;

        if (net > 0) {
          currentStreak++;
        } else {
          foundLoss = true;
          break;
        }
      }

      if (currentStreak > 0) {
        playerStreaks.set(player.name, currentStreak);
      }
    });

    // Find max streak and players with that streak
    let maxStreak = 0;
    const playersWithMaxStreak: string[] = [];

    playerStreaks.forEach((streak, player) => {
      if (streak > maxStreak) {
        maxStreak = streak;
        playersWithMaxStreak.length = 0;
        playersWithMaxStreak.push(player);
      } else if (streak === maxStreak) {
        playersWithMaxStreak.push(player);
      }
    });

    setBestCurrentStreak({ value: maxStreak, players: playersWithMaxStreak });
  }, [playerStats, filteredTables]);

  // Calculate Food Order King
  useEffect(() => {
    const foodOrders = new Map<string, number>();
    const foodHistory: Array<{ date: string, player: string, tableCreatedAt?: string }> = [];

    // Sort tables by date descending to get most recent first
    const sortedTables = [...filteredTables].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    sortedTables.forEach(table => {
      if (table.food) {
        const foodOrderer = table.players.find(p => p.id === table.food);
        if (foodOrderer) {
          const count = (foodOrders.get(foodOrderer.name) || 0) + 1;
          foodOrders.set(foodOrderer.name, count);
          
          // Add to history (up to 20 entries)
          if (foodHistory.length < 20) {
            foodHistory.push({
              date: new Date(table.createdAt).toLocaleString('he-IL', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              }),
              player: foodOrderer.name,
              tableCreatedAt: table.createdAt ? String(table.createdAt) : undefined // keep the raw date for sorting
            });
          }
        }
      }
    });

    // Find player with most food orders
    let maxOrders = 0;
    let foodKing = '-';

    foodOrders.forEach((count, player) => {
      if (count > maxOrders) {
        maxOrders = count;
        foodKing = player;
      }
    });

    setFoodOrderKing({
      player: foodKing,
      count: maxOrders,
      history: foodHistory
    });
  }, [filteredTables]);

  // Sorted player options for Autocomplete
  const playerOptions = useMemo(() =>
    [...playerStats.map(player => player.name)].sort((a, b) => a.localeCompare(b)),
    [playerStats]
  );

  // Filter players based on search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.length) return filteredPlayerStats;
    return filteredPlayerStats.filter(player => 
      searchQuery.some(query => 
        player.name.toLowerCase().includes(query.toLowerCase()) || 
        (player.nickname && player.nickname.toLowerCase().includes(query.toLowerCase()))
      )
    );
  }, [filteredPlayerStats, searchQuery]);

  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const allPlayers = useMemo(() => {
    const players = new Set<string>();
    filteredPlayers.forEach((player) => {
      if (player.name) players.add(player.name);
    });
    return Array.from(players).sort();
  }, [filteredPlayers]);

  const filteredRows = useMemo(() => {
    if (selectedPlayers.length === 0) return filteredPlayerStats;
    return filteredPlayerStats.filter((player) => selectedPlayers.includes(player.name));
  }, [filteredPlayerStats, selectedPlayers]);

  // Remove freeSolo and add inputValue state
  const [inputValue, setInputValue] = useState('');

  // Add statCardSx at the top of the file for consistent card sizing
  const statCardSx = {
    bgcolor: '#1e1e1e',
    color: 'white',
    textAlign: 'center',
    boxShadow: 3,
    minHeight: { xs: 170, sm: 200 },
    maxHeight: { xs: 170, sm: 200 },
    minWidth: { xs: 'unset', sm: 220 },
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      boxShadow: '0 0 24px 4px #29b6f6',
      transform: { sm: 'scale(1.04)', xs: 'none' },
    },
  };

  // Helper: get top 3 players by games played
  const top3MostGamesPlayed = useMemo(() => {
    return [...playerStats]
      .sort((a, b) => b.tablesPlayed - a.tablesPlayed)
      .slice(0, 3);
  }, [playerStats]);

  // Helper: get top 3 biggest single game wins
  const top3BiggestSingleGameWins = useMemo(() => {
    // Collect all single game wins from all tables
    const wins: { player: string; amount: number; tableName?: string; date?: string }[] = [];
    filteredTables.forEach(table => {
      table.players.forEach(player => {
        const buyIn = player.totalBuyIn || 0;
        const cashOut = player.cashOuts?.reduce((sum, co) => sum + (Number(co.amount) || 0), 0) || 0;
        const chips = player.active ? (player.chips || 0) : 0;
        const net = cashOut + chips - buyIn;
        if (net > 0) {
          wins.push({
            player: player.name,
            amount: net,
            tableName: table.name,
            date: table.createdAt ? new Date(table.createdAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }) : undefined
          });
        }
      });
    });
    return wins.sort((a, b) => b.amount - a.amount).slice(0, 3);
  }, [filteredTables]);

  // Helper: get top 3 best winning streaks
  const top3BestWinningStreaks = useMemo(() => {
    // For each player, calculate their longest win streak and when it was achieved
    const streaks: { player: string; streak: number; date: Date | null }[] = [];
    playerStats.forEach(player => {
      // Gather all games for this player
      const games = filteredTables
        .filter(table => table.players.some(p => p.name.toLowerCase() === player.name.toLowerCase()))
        .map(table => {
          const p = table.players.find(p => p.name.toLowerCase() === player.name.toLowerCase());
          const buyIn = p?.totalBuyIn || 0;
          const cashOut = p?.cashOuts?.reduce((sum, co) => sum + (Number(co.amount) || 0), 0) || 0;
          const chips = p?.active ? (p?.chips || 0) : 0;
          const net = cashOut + chips - buyIn;
          return { netResult: net, date: new Date(table.createdAt) };
        });
      // Sort games by date ascending
      games.sort((a, b) => a.date.getTime() - b.date.getTime());
      // Calculate longest win streak and when it was achieved
      let streak = 0;
      let maxPlayerStreak = 0;
      let streakStartIdx = 0;
      let maxStreakStartIdx = 0;
      let maxStreakEndIdx = 0;
      for (let i = 0; i < games.length; i++) {
        if (games[i].netResult > 0) {
          if (streak === 0) streakStartIdx = i;
          streak++;
          if (streak > maxPlayerStreak) {
            maxPlayerStreak = streak;
            maxStreakStartIdx = streakStartIdx;
            maxStreakEndIdx = i;
          }
        } else {
          streak = 0;
        }
      }
      if (maxPlayerStreak > 0) {
        // We'll use the end date of the streak as the achievement date
        streaks.push({ player: player.name, streak: maxPlayerStreak, date: games[maxStreakEndIdx]?.date || null });
      }
    });
    return streaks.sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      if (a.date && b.date) return a.date.getTime() - b.date.getTime(); // earlier date first
      return 0;
    }).slice(0, 3);
  }, [playerStats, filteredTables]);

  // Helper: get top 3 biggest single game buy-ins
  const top3BiggestSingleGameBuyIns = useMemo(() => {
    const buyIns: { player: string; amount: number; tableName?: string; date?: string; createdAt?: string }[] = [];
    filteredTables.forEach(table => {
      table.players.forEach(player => {
        const buyIn = player.totalBuyIn || 0;
        if (buyIn > 0) {
          buyIns.push({
            player: player.name,
            amount: buyIn,
            tableName: table.name,
            date: table.createdAt ? new Date(table.createdAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }) : undefined,
            createdAt: table.createdAt ? String(table.createdAt) : undefined // keep the raw date for sorting
          });
        }
      });
    });
    return buyIns.sort((a, b) => {
      if (b.amount !== a.amount) {
        return b.amount - a.amount;
      }
      // Tie-breaker: older createdAt first
      if (a.createdAt && b.createdAt) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return 0;
    }).slice(0, 3);
  }, [filteredTables]);

  // Helper: get top 3 biggest avg buy-in
  const top3BiggestAvgBuyIn = useMemo(() => {
    return [...playerStats]
      .filter(p => p.tablesPlayed > 0)
      .map(p => ({
        player: p.name,
        avgBuyIn: Math.round(p.avgBuyIn),
        games: p.tablesPlayed
      }))
      .sort((a, b) => b.avgBuyIn - a.avgBuyIn)
      .slice(0, 3);
  }, [playerStats]);

  // Helper: get top 3 best avg result
  const top3BestAvgResult = useMemo(() => {
    return [...playerStats]
      .filter(p => p.tablesPlayed > 0)
      .map(p => ({
        player: p.name,
        avgResult: Math.round(p.avgNetResult),
        games: p.tablesPlayed
      }))
      .sort((a, b) => b.avgResult - a.avgResult)
      .slice(0, 3);
  }, [playerStats]);

  // Helper: get top 3 best current streaks
  const top3BestCurrentStreaks = useMemo(() => {
    // For each player, calculate their current win streak
    const streaks: { player: string; streak: number }[] = [];
    playerStats.forEach(player => {
      let currentStreak = 0;
      const sortedTables = [...filteredTables].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      for (const table of sortedTables) {
        const playerInTable = table.players.find(p => p.name.toLowerCase() === player.name.toLowerCase());
        if (!playerInTable) continue;
        const buyIn = playerInTable.totalBuyIn || 0;
        const cashOut = playerInTable.cashOuts?.reduce((sum, co) => sum + (Number(co.amount) || 0), 0) || 0;
        const chips = playerInTable.active ? (playerInTable.chips || 0) : 0;
        const net = cashOut + chips - buyIn;
        if (net > 0) {
          currentStreak++;
        } else {
          break;
        }
      }
      if (currentStreak > 0) {
        streaks.push({ player: player.name, streak: currentStreak });
      }
    });
    return streaks.sort((a, b) => b.streak - a.streak).slice(0, 3);
  }, [playerStats, filteredTables]);

  if (loading || (user && contextLoading)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || (user && contextError)) {
    return <Alert severity="error">Error loading data: {error || contextError}</Alert>;
  }

  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      bgcolor: '#121212'
    }}>
      <Box 
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 0.5, sm: 3 },
          px: { xs: 0.5, sm: 3 },
          width: '100%',
          maxWidth: '100%',
          overflowX: 'hidden',
          boxSizing: 'border-box',
          margin: 0,
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#1e1e1e'
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#555',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#666'
          }
        }}
      >
        {/* Group Selection and Title */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          mb: 3,
          gap: 2
        }}>
          <Typography variant="h4" sx={{ 
            color: 'white',
            fontWeight: 'bold',
            textAlign: { xs: 'center', sm: 'left' },
            width: { xs: '100%', sm: 'auto' }
          }}>
            Statistics for {selectedGroupName}
          </Typography>
          <TextField
            select
            label="Select Group"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            sx={{
              minWidth: 200,
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'grey.700',
                },
                '&:hover fieldset': {
                  borderColor: 'grey.500',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'grey.400',
              },
              '& .MuiSelect-select': {
                color: 'white',
              },
            }}
          >
            {groups.map((group) => (
              <MenuItem key={group.id} value={group.id}>
                {group.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Grid container spacing={1} sx={{ mb: 4, width: '100%', mx: 0, px: 0 }}>
          {/* 1. Total Games Played */}
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={statCardSx}>
              <CardContent sx={{ width: '100%', height: '100%', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  <span role="img" aria-label="games">🎮</span> Total Games Played
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#29b6f6', fontSize: { xs: '2rem', sm: '2.5rem' } }}>
                  {filteredTables.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          {/* 2. Most Games Played */}
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={statCardSx} onClick={top3MostGamesPlayed.length > 0 ? () => setIsMostGamesPlayedDialogOpen(true) : undefined} style={top3MostGamesPlayed.length > 0 ? { cursor: 'pointer' } : {}}>
              <CardContent sx={{ width: '100%', height: '100%', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  <span role="img" aria-label="trophy">🏆</span> Most Games Played
                </Typography>
                {overallStats.mostPlayed ? (
                  <>
                    <Typography variant="h5" sx={{ color: '#29b6f6', fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                      {overallStats.mostPlayed.name}
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#fff', fontSize: { xs: '0.8rem', sm: '1rem' } }}>
                      {overallStats.mostPlayed.tablesPlayed}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: 'grey.500', fontSize: { xs: '0.8rem', sm: '1rem' } }}>-</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/* 3. Total Buy In */}
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={statCardSx}>
              <CardContent sx={{ width: '100%', height: '100%', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  <span role="img" aria-label="money">💰</span> Total Buy In
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#66bb6a', fontSize: { xs: '2rem', sm: '2.5rem' } }}>
                  {animatedTotalBuyIn.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          {/* 4. Biggest Single Game Win */}
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={statCardSx} onClick={top3BiggestSingleGameWins.length > 0 ? () => setIsBiggestSingleGameWinDialogOpen(true) : undefined} style={top3BiggestSingleGameWins.length > 0 ? { cursor: 'pointer' } : {}}>
              <CardContent sx={{ width: '100%', height: '100%', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  <span role="img" aria-label="win">🏅</span> Biggest Single Game Win
                </Typography>
                {singleGameStats.maxWin > 0 ? (
                  <Typography variant="h5" sx={{ color: 'success.main', fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {singleGameStats.maxWinPlayer} (+{singleGameStats.maxWin})
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ color: 'grey.500', fontSize: { xs: '0.8rem', sm: '1rem' } }}>No single game wins yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/* 5. Best Winning Streak */}
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={statCardSx} onClick={top3BestWinningStreaks.length > 0 ? () => setIsBestWinningStreakDialogOpen(true) : undefined} style={top3BestWinningStreaks.length > 0 ? { cursor: 'pointer' } : {}}>
              <CardContent sx={{ width: '100%', height: '100%', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  <span role="img" aria-label="fire">🔥</span> Best Winning Streak
                </Typography>
                {top3BestWinningStreaks.length > 0 ? (
                  <Typography variant="h5" sx={{ color: '#ffb300', fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {top3BestWinningStreaks[0].player} ({top3BestWinningStreaks[0].streak} Games)
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ color: 'grey.500', fontSize: { xs: '0.8rem', sm: '1rem' } }}>No streaks yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/* 6. Biggest Single Game Buy-In */}
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={statCardSx} onClick={top3BiggestSingleGameBuyIns.length > 0 ? () => setIsBiggestSingleGameBuyInDialogOpen(true) : undefined} style={top3BiggestSingleGameBuyIns.length > 0 ? { cursor: 'pointer' } : {}}>
              <CardContent sx={{ width: '100%', height: '100%', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  <span role="img" aria-label="buy-in">🪙</span> Biggest Single Game Buy-In
                </Typography>
                {top3BiggestSingleGameBuyIns.length > 0 ? (
                  <Typography variant="h5" sx={{ color: '#ffd600', fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {top3BiggestSingleGameBuyIns[0].player} ({top3BiggestSingleGameBuyIns[0].amount})
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ color: 'grey.500', fontSize: { xs: '0.8rem', sm: '1rem' } }}>No buy-ins yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/* 7. Biggest Avg Buy-In */}
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={statCardSx} onClick={top3BiggestAvgBuyIn.length > 0 ? () => setIsBiggestAvgBuyInDialogOpen(true) : undefined} style={top3BiggestAvgBuyIn.length > 0 ? { cursor: 'pointer' } : {}}>
              <CardContent sx={{ width: '100%', height: '100%', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  <span role="img" aria-label="credit-card">💳</span> Biggest Avg Buy-In
                </Typography>
                {extraStats.biggestAvgBuyIn.value > 0 ? (
                  <Typography variant="h5" sx={{ color: '#ba68c8', fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {extraStats.biggestAvgBuyIn.player} ({Math.round(extraStats.biggestAvgBuyIn.value)})
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ color: 'grey.500', fontSize: { xs: '0.8rem', sm: '1rem' } }}>No avg buy-ins yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/* 8. Best Avg Result */}
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={statCardSx} onClick={top3BestAvgResult.length > 0 ? () => setIsBestAvgResultDialogOpen(true) : undefined} style={top3BestAvgResult.length > 0 ? { cursor: 'pointer' } : {}}>
              <CardContent sx={{ width: '100%', height: '100%', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  <span role="img" aria-label="chart">📈</span> Best Avg Result
                </Typography>
                {extraStats.bestAvgResult.value !== 0 ? (
                  <Typography variant="h5" sx={{ color: '#00bcd4', fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {extraStats.bestAvgResult.player} ({Math.round(extraStats.bestAvgResult.value)})
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ color: 'grey.500', fontSize: { xs: '0.8rem', sm: '1rem' } }}>No avg results yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/* 9. Best Current Streak */}
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={statCardSx} onClick={top3BestCurrentStreaks.length > 0 ? () => setIsBestCurrentStreakDialogOpen(true) : undefined} style={top3BestCurrentStreaks.length > 0 ? { cursor: 'pointer' } : {}}>
              <CardContent sx={{ width: '100%', height: '100%', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  <span role="img" aria-label="current-streak">⚡</span> Best Current Streak
                </Typography>
                {bestCurrentStreak.value > 0 ? (
                  <Typography variant="h5" sx={{ color: '#ffd700', fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {bestCurrentStreak.players[0]} ({bestCurrentStreak.value} Games)
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ color: 'grey.500', fontSize: { xs: '0.8rem', sm: '1rem' } }}>No current streaks</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/* 10. King Of Food Orders */}
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={statCardSx} onClick={foodOrderKing.count > 0 ? () => setIsFoodKingDialogOpen(true) : undefined} style={foodOrderKing.count > 0 ? { cursor: 'pointer' } : {}}>
              <CardContent sx={{ width: '100%', height: '100%', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  <span role="img" aria-label="food-king">🍔</span> King Of Food Orders
                </Typography>
                {foodOrderKing.count > 0 ? (
                  <>
                    <Typography variant="h5" sx={{ color: '#ff9800', fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                      {foodOrderKing.player}
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#fff', fontSize: { xs: '0.8rem', sm: '1rem' } }}>
                      {foodOrderKing.count} Orders
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: 'grey.500', fontSize: { xs: '0.8rem', sm: '1rem' } }}>No food orders yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/* 11. Craziest Table (NEW) */}
          <Grid item xs={6} sm={6} md={3}>
            <Card
              sx={statCardSx}
              onClick={craziestTable.table ? () => setIsCraziestTableDialogOpen(true) : undefined}
              style={craziestTable.table ? { cursor: 'pointer' } : {}}
            >
              <CardContent sx={{ width: '100%', height: '100%', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  <span role="img" aria-label="crazy">🤪</span> Craziest Table
                </Typography>
                {craziestTable.table ? (
                  <>
                    <Typography variant="h5" sx={{ color: '#ff4081', fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                      {craziestTable.table.name}
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#fff', fontSize: { xs: '0.8rem', sm: '1rem' } }}>
                      Avg Buy In: {Math.round(craziestTable.avgBuyIn)}
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#fff', fontSize: { xs: '0.8rem', sm: '1rem' } }}>
                      Players: {craziestTable.table.players.length}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: 'grey.500', fontSize: { xs: '0.8rem', sm: '1rem' } }}>No tables yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          {/* 12. Calmest Table (NEW) */}
          <Grid item xs={6} sm={6} md={3}>
            <Card
              sx={statCardSx}
              onClick={calmestTable.table ? () => setIsCalmestTableDialogOpen(true) : undefined}
              style={calmestTable.table ? { cursor: 'pointer' } : {}}
            >
              <CardContent sx={{ width: '100%', height: '100%', p: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'grey.400', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  <span role="img" aria-label="calm">🧘‍♂️</span> Calmest Table
                </Typography>
                {calmestTable.table ? (
                  <>
                    <Typography variant="h5" sx={{ color: '#00bcd4', fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                      {calmestTable.table.name}
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#fff', fontSize: { xs: '0.8rem', sm: '1rem' } }}>
                      Avg Buy In: {Math.round(calmestTable.avgBuyIn)}
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#fff', fontSize: { xs: '0.8rem', sm: '1rem' } }}>
                      Players: {calmestTable.table.players.length}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: 'grey.500', fontSize: { xs: '0.8rem', sm: '1rem' } }}>No tables yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Search Autocomplete */}
        <Box sx={{ mb: 2, maxWidth: 300 }}>
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={playerOptions}
            value={selectedPlayers}
            inputValue={inputValue}
            onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
            onChange={(_, newValue) => {
              setSelectedPlayers(newValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Players"
                variant="outlined"
                size="small"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.23)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'primary.main',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                }}
              />
            )}
            sx={{
              '& .MuiAutocomplete-popupIndicator': {
                color: 'rgba(255, 255, 255, 0.7)',
              },
              '& .MuiAutocomplete-clearIndicator': {
                color: 'rgba(255, 255, 255, 0.7)',
              },
              '& .MuiChip-root': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                '& .MuiChip-deleteIcon': {
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&:hover': {
                    color: 'white',
                  },
                },
              },
            }}
          />
        </Box>

        {/* Filter Input */}
        <Box sx={{ 
          mb: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          width: '100%'
        }}>
          <Typography variant="caption" sx={{ color: 'grey.400', mb: 0.5 }}>
            Min Games
          </Typography>
          <TextField
            type="number"
            variant="outlined"
            size="small"
            value={minGamesFilter}
            onChange={(e) => setMinGamesFilter(e.target.value)}
            InputProps={{
              style: { color: 'white' },
              inputProps: { 
                min: 0,
                max: 999,
                style: { width: '50px' }
              }
            }}
            sx={{
              width: '80px',
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'grey.700',
                },
                '&:hover fieldset': {
                  borderColor: 'grey.500',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                },
              },
            }}
          />
        </Box>

        {/* Table Container */}
        {isMobile ? (
          <div className={styles['mobile-stats-grid']} style={{ overflowX: 'auto' }}>
            <div className={styles['mobile-stats-header']} style={{ minWidth: 1200 }}>
              <div className={`${styles['mobile-stats-cell']} ${styles['mobile-stats-sticky']}`} style={{ width: 100 }}>Position</div>
              <div className={`${styles['mobile-stats-cell']} ${styles['mobile-stats-sticky2']}`} style={{ width: 160 }}>Player</div>
              {headCells.map((headCell) => (
                <div
                  key={headCell.id}
                  className={styles['mobile-stats-cell']}
                  style={{ minWidth: 130, width: 130 }}
                >
                  {headCell.label}
                </div>
              ))}
            </div>
            {filteredRows.length === 0 ? (
              <div className={styles['mobile-stats-row']} style={{ minWidth: 1200 }}>
                <div className={styles['mobile-stats-cell']} style={{ width: '100%' }}>
                  No players match the current filter.
                </div>
              </div>
            ) : (
              stableSort(filteredRows, getComparator(order, orderBy)).map((stat, index) => (
                <div className={styles['mobile-stats-row']} key={stat.id} style={{ minWidth: 1200, cursor: 'pointer' }} onClick={() => handlePlayerRowClick(stat)}>
                  <div className={`${styles['mobile-stats-cell']} ${styles['mobile-stats-sticky']}`} style={{ width: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    #{index + 1}
                    {getMedalForPlayer(stat.id) || getSheepForPlayer(stat.id) || ''}
                  </div>
                  <div className={`${styles['mobile-stats-cell']} ${styles['mobile-stats-sticky2']}`} style={{ width: 160 }}>{stat.name}</div>
                  {headCells.map((headCell) => {
                    let cellColor = 'inherit';
                    if (headCell.id === 'netResult') {
                      cellColor = stat.netResult > 0 ? '#4caf50' : stat.netResult < 0 ? '#f44336' : 'inherit';
                    } else if (headCell.id === 'avgNetResult') {
                      cellColor = stat.avgNetResult > 0 ? '#4caf50' : stat.avgNetResult < 0 ? '#f44336' : 'inherit';
                    } else if (headCell.id === 'largestWin') {
                      cellColor = '#4caf50';
                    } else if (headCell.id === 'largestLoss') {
                      cellColor = '#f44336';
                    }
                    let showOrdinal = false;
                    if (orderBy !== headCell.id && [
                      'netResult', 'tablesPlayed', 'totalBuyIn', 'totalCashOut', 'avgBuyIn', 'avgNetResult', 'largestWin', 'largestLoss'
                    ].includes(headCell.id as string)) {
                      showOrdinal = true;
                    }
                    let ordinal = '';
                    if (showOrdinal) {
                      let values = stableSort(filteredRows, getComparator('desc', headCell.id));
                      if (negativeColumns.includes(headCell.id as string)) {
                        values = stableSort(filteredRows, getComparator('asc', headCell.id));
                      }
                      const value = stat[headCell.id as keyof PlayerStats];
                      let rank = values.findIndex(s => s[headCell.id as keyof PlayerStats] === value) + 1;
                      if (rank > 0) {
                        ordinal = getOrdinal(rank);
                      }
                    }
                    return (
                      <div
                        key={headCell.id}
                        className={styles['mobile-stats-cell']}
                        style={{ minWidth: 130, width: 130, color: cellColor }}
                      >
                        {headCell.id === 'netResult' ? formatResult(stat.netResult) :
                          headCell.id === 'tablesPlayed' ? `${stat.tablesPlayed}/${stat.potentialGames} (${stat.potentialGames > 0 ? Math.ceil((stat.tablesPlayed / stat.potentialGames) * 100) : 0}%)` :
                          headCell.id === 'totalBuyIn' ? formatStat(stat.totalBuyIn) :
                          headCell.id === 'totalCashOut' ? formatStat(stat.totalCashOut) :
                          headCell.id === 'avgBuyIn' ? formatStat(stat.avgBuyIn) :
                          headCell.id === 'avgNetResult' ? formatStat(stat.avgNetResult) :
                          headCell.id === 'largestWin' ? formatStat(stat.largestWin) :
                          headCell.id === 'largestLoss' ? formatStat(stat.largestLoss) :
                          ''}
                        {showOrdinal && renderOrdinal(ordinal)}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        ) : (
          <TableContainer
            sx={{
              maxHeight: 'calc(100vh - 250px)',
              overflow: 'auto',
              '& .MuiTableCell-root': {
                borderBottom: '1px solid rgba(81, 81, 81, 1)'
              }
            }}
          >
            <MuiTable stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      bgcolor: '#1e1e1e',
                      width: '100px',
                      maxWidth: '100px',
                      padding: '8px 16px',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid rgba(81, 81, 81, 1)',
                    }}
                    align="center"
                  >
                    Position
                  </TableCell>
                  <TableCell
                    align="left"
                    sx={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      bgcolor: '#1e1e1e',
                      width: '120px',
                      maxWidth: '120px',
                      minWidth: '90px',
                      padding: '6px 10px',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid rgba(81, 81, 81, 1)',
                    }}
                  >
                    Player
                  </TableCell>
                  {headCells.map((headCell) => (
                    <TableCell
                      key={headCell.id}
                      align={headCell.numeric ? 'right' : 'center'}
                      sx={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        bgcolor: '#1e1e1e',
                        width: '90px',
                        maxWidth: '90px',
                        minWidth: '70px',
                        padding: '6px 10px',
                        whiteSpace: 'nowrap',
                        borderBottom: '1px solid rgba(81, 81, 81, 1)',
                      }}
                    >
                      <TableSortLabel
                        active={orderBy === headCell.id}
                        direction={orderBy === headCell.id ? order : 'asc'}
                        onClick={(event) => handleRequestSort(event, headCell.id)}
                      >
                        {headCell.label}
                        {orderBy === headCell.id ? (
                          <Box component="span" sx={visuallyHidden}>
                            {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                          </Box>
                        ) : null}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headCells.length + 1} align="center" sx={{ color: 'grey.500' }}> 
                      No players match the current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  stableSort(filteredRows, getComparator(order, orderBy))
                    .map((stat, index) => {
                      return (
                        <TableRow
                          hover
                          tabIndex={-1}
                          key={stat.id}
                          onClick={() => handlePlayerRowClick(stat)}
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                            bgcolor: 'background.paper'
                          }}
                        >
                          <TableCell
                            align="center"
                            sx={{
                              width: '70px',
                              maxWidth: '70px',
                              minWidth: '60px',
                              whiteSpace: 'nowrap',
                              borderBottom: '1px solid rgba(81, 81, 81, 1)',
                              bgcolor: '#1e1e1e',
                            }}
                          >
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                              #{index + 1}
                              {getMedalForPlayer(stat.id) || getSheepForPlayer(stat.id) || ''}
                            </Box>
                          </TableCell>
                          <TableCell
                            align="left"
                            sx={{
                              width: '120px',
                              maxWidth: '120px',
                              minWidth: '90px',
                              whiteSpace: 'nowrap',
                              borderBottom: '1px solid rgba(81, 81, 81, 1)',
                              bgcolor: '#1e1e1e',
                              padding: '6px 10px',
                            }}
                          >
                            {stat.name}
                          </TableCell>
                          {headCells.map((headCell) => {
                            let cellColor = 'inherit';
                            if (headCell.id === 'netResult') {
                              cellColor = stat.netResult > 0 ? '#4caf50' : stat.netResult < 0 ? '#f44336' : 'inherit';
                            } else if (headCell.id === 'avgNetResult') {
                              cellColor = stat.avgNetResult > 0 ? '#4caf50' : stat.avgNetResult < 0 ? '#f44336' : 'inherit';
                            } else if (headCell.id === 'largestWin') {
                              cellColor = '#4caf50';
                            } else if (headCell.id === 'largestLoss') {
                              cellColor = '#f44336';
                            }
                            let showOrdinal = false;
                            if (orderBy !== headCell.id && [
                              'netResult', 'tablesPlayed', 'totalBuyIn', 'totalCashOut', 'avgBuyIn', 'avgNetResult', 'largestWin', 'largestLoss'
                            ].includes(headCell.id as string)) {
                              showOrdinal = true;
                            }
                            let ordinal = '';
                            if (showOrdinal) {
                              let values = stableSort(filteredRows, getComparator('desc', headCell.id));
                              if (negativeColumns.includes(headCell.id as string)) {
                                values = stableSort(filteredRows, getComparator('asc', headCell.id));
                              }
                              const value = stat[headCell.id as keyof PlayerStats];
                              let rank = values.findIndex(s => s[headCell.id as keyof PlayerStats] === value) + 1;
                              if (rank > 0) {
                                ordinal = getOrdinal(rank);
                              }
                            }
                            return (
                              <TableCell
                                key={headCell.id}
                                align={headCell.numeric ? 'right' : 'center'}
                                sx={{
                                  width: '90px',
                                  maxWidth: '90px',
                                  minWidth: '70px',
                                  padding: '6px 10px',
                                  whiteSpace: 'nowrap',
                                  borderBottom: '1px solid rgba(81, 81, 81, 1)',
                                  bgcolor: '#1e1e1e',
                                  color: cellColor,
                                }}
                              >
                                {headCell.id === 'netResult' ? formatResult(stat.netResult) :
                                  headCell.id === 'tablesPlayed' ? `${stat.tablesPlayed}/${stat.potentialGames} (${stat.potentialGames > 0 ? Math.ceil((stat.tablesPlayed / stat.potentialGames) * 100) : 0}%)` :
                                  headCell.id === 'totalBuyIn' ? formatStat(stat.totalBuyIn) :
                                  headCell.id === 'totalCashOut' ? formatStat(stat.totalCashOut) :
                                  headCell.id === 'avgBuyIn' ? formatStat(stat.avgBuyIn) :
                                  headCell.id === 'avgNetResult' ? formatStat(stat.avgNetResult) :
                                  headCell.id === 'largestWin' ? formatStat(stat.largestWin) :
                                  headCell.id === 'largestLoss' ? formatStat(stat.largestLoss) :
                                  ''}
                                {showOrdinal && renderOrdinal(ordinal)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </MuiTable>
          </TableContainer>
        )}
      </Box>

      {/* Dialog */}
      <PlayerStatsDialog 
        open={isDetailDialogOpen}
        onClose={handleCloseDetailDialog}
        playerData={selectedPlayerStats}
        allTablesData={filteredTables} 
      />

      {/* Best Current Streak Dialog */}
      <Dialog
        open={isStreakDialogOpen}
        onClose={() => setIsStreakDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: 'white',
            minWidth: { xs: '90%', sm: '400px' },
            maxWidth: '600px',
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: 1, borderColor: 'grey.800', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span role="img" aria-label="current-streak">⚡</span>
            <Typography variant="h6">Best Current Streak</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <List>
            {bestCurrentStreak.players.map((player, index) => (
              <ListItem key={index} sx={{ py: 1 }}>
                <ListItemText
                  primary={player}
                  secondary={`${bestCurrentStreak.value} Games`}
                  primaryTypographyProps={{ color: '#ffd700', fontWeight: 'bold' }}
                  secondaryTypographyProps={{ color: 'grey.400' }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ borderTop: 1, borderColor: 'grey.800', p: 2 }}>
          <Button onClick={() => setIsStreakDialogOpen(false)} sx={{ color: 'grey.400' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Food King Dialog */}
      <Dialog
        open={isFoodKingDialogOpen}
        onClose={() => setIsFoodKingDialogOpen(false)}
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
          <span role="img" aria-label="food-king">🍔</span>
          Food Order History
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" sx={{ color: '#ff9800', mb: 2 }}>
              {foodOrderKing.player} - {foodOrderKing.count} Orders
            </Typography>
            <List>
              {foodOrderKing.history.map((order, index) => (
                <ListItem key={index} sx={{
                  bgcolor: 'rgba(255, 152, 0, 0.1)',
                  borderRadius: 1,
                  mb: 1
                }}>
                  <ListItemText
                    primary={
                      <Typography sx={{ color: 'white' }}>
                        {order.player}
                      </Typography>
                    }
                    secondary={
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {order.tableCreatedAt ? new Date(order.tableCreatedAt).toLocaleDateString('he-IL') : '-'}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsFoodKingDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Craziest Table Dialog */}
      <Dialog
        open={isCraziestTableDialogOpen}
        onClose={() => setIsCraziestTableDialogOpen(false)}
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
          <span role="img" aria-label="crazy">🤪</span>
          Craziest Table Details
        </DialogTitle>
        <DialogContent>
          {craziestTable.table && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ color: '#ff4081', mb: 2 }}>
                {craziestTable.table.name}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" sx={{ color: 'white', fontWeight: 'bold' }}>Date:</Typography>
                  <Typography variant="body1" sx={{ color: 'white' }}>
                    {new Date(craziestTable.table.createdAt).toLocaleDateString('he-IL')}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body1" sx={{ color: 'white' }}>
                    <strong>Blinds:</strong> {craziestTable.table.smallBlind}/{craziestTable.table.bigBlind}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body1" sx={{ color: 'white' }}>
                    <strong>Location:</strong> {craziestTable.table.location || 'Not specified'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body1" sx={{ color: 'white' }}>
                    <strong>Total Buy In:</strong> {craziestTable.table.players.reduce((sum, player) => sum + (player.totalBuyIn || 0), 0)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCraziestTableDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Calmest Table Dialog */}
      <Dialog
        open={isCalmestTableDialogOpen}
        onClose={() => setIsCalmestTableDialogOpen(false)}
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
          <span role="img" aria-label="calm">🧘‍♂️</span>
          Calmest Table Details
        </DialogTitle>
        <DialogContent>
          {calmestTable.table && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" sx={{ color: '#00bcd4', mb: 2 }}>
                {calmestTable.table.name}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" sx={{ color: 'white', fontWeight: 'bold' }}>Date:</Typography>
                  <Typography variant="body1" sx={{ color: 'white' }}>
                    {new Date(calmestTable.table.createdAt).toLocaleDateString('he-IL')}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body1" sx={{ color: 'white' }}>
                    <strong>Blinds:</strong> {calmestTable.table.smallBlind}/{calmestTable.table.bigBlind}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body1" sx={{ color: 'white' }}>
                    <strong>Location:</strong> {calmestTable.table.location || 'Not specified'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body1" sx={{ color: 'white' }}>
                    <strong>Total Buy In:</strong> {calmestTable.table.players.reduce((sum, player) => sum + (player.totalBuyIn || 0), 0)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCalmestTableDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Most Games Played Dialog */}
      <Dialog
        open={isMostGamesPlayedDialogOpen}
        onClose={() => setIsMostGamesPlayedDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', alignItems: 'center', gap: 1 }}>
          <span role="img" aria-label="trophy">🏆</span> Top 3 Most Games Played
        </DialogTitle>
        <DialogContent>
          {top3MostGamesPlayed.length > 0 ? (
            <List>
              {top3MostGamesPlayed.map((player, idx) => (
                <ListItem key={player.id || player.name}>
                  <ListItemText
                    primary={<>
                      <strong>{idx + 1}.</strong> {player.name}
                    </>}
                    secondary={`Games Played: ${player.tablesPlayed}`}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography>No data available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsMostGamesPlayedDialogOpen(false)} sx={{ color: 'grey.400' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Biggest Single Game Win Dialog */}
      <Dialog
        open={isBiggestSingleGameWinDialogOpen}
        onClose={() => setIsBiggestSingleGameWinDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', alignItems: 'center', gap: 1 }}>
          <span role="img" aria-label="win">🏅</span> Top 3 Biggest Single Game Wins
        </DialogTitle>
        <DialogContent>
          {top3BiggestSingleGameWins.length > 0 ? (
            <List>
              {top3BiggestSingleGameWins.map((win, idx) => (
                <ListItem key={win.player + win.amount + (win.tableName || '') + (win.date || '')}>
                  <ListItemText
                    primary={<>
                      <strong>{idx + 1}.</strong> {win.player} (+{win.amount})
                    </>}
                    secondary={win.tableName || win.date ? `${win.tableName ? 'Table: ' + win.tableName : ''}${win.tableName && win.date ? ' | ' : ''}${win.date ? 'Date: ' + win.date : ''}` : undefined}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography>No data available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsBiggestSingleGameWinDialogOpen(false)} sx={{ color: 'grey.400' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Best Winning Streak Dialog */}
      <Dialog
        open={isBestWinningStreakDialogOpen}
        onClose={() => setIsBestWinningStreakDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', alignItems: 'center', gap: 1 }}>
          <span role="img" aria-label="fire">🔥</span> Top 3 Best Winning Streaks
        </DialogTitle>
        <DialogContent>
          {top3BestWinningStreaks.length > 0 ? (
            <List>
              {top3BestWinningStreaks.map((streak, idx) => (
                <ListItem key={streak.player + streak.streak}>
                  <ListItemText
                    primary={<>
                      <strong>{idx + 1}.</strong> {streak.player} ({streak.streak} Games)
                    </>}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography>No data available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsBestWinningStreakDialogOpen(false)} sx={{ color: 'grey.400' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Biggest Single Game Buy-In Dialog */}
      <Dialog
        open={isBiggestSingleGameBuyInDialogOpen}
        onClose={() => setIsBiggestSingleGameBuyInDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', alignItems: 'center', gap: 1 }}>
          <span role="img" aria-label="buy-in">🪙</span> Top 3 Biggest Single Game Buy-Ins
        </DialogTitle>
        <DialogContent>
          {top3BiggestSingleGameBuyIns.length > 0 ? (
            <List>
              {top3BiggestSingleGameBuyIns.map((buyIn, idx) => (
                <ListItem key={buyIn.player + buyIn.amount + (buyIn.tableName || '') + (buyIn.date || '')}>
                  <ListItemText
                    primary={<>
                      <strong>{idx + 1}.</strong> {buyIn.player} ({buyIn.amount})
                    </>}
                    secondary={buyIn.tableName || buyIn.date ? `${buyIn.tableName ? 'Table: ' + buyIn.tableName : ''}${buyIn.tableName && buyIn.date ? ' | ' : ''}${buyIn.date ? 'Date: ' + buyIn.date : ''}` : undefined}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography>No data available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsBiggestSingleGameBuyInDialogOpen(false)} sx={{ color: 'grey.400' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Biggest Avg Buy-In Dialog */}
      <Dialog
        open={isBiggestAvgBuyInDialogOpen}
        onClose={() => setIsBiggestAvgBuyInDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', alignItems: 'center', gap: 1 }}>
          <span role="img" aria-label="credit-card">💳</span> Top 3 Biggest Avg Buy-In
        </DialogTitle>
        <DialogContent>
          {top3BiggestAvgBuyIn.length > 0 ? (
            <List>
              {top3BiggestAvgBuyIn.map((item, idx) => (
                <ListItem key={item.player + item.avgBuyIn}>
                  <ListItemText
                    primary={<>
                      <strong>{idx + 1}.</strong> {item.player} ({item.avgBuyIn})
                    </>}
                    secondary={`Games: ${item.games}`}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography>No data available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsBiggestAvgBuyInDialogOpen(false)} sx={{ color: 'grey.400' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Best Avg Result Dialog */}
      <Dialog
        open={isBestAvgResultDialogOpen}
        onClose={() => setIsBestAvgResultDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', alignItems: 'center', gap: 1 }}>
          <span role="img" aria-label="chart">📈</span> Top 3 Best Avg Result
        </DialogTitle>
        <DialogContent>
          {top3BestAvgResult.length > 0 ? (
            <List>
              {top3BestAvgResult.map((item, idx) => (
                <ListItem key={item.player + item.avgResult}>
                  <ListItemText
                    primary={<>
                      <strong>{idx + 1}.</strong> {item.player} ({item.avgResult})
                    </>}
                    secondary={`Games: ${item.games}`}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography>No data available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsBestAvgResultDialogOpen(false)} sx={{ color: 'grey.400' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Best Current Streak Dialog */}
      <Dialog
        open={isBestCurrentStreakDialogOpen}
        onClose={() => setIsBestCurrentStreakDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1e1e1e',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', alignItems: 'center', gap: 1 }}>
          <span role="img" aria-label="current-streak">⚡</span> Top 3 Best Current Streaks
        </DialogTitle>
        <DialogContent>
          {top3BestCurrentStreaks.length > 0 ? (
            <List>
              {top3BestCurrentStreaks.map((streak, idx) => (
                <ListItem key={streak.player + streak.streak}>
                  <ListItemText
                    primary={<>
                      <strong>{idx + 1}.</strong> {streak.player} ({streak.streak} Games)
                    </>}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography>No data available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsBestCurrentStreakDialogOpen(false)} sx={{ color: 'grey.400' }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StatisticsView;