import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useUser } from './UserContext';
import { Table, Player, BuyIn, CashOut } from '../types';

interface PokerContextType {
  tables: Table[];
  getTable: (id: string) => Table | undefined;
  createTable: (name: string, smallBlind: number, bigBlind: number, location?: string) => void;
  deleteTable: (tableId: string) => void;
  addPlayer: (tableId: string, name: string, chips: number, nickname?: string) => void;
  removePlayer: (tableId: string, playerId: string) => void;
  updatePlayerChips: (tableId: string, playerId: string, newChips: number) => void;
  addBuyIn: (tableId: string, playerId: string, amount: number) => void;
  cashOut: (tableId: string, playerId: string, amount: number) => void;
  toggleTableStatus: (tableId: string, creatorId: string) => void;
  reactivatePlayer: (tableId: string, playerId: string) => void;
  disableShowMe: (tableId: string, playerId: string) => void;
  fetchTables: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  updateTable: (
    tableId: string,
    data: { name: string; smallBlind: number; bigBlind: number; location: string; createdAt: Date }
  ) => Promise<void>;
}

const PokerContext = createContext<PokerContextType | undefined>(undefined);

export const PokerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [transientError, setTransientError] = useState<string | null>(null);
  const CACHE_DURATION = 2000; // 2 seconds cache
  const { user, isLoading: userLoading } = useUser();

  const getAuthToken = () => {
    return localStorage.getItem('token');
  };

  const fetchTables = useCallback(async () => {
    // Check if we should fetch based on cache
    const now = Date.now();
    if (now - lastFetchTime < CACHE_DURATION) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      console.log('Fetching tables from:', `${process.env.REACT_APP_API_URL}/api/tables`); // Debug log
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Response status:', response.status); // Debug log
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText); // Debug log
        throw new Error(`Failed to fetch tables: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Received data:', data); // Debug log
      
      // Ensure each table has a players array and parse dates
      const tablesWithPlayers = data.map((table: Table) => ({
        ...table,
        createdAt: new Date(table.createdAt),
        players: (table.players || []).map((player: Player) => ({
          ...player,
          buyIns: (player.buyIns || []).map((buyIn: BuyIn) => ({ ...buyIn, timestamp: new Date(buyIn.timestamp) }))
        }))
      }));
      setTables(tablesWithPlayers);
      setLastFetchTime(now);
    } catch (error: any) {
      console.error('Error fetching tables:', error);
      setError(error.message || 'Failed to fetch tables');
      setTables([]); // Set to empty array on error
    } finally {
      setIsLoading(false);
    }
  }, [lastFetchTime]);

  // Fetch tables on mount (no polling)
  useEffect(() => {
    if (!userLoading && user) {
      fetchTables();
    }
    // No polling interval
  }, [fetchTables, user, userLoading]); // Add user and userLoading as dependencies

  const createTable = async (name: string, smallBlind: number, bigBlind: number, location?: string) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const tableData = {
        id: uuidv4(),
        name,
        smallBlind,
        bigBlind,
        location,
        isActive: true,
        createdAt: new Date().toISOString(),
        creatorId: uuidv4(),
      };
      
      console.log('Creating table with data:', tableData); // Debug log
      console.log('Sending to:', `${process.env.REACT_APP_API_URL}/api/tables`); // Debug log
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(tableData),
      });

      console.log('Create table response status:', response.status); // Debug log
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
          return;
        }
        const errorText = await response.text();
        console.error('Error response:', errorText); // Debug log
        throw new Error(`Failed to create table: ${errorText}`);
      }

      await fetchTables();
    } catch (error) {
      console.error('Error creating table:', error);
    }
  };

  const deleteTable = async (tableId: string) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setTables(prev => prev.filter(table => table.id !== tableId));
      } else {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
          return;
        }
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error deleting table:', error);
    }
  };

  // Helper to show error for 2 seconds
  const showTransientError = (msg: string) => {
    console.log('showTransientError', msg);
    setTransientError(msg);
    setTimeout(() => setTransientError(null), 2000);
  };

  const addPlayer = async (tableId: string, name: string, chips: number, nickname?: string) => {
    const newPlayer = {
      id: uuidv4(),
      name,
      nickname,
      chips,
      totalBuyIn: chips,
      active: true,
      showMe: true,
      buyIns: [{
        id: uuidv4(),
        playerId: uuidv4(), // This will be replaced by the server response
        amount: chips,
        timestamp: new Date().toISOString()
      }],
      cashOuts: []
    };

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newPlayer)
      });
      
      if (response.ok) {
        const addedPlayer = await response.json();
        setTables(prev => prev.map(table => 
          table.id === tableId
            ? { ...table, players: [...table.players, addedPlayer] }
            : table
        ));
      } else {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
        }
      }
    } catch (error) {
      console.error('Error adding player:', error);
    }
  };

  const removePlayer = async (tableId: string, playerId: string) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}/players/${playerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        setTables(prev => prev.map(table =>
          table.id === tableId
            ? { ...table, players: table.players.filter(p => p.id !== playerId) }
            : table
        ));
      } else {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
        }
      }
    } catch (error) {
      console.error('Error removing player:', error);
    }
  };

  const updatePlayerChips = async (tableId: string, playerId: string, newChips: number) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}/players/${playerId}/chips`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chips: newChips })
      });
      
      if (response.ok) {
        setTables(prev => prev.map(table =>
          table.id === tableId
            ? {
                ...table,
                players: table.players.map(player =>
                  player.id === playerId
                    ? { ...player, chips: newChips }
                    : player
                )
              }
            : table
        ));
      } else {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
        }
      }
    } catch (error) {
      console.error('Error updating player chips:', error);
    }
  };

  const addBuyIn = async (tableId: string, playerId: string, amount: number) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}/players/${playerId}/buyins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount })
      });
      
      if (response.ok) {
        await fetchTables();
      } else {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
        }
      }
    } catch (error) {
      console.error('Error adding buy-in:', error);
    }
  };

  const cashOut = async (tableId: string, playerId: string, amount: number) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}/players/${playerId}/cashouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount })
      });
      
      if (response.ok) {
        await fetchTables();
      } else {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
        }
      }
    } catch (error) {
      console.error('Error cashing out:', error);
    }
  };

  const toggleTableStatus = async (tableId: string, creatorId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !table.isActive })
      });
      
      if (response.ok) {
        await fetchTables();
      } else {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
        }
      }
    } catch (error) {
      console.error('Error toggling table status:', error);
    }
  };

  const reactivatePlayer = async (tableId: string, playerId: string) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}/players/${playerId}/reactivate`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        await fetchTables();
      } else {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
        }
      }
    } catch (error) {
      console.error('Error reactivating player:', error);
    }
  };

  const disableShowMe = async (tableId: string, playerId: string) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Get current player's showMe value
      const table = tables.find(t => t.id === tableId);
      const player = table?.players.find(p => p.id === playerId);
      if (!table || !player) return;

      // Toggle the showMe value
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}/players/${playerId}/showme`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ showMe: !player.showMe })
      });
      
      if (response.ok) {
        await fetchTables();
      } else {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
        }
      }
    } catch (error) {
      console.error('Error toggling showMe:', error);
    }
  };

  const updateTable = async (
    tableId: string,
    data: { name: string; smallBlind: number; bigBlind: number; location: string; createdAt: Date }
  ) => {
    console.log('[UPDATE TABLE] Attempting to update table:', { tableId, data });
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      console.log('[UPDATE TABLE] Sending request to:', `${process.env.REACT_APP_API_URL}/api/tables/${tableId}`);
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: data.name,
          smallBlind: Number(data.smallBlind),
          bigBlind: Number(data.bigBlind),
          location: data.location || '',
          createdAt: data.createdAt.toISOString()
        }),
      });

      console.log('[UPDATE TABLE] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        console.error('[UPDATE TABLE] Server error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`Failed to update table: ${errorData.error || response.statusText}`);
      }

      const updatedTable = await response.json();
      console.log('[UPDATE TABLE] Table updated successfully:', updatedTable);
      
      // Update tables state with the correct date format
      setTables(prevTables => 
        prevTables.map(table => 
          table.id === tableId ? { 
            ...table, 
            ...updatedTable,
            createdAt: new Date(updatedTable.createdAt) 
          } : table
        )
      );

      return { ...updatedTable, createdAt: new Date(updatedTable.createdAt) };
    } catch (error: any) {
      console.error('[UPDATE TABLE] Error updating table:', error);
      throw error;
    }
  };

  // Add getTable function
  const getTable = (id: string): Table | undefined => {
    return tables.find(table => table.id === id);
  };

  const contextValue = {
    tables,
    getTable,
    createTable,
    deleteTable,
    addPlayer,
    removePlayer,
    updatePlayerChips,
    addBuyIn,
    cashOut,
    toggleTableStatus,
    reactivatePlayer,
    disableShowMe,
    fetchTables,
    isLoading,
    error,
    updateTable,
  };

  return (
    <PokerContext.Provider value={contextValue}>
      {children}
      {transientError && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(220, 53, 69, 0.95)',
          color: 'white',
          padding: '12px 32px',
          borderRadius: 8,
          fontSize: 18,
          zIndex: 9999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          {transientError}
        </div>
      )}
    </PokerContext.Provider>
  );
};

export const usePoker = () => {
  const context = useContext(PokerContext);
  if (context === undefined) {
    throw new Error('usePoker must be used within a PokerProvider');
  }
  return context;
}; 