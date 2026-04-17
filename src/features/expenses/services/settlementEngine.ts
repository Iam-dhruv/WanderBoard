import type { Settlement } from '@/features/expenses/types';

const EPSILON = 0.01;

function normalizeCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function settleGreedy(balances: Record<string, number>): Settlement[] {
  const nextBalances = { ...balances };
  const settlements: Settlement[] = [];

  while (true) {
    const debtors = Object.entries(nextBalances)
      .filter(([, amount]) => amount < -EPSILON)
      .sort((a, b) => a[1] - b[1]);
    const creditors = Object.entries(nextBalances)
      .filter(([, amount]) => amount > EPSILON)
      .sort((a, b) => b[1] - a[1]);

    if (debtors.length === 0 || creditors.length === 0) {
      break;
    }

    const [debtorId, debtorAmount] = debtors[0];
    const [creditorId, creditorAmount] = creditors[0];
    const transfer = normalizeCurrency(Math.min(Math.abs(debtorAmount), creditorAmount));

    settlements.push({
      fromUser: debtorId,
      toUser: creditorId,
      amount: transfer,
    });

    nextBalances[debtorId] = normalizeCurrency(nextBalances[debtorId] + transfer);
    nextBalances[creditorId] = normalizeCurrency(nextBalances[creditorId] - transfer);
  }

  return settlements;
}

function settleSmallGroupExact(balances: Record<string, number>): Settlement[] {
  const entries = Object.entries(balances).filter(([, amount]) => Math.abs(amount) > EPSILON);

  if (entries.length === 0) {
    return [];
  }

  const userIds = entries.map(([userId]) => userId);
  const debt = entries.map(([, amount]) => normalizeCurrency(amount));

  let best: Settlement[] | null = null;

  const dfs = (index: number, draft: Settlement[]) => {
    while (index < debt.length && Math.abs(debt[index]) <= EPSILON) {
      index += 1;
    }

    if (index === debt.length) {
      if (!best || draft.length < best.length) {
        best = draft.map((item) => ({ ...item }));
      }
      return;
    }

    if (best && draft.length >= best.length) {
      return;
    }

    const used = new Set<number>();

    for (let i = index + 1; i < debt.length; i += 1) {
      if (debt[index] * debt[i] >= 0) {
        continue;
      }

      const candidate = normalizeCurrency(debt[i]);
      if (used.has(Math.round(candidate * 100))) {
        continue;
      }
      used.add(Math.round(candidate * 100));

      const fromIndex = debt[index] < 0 ? index : i;
      const toIndex = debt[index] < 0 ? i : index;
      const transfer = Math.min(Math.abs(debt[index]), Math.abs(debt[i]));

      debt[i] = normalizeCurrency(debt[i] + debt[index]);
      const original = debt[index];
      debt[index] = 0;

      draft.push({
        fromUser: userIds[fromIndex],
        toUser: userIds[toIndex],
        amount: normalizeCurrency(transfer),
      });

      dfs(index + 1, draft);

      draft.pop();
      debt[index] = original;
      debt[i] = candidate;

      if (Math.abs(candidate + original) <= EPSILON) {
        break;
      }
    }
  };

  dfs(0, []);
  return best ?? settleGreedy(balances);
}

export function calculateSettlements(
  balances: Record<string, number>,
  memberCount: number,
): Settlement[] {
  if (memberCount <= 20) {
    return settleSmallGroupExact(balances);
  }

  return settleGreedy(balances);
}
