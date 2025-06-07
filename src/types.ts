export interface Player {
  id: string;
  name: string;
  nickname?: string;
  chips: number;
  active: boolean;
  buyIns: BuyIn[];
  totalBuyIn: number;
  cashOuts: CashOut[];
  showMe: boolean;
  tableId: string;
}

export interface BuyIn {
  id: string;
  playerId: string;
  amount: number;
  timestamp: Date;
}

export interface CashOut {
  id: string;
  playerId: string;
  amount: number;
  timestamp: Date;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  createdBy: string;
  isActive: boolean;
}

export interface Table {
  id: string;
  name: string;
  players: Player[];
  smallBlind: number;
  bigBlind: number;
  createdAt: Date;
  isActive: boolean;
  creatorId: string;
  location?: string;
  food?: string;
  groupId: string;
}

export interface PlayerStats {
  id: string;
  name: string;
  nickname?: string;
  totalBuyIn: number;
  totalCashOut: number;
  netResult: number;
  tablesPlayed: number;
  avgBuyIn: number;
  avgNetResult: number;
  largestWin: number;
  largestLoss: number;
  gamesWon: number;
  gamesLost: number;
}

export interface AggregatedPlayerStats extends PlayerStats {
  latestTableTimestamp: number | null;
}

export interface EditForm {
  name: string;
  smallBlind: string;
  bigBlind: string;
  location: string;
  date: Date;
  food: string;
  groupId: string;
}

export interface EditFormErrors {
  [key: string]: string | undefined;
  name?: string;
  smallBlind?: string;
  bigBlind?: string;
  location?: string;
  date?: string;
  food?: string;
}

export interface CreateTableFormData {
  name: string;
  smallBlind: string;
  bigBlind: string;
  location: string;
  groupId: string;
}

export interface CreateTableFunction {
  createTable: (name: string, smallBlind: number, bigBlind: number, groupId: string, location?: string) => void;
} 