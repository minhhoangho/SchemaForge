import { type MySqlTableExtraConfigValue, bigint, char, customType, decimal, foreignKey, int, longtext, mysqlEnum, mysqlTable, primaryKey, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { relations, sql } from "drizzle-orm";

export const geometryPoint4326Type = customType<{ data: unknown }>({
  dataType() {
    return "geometry(Point, 4326)";
  },
});

export const orderItems = mysqlTable(
  "order_items",
  {
    tenantId: char("tenant_id", { length: 36 }).notNull(),
    orderNumber: int("order_number").notNull(),
    lineNumber: int("line_number").notNull(),
    quantity: int("quantity").notNull().default(1),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "order_items_pkey", columns: [table.tenantId, table.orderNumber, table.lineNumber] }),
    foreignKey({ name: "order_items_tenant_id_order_number_fkey", columns: [table.tenantId, table.orderNumber], foreignColumns: [orders.tenantId, orders.orderNumber] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const orders = mysqlTable(
  "orders",
  {
    tenantId: char("tenant_id", { length: 36 }).notNull(),
    orderNumber: int("order_number").notNull(),
    status: mysqlEnum("status", ["pending", "paid", "shipped"]).notNull().default("pending"),
    total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0.00"),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "orders_pkey", columns: [table.tenantId, table.orderNumber] }),
    foreignKey({ name: "orders_user_id_fkey", columns: [table.userId], foreignColumns: [users.id] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const tags = mysqlTable(
  "tags",
  {
    id: char("id", { length: 36 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "tags_pkey", columns: [table.id] }),
  ],
);

export const tenants = mysqlTable(
  "tenants",
  {
    id: char("id", { length: 36 }).notNull().default(sql.raw("(UUID())")),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "tenants_pkey", columns: [table.id] }),
  ],
);

export const userProfiles = mysqlTable(
  "user_profiles",
  {
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    bio: longtext("bio"),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "user_profiles_pkey", columns: [table.userId] }),
    foreignKey({ name: "user_profiles_user_id_fkey", columns: [table.userId], foreignColumns: [users.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const userTags = mysqlTable(
  "user_tags",
  {
    usersId: bigint("users_id", { mode: "bigint" }).notNull(),
    tagsId: char("tags_id", { length: 36 }).notNull(),
    assignedAt: timestamp("assigned_at", { fsp: 6 }).notNull().default(sql.raw("CURRENT_TIMESTAMP(6)")),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "user_tags_pkey", columns: [table.usersId, table.tagsId] }),
    foreignKey({ name: "user_tags_users_id_fkey", columns: [table.usersId], foreignColumns: [users.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
    foreignKey({ name: "user_tags_tags_id_fkey", columns: [table.tagsId], foreignColumns: [tags.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const users = mysqlTable(
  "users",
  {
    id: bigint("id", { mode: "bigint" }).notNull().autoincrement(),
    tenantId: char("tenant_id", { length: 36 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    managerId: bigint("manager_id", { mode: "bigint" }),
    createdAt: timestamp("created_at", { fsp: 6 }).notNull().default(sql.raw("CURRENT_TIMESTAMP(6)")),
    location: geometryPoint4326Type("location"),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "users_pkey", columns: [table.id] }),
    uniqueIndex("users_tenant_id_email_key").on(table.tenantId, table.email),
    foreignKey({ name: "users_tenant_id_fkey", columns: [table.tenantId], foreignColumns: [tenants.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
    foreignKey({ name: "users_manager_id_fkey", columns: [table.managerId], foreignColumns: [table.id] })
      .onDelete("set null")
      .onUpdate("no action"),
  ],
);

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  orders: one(orders, { fields: [orderItems.tenantId, orderItems.orderNumber], references: [orders.tenantId, orders.orderNumber] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  orderItems: many(orderItems),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  userTags: many(userTags),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}));

export const userTagsRelations = relations(userTags, ({ one }) => ({
  users: one(users, { fields: [userTags.usersId], references: [users.id] }),
  tags: one(tags, { fields: [userTags.tagsId], references: [tags.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  manager: one(users, { fields: [users.managerId], references: [users.id], relationName: "users_manager" }),
  orders: many(orders),
  userProfiles: one(userProfiles),
  userTags: many(userTags),
  users: many(users, { relationName: "users_manager" }),
}));
