import { NextRequest, NextResponse } from 'next/server';
import { getCategories, createCategory, deleteCategory, getCategoryById, getTransactionCountByCategory, clearCategoryFromTransactions } from '@/lib/db';

export async function GET() {
  try {
    const categories = getCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color, icon } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const id = createCategory(name.trim(), color, icon);
    return NextResponse.json({ id, name: name.trim(), color, icon });
  } catch (error: unknown) {
    console.error('Failed to create category:', error);

    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const confirm = searchParams.get('confirm') === 'true';

    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      );
    }

    const categoryId = parseInt(id, 10);
    const category = getCategoryById(categoryId);

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Check how many transactions use this category
    const transactionCount = getTransactionCountByCategory(category.name);

    // If transactions exist and not confirmed, return the count for confirmation
    if (transactionCount > 0 && !confirm) {
      return NextResponse.json({
        requiresConfirmation: true,
        transactionCount,
        categoryName: category.name,
      });
    }

    // Clear the category from all affected transactions
    if (transactionCount > 0) {
      clearCategoryFromTransactions(category.name);
    }

    // Delete the category
    deleteCategory(categoryId);

    return NextResponse.json({
      success: true,
      transactionsCleared: transactionCount,
    });
  } catch (error) {
    console.error('Failed to delete category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
