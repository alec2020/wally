// Fake data for screenshot mode

const FAKE_MERCHANTS = [
  'Whole Foods Market',
  'Amazon.com',
  'Netflix',
  'Spotify',
  'Uber',
  'Starbucks',
  'Target',
  'Costco',
  'Home Depot',
  'Apple',
  'Google Cloud',
  'Airbnb',
  'Delta Airlines',
  'Marriott Hotels',
  'Chevron Gas',
  'Trader Joes',
  'CVS Pharmacy',
  'Walgreens',
  'Best Buy',
  'Nike',
];

const CATEGORIES = [
  'Groceries',
  'Shopping',
  'Entertainment',
  'Transportation',
  'Food',
  'Subscriptions',
  'Travel',
  'Health',
  'Housing',
  'Other',
];

function randomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(daysBack: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date.toISOString().split('T')[0];
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateFakeTransactions(count: number = 150) {
  const transactions = [];

  for (let i = 1; i <= count; i++) {
    const isIncome = Math.random() < 0.15;
    const merchant = randomItem(FAKE_MERCHANTS);
    const category = isIncome ? 'Income' : randomItem(CATEGORIES);

    transactions.push({
      id: i,
      date: randomDate(90),
      description: isIncome
        ? `Direct Deposit - ${['Acme Corp', 'Tech Industries', 'Consulting LLC'][Math.floor(Math.random() * 3)]}`
        : `${merchant} #${Math.floor(Math.random() * 9000) + 1000}`,
      amount: isIncome
        ? randomAmount(3000, 8000)
        : -randomAmount(5, 500),
      category,
      merchant: isIncome ? null : merchant,
      is_transfer: false,
      account_id: Math.random() < 0.5 ? 1 : 2,
      account_name: Math.random() < 0.5 ? 'Chase Checking' : 'Amex Gold',
    });
  }

  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function generateFakeAccounts() {
  return [
    { id: 1, name: 'Chase Checking', type: 'bank', institution: 'Chase', balance: 12450.00, transactionCount: 89 },
    { id: 2, name: 'Amex Gold', type: 'credit_card', institution: 'American Express', balance: -2340.50, transactionCount: 61 },
    { id: 3, name: 'Fidelity Brokerage', type: 'brokerage', institution: 'Fidelity', balance: 85000.00, transactionCount: 12 },
  ];
}

export function generateFakeAnalytics() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return {
    spendingByCategory: [
      { category: 'Housing', total: -2200 },
      { category: 'Groceries', total: -850 },
      { category: 'Transportation', total: -420 },
      { category: 'Food', total: -380 },
      { category: 'Entertainment', total: -250 },
      { category: 'Shopping', total: -620 },
      { category: 'Subscriptions', total: -95 },
      { category: 'Health', total: -180 },
    ],
    currentMonthSpendingByCategory: [
      { category: 'Housing', total: -2200 },
      { category: 'Groceries', total: -450 },
      { category: 'Food', total: -280 },
      { category: 'Shopping', total: -320 },
      { category: 'Transportation', total: -180 },
      { category: 'Entertainment', total: -120 },
      { category: 'Subscriptions', total: -95 },
      { category: 'Health', total: -85 },
    ],
    monthlyTotals: Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return {
        month,
        income: randomAmount(6000, 9000),
        expenses: -randomAmount(4000, 6500),
        invested: randomAmount(500, 2000),
      };
    }).reverse(),
    monthlyExpensesByCategory: CATEGORIES.slice(0, 6).flatMap(category =>
      Array.from({ length: 6 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return {
          month,
          category,
          total: randomAmount(100, 800), // Positive values - real DB uses ABS()
        };
      })
    ),
    totalBalance: 95109.50,
    // Net worth = accounts (97450) + assets (41600) - liabilities not excluded (22000) = 117050
    currentNetWorth: 117050,
    netWorthUpdatedAt: currentMonth,
    stats: {
      totalTransactions: 162,
      totalIncome: 24500,
      totalExpenses: -18995,
      uncategorized: 8,
    },
    currentMonth: {
      income: 7250,
      expenses: -4995,
      invested: 1500,
      net: 2255,
      expensesTrend: -8.5,
    },
    topMerchants: [
      { merchant: 'Whole Foods Market', total: -485.32, count: 8 },
      { merchant: 'Amazon.com', total: -412.87, count: 12 },
      { merchant: 'Target', total: -287.45, count: 5 },
      { merchant: 'Costco', total: -256.90, count: 2 },
      { merchant: 'Starbucks', total: -89.50, count: 15 },
    ],
    periodAnalytics: {
      totalSpent: 4995,
      avgDailySpend: 166.50,
      daysInPeriod: 30,
      largestExpense: {
        description: 'Rent Payment',
        amount: -2200,
        date: `${currentMonth}-01`,
        category: 'Housing',
      },
    },
    subscriptions: generateFakeSubscriptions(),
    savingsRate: generateFakeSavingsRate(),
    merchantFrequency: generateFakeMerchantFrequency(),
    spendingTrend6Months: Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return {
        month,
        income: randomAmount(6000, 9000),
        expenses: -randomAmount(4000, 6500),
      };
    }),
  };
}

