export enum UserRole {
  ADMIN = 'ADMIN',
  WAREHOUSE = 'WAREHOUSE',
  HR = 'HR',
  READ_ONLY = 'READ_ONLY',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LEFT = 'LEFT',
}

export enum ClothingCategory {
  PERSONALIZED = 'PERSONALIZED',
  POOL = 'POOL',
}

export enum ClothingCondition {
  NEW = 'NEW',
  GOOD = 'GOOD',
  WORN = 'WORN',
  RETIRED = 'RETIRED',
}

export enum ClothingStatus {
  AVAILABLE = 'AVAILABLE',
  ISSUED = 'ISSUED',
  IN_USE = 'IN_USE',
  RETURNED = 'RETURNED',
  RETIRED = 'RETIRED',
  LOST = 'LOST',
}

export enum TransactionType {
  ISSUE = 'ISSUE',
  RETURN = 'RETURN',
  TRANSFER = 'TRANSFER',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string | null;
  role: UserRole;
  status: EmployeeStatus;
}

export interface Employee {
  id: string;
  entraId: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string | null;
  status: EmployeeStatus;
  role: UserRole;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClothingType {
  id: string;
  name: string;
  description: string | null;
  category: string;
  availableSizes: string[];
  expectedLifespanMonths: number | null;
  imageUrl: string | null;
  isActive: boolean;
}

export interface ClothingItem {
  id: string;
  internalId: string;
  type: ClothingType;
  typeId: string;
  size: string;
  category: ClothingCategory;
  condition: ClothingCondition;
  status: ClothingStatus;
  imageUrl: string | null;
  qrCode: string;
  isPersonalized: boolean;
  personalizedFor?: Employee;
  currentEmployee?: Employee;
  purchaseDate: string | null;
  purchasePrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  employee: Employee;
  employeeId: string;
  clothingItem: ClothingItem;
  clothingItemId: string;
  issuedAt: string;
  issuedBy: Employee;
  conditionOnIssue: ClothingCondition;
  returnedAt: string | null;
  returnedBy?: Employee;
  conditionOnReturn: ClothingCondition | null;
  signatureUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> {
  items: T[];
  pagination: PaginationData;
}

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalClothingItems: number;
  itemsByStatus: Record<string, number>;
  itemsByCategory: Record<string, number>;
  recentTransactions: Transaction[];
  pendingReturns: Transaction[];
}
