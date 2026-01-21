import { NextRequest, NextResponse } from 'next/server';
import {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getTotalAssetsValue,
  Asset,
  AssetType,
} from '@/lib/db';

export async function GET() {
  try {
    const assets = getAssets();
    const totalValue = getTotalAssetsValue();

    return NextResponse.json({
      assets,
      totalValue,
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, purchase_price, purchase_date, current_value, notes } = body;

    if (!name || !type || current_value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, current_value' },
        { status: 400 }
      );
    }

    const validTypes: AssetType[] = ['vehicle', 'jewelry', 'real_estate', 'collectible', 'other'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid asset type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const id = createAsset({
      name,
      type,
      purchase_price: purchase_price ?? null,
      purchase_date: purchase_date ?? null,
      current_value,
      notes: notes ?? null,
    });

    const asset = getAssetById(id);

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error('Error creating asset:', error);
    return NextResponse.json(
      { error: 'Failed to create asset' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing asset id' },
        { status: 400 }
      );
    }

    const existing = getAssetById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    if (updates.type) {
      const validTypes: AssetType[] = ['vehicle', 'jewelry', 'real_estate', 'collectible', 'other'];
      if (!validTypes.includes(updates.type)) {
        return NextResponse.json(
          { error: `Invalid asset type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    updateAsset(id, updates);
    const asset = getAssetById(id);

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error('Error updating asset:', error);
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing asset id' },
        { status: 400 }
      );
    }

    const existing = getAssetById(parseInt(id, 10));
    if (!existing) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    deleteAsset(parseInt(id, 10));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting asset:', error);
    return NextResponse.json(
      { error: 'Failed to delete asset' },
      { status: 500 }
    );
  }
}
