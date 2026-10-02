import { type PgTableExtraConfigValue, bigint, customType, foreignKey, integer, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "shipped"]);

export const geometryPoint4326Type = customType<{ data: unknown }>({
  dataType() {
    return "geometry(Point, 4326)";
  },
});

export const orderItems = pgTable(
  "order_items",
  {
    tenantId: uuid("tenant_id").notNull(),
    orderNumber: integer("order_number").notNull(),
    lineNumber: integer("line_number").notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "order_items_pkey", columns: [table.tenantId, table.orderNumber, table.lineNumber] }),
    foreignKey({ name: "order_items_tenant_id_order_number_fkey", columns: [table.tenantId, table.orderNumber], foreignColumns: [orders.tenantId, orders.orderNumber] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const orders = pgTable(
  "orders",
  {
    tenantId: uuid("tenant_id").notNull(),
    orderNumber: integer("order_number").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0.00"),
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "orders_pkey", columns: [table.tenantId, table.orderNumber] }),
    foreignKey({ name: "orders_user_id_fkey", columns: [table.userId], foreignColumns: [users.id] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "tags_pkey", columns: [table.id] }),
  ],
);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").notNull().defaultRandom(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "tenants_pkey", columns: [table.id] }),
  ],
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: bigint("user_id", { mode: "bigint" }).notNull(),
    bio: text("bio"),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "user_profiles_pkey", columns: [table.userId] }),
    foreignKey({ name: "user_profiles_user_id_fkey", columns: [table.userId], foreignColumns: [users.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const userTags = pgTable(
  "user_tags",
  {
    usersId: bigint("users_id", { mode: "bigint" }).notNull(),
    tagsId: uuid("tags_id").notNull(),
    assignedAt: timestamp("assigned_at", { precision: 6, withTimezone: true }).notNull().defaultNow(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "user_tags_pkey", columns: [table.usersId, table.tagsId] }),
    foreignKey({ name: "user_tags_users_id_fkey", columns: [table.usersId], foreignColumns: [users.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
    foreignKey({ name: "user_tags_tags_id_fkey", columns: [table.tagsId], foreignColumns: [tags.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const users = pgTable(
  "users",
  {
    id: bigint("id", { mode: "bigint" }).notNull().generatedByDefaultAsIdentity(),
    tenantId: uuid("tenant_id").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    managerId: bigint("manager_id", { mode: "bigint" }),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).notNull().defaultNow(),
    location: geometryPoint4326Type("location"),
  },
  (table): PgTableExtraConfigValue[] => [
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
