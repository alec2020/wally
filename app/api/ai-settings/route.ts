import { NextRequest, NextResponse } from 'next/server';
import { getAllAiSettings, setAiSetting, deleteAiSetting, getAiSetting } from '@/lib/db';

// Mask API key for display (show first 8 and last 4 characters)
function maskApiKey(key: string): string {
  if (key.length <= 12) {
    return '****';
  }
  return key.substring(0, 8) + '...' + key.substring(key.length - 4);
}

export async function GET() {
  try {
    const settings = getAllAiSettings();

    // Mask the API key if it exists
    const maskedSettings: Record<string, string> = { ...settings };
    if (maskedSettings.openrouter_api_key) {
      maskedSettings.openrouter_api_key_masked = maskApiKey(maskedSettings.openrouter_api_key);
      // Don't send the actual key in GET response
      delete maskedSettings.openrouter_api_key;
    }

    return NextResponse.json({
      settings: maskedSettings,
      configured: !!settings.openrouter_api_key,
    });
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { openrouter_api_key, model } = body;

    // Update API key if provided (allow empty string to clear it)
    if (openrouter_api_key !== undefined) {
      if (openrouter_api_key === '') {
        deleteAiSetting('openrouter_api_key');
      } else {
        setAiSetting('openrouter_api_key', openrouter_api_key);
      }
    }

    // Update model if provided
    if (model !== undefined) {
      if (model === '') {
        deleteAiSetting('model');
      } else {
        setAiSetting('model', model);
      }
    }

    // Return updated settings (with masked API key)
    const settings = getAllAiSettings();
    const maskedSettings: Record<string, string> = { ...settings };
    if (maskedSettings.openrouter_api_key) {
      maskedSettings.openrouter_api_key_masked = maskApiKey(maskedSettings.openrouter_api_key);
      delete maskedSettings.openrouter_api_key;
    }

    return NextResponse.json({
      success: true,
      settings: maskedSettings,
      configured: !!settings.openrouter_api_key,
    });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    return NextResponse.json(
      { error: 'Failed to update AI settings' },
      { status: 500 }
    );
  }
}
