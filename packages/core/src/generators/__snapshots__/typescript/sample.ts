export type OrderStatus = "pending" | "paid" | "shipped";

export type OrderItems = {
  tenant_id: string;
  order_number: number;
  line_number: number;
  quantity: number;
};

export type Orders = {
  tenant_id: string;
  order_number: number;
  status: OrderStatus;
  total: string;
  user_id: string;
};

export type Tags = {
  id: string;
};

export type Tenants = {
  id: string;
};

export type UserProfiles = {
  user_id: string;
  bio: string | null;
};

export type UserTags = {
  users_id: string;
  tags_id: string;
  assigned_at: string;
};

export type Users = {
  id: string;
  tenant_id: string;
  email: string;
  manager_id: string | null;
  created_at: string;
  location: unknown | null;
};
