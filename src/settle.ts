import type { Crew, Expense, ExpenseType } from './types';

export type PersonTotal = { member: Crew; paid: number; share: number; balance: number };
export type Payment = { from: Crew; to: Crew; amount: number };
export type Settlement = {
  /** What the chosen expenses add up to, and how many of them there are. */
  total: number;
  count: number;
  /** Everyone's even share of the total. */
  share: number;
  people: PersonTotal[];
  /** Who pays whom so everyone ends up even, in as few payments as it takes. */
  payments: Payment[];
  /** Expenses left out because someone who isn't on the crew paid part of them. */
  skipped: number;
};

const cents = (dollars: number) => Math.round(dollars * 100);

/**
 * Splits the chosen kinds of expense evenly between everyone on the crew, then works out who owes whom.
 * An expense with several payers counts as paid evenly by them, and "All" means everyone paid an equal part.
 * An expense paid even partly by someone not on the crew ("Other", or a name not on the trip) is left out,
 * since there is no one on the trip to settle it with. Works in cents, so the payments add up exactly.
 */
export function settle(expenses: Expense[], crew: Crew[], kinds: ExpenseType[]): Settlement {
  const byName = new Map(crew.map((member) => [member.name.trim().toLowerCase(), member]));
  const paid = new Map<string, number>(crew.map((member) => [member.id, 0]));
  let total = 0;
  let count = 0;
  let skipped = 0;

  for (const expense of expenses) {
    if (!kinds.includes(expense.type)) continue;
    const payers = expense.paidBy.some((name) => name === 'All')
      ? crew
      : expense.paidBy.map((name) => byName.get(name.trim().toLowerCase()));
    if (payers.length === 0 || payers.some((member) => !member)) {
      skipped += 1;
      continue;
    }
    const amount = cents(expense.amount);
    total += amount;
    count += 1;
    // Each payer's part, with any leftover cent going to the first payers.
    payers.forEach((member, index) => {
      const part = Math.floor(amount / payers.length) + (index < amount % payers.length ? 1 : 0);
      paid.set(member!.id, (paid.get(member!.id) ?? 0) + part);
    });
  }

  const n = Math.max(1, crew.length);
  const people = crew.map((member, index) => {
    // An even share, with any leftover cent going to the first people on the crew.
    const share = Math.floor(total / n) + (index < total % n ? 1 : 0);
    const own = paid.get(member.id) ?? 0;
    return { member, paid: own, share, balance: own - share };
  });

  // Whoever is furthest behind pays whoever is furthest ahead, until everyone is even.
  const owing = people.filter((person) => person.balance < 0).map((person) => ({ member: person.member, left: -person.balance }));
  const owed = people.filter((person) => person.balance > 0).map((person) => ({ member: person.member, left: person.balance }));
  const payments: Payment[] = [];
  while (owing.length > 0 && owed.length > 0) {
    owing.sort((a, b) => b.left - a.left);
    owed.sort((a, b) => b.left - a.left);
    const from = owing[0];
    const to = owed[0];
    const amount = Math.min(from.left, to.left);
    payments.push({ from: from.member, to: to.member, amount: amount / 100 });
    from.left -= amount;
    to.left -= amount;
    if (from.left === 0) owing.shift();
    if (to.left === 0) owed.shift();
  }

  return {
    total: total / 100,
    count,
    share: total / n / 100,
    people: people.map((person) => ({ ...person, paid: person.paid / 100, share: person.share / 100, balance: person.balance / 100 })),
    payments,
    skipped,
  };
}
