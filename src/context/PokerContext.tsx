import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useUser } from './UserContext';
import { Table, Player, BuyIn, CashOut, Group } from '../types';

export interface PokerContextType {
  tables: Table[];
  groups: Group[];
  getTable: (id: string) => Table | null;
  createTable: (name: string, smallBlind: number, bigBlind: number, groupId: string, location?: string, minimumBuyIn?: number) => Promise<any>;
  deleteTable: (id: string) => void;
  addPlayer: (tableId: string, name: string, chips: number, nickname?: string) => void;
  removePlayer: (tableId: string, playerId: string) => void;
  updatePlayerChips: (tableId: string, playerId: string, newChips: number) => void;
  addBuyIn: (tableId: string, playerId: string, amount: number) => void;
  deleteBuyIn: (tableId: string, buyinId: string) => Promise<void>;
  cashOut: (tableId: string, playerId: string, amount: number) => void;
  toggleTableStatus: (tableId: string, creatorId: string) => void;
  reactivatePlayer: (tableId: string, playerId: string) => void;
  disableShowMe: (tableId: string, playerId: string) => void;
  fetchTables: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  updateTable: (tableId: string, tableData: Partial<Table>) => Promise<void>;
  updatePlayerPayment: (tableId: string, playerId: string, paymentMethod: string, paymentComment: string) => Promise<void>;
}

const PokerContext = createContext<PokerContextType | undefined>(undefined);

