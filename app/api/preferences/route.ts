import { NextRequest, NextResponse } from 'next/server';
import { getUserPreferences, addUserPreference, updateUserPreference, deleteUserPreference } from '@/lib/db';

export async function GET() {
  try {
    const preferences = getUserPreferences();
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instruction, source = 'user' } = body;

    if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
      return NextResponse.json(
        { error: 'Instruction text is required' },
        { status: 400 }
      );
    }

    const id = addUserPreference(instruction.trim(), source);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error adding preference:', error);
    return NextResponse.json(
      { error: 'Failed to add preference' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, instruction } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Preference ID is required' },
        { status: 400 }
      );
    }

    if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
      return NextResponse.json(
        { error: 'Instruction text is required' },
        { status: 400 }
      );
    }

    updateUserPreference(id, instruction.trim());

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating preference:', error);
    return NextResponse.json(
      { error: 'Failed to update preference' },
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
        { error: 'Preference ID is required' },
        { status: 400 }
      );
    }

    deleteUserPreference(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting preference:', error);
    return NextResponse.json(
      { error: 'Failed to delete preference' },
      { status: 500 }
    );
  }
}
