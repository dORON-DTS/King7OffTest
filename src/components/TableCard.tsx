import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Table } from '../types';
import { useUser } from '../context/UserContext';

interface TableCardProps {
  table: Table;
  onEdit: (table: Table) => void;
  onDelete: (table: Table) => void;
}

export const TableCard: React.FC<TableCardProps> = ({
  table,
  onEdit,
  onDelete
}) => {
  const navigate = useNavigate();
  const { currentUser } = useUser();

  const handleClick = () => {
    navigate(`/tables/${table.id}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(table);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(table);
  };

  const isCreator = currentUser?.uid === table.creatorId;

  return (
    <div className="table-card" onClick={handleClick}>
      <div className="table-header">
        <h3>{table.name}</h3>
        {isCreator && (
          <div className="table-actions">
            <button onClick={handleEdit} className="edit-button">
              Edit
            </button>
            <button onClick={handleDelete} className="delete-button">
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="table-details">
        <div className="detail-item">
          <span className="label">Blinds:</span>
          <span className="value">
            {table.smallBlind}/{table.bigBlind}
          </span>
        </div>
        <div className="detail-item">
          <span className="label">Min Buy-In:</span>
          <span className="value">{table.minimumBuyIn}</span>
        </div>
        <div className="detail-item">
          <span className="label">Players:</span>
          <span className="value">{table.players.length}</span>
        </div>
        {table.location && (
          <div className="detail-item">
            <span className="label">Location:</span>
            <span className="value">{table.location}</span>
          </div>
        )}
        {table.food && (
          <div className="detail-item">
            <span className="label">Food:</span>
            <span className="value">{table.food}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = `
  .table-card {
    background: white;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: transform 0.2s;
  }

  .table-card:hover {
    transform: translateY(-2px);
  }

  .table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .table-header h3 {
    margin: 0;
    color: #333;
  }

  .table-actions {
    display: flex;
    gap: 8px;
  }

  .edit-button, .delete-button {
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .edit-button {
    background: none;
    border: 1px solid #4CAF50;
    color: #4CAF50;
  }

  .delete-button {
    background: none;
    border: 1px solid #f44336;
    color: #f44336;
  }

  .table-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
  }

  .label {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 4px;
  }

  .value {
    font-size: 1.1rem;
    color: #333;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .table-details {
      grid-template-columns: 1fr;
    }
  }
`; 