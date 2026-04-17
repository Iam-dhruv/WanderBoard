import type { ExpenseCategoryMap } from '@/features/expenses/types';

export const EXPENSE_CATEGORIES: ExpenseCategoryMap = {
  food: {
    label: 'Food',
    icon: '🍽️',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    subcategories: ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Groceries', 'Other'],
  },
  adventure: {
    label: 'Adventure',
    icon: '🎢',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    subcategories: ['Activities', 'Tours', 'Equipment rental', 'Entrance fees', 'Other'],
  },
  accommodation: {
    label: 'Accommodation',
    icon: '🏨',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    subcategories: ['Hotel', 'Hostel', 'Airbnb', 'Other'],
  },
  transport: {
    label: 'Transport',
    icon: '🚗',
    color: 'bg-green-100 text-green-700 border-green-200',
    subcategories: ['Flight', 'Bus', 'Train', 'Taxi', 'Rental', 'Fuel', 'Parking', 'Other'],
  },
  shopping: {
    label: 'Shopping',
    icon: '🛍️',
    color: 'bg-pink-100 text-pink-700 border-pink-200',
    subcategories: ['Souvenirs', 'Clothes', 'Gifts', 'Essentials', 'Other'],
  },
  entertainment: {
    label: 'Entertainment',
    icon: '🎭',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    subcategories: ['Nightlife', 'Shows', 'Movies', 'Games', 'Other'],
  },
  utilities: {
    label: 'Utilities',
    icon: '💡',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    subcategories: ['Phone', 'Internet', 'Laundry', 'Tips', 'Other'],
  },
  medical: {
    label: 'Medical',
    icon: '⚕️',
    color: 'bg-red-100 text-red-700 border-red-200',
    subcategories: ['Pharmacy', 'Doctor', 'Emergency', 'Other'],
  },
  other: {
    label: 'Other',
    icon: '📦',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    subcategories: ['Miscellaneous'],
  },
};

export const EXPENSE_CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as Array<keyof typeof EXPENSE_CATEGORIES>;
