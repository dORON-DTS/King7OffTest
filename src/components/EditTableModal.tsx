import React, { useState } from 'react';
import { usePoker } from '../context/PokerContext';
import { Table } from '../types';

interface EditTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: Table;
}

export const EditTableModal: React.FC<EditTableModalProps> = ({
  isOpen,
  onClose,
  table
}) => {
  const { updateTable } = usePoker();
  const [name, setName] = useState(table.name);
  const [smallBlind, setSmallBlind] = useState(table.smallBlind.toString());
  const [bigBlind, setBigBlind] = useState(table.bigBlind.toString());
  const [minimumBuyIn, setMinimumBuyIn] = useState(table.minimumBuyIn?.toString() || '');
  const [location, setLocation] = useState(table.location || '');
  const [food, setFood] = useState(table.food || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const smallBlindNum = parseFloat(smallBlind);
      const bigBlindNum = parseFloat(bigBlind);
      const minimumBuyInNum = parseFloat(minimumBuyIn);

      if (isNaN(smallBlindNum) || isNaN(bigBlindNum) || isNaN(minimumBuyInNum)) {
        throw new Error('Please enter valid numbers for blinds and minimum buy-in');
      }

      if (smallBlindNum <= 0 || bigBlindNum <= 0 || minimumBuyInNum <= 0) {
        throw new Error('Blinds and minimum buy-in must be greater than 0');
      }

      if (bigBlindNum <= smallBlindNum) {
        throw new Error('Big blind must be greater than small blind');
      }

      if (minimumBuyInNum < bigBlindNum * 2) {
        throw new Error('Minimum buy-in must be at least 2 big blinds');
      }

      const updatedTable: Table = {
        ...table,
        name,
        smallBlind: smallBlindNum,
        bigBlind: bigBlindNum,
        minimumBuyIn: minimumBuyInNum,
        location: location || undefined,
        food: food || undefined
      };

      await updateTable(updatedTable);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update table');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Edit Table</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Table Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Enter table name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="smallBlind">Small Blind</label>
            <input
              type="number"
              id="smallBlind"
              value={smallBlind}
              onChange={(e) => setSmallBlind(e.target.value)}
              required
              min="0"
              step="0.01"
              placeholder="Enter small blind amount"
            />
          </div>

          <div className="form-group">
            <label htmlFor="bigBlind">Big Blind</label>
            <input
              type="number"
              id="bigBlind"
              value={bigBlind}
              onChange={(e) => setBigBlind(e.target.value)}
              required
              min="0"
              step="0.01"
              placeholder="Enter big blind amount"
            />
          </div>

          <div className="form-group">
            <label htmlFor="minimumBuyIn">Minimum Buy-In</label>
            <input
              type="number"
              id="minimumBuyIn"
              value={minimumBuyIn}
              onChange={(e) => setMinimumBuyIn(e.target.value)}
              required
              min="0"
              step="0.01"
              placeholder="Enter minimum buy-in amount"
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Location (Optional)</label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter table location"
            />
          </div>

          <div className="form-group">
            <label htmlFor="food">Food (Optional)</label>
            <input
              type="text"
              id="food"
              value={food}
              onChange={(e) => setFood(e.target.value)}
              placeholder="Enter food details"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="submit-button" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = `
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    padding: 24px;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
  }

  .modal-content h2 {
    margin: 0 0 24px 0;
    color: #333;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    color: #666;
  }

  .form-group input {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  .error-message {
    color: #f44336;
    margin-bottom: 16px;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }

  .cancel-button, .submit-button {
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .cancel-button {
    background: none;
    border: 1px solid #ddd;
    color: #666;
  }

  .submit-button {
    background-color: #4CAF50;
    border: none;
    color: white;
  }

  .submit-button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }

  .submit-button:hover:not(:disabled) {
    background-color: #45a049;
  }

  @media (max-width: 768px) {
    .modal-content {
      width: 95%;
      margin: 16px;
    }
  }
`; 