export const PokerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
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
      let response;
      if (user) {
        const token = getAuthToken();
        if (!token) {
          throw new Error('Authentication required');
        }
        response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } else {
        response = await fetch(`${process.env.REACT_APP_API_URL}/api/public/tables`);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch tables: ${errorText}`);
      }
      
      const data = await response.json();
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
      setError(error.message || 'Failed to fetch tables');
      setTables([]); // Set to empty array on error
    } finally {
      setIsLoading(false);
    }
  }, [lastFetchTime, user]);

  // Fetch tables on mount (no polling)
  useEffect(() => {
    if (!userLoading && user) {
      fetchTables();
    }
    // No polling interval
  }, [fetchTables, user, userLoading]); // Add user and userLoading as dependencies

  // Fetch groups on mount
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          throw new Error('Authentication required');
        }

        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/groups`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch groups');
        }
        const groupsData = await response.json();
        setGroups(groupsData);
      } catch (err) {
        console.error('Error fetching groups:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };

    if (!userLoading && user) {
      fetchGroups();
    }
  }, [user, userLoading]);

  const createTable = async (name: string, smallBlind: number, bigBlind: number, groupId: string, location?: string, minimumBuyIn?: number) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          smallBlind,
          bigBlind,
          location,
          groupId,
          minimumBuyIn
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create table');
      }

      const newTable = await response.json();
      setTables(prevTables => [...prevTables, newTable]);
      setLastFetchTime(0); // Reset lastFetchTime to force a fresh fetch
    } catch (error) {
      console.error('Error creating table:', error);
      throw error;
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
      }
    } catch (error) {
      // אפשר להשאיר alert או setError אם צריך, אבל לא לוגים
    }
  };

  // Helper to show error for 2 seconds
  const showTransientError = (msg: string) => {
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
        const newBuyIn = await response.json();
        setTables(prevTables =>
          prevTables.map(table => {
            if (table.id !== tableId) {
              return table;
            }
            return {
              ...table,
              players: table.players.map(player => {
                if (player.id !== playerId) {
                  return player;
                }
                return {
                  ...player,
                  chips: (player.chips || 0) + amount,
                  totalBuyIn: (player.totalBuyIn || 0) + amount,
                  buyIns: [...player.buyIns, newBuyIn]
                };
              })
            };
          })
        );
      } else {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
        }
      }
    } catch (error) {
      console.error('Error adding buy-in:', error);
    }
  };

  const deleteBuyIn = async (tableId: string, buyinId: string) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}/buyins/${buyinId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        setTables(prevTables =>
          prevTables.map(table =>
            table.id === tableId
              ? {
                  ...table,
                  players: table.players.map(player => {
                    const foundBuyIn = player.buyIns.find(buyIn => buyIn.id === buyinId);
                    const buyInAmount = foundBuyIn ? foundBuyIn.amount || 0 : 0;
                    if (foundBuyIn) {
                      return {
                        ...player,
                        chips: (player.chips || 0) - buyInAmount,
                        totalBuyIn: (player.totalBuyIn || 0) - buyInAmount,
                        buyIns: player.buyIns.filter(buyIn => buyIn.id !== buyinId)
                      };
                    }
                    return player;
                  })
                }
              : table
          )
        );
      } else {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
        }
      }
    } catch (error) {
      console.error('Error deleting buy-in:', error);
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
        const newCashOut = await response.json();
        setTables(prevTables =>
          prevTables.map(table => {
            if (table.id !== tableId) {
              return table;
            }
            return {
              ...table,
              players: table.players.map(player => {
                if (player.id !== playerId) {
                  return player;
                }
                // Server sets active=false and chips=0
                return {
                  ...player,
                  active: false,
                  chips: 0,
                  cashOuts: [...player.cashOuts, newCashOut]
                };
              })
            };
          })
        );
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
    const newStatus = !table.isActive;
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isActive: newStatus })
      });
      if (response.ok) {
        const { isActive } = await response.json();
        setTables(prevTables =>
          prevTables.map(t =>
            t.id === tableId ? { ...t, isActive: isActive } : t
          )
        );
        // Fetch fresh data to ensure we have the latest player statuses and balances
        await fetchTables();
      } else {
        const errorData = await response.json();
        showTransientError(errorData.error || 'Failed to update table status');
      }
    } catch (error) {
      console.error('Error toggling table status:', error);
      showTransientError('Failed to update table status');
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
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const { active } = await response.json();
        setTables(prevTables =>
          prevTables.map(table =>
            table.id === tableId
              ? {
                  ...table,
                  players: table.players.map(player =>
                    player.id === playerId ? { ...player, active } : player
                  )
                }
              : table
          )
        );
      } else {
        const errorData = await response.json();
        showTransientError(errorData.error || 'Failed to reactivate player');
      }
    } catch (error) {
      console.error('Error reactivating player:', error);
      showTransientError('Failed to reactivate player');
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
        // Optimistically update the local state
        setTables(prevTables => prevTables.map(t =>
          t.id === tableId
            ? {
                ...t,
                players: t.players.map(p =>
                  p.id === playerId ? { ...p, showMe: !player.showMe } : p
                )
              }
            : t
        ));
        // Optionally, sync with server in the background
        fetchTables();
      } else {
        if (response.status === 401 || response.status === 403) {
          showTransientError('You do not have permission to perform this action');
        }
      }
    } catch (error) {
      console.error('Error toggling showMe:', error);
    }
  };

  const updateTable = async (tableId: string, tableData: Partial<Table>) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tables/${tableId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...tableData,
          createdAt: tableData.createdAt ? new Date(tableData.createdAt).toISOString() : undefined
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(`Failed to update table: ${errorData.error || response.statusText}`);
      }
      const updatedTable = await response.json();
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
    } catch (error) {
      // אפשר להשאיר alert או setError אם צריך, אבל לא לוגים
    }
  };

  const updatePlayerPayment = async (tableId: string, playerId: string, paymentMethod: string, paymentComment: string) => {
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Authentication required');
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/player/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tableId,
          playerId,
          payment_method: paymentMethod,
          payment_comment: paymentComment
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update payment method');
      }

      const updatedPlayer = await response.json();

      setTables(prevTables =>
        prevTables.map(table =>
          table.id === tableId
            ? {
                ...table,
                players: table.players.map(player =>
                  player.id === playerId ? { ...player, ...updatedPlayer } : player
                )
              }
            : table
        )
      );
    } catch (error) {
      console.error('Error updating payment method:', error);
      throw error;
    }
  };

  // Add getTable function
  const getTable = (id: string): Table | null => {
    return tables.find(table => table.id === id) || null;
  };

  const contextValue = {
    tables,
    groups,
    getTable,
    createTable,
    deleteTable,
    addPlayer,
    removePlayer,
    updatePlayerChips,
    addBuyIn,
    deleteBuyIn,
    cashOut,
    toggleTableStatus,
    reactivatePlayer,
    disableShowMe,
    fetchTables,
    isLoading,
    error,
    updateTable,
    updatePlayerPayment,
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