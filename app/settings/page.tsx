'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, Building2, Camera, Tag, X, Brain, Pencil, Check, Eye, EyeOff, Key, ExternalLink } from 'lucide-react';
import { useScreenshotMode } from '@/lib/screenshot-mode';
import { generateFakeAccounts } from '@/lib/fake-data';

interface Account {
  id: number;
  name: string;
  type: string;
  institution: string | null;
  balance: number;
  transactionCount: number;
}

interface Category {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
}

interface UserPreference {
  id: number;
  instruction: string;
  source: string;
  created_at: string;
  updated_at: string;
}

interface AiSettings {
  model?: string;
  openrouter_api_key_masked?: string;
  configured: boolean;
}

const PRESET_MODELS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'Latest GPT-4, great for complex categorization' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Cheaper GPT-4, good balance' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Excellent instruction following' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast and cheap' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', description: "Google's latest" },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'Open source, cheap' },
];

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [preferences, setPreferences] = useState<UserPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isPreferencesLoading, setIsPreferencesLoading] = useState(true);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('bank');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newPreference, setNewPreference] = useState('');
  const [editingPreferenceId, setEditingPreferenceId] = useState<number | null>(null);
  const [editingPreferenceText, setEditingPreferenceText] = useState('');
  const { isScreenshotMode, setScreenshotMode } = useScreenshotMode();

  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AiSettings>({ configured: false });
  const [isAiSettingsLoading, setIsAiSettingsLoading] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);
  const [aiSettingsSaved, setAiSettingsSaved] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
    fetchPreferences();
    fetchAiSettings();
  }, [isScreenshotMode]);

  const fetchAccounts = async () => {
    if (isScreenshotMode) {
      setAccounts(generateFakeAccounts() as Account[]);
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/accounts');
      const data = await response.json();
      setAccounts(data.accounts);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (isScreenshotMode) {
      setCategories([
        { id: 1, name: 'Income', color: '#22c55e', icon: null },
        { id: 2, name: 'Housing', color: '#3b82f6', icon: null },
        { id: 3, name: 'Transportation', color: '#f59e0b', icon: null },
        { id: 4, name: 'Groceries', color: '#84cc16', icon: null },
        { id: 5, name: 'Food', color: '#ef4444', icon: null },
        { id: 6, name: 'Shopping', color: '#8b5cf6', icon: null },
        { id: 7, name: 'Entertainment', color: '#ec4899', icon: null },
        { id: 8, name: 'Health', color: '#14b8a6', icon: null },
        { id: 9, name: 'Travel', color: '#06b6d4', icon: null },
        { id: 10, name: 'Financial', color: '#64748b', icon: null },
        { id: 11, name: 'Subscriptions', color: '#f97316', icon: null },
        { id: 12, name: 'Investing', color: '#10b981', icon: null },
        { id: 13, name: 'Other', color: '#94a3b8', icon: null },
      ]);
      setIsCategoriesLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  const fetchPreferences = async () => {
    if (isScreenshotMode) {
      setPreferences([
        {
          id: 1,
          instruction: 'Venmo payments to Katlyn over $1200 are rent (Housing / Rent + Utilities)',
          source: 'user',
          created_at: '2024-01-15T10:30:00Z',
          updated_at: '2024-01-15T10:30:00Z',
        },
        {
          id: 2,
          instruction: 'Robinhood transactions should be marked as transfers',
          source: 'user',
          created_at: '2024-01-14T09:00:00Z',
          updated_at: '2024-01-14T09:00:00Z',
        },
        {
          id: 3,
          instruction: '"Trader Joe\'s" should be categorized as Groceries / Supermarket',
          source: 'learned',
          created_at: '2024-01-13T15:00:00Z',
          updated_at: '2024-01-13T15:00:00Z',
        },
      ]);
      setIsPreferencesLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/preferences');
      const data = await response.json();
      setPreferences(data.preferences || []);
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setIsPreferencesLoading(false);
    }
  };

  const fetchAiSettings = async () => {
    if (isScreenshotMode) {
      setAiSettings({
        configured: true,
        model: 'openai/gpt-4o',
        openrouter_api_key_masked: 'sk-or-v1...4f2a',
      });
      setSelectedModel('openai/gpt-4o');
      setIsAiSettingsLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/ai-settings');
      const data = await response.json();
      setAiSettings(data);

      // Set the model selector state
      if (data.settings?.model) {
        const isPreset = PRESET_MODELS.some((m) => m.id === data.settings.model);
        if (isPreset) {
          setSelectedModel(data.settings.model);
          setIsCustomModel(false);
        } else {
          setIsCustomModel(true);
          setCustomModelInput(data.settings.model);
        }
      }
    } catch (error) {
      console.error('Failed to fetch AI settings:', error);
    } finally {
      setIsAiSettingsLoading(false);
    }
  };

  const handleSaveAiSettings = async () => {
    setIsSavingAiSettings(true);
    setAiSettingsSaved(false);

    try {
      const model = isCustomModel ? customModelInput : selectedModel;
      const body: { openrouter_api_key?: string; model?: string } = {};

      // Only include API key if user entered a new one
      if (apiKeyInput) {
        body.openrouter_api_key = apiKeyInput;
      }

      // Always include the model
      body.model = model;

      const response = await fetch('/api/ai-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        setAiSettings(data);
        setApiKeyInput(''); // Clear the input after saving
        setAiSettingsSaved(true);
        setTimeout(() => setAiSettingsSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save AI settings:', error);
    } finally {
      setIsSavingAiSettings(false);
    }
  };

  const handleClearApiKey = async () => {
    if (!confirm('Are you sure you want to remove your API key?')) return;

    try {
      const response = await fetch('/api/ai-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openrouter_api_key: '' }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiSettings(data);
        setApiKeyInput('');
      }
    } catch (error) {
      console.error('Failed to clear API key:', error);
    }
  };

  const handleModelChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomModel(true);
    } else {
      setIsCustomModel(false);
      setSelectedModel(value);
    }
  };

  const handleAddPreference = async () => {
    if (!newPreference.trim()) return;

    try {
      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: newPreference }),
      });

      if (response.ok) {
        setNewPreference('');
        fetchPreferences();
      }
    } catch (error) {
      console.error('Failed to add preference:', error);
    }
  };

  const handleDeletePreference = async (id: number) => {
    try {
      const response = await fetch(`/api/preferences?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchPreferences();
      }
    } catch (error) {
      console.error('Failed to delete preference:', error);
    }
  };

  const handleEditPreference = (pref: UserPreference) => {
    setEditingPreferenceId(pref.id);
    setEditingPreferenceText(pref.instruction);
  };

  const handleSavePreference = async () => {
    if (!editingPreferenceId || !editingPreferenceText.trim()) return;

    try {
      const response = await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPreferenceId,
          instruction: editingPreferenceText,
        }),
      });

      if (response.ok) {
        setEditingPreferenceId(null);
        setEditingPreferenceText('');
        fetchPreferences();
      }
    } catch (error) {
      console.error('Failed to save preference:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingPreferenceId(null);
    setEditingPreferenceText('');
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName }),
      });

      if (response.ok) {
        setNewCategoryName('');
        fetchCategories();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to add category');
      }
    } catch (error) {
      console.error('Failed to add category:', error);
    }
  };

  const handleDeleteCategory = async (id: number, confirmed: boolean = false) => {
    try {
      const url = confirmed
        ? `/api/categories?id=${id}&confirm=true`
        : `/api/categories?id=${id}`;
      const response = await fetch(url, { method: 'DELETE' });
      const data = await response.json();

      if (data.requiresConfirmation) {
        const confirmDelete = window.confirm(
          `"${data.categoryName}" is used by ${data.transactionCount} transaction${data.transactionCount === 1 ? '' : 's'}.\n\nDeleting this category will set those transactions to uncategorized.\n\nAre you sure you want to continue?`
        );
        if (confirmDelete) {
          await handleDeleteCategory(id, true);
        }
        return;
      }

      fetchCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const handleAddAccount = async () => {
    if (!newAccountName.trim()) return;

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAccountName,
          type: newAccountType,
        }),
      });

      if (response.ok) {
        setNewAccountName('');
        fetchAccounts();
      }
    } catch (error) {
      console.error('Failed to add account:', error);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'bank':
        return 'bg-blue-100 text-blue-800';
      case 'credit_card':
        return 'bg-purple-100 text-purple-800';
      case 'brokerage':
        return 'bg-primary/10 text-primary';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'bank':
        return 'Bank';
      case 'credit_card':
        return 'Credit Card';
      case 'brokerage':
        return 'Brokerage';
      default:
        return type;
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your accounts and preferences</p>
      </div>

      {/* Accounts Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Accounts
          </CardTitle>
          <CardDescription>
            Manage your bank accounts, credit cards, and investment accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Existing Accounts */}
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-16 bg-muted rounded"></div>
              <div className="h-16 bg-muted rounded"></div>
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No accounts yet. Add your first account or upload a statement.
            </p>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">{account.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getTypeColor(account.type)}>
                          {getTypeLabel(account.type)}
                        </Badge>
                        {account.institution && (
                          <span className="text-sm text-muted-foreground">
                            {account.institution}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(account.balance)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {account.transactionCount} transactions
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Add New Account */}
          <div className="space-y-4">
            <h4 className="font-medium">Add New Account</h4>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g., Chase Checking"
                />
              </div>
              <div className="w-40">
                <Label htmlFor="accountType">Type</Label>
                <select
                  id="accountType"
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="bank">Bank</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="brokerage">Brokerage</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddAccount}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Categories
          </CardTitle>
          <CardDescription>
            Manage transaction categories. AI will use these when categorizing new uploads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isCategoriesLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </div>
          ) : categories.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No categories found. Add your first category below.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border rounded-full text-sm bg-card"
                >
                  {category.color && (
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                  )}
                  <span>{category.name}</span>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="ml-1 p-0.5 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Add New Category */}
          <div className="space-y-4">
            <h4 className="font-medium">Add New Category</h4>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Pets, Education, Charity"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
              </div>
              <Button onClick={handleAddCategory}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categorization Preferences Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Categorization Preferences
          </CardTitle>
          <CardDescription>
            Write natural language rules for how transactions should be processed. The AI will follow these when categorizing new uploads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* AI Capabilities */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
            <p className="font-medium">The AI can:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-1">
              <li><span className="text-foreground">Assign categories</span> — "GEICO transactions are car insurance"</li>
              <li><span className="text-foreground">Assign subcategories</span> — "Transactions at Smith's are Groceries / Supermarket"</li>
              <li><span className="text-foreground">Mark as transfers</span> — "Payments to Amex are credit card payments, mark as transfers"</li>
              <li><span className="text-foreground">Apply conditions</span> — "Venmo to Katlyn above $1200 should be housing"</li>
              <li><span className="text-foreground">Clean merchant names</span> — "AMZN MKTP should be displayed as Amazon"</li>
            </ul>
          </div>

          {/* Add New Preference */}
          <div className="space-y-2">
            <Label htmlFor="newPreference">Add a preference</Label>
            <div className="flex gap-2">
              <Input
                id="newPreference"
                value={newPreference}
                onChange={(e) => setNewPreference(e.target.value)}
                placeholder='e.g., "Robinhood withdrawals are investments, mark as transfers"'
                onKeyDown={(e) => e.key === 'Enter' && handleAddPreference()}
                className="flex-1"
              />
              <Button onClick={handleAddPreference}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          <Separator />

          {/* Existing Preferences */}
          {isPreferencesLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-12 bg-muted rounded"></div>
              <div className="h-12 bg-muted rounded"></div>
            </div>
          ) : preferences.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No preferences yet. Add your first preference above, or correct a transaction's category to auto-learn preferences.
            </p>
          ) : (
            <div className="space-y-2">
              {preferences.map((pref) => (
                <div
                  key={pref.id}
                  className="flex items-start justify-between p-3 border rounded-lg bg-card gap-3"
                >
                  {editingPreferenceId === pref.id ? (
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={editingPreferenceText}
                        onChange={(e) => setEditingPreferenceText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSavePreference();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="flex-1"
                        autoFocus
                      />
                      <Button size="sm" onClick={handleSavePreference}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{pref.instruction}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={pref.source === 'user' ? 'default' : 'outline'} className="text-xs">
                            {pref.source === 'user' ? 'Custom' : 'Learned'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleEditPreference(pref)}
                          className="p-2 hover:bg-muted rounded-md transition-colors"
                          title="Edit this preference"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </button>
                        <button
                          onClick={() => handleDeletePreference(pref.id)}
                          className="p-2 hover:bg-muted rounded-md transition-colors"
                          title="Remove this preference"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {preferences.length > 0 && (
            <p className="text-xs text-muted-foreground">
              These preferences are sent to the AI when categorizing new transactions. "Learned" preferences are created automatically when you correct a transaction's category.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Screenshot Mode */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Screenshot Mode
          </CardTitle>
          <CardDescription>
            Display fake data for taking screenshots without revealing personal information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Screenshot Mode</p>
              <p className="text-sm text-muted-foreground">
                {isScreenshotMode
                  ? 'Currently showing fake data throughout the app'
                  : 'Currently showing your real financial data'}
              </p>
            </div>
            <Button
              variant={isScreenshotMode ? 'default' : 'outline'}
              onClick={() => setScreenshotMode(!isScreenshotMode)}
            >
              {isScreenshotMode ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            AI Configuration
          </CardTitle>
          <CardDescription>
            Configure OpenRouter for AI-powered transaction categorization.{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Get an API key <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isAiSettingsLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-muted rounded"></div>
              <div className="h-10 bg-muted rounded"></div>
            </div>
          ) : (
            <>
              {/* Status indicator */}
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    aiSettings.configured ? 'bg-green-500' : 'bg-amber-500'
                  }`}
                />
                <span className="text-sm">
                  {aiSettings.configured ? (
                    <>
                      AI categorization is <span className="font-medium text-green-600">enabled</span>
                    </>
                  ) : (
                    <>
                      AI categorization is <span className="font-medium text-amber-600">not configured</span> - using rule-based fallback
                    </>
                  )}
                </span>
              </div>

              {/* API Key Input */}
              <div className="space-y-2">
                <Label htmlFor="apiKey">OpenRouter API Key</Label>
                {aiSettings.configured && !apiKeyInput && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <span>Current key: {aiSettings.openrouter_api_key_masked}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearApiKey}
                      className="h-6 px-2 text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                )}
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={aiSettings.configured ? 'Enter new key to replace...' : 'sk-or-v1-...'}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <select
                  id="model"
                  value={isCustomModel ? 'custom' : selectedModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {PRESET_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.description}
                    </option>
                  ))}
                  <option value="custom">Custom model...</option>
                </select>

                {isCustomModel && (
                  <div className="mt-2">
                    <Input
                      value={customModelInput}
                      onChange={(e) => setCustomModelInput(e.target.value)}
                      placeholder="e.g., mistralai/mistral-large"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter any model ID from{' '}
                      <a
                        href="https://openrouter.ai/models"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        OpenRouter models
                      </a>
                    </p>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSaveAiSettings}
                  disabled={isSavingAiSettings || (!apiKeyInput && !aiSettings.configured)}
                >
                  {isSavingAiSettings ? 'Saving...' : 'Save Settings'}
                </Button>
                {aiSettingsSaved && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <Check className="h-4 w-4" /> Saved
                  </span>
                )}
              </div>

              <Separator />

              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Why OpenRouter?</strong> Access to many models (GPT-4, Claude, Llama, etc.) with a single API key.
                  You can choose the model that works best for your needs and budget.
                </p>
                <p>
                  Your preferences are included in the AI prompt to ensure consistent categorization according to your rules.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
