import { Player } from '../types';

export const sortPlayers = (a: Player, b: Player) => {
  // Calculate totals
  const aTotalBuyIn = a.buyIns.reduce((sum, buyIn) => sum + buyIn.amount, 0);
  const bTotalBuyIn = b.buyIns.reduce((sum, buyIn) => sum + buyIn.amount, 0);

  const aTotalCashOut = a.cashOuts.reduce((sum, cashOut) => sum + cashOut.amount, 0);
  const bTotalCashOut = b.cashOuts.reduce((sum, cashOut) => sum + cashOut.amount, 0);

  const aBalance = aTotalCashOut - aTotalBuyIn;
  const bBalance = bTotalCashOut - bTotalBuyIn;

  // 1. Balance (high to low)
  if (bBalance !== aBalance) {
    return bBalance - aBalance;
  }
  // 2. Total Buy-in (high to low)
  if (bTotalBuyIn !== aTotalBuyIn) {
    return bTotalBuyIn - aTotalBuyIn;
  }
  // 3. Total Cash-out (high to low)
  if (bTotalCashOut !== aTotalCashOut) {
    return bTotalCashOut - aTotalCashOut;
  }
  // 4. Name (A-Z)
  return a.name.localeCompare(b.name);
};

export {}; 