export function generateFakeSubscriptions() {
  const now = new Date();
  const currentMonth = now.toISOString().split('T')[0];

  return [
    { merchant: 'Netflix', avgAmount: 15.99, monthlyAmount: 15.99, frequency: 12, billingCycle: 'monthly' as const, lastSeen: currentMonth },
    { merchant: 'Spotify', avgAmount: 10.99, monthlyAmount: 10.99, frequency: 12, billingCycle: 'monthly' as const, lastSeen: currentMonth },
    { merchant: 'Adobe Creative Cloud', avgAmount: 54.99, monthlyAmount: 54.99, frequency: 8, billingCycle: 'monthly' as const, lastSeen: currentMonth },
    { merchant: 'Amazon Prime', avgAmount: 139.00, monthlyAmount: 11.58, frequency: 1, billingCycle: 'annual' as const, lastSeen: currentMonth },
    { merchant: 'iCloud+', avgAmount: 2.99, monthlyAmount: 2.99, frequency: 12, billingCycle: 'monthly' as const, lastSeen: currentMonth },
    { merchant: 'YouTube Premium', avgAmount: 13.99, monthlyAmount: 13.99, frequency: 10, billingCycle: 'monthly' as const, lastSeen: currentMonth },
    { merchant: 'ChatGPT Plus', avgAmount: 20.00, monthlyAmount: 20.00, frequency: 6, billingCycle: 'monthly' as const, lastSeen: currentMonth },
    { merchant: 'CLEAR', avgAmount: 189.00, monthlyAmount: 15.75, frequency: 1, billingCycle: 'annual' as const, lastSeen: currentMonth },
  ];
}

export function generateFakeSavingsRate() {
  const income = randomAmount(6000, 9000);
  const expenses = randomAmount(4000, 6500);
  const saved = income - expenses;
  const rate = Math.round((saved / income) * 1000) / 10;

  return {
    current: rate,
    income,
    expenses,
    saved,
  };
}

export function generateFakeMerchantFrequency() {
  const now = new Date();
  const recentDate = now.toISOString().split('T')[0];
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return [
    { merchant: 'Starbucks', visits: 18, totalSpent: 107.50, avgPerVisit: 5.97, lastVisit: recentDate },
    { merchant: 'Amazon.com', visits: 12, totalSpent: 412.87, avgPerVisit: 34.41, lastVisit: weekAgo },
    { merchant: 'Whole Foods Market', visits: 8, totalSpent: 485.32, avgPerVisit: 60.67, lastVisit: recentDate },
    { merchant: 'Gas Station', visits: 7, totalSpent: 287.50, avgPerVisit: 41.07, lastVisit: weekAgo },
    { merchant: 'Target', visits: 5, totalSpent: 287.45, avgPerVisit: 57.49, lastVisit: monthAgo },
    { merchant: 'Uber', visits: 5, totalSpent: 89.75, avgPerVisit: 17.95, lastVisit: weekAgo },
    { merchant: 'Chipotle', visits: 4, totalSpent: 52.80, avgPerVisit: 13.20, lastVisit: recentDate },
    { merchant: 'CVS Pharmacy', visits: 3, totalSpent: 67.24, avgPerVisit: 22.41, lastVisit: monthAgo },
    { merchant: 'Costco', visits: 2, totalSpent: 256.90, avgPerVisit: 128.45, lastVisit: monthAgo },
    { merchant: 'Home Depot', visits: 2, totalSpent: 189.32, avgPerVisit: 94.66, lastVisit: monthAgo },
  ];
}

export function generateFakeSnapshots() {
  const snapshots = [];
  const netWorthHistory = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

    const checkingBalance = 10000 + (5 - i) * 500 + randomAmount(-200, 200);
    const brokerageBalance = 75000 + (5 - i) * 2000 + randomAmount(-500, 500);

    snapshots.push({
      id: i * 2 + 1,
      month,
      account_id: 1,
      balance: checkingBalance,
      account_name: 'Chase Checking',
      account_type: 'bank',
    });

    snapshots.push({
      id: i * 2 + 2,
      month,
      account_id: 3,
      balance: brokerageBalance,
      account_name: 'Fidelity Brokerage',
      account_type: 'brokerage',
    });

    netWorthHistory.push({
      month,
      balance: checkingBalance + brokerageBalance,
    });
  }

  return {
    snapshots: snapshots.reverse(),
    latestBalances: [
      { account_id: 1, account_name: 'Chase Checking', account_type: 'bank', balance: 12450, month: netWorthHistory[netWorthHistory.length - 1].month },
      { account_id: 3, account_name: 'Fidelity Brokerage', account_type: 'brokerage', balance: 85000, month: netWorthHistory[netWorthHistory.length - 1].month },
    ],
    netWorthHistory,
    currentNetWorth: 97450,
  };
}

export function generateFakeAssets() {
  return [
    {
      id: 1,
      name: '2022 Honda Accord',
      type: 'vehicle' as const,
      purchase_price: 28000,
      purchase_date: '2022-03-15',
      current_value: 25000,
      notes: null,
    },
    {
      id: 2,
      name: 'Rolex Submariner',
      type: 'jewelry' as const,
      purchase_price: 9500,
      purchase_date: '2021-06-01',
      current_value: 12500,
      notes: null,
    },
    {
      id: 3,
      name: 'Vintage Wine Collection',
      type: 'collectible' as const,
      purchase_price: 3200,
      purchase_date: '2020-11-20',
      current_value: 4100,
      notes: null,
    },
  ];
}

export function generateFakeLiabilities() {
  return [
    {
      id: 1,
      name: 'Tesla Model 3 Loan',
      type: 'auto_loan' as const,
      original_amount: 45000,
      current_balance: 32000,
      interest_rate: 4.9,
      monthly_payment: 650,
      start_date: '2023-06-15',
      exclude_from_net_worth: true,
      notes: null,
    },
    {
      id: 2,
      name: 'Student Loan',
      type: 'student_loan' as const,
      original_amount: 35000,
      current_balance: 22000,
      interest_rate: 4.5,
      monthly_payment: 320,
      start_date: '2019-09-01',
      exclude_from_net_worth: false,
      notes: null,
    },
  ];
}
