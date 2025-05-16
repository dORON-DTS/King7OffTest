import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Paper
} from '@mui/material';
import { Table, PlayerStats } from '../types';
// Import Recharts components
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Interface for props expected by the dialog
interface PlayerStatsDialogProps {
  open: boolean;
  onClose: () => void;
  playerData: PlayerStats | null;
  allTablesData: Table[];
}

const PlayerStatsDialog: React.FC<PlayerStatsDialogProps> = ({ open, onClose, playerData, allTablesData }) => {
  
  // Calculate Timeline Data and Matchup Data here using useMemo
  const detailedStats = useMemo(() => {
    if (!playerData || !allTablesData) {
      // Return only timeline data
      return { timeline: [] }; 
    }

    const timelineData: { gameDate: string, netResult: number, cumulativeResult: number }[] = [];
    let cumulativeResult = 0;

    // Sort tables by date for timeline
    const sortedTables = [...allTablesData].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    sortedTables.forEach(table => {
        const playerInstance = table.players.find(p => 
            p.name.toLowerCase() === playerData.name.toLowerCase()
        );

        if (playerInstance) {
            // Calculate result for this specific game
            const gameBuyIn = playerInstance.totalBuyIn || 0;
            const gameCashOutTotal = playerInstance.cashOuts?.reduce((sum, co) => sum + (Number(co.amount) || 0), 0) || 0;
            const gameCurrentChips = playerInstance.active ? (playerInstance.chips || 0) : 0;
            const gameTotalValue = gameCashOutTotal + gameCurrentChips;
            const gameNetResult = gameTotalValue - gameBuyIn;

            // Add to timeline
            cumulativeResult += gameNetResult;
            timelineData.push({
                gameDate: new Date(table.createdAt).toLocaleDateString('he-IL'), // Format date as needed
                netResult: gameNetResult,
                cumulativeResult: cumulativeResult
            });
        }
    });

    // Return only timeline data
    return { timeline: timelineData }; 

  }, [playerData, allTablesData]);

  // Calculate Win Rate
  const winRate = useMemo(() => {
      if (!playerData || playerData.tablesPlayed === 0) return 0;
      return (playerData.gamesWon / playerData.tablesPlayed) * 100;
  }, [playerData]);

  if (!playerData) return null; // Don't render if no player data

  // Helper to format numbers
  const formatStat = (value: number | undefined, decimals = 0): string => {
    if (value === undefined || value === null) return '-';
    return value.toFixed(decimals);
  };

  const formatResult = (value: number | undefined, decimals = 0): string => {
      if (value === undefined || value === null) return '-';
      const formatted = value.toFixed(decimals);
      return value > 0 ? `+${formatted}` : formatted;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { bgcolor: '#1e1e1e', color: 'white' } }}>
      <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
          Stats for {playerData.name} {playerData.nickname ? `(${playerData.nickname})` : ''}
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: '#121212' }}> {/* Slightly different background for content */}
        <Grid container spacing={3}>
            {/* Section 1: Timeline Graph */}
            <Grid item xs={12} lg={7}> {/* Adjusted grid size */}
                <Paper elevation={3} sx={{ p: 2, height: '100%', bgcolor: '#1e1e1e', color: 'white' }}>
                     <Typography variant="h6" gutterBottom>Performance Over Time</Typography>
                     <Box sx={{ height: 350 }}>
                        {/* Added Recharts Line Chart */} 
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                            data={detailedStats.timeline}
                            margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                            >
                            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                            <XAxis dataKey="gameDate" stroke="#ccc" />
                            <YAxis stroke="#ccc" />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#333', border: 'none' }} 
                                itemStyle={{ color: '#eee' }} 
                                labelStyle={{ color: '#ccc' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="netResult" name="Game Net" stroke="#8884d8" activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="cumulativeResult" name="Cumulative Net" stroke="#82ca9d" />
                            </LineChart>
                        </ResponsiveContainer>
                        {detailedStats.timeline.length === 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                <Typography color="text.secondary">No game data for timeline.</Typography>
                            </Box>
                        )}
                     </Box>
                </Paper>
            </Grid>

            {/* Section 2: Summary Stats */}
            <Grid item xs={12} lg={5}> {/* Adjusted grid size */}
                 <Paper elevation={3} sx={{ p: 2, height: '100%', bgcolor: '#1e1e1e', color: 'white' }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>Summary</Typography>
                    <Grid container spacing={1.5}> {/* Use grid for alignment */}
                        {/* Row 1 */}
                        <Grid item xs={6}><Typography variant="body1">Total Buy-In:</Typography></Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right">{formatStat(playerData.totalBuyIn)}</Typography></Grid>
                        <Grid item xs={6}><Typography variant="body1">Total Value:</Typography></Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right">{formatStat(playerData.totalCashOut)}</Typography></Grid>
                        {/* Row 2 */}
                        <Grid item xs={6}><Typography variant="body1" sx={{ fontWeight: 'bold', color: playerData.netResult >= 0 ? 'success.light' : 'error.light' }}>Net Result:</Typography></Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right" sx={{ fontWeight: 'bold', color: playerData.netResult >= 0 ? 'success.light' : 'error.light' }}>{formatResult(playerData.netResult)}</Typography></Grid>
                        {/* Row 3 */}
                        <Grid item xs={6}><Typography variant="body1">Tables Played:</Typography></Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right">{playerData.tablesPlayed}</Typography></Grid>
                        {/* Row 4 */}
                        <Grid item xs={6}><Typography variant="body1">Record (W-L):</Typography></Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right">{playerData.gamesWon}-{playerData.gamesLost}</Typography></Grid>
                        {/* Row 5 - Win Rate */}
                        <Grid item xs={6}><Typography variant="body1">Win Rate:</Typography></Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right" sx={{ color: winRate >= 50 ? 'success.light' : 'text.secondary' }}>{formatStat(winRate, 1)}%</Typography></Grid>
                        {/* Row 6 */}
                        <Grid item xs={6}><Typography variant="body1">Avg Buy-In:</Typography></Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right">{formatStat(playerData.avgBuyIn, 2)}</Typography></Grid>
                        {/* Row 7 */}
                        <Grid item xs={6}><Typography variant="body1">Avg Net/Game:</Typography></Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right" sx={{ color: playerData.avgNetResult >= 0 ? 'success.light' : 'error.light' }}>{formatResult(playerData.avgNetResult, 2)}</Typography></Grid>
                        {/* Row 8 */}
                        <Grid item xs={6}><Typography variant="body1" sx={{ color: 'success.main' }}>Largest Win:</Typography></Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right" sx={{ color: 'success.main' }}>{playerData.largestWin > 0 ? formatResult(playerData.largestWin) : '-'}</Typography></Grid>
                        {/* Row 9 */}
                        <Grid item xs={6}><Typography variant="body1" sx={{ color: 'error.main' }}>Largest Loss:</Typography></Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right" sx={{ color: 'error.main' }}>{playerData.largestLoss < 0 ? formatResult(playerData.largestLoss) : '-'}</Typography></Grid>
                    </Grid>
                 </Paper>
            </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#1e1e1e' }}> {/* Match background */}
        <Button onClick={onClose} sx={{ color: 'white' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlayerStatsDialog; 