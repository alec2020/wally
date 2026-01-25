'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowTopRightOnSquareIcon, KeyIcon, SparklesIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkFirstRun();
  }, []);

  const checkFirstRun = async () => {
    try {
      const response = await fetch('/api/ai-settings');
      const data = await response.json();
      // Show modal if no API key is configured
      if (!data.configured) {
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Failed to check AI settings:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!apiKey.trim()) {
      // Skip without saving
      setIsOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      await fetch('/api/ai-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openrouter_api_key: apiKey,
          model: 'openai/gpt-4o-mini', // Default to a good balance of cost/quality
        }),
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to save API key:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    setIsOpen(false);
  };

  if (isChecking) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <SparklesIcon className="h-6 w-6 text-primary" />
            Welcome to Wally
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Track your finances with AI-powered PDF statement parsing and smart categorization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">OpenRouter API Key</h3>
              <span className="text-xs text-muted-foreground">(optional)</span>
            </div>
            <p className="text-sm text-muted-foreground">
              To use AI features (PDF parsing, smart categorization), you&apos;ll need an OpenRouter API key.
              This gives you access to multiple AI models at low cost.
            </p>
            <div className="space-y-2">
              <Label htmlFor="api-key" className="sr-only">API Key</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="sk-or-v1-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Get an API key at openrouter.ai
              <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            </a>
          </div>

          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <p className="font-medium mb-2">Without an API key, you can still:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Manually add transactions</li>
              <li>Track accounts and balances</li>
              <li>View spending analytics</li>
              <li>Monitor net worth</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={handleSkip}>
            Skip for now
          </Button>
          <Button onClick={handleSaveAndContinue} disabled={isSaving}>
            {isSaving ? 'Saving...' : apiKey ? 'Save & Continue' : 'Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
