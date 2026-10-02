CREATE TABLE [order_items] (
  [tenant_id] uniqueidentifier NOT NULL,
  [order_number] int NOT NULL,
  [line_number] int NOT NULL,
  [quantity] int NOT NULL DEFAULT 1,
  CONSTRAINT [order_items_pkey] PRIMARY KEY ([tenant_id], [order_number], [line_number])
);

CREATE TABLE [orders] (
  [tenant_id] uniqueidentifier NOT NULL,
  [order_number] int NOT NULL,
  [status] nvarchar(7) NOT NULL DEFAULT N'pending',
  [total] decimal(12, 2) NOT NULL DEFAULT 0.00,
  [user_id] bigint NOT NULL,
  CONSTRAINT [orders_pkey] PRIMARY KEY ([tenant_id], [order_number]),
  CONSTRAINT [orders_status_check] CHECK ([status] IN (N'pending', N'paid', N'shipped'))
);

CREATE TABLE [tags] (
  [id] uniqueidentifier NOT NULL,
  CONSTRAINT [tags_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [tenants] (
  [id] uniqueidentifier NOT NULL DEFAULT newid(),
  CONSTRAINT [tenants_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [user_profiles] (
  [user_id] bigint NOT NULL,
  [bio] nvarchar(max) NULL,
  CONSTRAINT [user_profiles_pkey] PRIMARY KEY ([user_id])
);

CREATE TABLE [user_tags] (
  [users_id] bigint NOT NULL,
  [tags_id] uniqueidentifier NOT NULL,
  [assigned_at] datetimeoffset NOT NULL DEFAULT sysdatetimeoffset(),
  CONSTRAINT [user_tags_pkey] PRIMARY KEY ([users_id], [tags_id])
);

CREATE TABLE [users] (
  [id] bigint IDENTITY(1, 1) NOT NULL,
  [tenant_id] uniqueidentifier NOT NULL,
  [email] nvarchar(255) NOT NULL,
  [manager_id] bigint NULL,
  [created_at] datetimeoffset NOT NULL DEFAULT sysdatetimeoffset(),
  [location] geometry(Point, 4326) NULL,
  CONSTRAINT [users_pkey] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [users_tenant_id_email_key] ON [users] ([tenant_id], [email]);

ALTER TABLE [order_items] ADD CONSTRAINT [order_items_tenant_id_order_number_fkey] FOREIGN KEY ([tenant_id], [order_number]) REFERENCES [orders] ([tenant_id], [order_number]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [orders] ADD CONSTRAINT [orders_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [users] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [user_profiles] ADD CONSTRAINT [user_profiles_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [users] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [user_tags] ADD CONSTRAINT [user_tags_users_id_fkey] FOREIGN KEY ([users_id]) REFERENCES [users] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [user_tags] ADD CONSTRAINT [user_tags_tags_id_fkey] FOREIGN KEY ([tags_id]) REFERENCES [tags] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [users] ADD CONSTRAINT [users_tenant_id_fkey] FOREIGN KEY ([tenant_id]) REFERENCES [tenants] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [users] ADD CONSTRAINT [users_manager_id_fkey] FOREIGN KEY ([manager_id]) REFERENCES [users] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
