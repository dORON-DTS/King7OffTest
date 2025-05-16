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
  Paper,
  Tooltip
} from '@mui/material';
import { Table, PlayerStats } from '../types';
// Import Recharts components
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

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

  // --- Advanced Stats Calculations ---
  const advancedStats = useMemo(() => {
    if (!playerData || !allTablesData) return null;

    // ROI
    const roi = playerData.totalBuyIn > 0 ? (playerData.netResult / playerData.totalBuyIn) * 100 : null;

    // Gather all games for this player
    const games = allTablesData
      .filter(table => table.players.some(p => p.name.toLowerCase() === playerData.name.toLowerCase()))
      .map(table => {
        const player = table.players.find(p => p.name.toLowerCase() === playerData.name.toLowerCase());
        const buyIn = player?.totalBuyIn || 0;
        const cashOut = player?.cashOuts?.reduce((sum, co) => sum + (Number(co.amount) || 0), 0) || 0;
        const chips = player?.active ? (player?.chips || 0) : 0;
        const net = cashOut + chips - buyIn;
        return {
          table,
          date: new Date(table.createdAt),
          netResult: net,
          opponents: table.players.filter(p => p.name.toLowerCase() !== playerData.name.toLowerCase()),
        };
      });

    // Streaks
    let longestWin = 0, longestLose = 0, currentWin = 0, currentLose = 0, currentStreak = 0, currentType: 'win' | 'lose' | 'neutral' | null = null;
    let maxWin = 0, maxLose = 0;
    games.forEach(g => {
      if (g.netResult > 0) {
        currentWin++;
        currentLose = 0;
        if (currentWin > maxWin) maxWin = currentWin;
        currentType = 'win';
        currentStreak = currentWin;
      } else if (g.netResult < 0) {
        currentLose++;
        currentWin = 0;
        if (currentLose > maxLose) maxLose = currentLose;
        currentType = 'lose';
        currentStreak = currentLose;
      } else {
        currentWin = 0;
        currentLose = 0;
        currentType = 'neutral';
        currentStreak = 1;
      }
    });
    // Determine current streak (from last game)
    let lastGame = games[games.length - 1];
    let currentStreakType: string = 'None';
    let currentStreakCount = 0;
    if (lastGame) {
      if (lastGame.netResult > 0) {
        currentStreakType = 'Win';
        // Count backwards
        for (let i = games.length - 1; i >= 0 && games[i].netResult > 0; i--) currentStreakCount++;
      } else if (lastGame.netResult < 0) {
        currentStreakType = 'Lose';
        for (let i = games.length - 1; i >= 0 && games[i].netResult < 0; i--) currentStreakCount++;
      } else {
        currentStreakType = 'Neutral';
        for (let i = games.length - 1; i >= 0 && games[i].netResult === 0; i--) currentStreakCount++;
      }
    }

    // Best/Worst Enemy
    // For each opponent, sum net result in games played together
    const enemyMap: Record<string, { name: string; net: number; count: number; } > = {};
    games.forEach(g => {
      g.opponents.forEach(opp => {
        if (!enemyMap[opp.name]) enemyMap[opp.name] = { name: opp.name, net: 0, count: 0 };
        // For this game, the player's net result is split among all opponents (for fairness)
        enemyMap[opp.name].net += g.netResult / g.opponents.length;
        enemyMap[opp.name].count++;
      });
    });
    // Best Enemy: highest positive net, Worst Enemy: lowest negative net
    let bestEnemy: { name: string; net: number; count: number } | null = null;
    let worstEnemy: { name: string; net: number; count: number } | null = null;
    let totalProfit = games.reduce((sum, g) => sum + (g.netResult > 0 ? g.netResult : 0), 0);
    let totalLoss = games.reduce((sum, g) => sum + (g.netResult < 0 ? -g.netResult : 0), 0);
    Object.values(enemyMap).forEach(e => {
      if (e.net > 0 && (!bestEnemy || e.net > bestEnemy.net)) bestEnemy = e;
      if (e.net < 0 && (!worstEnemy || e.net < worstEnemy.net)) worstEnemy = e;
    });
    // Calculate percent
    let bestEnemyPercent = bestEnemy && totalProfit > 0 ? (bestEnemy.net / totalProfit) * 100 : null;
    let worstEnemyPercent = worstEnemy && totalLoss > 0 ? (-worstEnemy.net / totalLoss) * 100 : null;

    return {
      roi,
      maxWin,
      maxLose,
      currentStreakType,
      currentStreakCount,
      bestEnemy,
      bestEnemyPercent,
      worstEnemy,
      worstEnemyPercent,
    };
  }, [playerData, allTablesData]);

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
                            <RechartsTooltip 
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
                        <Grid item xs={6}>
                          <Tooltip title="Total amount of all buy-ins to the table">
                            <Typography variant="body1">Total Buy-In:</Typography>
                          </Tooltip>
                        </Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right">{formatStat(playerData.totalBuyIn)}</Typography></Grid>
                        <Grid item xs={6}>
                          <Tooltip title="Total amount of all cash-outs from the table">
                            <Typography variant="body1">Total Value:</Typography>
                          </Tooltip>
                        </Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right">{formatStat(playerData.totalCashOut)}</Typography></Grid>
                        {/* Row 2 */}
                        <Grid item xs={6}>
                          <Tooltip title="Total profit or loss (income minus expenses)">
                            <Typography variant="body1" sx={{ fontWeight: 'bold', color: playerData.netResult >= 0 ? 'success.light' : 'error.light' }}>Net Result:</Typography>
                          </Tooltip>
                        </Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right" sx={{ fontWeight: 'bold', color: playerData.netResult >= 0 ? 'success.light' : 'error.light' }}>{formatResult(playerData.netResult)}</Typography></Grid>
                        {/* Row 3 */}
                        <Grid item xs={6}>
                          <Tooltip title="Number of games the player participated in">
                            <Typography variant="body1">Tables Played:</Typography>
                          </Tooltip>
                        </Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right">{playerData.tablesPlayed}</Typography></Grid>
                        {/* Row 4 */}
                        <Grid item xs={6}>
                          <Tooltip title="Number of games won versus lost">
                            <Typography variant="body1">Record (W-L):</Typography>
                          </Tooltip>
                        </Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right">{playerData.gamesWon}-{playerData.gamesLost}</Typography></Grid>
                        {/* Row 5 - Win Rate */}
                        <Grid item xs={6}>
                          <Tooltip title="Percentage of games finished in profit">
                            <Typography variant="body1">Win Rate:</Typography>
                          </Tooltip>
                        </Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right" sx={{ color: winRate >= 50 ? 'success.light' : 'text.secondary' }}>{formatStat(winRate, 1)}%</Typography></Grid>
                        {/* Row 6 */}
                        <Grid item xs={6}>
                          <Tooltip title="Average buy-in amount per game">
                            <Typography variant="body1">Avg Buy-In:</Typography>
                          </Tooltip>
                        </Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right">{formatStat(playerData.avgBuyIn, 2)}</Typography></Grid>
                        {/* Row 7 */}
                        <Grid item xs={6}>
                          <Tooltip title="Average profit or loss per game">
                            <Typography variant="body1">Avg Net/Game:</Typography>
                          </Tooltip>
                        </Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right" sx={{ color: playerData.avgNetResult >= 0 ? 'success.light' : 'error.light' }}>{formatResult(playerData.avgNetResult, 2)}</Typography></Grid>
                        {/* Row 8 */}
                        <Grid item xs={6}>
                          <Tooltip title="Highest profit in a single game">
                            <Typography variant="body1" sx={{ color: 'success.main' }}>Largest Win:</Typography>
                          </Tooltip>
                        </Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right" sx={{ color: 'success.main' }}>{playerData.largestWin > 0 ? formatResult(playerData.largestWin) : '-'}</Typography></Grid>
                        {/* Row 9 */}
                        <Grid item xs={6}>
                          <Tooltip title="Highest loss in a single game">
                            <Typography variant="body1" sx={{ color: 'error.main' }}>Largest Loss:</Typography>
                          </Tooltip>
                        </Grid>
                        <Grid item xs={6}><Typography variant="body1" align="right" sx={{ color: 'error.main' }}>{playerData.largestLoss < 0 ? formatResult(playerData.largestLoss) : '-'}</Typography></Grid>
                    </Grid>
                 </Paper>
                 {/* Advanced Stats Section */}
                 {advancedStats && (
                   <Paper elevation={3} sx={{ p: 2, mt: 3, bgcolor: '#232323', color: 'white' }}>
                     <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>Advanced Stats</Typography>
                     <Grid container spacing={1.5}>
                       {/* ROI */}
                       <Grid item xs={7}>
                         <Tooltip title="Return on Investment - ratio of total profit to total buy-ins">
                           <Typography variant="body1">ROI (Return on Investment):</Typography>
                         </Tooltip>
                       </Grid>
                       <Grid item xs={5}><Typography variant="body1" align="right">{advancedStats.roi !== null ? `${advancedStats.roi > 0 ? '+' : ''}${Math.round(advancedStats.roi)}%` : '-'}</Typography></Grid>
                       {/* Longest Win Streak */}
                       <Grid item xs={7}>
                         <Tooltip title="Maximum number of consecutive winning games">
                           <Typography variant="body1">Longest Win Streak:</Typography>
                         </Tooltip>
                       </Grid>
                       <Grid item xs={5}><Typography variant="body1" align="right">{advancedStats.maxWin || '-'}</Typography></Grid>
                       {/* Longest Lose Streak */}
                       <Grid item xs={7}>
                         <Tooltip title="Maximum number of consecutive losing games">
                           <Typography variant="body1">Longest Lose Streak:</Typography>
                         </Tooltip>
                       </Grid>
                       <Grid item xs={5}><Typography variant="body1" align="right">{advancedStats.maxLose || '-'}</Typography></Grid>
                       {/* Current Streak */}
                       <Grid item xs={7}>
                         <Tooltip title="Current streak of wins or losses">
                           <Typography variant="body1">Current Streak:</Typography>
                         </Tooltip>
                       </Grid>
                       <Grid item xs={5}><Typography variant="body1" align="right">{advancedStats.currentStreakType !== 'None' ? `${advancedStats.currentStreakType} (${advancedStats.currentStreakCount})` : '-'}</Typography></Grid>
                       {/* Best Enemy */}
                       <Grid item xs={7}>
                         <Tooltip title="Player against whom total profit is highest, including percentage of total profit">
                           <Typography variant="body1">Best Enemy:</Typography>
                         </Tooltip>
                       </Grid>
                       <Grid item xs={5}><Typography variant="body1" align="right">
                         {advancedStats.bestEnemy ? `${advancedStats.bestEnemy.name} (${advancedStats.bestEnemy.net > 0 ? '+' : ''}${Math.round(advancedStats.bestEnemy.net)}${advancedStats.bestEnemyPercent !== null ? `, ${Math.round(advancedStats.bestEnemyPercent)}%` : ''})` : '-'}
                       </Typography></Grid>
                       {/* Worst Enemy */}
                       <Grid item xs={7}>
                         <Tooltip title="Player against whom total loss is highest, including percentage of total loss">
                           <Typography variant="body1">Worst Enemy:</Typography>
                         </Tooltip>
                       </Grid>
                       <Grid item xs={5}><Typography variant="body1" align="right">
                         {advancedStats.worstEnemy ? `${advancedStats.worstEnemy.name} (${Math.round(advancedStats.worstEnemy.net)},${advancedStats.worstEnemyPercent !== null ? ` ${Math.round(advancedStats.worstEnemyPercent)}%` : ''})` : '-'}
                       </Typography></Grid>
                     </Grid>
                   </Paper>
                 )}
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