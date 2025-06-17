import React from 'react';
import { Player } from '../types';
import { usePoker } from '../context/PokerContext';
import { Card, CardContent, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, TextField } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PaymentIcon from '@mui/icons-material/Payment';

interface PlayerCardProps {
  player: Player;
  tableId: string;
  onAddBuyIn: (playerId: string) => void;
  onCashOut: (playerId: string) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, tableId, onAddBuyIn, onCashOut }) => {
  const { removePlayer, disableShowMe } = usePoker();

  // DEBUG LOG
  console.log('PlayerCard player:', player);

  // Calculate total cashout
  const totalCashout = player.cashOuts.reduce((sum, cashout) => sum + cashout.amount, 0);
  // Calculate balance (totalCashout - totalBuyIn)
  const balance = totalCashout - (player.totalBuyIn ?? 0);

  // State for payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [commentError, setCommentError] = React.useState('');

  const handleOpenPaymentDialog = () => {
    setPaymentDialogOpen(true);
  };
  const handleClosePaymentDialog = () => {
    setPaymentDialogOpen(false);
    setPaymentMethod('');
    setComment('');
    setCommentError('');
  };
  const handleSavePayment = () => {
    if (comment.length > 100) {
      setCommentError('Comment cannot exceed 100 characters');
      return;
    }
    // כאן אפשר להוסיף לוגיקה לשמירה בסטייט/שרת בעתיד
    handleClosePaymentDialog();
  };

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
          {/* כפתור אמצעי תשלום - רק לשחקן לא אקטיבי עם CASHOUT */}
          {!player.active && player.cashOuts.length > 0 && (
            <Button
              variant="outlined"
              fullWidth
              color="secondary"
              startIcon={<PaymentIcon />}
              onClick={handleOpenPaymentDialog}
            >
              PAYMENT METHOD
            </Button>
          )}
        </div>
        {/* דיאלוג אמצעי תשלום */}
        <Dialog open={paymentDialogOpen} onClose={handleClosePaymentDialog} maxWidth="xs" fullWidth>
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
            <Button onClick={handleClosePaymentDialog}>Cancel</Button>
            <Button onClick={handleSavePayment} disabled={!paymentMethod || !!commentError} variant="contained" color="primary">
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default PlayerCard; 