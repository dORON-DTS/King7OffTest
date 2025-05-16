import React from 'react';
import { Player } from '../types';
import { usePoker } from '../context/PokerContext';
import { Card, CardContent, Typography, Button, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';

interface PlayerCardProps {
  player: Player;
  tableId: string;
  onAddBuyIn: (playerId: string) => void;
  onCashOut: (playerId: string) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, tableId, onAddBuyIn, onCashOut }) => {
  const { removePlayer, disableShowMe } = usePoker();

  // Calculate total cashout
  const totalCashout = player.cashOuts.reduce((sum, cashout) => sum + cashout.amount, 0);
  // Calculate balance (totalCashout - totalBuyIn)
  const balance = totalCashout - (player.totalBuyIn ?? 0);

  return (
    <Card 
      sx={{ 
        width: '100%',
        mb: 2,
        opacity: player.showMe ? 1 : 0.5,
        transition: 'opacity 0.3s ease'
      }}
    >
      <CardContent>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Typography variant="h6">
            {player.name}
            {!player.active && <span style={{ fontSize: '0.8em', color: 'gray' }}> (Inactive)</span>}
          </Typography>
          <div style={{ display: 'flex', gap: '8px' }}>
            <IconButton
              size="small"
              onClick={() => player.showMe && disableShowMe(tableId, player.id)}
              sx={{
                color: player.showMe ? '#2196f3' : '#bdbdbd',
                '&:hover': {
                  backgroundColor: 'transparent'
                },
                cursor: player.showMe ? 'pointer' : 'not-allowed'
              }}
            >
              <VisibilityIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => removePlayer(tableId, player.id)}
              sx={{ 
                color: '#f44336',
                '&:hover': {
                  backgroundColor: 'transparent'
                }
              }}
            >
              <DeleteIcon />
            </IconButton>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <Typography color="textSecondary">Total Buy In: ${player.totalBuyIn ?? 0}</Typography>
          {!player.active && (
            <>
              <Typography color="textSecondary">Cashout: ${totalCashout}</Typography>
              <Typography color="textSecondary">Balance: ${balance}</Typography>
            </>
          )}
        </div>

        <Button 
          fullWidth 
          variant="text" 
          sx={{ mb: 2 }}
          onClick={() => {/* Handle view history */}}
        >
          VIEW HISTORY
        </Button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => onAddBuyIn(player.id)}
            disabled={!player.active || !player.showMe}
            startIcon={<span>$</span>}
          >
            BUY IN
          </Button>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => onCashOut(player.id)}
            disabled={!player.active || !player.showMe}
            startIcon={<span>⌂</span>}
          >
            CASH OUT
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlayerCard; 