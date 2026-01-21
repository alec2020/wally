# Finance Tracker

A personal finance management application built with Next.js that helps you track transactions, monitor spending, and manage your net worth.

## Features

### Transaction Management
- **PDF Statement Import**: Upload bank and credit card statements (PDF) with AI-powered transaction extraction via OpenRouter
- **Manual Entry**: Add transactions manually with custom categories
- **Smart Categorization**: AI-assisted transaction categorization for accurate expense tracking
- **Search & Filter**: Find transactions by description, category, account, or date range

### Analytics & Insights
- **Spending Trends**: Visualize monthly spending patterns with interactive charts
- **Category Breakdown**: See where your money goes with pie charts and category summaries
- **Monthly Comparisons**: Track spending changes month-over-month
- **Expense Trends**: Monitor spending by category over time

### Net Worth Tracking
- **Assets Management**: Track bank accounts, investments, property, and other assets
- **Liabilities Tracking**: Monitor credit cards, loans, mortgages, and other debts
- **Net Worth History**: View your net worth progression over time
- **Breakdown Charts**: Visualize asset and liability composition

### Account Management
- **Multiple Accounts**: Support for checking, savings, credit cards, and investment accounts
- **Statement Coverage**: Track which months have uploaded statements to identify gaps
- **Missing Statements Alerts**: Get notified about missing statement periods

### User Experience
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Works on desktop and mobile devices
- **Local Data Storage**: All financial data stays on your machine (SQLite database)

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Database**: SQLite via better-sqlite3
- **UI Components**: Radix UI with Tailwind CSS
- **Charts**: Recharts
- **AI Integration**: OpenRouter API for PDF parsing and categorization

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/alec2020/finance-tracker.git
   cd finance-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Configuration

1. Navigate to **Settings** in the app
2. Add your OpenRouter API key for AI-powered PDF parsing
   - Get a key at [openrouter.ai/keys](https://openrouter.ai/keys)
3. Select your preferred AI model for transaction extraction

## Project Structure

```
├── app/                    # Next.js app router pages
│   ├── analytics/          # Spending analytics page
│   ├── api/                # API routes
│   ├── net-worth/          # Net worth tracking page
│   ├── settings/           # App settings page
│   ├── transactions/       # Transaction list page
│   └── upload/             # Statement upload page
├── components/             # React components
│   └── charts/             # Recharts visualization components
├── lib/                    # Utilities and database logic
│   ├── db.ts               # Database operations
│   ├── parsers/            # PDF parsing logic
│   └── utils.ts            # Helper functions
├── scripts/                # Utility scripts
│   └── eval/               # PDF parsing evaluation tools
└── schema.sql              # Database schema
```

## Privacy

All your financial data is stored locally in a SQLite database (`finance.db`). No data is sent to external servers except:
- PDF content sent to OpenRouter for AI extraction (when uploading statements)
- Transaction descriptions sent for AI categorization (optional)

The database file and PDF statements are excluded from git via `.gitignore`.

## License

MIT
