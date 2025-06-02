import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Snackbar,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import CircularProgress from '@mui/material/CircularProgress';
import GroupIcon from '@mui/icons-material/Group';
import { Player, Table, BuyIn, CashOut } from '../types';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { sortPlayers } from './ShareTable';
import EventIcon from '@mui/icons-material/Event';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CloudIcon from '@mui/icons-material/Cloud';
import OpacityIcon from '@mui/icons-material/Opacity';
import NightlightIcon from '@mui/icons-material/Nightlight';
import FastfoodIcon from '@mui/icons-material/Fastfood';

// Define Feedback type
interface FeedbackState {
  message: string;
  severity: 'success' | 'error';
}

// WeatherCardInfo component
const WeatherCardInfo: React.FC<{ date: string | Date, location?: string, iconSize?: number }> = ({ date, location, iconSize = 32 }) => {
  const [weather, setWeather] = useState<null | {
    icon: React.ReactNode,
    hour: string,
    dayOfWeek: string,
    maxTemp: number,
    minTemp: number,
    temp: number,
    desc: string
  }>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = process.env.REACT_APP_WEATHER_API_KEY;
    // תמיד Tel Aviv
    const city = 'Tel Aviv';
    const dt = typeof date === 'string' ? new Date(date) : date;
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(city)}&dt=${dateStr}&lang=he`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (!data.forecast || !data.forecast.forecastday || !data.forecast.forecastday[0]) throw new Error('No forecast data');
        const forecastDay = data.forecast.forecastday[0];
        // ננסה להביא את השעה 21:00, אם אין ניקח 20:00, ואם אין ניקח את ממוצע היום
        let hourData = forecastDay.hour.find((h: any) => h.time.endsWith('21:00')) ||
                       forecastDay.hour.find((h: any) => h.time.endsWith('20:00')) ||
                       forecastDay.day;
        // אייקון
        let icon: React.ReactNode = <WbSunnyIcon sx={{ color: '#FFD600', fontSize: iconSize }} />;
        const code = hourData.condition.code;
        const isNight = hourData.is_day === 0;
        if (code === 1000 && isNight) icon = <NightlightIcon sx={{ color: '#1565c0', fontSize: iconSize }} />;
        else if ([1003, 1006, 1009].includes(code)) icon = <CloudIcon sx={{ color: '#90caf9', fontSize: iconSize }} />;
        else if ([1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(code)) icon = <OpacityIcon sx={{ color: '#2196f3', fontSize: iconSize }} />;
        // יום בשבוע
        const dayOfWeek = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
        // שעה
        const hour = hourData.time ? hourData.time.split(' ')[1].slice(0, 5) : '';
        // טמפ' מקס/מינימום
        const maxTemp = Math.round(forecastDay.day.maxtemp_c);
        const minTemp = Math.round(forecastDay.day.mintemp_c);
        setWeather({
          icon,
          hour,
          dayOfWeek,
          maxTemp,
          minTemp,
          temp: Math.round(hourData.temp_c || hourData.avgtemp_c),
          desc: hourData.condition.text
        });
      })
      .catch(err => setError('Weather unavailable'));
  }, [date, location, iconSize]);

  if (error) return null;
  if (!weather) return (
    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 60, minHeight: 32 }}>
      <CloudIcon sx={{ fontSize: 32, color: '#90caf9' }} />
      <Typography variant="body2" sx={{ color: 'grey.400', ml: 0.5 }}>...</Typography>
    </Box>
  );
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 60, minHeight: 32 }}>
      {weather.icon}
      <Box sx={{ display: 'flex', gap: 0.5, ml: 0.5 }}>
        <Typography variant="h6" sx={{ color: '#FFD600', fontSize: '1.1rem', lineHeight: 1 }}>{weather.maxTemp}°</Typography>
        <Typography variant="h6" sx={{ color: 'grey.400', fontSize: '1.1rem', lineHeight: 1 }}>{weather.minTemp}°</Typography>
      </Box>
    </Box>
  );
};

const SharedTableView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  
  // State to hold the fetched table data directly
  const [table, setTable] = useState<Table | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const fetchTableData = useCallback(async () => {
    if (!id) {
      setError('Table ID is missing.');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const url = `${process.env.REACT_APP_API_URL}/api/share/${id}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Table not found.');
        } else {
          throw new Error(`Failed to fetch table: ${response.statusText}`);
        }
      }

      const data: Table = await response.json();
      setTable(data);
    } catch (fetchError: any) {
      setError(fetchError.message || 'An error occurred while fetching the table.');
      setTable(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Use effect to fetch the specific table data
  useEffect(() => {
    // Initial fetch
    if (id) {
      fetchTableData();
    }
  }, [id, fetchTableData]);

  // Effect to clear feedback after a delay
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Updated loading state check
  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  // Updated error state check
  if (error) {
      return (
          <Box sx={{ p: 3 }}>
              <Alert severity="error">{error}</Alert>
          </Box>
      );
  }

  // If not loading, no error, but still no table (shouldn't happen with current logic, but safe check)
  if (!table) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Table data is unavailable.</Alert>
      </Box>
    );
  }

  const players = table.players || [];

  // Calculate statistics
  const totalBuyInAmount = players.reduce((sum, player) => sum + (player.totalBuyIn ?? 0), 0);
  const playersWithBuyIns = players.filter((player: Player) => (player.totalBuyIn ?? 0) > 0).length;
  const avgBuyInPerPlayer = playersWithBuyIns > 0 ? totalBuyInAmount / playersWithBuyIns : 0;

  const calculatePlayerBalance = (player: Player): number => {
    if (!player) return 0;
    const totalBuyIn = player.totalBuyIn ?? 0;
    const totalCashOut = Array.isArray(player.cashOuts)
      ? player.cashOuts.reduce((sum, cashOut) => sum + (Number(cashOut?.amount) || 0), 0)
      : 0;
    return (player.chips ?? 0) + totalCashOut - totalBuyIn;
  };

  const handlePlayerClick = (player: Player) => {
    if (!player) return;
    setSelectedPlayer(player);
    setHistoryDialogOpen(true);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, bgcolor: '#121212', minHeight: '100vh' }}>
      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 1, sm: 2, md: 3 } }}>
        <Typography variant="h4" sx={{ flexGrow: 1, color: 'white' }}>
          {table.name || 'Unnamed Table'}
        </Typography>
        <IconButton 
          onClick={fetchTableData}
          sx={{ 
            color: 'primary.main',
            '&:hover': {
              color: 'primary.dark',
              transform: 'rotate(360deg)',
              transition: 'transform 0.5s ease'
            }
          }}
        >
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Info Cards */}
      <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: { xs: 1, sm: 2, md: 3 } }}>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            bgcolor: '#1976d2', 
            color: 'white',
            transition: 'transform 0.2s',
            '&:hover': {
              transform: 'scale(1.02)'
            }
          }}>
            <CardContent sx={{ p: { xs: 1, sm: 1.5 } }}>
              <Typography variant="subtitle2" gutterBottom>Total Buy In</Typography>
              <Typography variant="h5">{totalBuyInAmount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            bgcolor: '#e91e63', 
            color: 'white',
            transition: 'transform 0.2s',
            '&:hover': {
              transform: 'scale(1.02)'
            }
          }}>
            <CardContent sx={{ p: { xs: 1, sm: 1.5 } }}>
              <Typography variant="subtitle2" gutterBottom>Avg Buy In</Typography>
              <Typography variant="h5">{Math.round(avgBuyInPerPlayer)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            bgcolor: '#2196f3', 
            color: 'white',
            transition: 'transform 0.2s',
            '&:hover': {
              transform: 'scale(1.02)'
            }
          }}>
            <CardContent sx={{ p: { xs: 1, sm: 1.5 } }}>
              <Typography variant="subtitle2" gutterBottom>Total Players</Typography>
              <Typography variant="h5">{players.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            bgcolor: table.isActive ? '#4caf50' : '#757575', 
            color: 'white',
            transition: 'transform 0.2s',
            '&:hover': {
              transform: 'scale(1.02)'
            }
          }}>
            <CardContent sx={{ p: { xs: 1, sm: 1.5 } }}>
              <Typography variant="subtitle2" gutterBottom>Table Status</Typography>
              <Typography variant="h5">
                {table.isActive ? 'Active' : 'Inactive'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Table Info */}
      <Box sx={{ mb: { xs: 1, sm: 2, md: 3 } }}>
        <Paper sx={{ p: { xs: 1, sm: 2 }, mb: { xs: 1, sm: 2, md: 3 }, bgcolor: '#232323', color: 'white', display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 3 }, flexWrap: 'wrap' }}>
          <Typography variant="body1" sx={{ color: 'grey.400', display: 'flex', alignItems: 'center', gap: 1, mr: { xs: 1, sm: 2 } }}>
            <EventIcon sx={{ fontSize: 20, color: 'white' }} />
            {new Date(table.createdAt).toLocaleString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
          </Typography>
          <Typography variant="body1" sx={{ color: 'grey.400', mr: { xs: 1, sm: 2 }, display: 'flex', alignItems: 'center', gap: 1 }}>
            <MonetizationOnIcon sx={{ fontSize: 18, color: '#388e3c' }} />
            Small Blind: {table.smallBlind} | Big Blind: {table.bigBlind}
          </Typography>
          {table.location && (
            <Typography variant="body1" sx={{ color: 'grey.400', display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationOnIcon sx={{ fontSize: 18, color: '#2196f3' }} />
              {table.location}
            </Typography>
          )}
          {/* Weather info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WeatherCardInfo date={table.createdAt} location={table.location} iconSize={20} />
          </Box>
          {/* Food info - always last */}
          {table.food && (
            <Typography variant="body1" sx={{ color: 'grey.400', display: 'flex', alignItems: 'center', gap: 1 }}>
              <FastfoodIcon sx={{ fontSize: 20, color: '#FFD600' }} />
              Food ordered by: {table.players.find(p => p.id === table.food)?.name || 'Unknown'}
            </Typography>
          )}
        </Paper>
      </Box>

      {/* Players Table */}
      <TableContainer 
        component={Paper} 
        sx={{ 
          bgcolor: '#1e1e1e', 
          overflowX: 'auto',
          mb: { xs: 1, sm: 2, md: 3 },
          '&::-webkit-scrollbar': {
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#1e1e1e',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#555',
            borderRadius: '4px',
            '&:hover': {
              background: '#777',
            },
          },
        }}
      >
        <MuiTable sx={{ minWidth: 650, '& .MuiTableCell-root': {
          fontSize: { xs: '0.85rem', sm: '1rem' },
          px: { xs: 0.5, sm: 2 },
          py: { xs: 0.5, sm: 1.5 },
        } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{
                position: 'sticky',
                left: 0,
                zIndex: (theme) => theme.zIndex.appBar + 1,
                bgcolor: '#1e1e1e',
                color: 'white',
                fontWeight: 'bold',
                minWidth: '90px',
                borderRight: '1px solid rgba(255, 255, 255, 0.12)',
                fontSize: { xs: '0.95rem', sm: '1.1rem' },
                px: { xs: 0.5, sm: 2 },
                py: { xs: 0.5, sm: 1.5 },
              }}>
                Player
              </TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', minWidth: '90px', fontSize: { xs: '0.9rem', sm: '1rem' }, px: { xs: 0.5, sm: 2 }, py: { xs: 0.5, sm: 1.5 } }}>
                Total Buy-in
              </TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', minWidth: '90px', fontSize: { xs: '0.9rem', sm: '1rem' }, px: { xs: 0.5, sm: 2 }, py: { xs: 0.5, sm: 1.5 } }}>
                Total Cash-out
              </TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', minWidth: '90px', fontSize: { xs: '0.9rem', sm: '1rem' }, px: { xs: 0.5, sm: 2 }, py: { xs: 0.5, sm: 1.5 } }}>
                Balance
              </TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', minWidth: '70px', fontSize: { xs: '0.9rem', sm: '1rem' }, px: { xs: 0.5, sm: 2 }, py: { xs: 0.5, sm: 1.5 } }}>
                Show Me!
              </TableCell>
              <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold', minWidth: '70px', fontSize: { xs: '0.9rem', sm: '1rem' }, px: { xs: 0.5, sm: 2 }, py: { xs: 0.5, sm: 1.5 } }}>
                Status
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...players].sort(sortPlayers).map((player) => {
              if (!player || typeof player !== 'object') return null;
              const balance = calculatePlayerBalance(player);
              const balanceColor = balance > 0 ? '#4caf50' : balance < 0 ? '#f44336' : 'white';
              const formattedBalance = balance > 0 ? `+${balance}` : `${balance}`;
              const totalCashOutDisplay = Array.isArray(player.cashOuts)
                ? player.cashOuts.reduce((sum, cashOut) => sum + (Number(cashOut?.amount) || 0), 0)
                : 0;
              return (
                <TableRow 
                  key={player.id}
                  onClick={() => handlePlayerClick(player)}
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#2e2e2e' }
                  }}
                >
                  <TableCell component="th" scope="row" sx={{
                    position: 'sticky',
                    left: 0,
                    zIndex: (theme) => theme.zIndex.appBar,
                    bgcolor: '#1e1e1e',
                    color: 'white',
                    minWidth: '90px',
                    borderRight: '1px solid rgba(255, 255, 255, 0.12)',
                    fontSize: { xs: '0.95rem', sm: '1.1rem' },
                    px: { xs: 0.5, sm: 2 },
                    py: { xs: 0.5, sm: 1.5 },
                  }}>
                    <Box>
                      {player.name}
                      {player.nickname && (
                        <Typography 
                          component="span" 
                          variant="body2" 
                          sx={{ ml: 1, color: 'rgba(255,255,255,0.7)', fontSize: { xs: '0.8rem', sm: '0.95rem' } }}
                        >
                          ({player.nickname})
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ color: 'white' }}>
                    {player.totalBuyIn ?? 0}
                  </TableCell>
                  <TableCell align="center" sx={{ color: 'white' }}>
                    {totalCashOutDisplay}
                  </TableCell>
                  <TableCell align="center" sx={{ color: balanceColor, fontWeight: 'bold', fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
                    {formattedBalance}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton 
                      sx={{ 
                        color: player.showMe ? '#2196f3' : '#757575',
                        '&:hover': { bgcolor: 'transparent' },
                        fontSize: { xs: '1.1rem', sm: '1.25rem' },
                        p: { xs: 0.5, sm: 1 }
                      }}
                      tabIndex={-1}
                      onClick={e => e.stopPropagation()}
                    >
                      {player.showMe ? <VisibilityIcon fontSize="inherit" /> : <VisibilityOffIcon fontSize="inherit" />}
                    </IconButton>
                  </TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={player.active ? 'Active' : 'Inactive'}
                      color={player.active ? 'success' : 'default'}
                      sx={{ 
                        bgcolor: player.active ? '#4caf50' : '#757575',
                        color: 'white',
                        fontSize: { xs: '0.8rem', sm: '1rem' },
                        height: { xs: 22, sm: 28 }
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </MuiTable>
      </TableContainer>

      {/* Player History Dialog */}
      <Dialog 
        open={historyDialogOpen} 
        onClose={() => setHistoryDialogOpen(false)}
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
              {selectedPlayer && selectedPlayer.buyIns && selectedPlayer.buyIns.filter(buyIn => buyIn.amount > 0).length > 0 ? (
                selectedPlayer.buyIns.filter(buyIn => buyIn.amount > 0).map((buyIn, index) => (
                  <React.Fragment key={buyIn.id || index}>
                    <ListItem sx={{
                      bgcolor: 'rgba(33, 150, 243, 0.1)',
                      borderRadius: 1,
                      mb: 1
                    }}>
                      <ListItemText
                        primary={
                          <Typography sx={{ color: 'white' }}>
                            Buy In #{index + 1}: ${buyIn.amount ?? '-'}
                          </Typography>
                        }
                        secondary={
                          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                            {new Date(buyIn.timestamp).toLocaleString()}
                          </Typography>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))
              ) : (
                <ListItem>
                  <ListItemText 
                    primary={
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        No buy-ins recorded.
                      </Typography>
                    }
                  />
                </ListItem>
              )}
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
              {selectedPlayer && selectedPlayer.cashOuts && selectedPlayer.cashOuts.length > 0 ? (
                selectedPlayer.cashOuts.map((cashOut, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={`Cash Out #${index + 1}: $${cashOut.amount ?? '-'}`}
                      secondary={new Date(cashOut.timestamp).toLocaleString()}
                      sx={{ color: 'white' }}
                    />
                  </ListItem>
                ))
              ) : (
                <ListItem>
                  <ListItemText 
                    primary={
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        No cash-outs recorded.
                      </Typography>
                    }
                  />
                </ListItem>
              )}
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
              Total Buy In: ${selectedPlayer?.totalBuyIn ?? '-'}
            </Typography>
            <Typography sx={{ color: 'white' }}>
              Total Cash Out: ${selectedPlayer?.cashOuts?.reduce((sum, cashOut) => sum + cashOut.amount, 0) ?? '-'}
            </Typography>
            <Typography sx={{ 
              color: 'white', 
              mt: 1,
              fontWeight: 'bold'
            }}>
              Current Balance: ${calculatePlayerBalance(selectedPlayer as Player)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <Button 
            onClick={() => setHistoryDialogOpen(false)}
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

      {/* Snackbar for feedback */}
      {feedback && (
        <Snackbar 
          open={!!feedback} 
          autoHideDuration={2000} 
          onClose={() => setFeedback(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setFeedback(null)} severity={feedback.severity} sx={{ width: '100%' }}>
            {feedback.message}
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
};

export default SharedTableView; 