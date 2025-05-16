import React, { useRef, useEffect } from 'react';
import { Box, Typography, Button, Grid, Card, CardContent, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { usePoker } from '../context/PokerContext';
import styles from './TablesList.module.css';

const TablesList: React.FC = () => {
  const navigate = useNavigate();
  const { tables, createTable } = usePoker();
  const gridRef = useRef();

  const handleCreateTable = () => {
    createTable('New Table', 1, 2);
  };

  // Log in render
  console.log('TablesList render');
  console.log('window.innerWidth:', window.innerWidth);
  console.log('tables:', tables);
  alert('TablesList loaded: ' + tables.length);

  // Log window width and grid width
  useEffect(() => {
    console.log('window.innerWidth (effect):', window.innerWidth);
    if (gridRef.current) {
      // @ts-ignore
      console.log('Grid offsetWidth:', gridRef.current.offsetWidth);
      // @ts-ignore
      console.log('Grid clientWidth:', gridRef.current.clientWidth);
      // @ts-ignore
      console.log('Grid scrollWidth:', gridRef.current.scrollWidth);
    }
    console.log('Number of tables:', tables.length);
    tables.forEach((table, i) => {
      console.log(`Table ${i}:`, table.name);
    });
  }, [tables]);

  return (
    <Box sx={{ 
      p: { xs: 1, md: 0 },
      mx: 0,
      bgcolor: '#121212', 
      minHeight: '100vh',
      maxWidth: 'none',
      width: '100vw',
      overflowX: 'hidden'
    }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 2, sm: 0 },
        mb: { xs: 3, sm: 4 },
        p: 2,
        borderRadius: 2,
        background: 'linear-gradient(45deg, rgba(25,118,210,0.1) 0%, rgba(25,118,210,0.2) 100%)',
        boxShadow: '0 0 20px rgba(25,118,210,0.3)',
        border: '1px solid rgba(25,118,210,0.3)'
      }}>
        <Typography 
          variant="h4" 
          sx={{ 
            color: 'white',
            textShadow: '0 0 10px rgba(25,118,210,0.5)',
            fontWeight: 'bold',
            textAlign: { xs: 'center', sm: 'left' },
            fontSize: { xs: '1.75rem', sm: '2.125rem' }
          }}
        >
          Poker Tables
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateTable}
          sx={{
            bgcolor: '#1976d2',
            color: 'white',
            '&:hover': {
              bgcolor: '#1565c0',
              boxShadow: '0 0 15px rgba(25,118,210,0.5)'
            },
            boxShadow: '0 0 10px rgba(25,118,210,0.3)',
            borderRadius: 2,
            px: 3,
            py: 1,
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          New Table
        </Button>
      </Box>

      <Box
        ref={gridRef}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fit, minmax(140px, 1fr))' },
          gap: 1,
          width: '100vw',
          p: 0,
          m: 0,
        }}
      >
        {tables.map((table) => (
          <Card
            key={table.id}
            sx={{
              minWidth: 0,
              minHeight: { xs: 280, md: 100 },
              maxHeight: { xs: 280, md: 120 },
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#1e1e1e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 1,
              transition: 'all 0.3s ease',
              overflow: 'hidden',
              '&:hover': {
                transform: 'translateY(-5px)',
                boxShadow: '0 0 20px rgba(25,118,210,0.3)',
                border: '1px solid rgba(25,118,210,0.5)'
              }
            }}
          >
            <CardContent sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              p: { xs: 1, md: 0.5 },
              gap: { xs: 1, md: 0.5 },
              minHeight: 0,
              maxHeight: 120,
              overflow: 'hidden'
            }}>
              <Typography
                variant="h6"
                sx={{
                  color: 'white',
                  fontSize: { xs: '1.1rem', md: '0.8rem' },
                  textAlign: 'center',
                  mb: { xs: 1, md: 0.5 }
                }}
              >
                {table.name}
              </Typography>
              <Chip
                label={table.isActive ? 'Active' : 'Inactive'}
                color={table.isActive ? 'success' : 'default'}
                sx={{
                  bgcolor: table.isActive ? '#4caf50' : '#757575',
                  color: 'white',
                  fontWeight: 'bold',
                  width: '100%',
                  fontSize: { xs: '0.9rem', md: '0.65rem' },
                  height: { xs: 28, md: 16 }
                }}
              />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: { xs: '0.9rem', md: '0.65rem' } }}>
                Small Blind: {table.smallBlind}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: { xs: '0.9rem', md: '0.65rem' } }}>
                Big Blind: {table.bigBlind}
              </Typography>
              {table.location && (
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: { xs: '0.9rem', md: '0.65rem' } }}>
                  Location: {table.location}
                </Typography>
              )}
              <Typography variant="body2" sx={{
                color: 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                fontSize: { xs: '0.9rem', md: '0.65rem' }
              }}>
                Players: {table.players.length}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate(`/tables/${table.id}`)}
                sx={{
                  color: '#1976d2',
                  borderColor: '#1976d2',
                  '&:hover': {
                    borderColor: '#1565c0',
                    bgcolor: 'rgba(25,118,210,0.1)'
                  },
                  width: '100%',
                  fontSize: { xs: '0.9rem', md: '0.65rem' },
                  minHeight: { xs: 32, md: 16 },
                  py: { xs: 0.5, md: 0.25 },
                  px: { xs: 1, md: 0.5 }
                }}
              >
                View Table
              </Button>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
};

export default TablesList; 