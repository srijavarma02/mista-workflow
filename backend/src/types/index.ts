// ============================================================
// SHARED TYPE DEFINITIONS
// ============================================================

export type UserRole =
  | 'admin'
  | 'site_engineer'
  | 'project_manager'
  | 'stores_executive'
  | 'procurement'
  | 'qaqc'
  | 'finance';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  location?: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  manager_id?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
}

export interface InventoryItem {
  id: string;
  item_code: string;
  material_name: string;
  category: string;
  unit: string;
  available_qty: number;
  reserved_qty: number;
  reorder_level: number;
  warehouse_location?: string;
  unit_cost: number;
  hsn_code?: string;
  is_active: boolean;
}

export interface MaterialRequest {
  id: string;
  request_number: string;
  project_id: string;
  requester_id: string;
  material_master_id?: string;
  inventory_id?: string;
  material_name: string;
  material_code?: string;
  unit_of_measurement?: string;
  quantity: number;
  approved_quantity?: number;
  unit: string;
  required_date: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  remarks?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'fulfilled' | 'partially_fulfilled';
}

export interface MaterialMaster {
  id: string;
  material_code: string;
  material_name: string;
  category: string;
  unit_of_measurement: string;
  reorder_level: number;
  description?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface MRFApprovalHistory {
  id: string;
  material_request_id: string;
  approver_id: string;
  requested_quantity: number;
  approved_quantity: number;
  status: 'approved' | 'rejected';
  remarks?: string;
  approved_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  gst_number?: string;
  performance_score: number;
  is_active: boolean;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  status: 'draft' | 'sent' | 'confirmed' | 'partially_delivered' | 'delivered' | 'cancelled';
  total_amount: number;
  delivery_date?: string;
  notes?: string;
  created_by: string;
}

export interface GRN {
  id: string;
  grn_number: string;
  po_id: string;
  received_by: string;
  received_date: string;
  status: 'pending' | 'inspected' | 'accepted' | 'rejected' | 'partial';
}

export interface Inspection {
  id: string;
  grn_id: string;
  inspector_id: string;
  test_certificates_ok?: boolean;
  po_compliance_ok?: boolean;
  physical_condition?: 'good' | 'damaged' | 'partial';
  result: 'pass' | 'fail';
  remarks?: string;
  inspected_at: string;
}

export interface MaterialIssue {
  id: string;
  issue_number: string;
  material_request_id?: string;
  project_id?: string;
  issued_by: string;
  received_by: string;
  issue_date: string;
  status: 'pending' | 'approved' | 'issued' | 'cancelled';
}

export interface MaterialReturn {
  id: string;
  return_number: string;
  issue_id?: string;
  project_id?: string;
  returned_by: string;
  return_date: string;
  reason?: string;
  condition?: 'good' | 'damaged' | 'partial';
  status: 'pending' | 'received' | 'rejected';
}

export interface Invoice {
  id: string;
  invoice_number: string;
  po_id: string;
  grn_id?: string;
  vendor_id: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: 'pending' | 'verified' | 'approved' | 'paid' | 'rejected';
  file_url?: string;
  received_date?: string;
  due_date?: string;
  paid_date?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  channel: 'in_app' | 'email' | 'whatsapp' | 'all';
  is_read: boolean;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
}

export interface StockLedgerEntry {
  id: string;
  inventory_id: string;
  transaction_type: 'inward' | 'issue' | 'return' | 'adjustment' | 'reserved' | 'unreserved';
  quantity: number;
  balance_after: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

// API Response wrappers
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Request augmentation
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
