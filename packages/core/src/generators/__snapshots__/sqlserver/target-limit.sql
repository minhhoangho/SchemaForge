CREATE TABLE [all_types] (
  [id] int NOT NULL,
  [smallint_value] smallint NOT NULL DEFAULT -32768,
  [integer_value] int NOT NULL DEFAULT 42,
  [bigint_value] bigint NOT NULL DEFAULT 9223372036854775807,
  [decimal_value] decimal(12, 2) NOT NULL DEFAULT 1234567890.12,
  [real_value] real NOT NULL DEFAULT 1.5e10,
  [double_value] float(53) NOT NULL DEFAULT -2.25,
  [boolean_value] bit NOT NULL DEFAULT 1,
  [char_value] nchar(3) NOT NULL DEFAULT N'abc',
  [varchar_value] nvarchar(20) NOT NULL DEFAULT N'it''s',
  [text_value] nvarchar(max) NOT NULL DEFAULT N'a\b',
  [uuid_value] uniqueidentifier NOT NULL DEFAULT N'123e4567-e89b-12d3-a456-426614174000',
  [date_value] date NOT NULL DEFAULT N'2026-01-02',
  [time_value] time NOT NULL DEFAULT N'12:34:56.789',
  [timestamp_value] datetime2 NOT NULL DEFAULT N'2026-01-02T03:04:05',
  [timestamptz_value] datetimeoffset NOT NULL DEFAULT N'2026-01-02T03:04:05.123+07:00',
  [timestamp_now] datetime2 NOT NULL DEFAULT sysdatetime(),
  [timestamptz_now] datetimeoffset NOT NULL DEFAULT sysdatetimeoffset(),
  [json_value] nvarchar(max) NOT NULL DEFAULT N'{"note":"it''s"}',
  [binary_value] varbinary(max) NULL,
  [enum_value] nvarchar(8) NOT NULL DEFAULT N'active',
  CONSTRAINT [all_types_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [all_types_enum_value_check] CHECK ([enum_value] IN (N'active', N'inactive'))
);

CREATE TABLE [auto_integer] (
  [id] int IDENTITY(1, 1) NOT NULL,
  CONSTRAINT [auto_integer_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [auto_smallint] (
  [id] smallint IDENTITY(1, 1) NOT NULL,
  CONSTRAINT [auto_smallint_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [auto_trailing] (
  [a] int NOT NULL,
  [id] bigint IDENTITY(1, 1) NOT NULL,
  CONSTRAINT [auto_trailing_pkey] PRIMARY KEY ([a], [id])
);

CREATE TABLE [auto_wide_key] (
  [id] bigint IDENTITY(1, 1) NOT NULL,
  [code_a] nvarchar(700) NOT NULL,
  [code_b] nvarchar(700) NOT NULL,
  CONSTRAINT [auto_wide_key_pkey] PRIMARY KEY ([id], [code_a], [code_b])
);

CREATE TABLE [binary_keys] (
  [id] int NOT NULL,
  [hash] varbinary(max) NOT NULL,
  CONSTRAINT [binary_keys_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [char_unique] (
  [id] int NOT NULL,
  [code] nchar(300) NOT NULL,
  CONSTRAINT [char_unique_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [char_unique_code_key] UNIQUE ([code])
);

CREATE TABLE [custom_required] (
  [id] int NOT NULL,
  [payload] tsvector NOT NULL,
  CONSTRAINT [custom_required_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [custom_values] (
  [id] int NOT NULL,
  [shape] geometry(Point, 4326) NULL,
  [address] inet NOT NULL DEFAULT N'127.0.0.1',
  CONSTRAINT [custom_values_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [cycle_a] (
  [id] int NOT NULL,
  [b_id] int NULL,
  CONSTRAINT [cycle_a_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [cycle_b] (
  [id] int NOT NULL,
  [a_id] int NULL,
  CONSTRAINT [cycle_b_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [default_children] (
  [id] int NOT NULL,
  [parent_id] int NOT NULL DEFAULT 0,
  CONSTRAINT [default_children_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [default_parents] (
  [id] int NOT NULL,
  CONSTRAINT [default_parents_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [five_part_keys] (
  [id] int NOT NULL,
  [q1] nvarchar(700) NOT NULL,
  [q2] nvarchar(700) NOT NULL,
  [q3] nvarchar(700) NOT NULL,
  [q4] nvarchar(700) NOT NULL,
  [q5] nvarchar(700) NOT NULL,
  CONSTRAINT [five_part_keys_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [five_part_refs] (
  [id] int NOT NULL,
  [q1] nvarchar(700) NOT NULL,
  [q2] nvarchar(700) NOT NULL,
  [q3] nvarchar(700) NOT NULL,
  [q4] nvarchar(700) NOT NULL,
  [q5] nvarchar(700) NOT NULL,
  CONSTRAINT [five_part_refs_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [fixed_keys] (
  [code] nvarchar(500) NOT NULL,
  CONSTRAINT [fixed_keys_pkey] PRIMARY KEY ([code])
);

CREATE TABLE [fixed_refs] (
  [id] int NOT NULL,
  [fixed_code] nvarchar(500) NOT NULL,
  CONSTRAINT [fixed_refs_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [fixed_unique] (
  [id] int NOT NULL,
  [code] nvarchar(900) NOT NULL,
  CONSTRAINT [fixed_unique_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [fixed_unique_code_key] UNIQUE ([code])
);

CREATE TABLE [flags] (
  [id] int NOT NULL,
  [status] nvarchar(8) NULL,
  [is_primary] bit NOT NULL,
  CONSTRAINT [flags_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [flags_is_primary_key] UNIQUE ([is_primary]),
  CONSTRAINT [flags_status_check] CHECK ([status] IN (N'active', N'inactive'))
);

CREATE TABLE [four_part_keys] (
  [id] int NOT NULL,
  [p1] nvarchar(192) NOT NULL,
  [p2] nvarchar(192) NOT NULL,
  [p3] nvarchar(192) NOT NULL,
  [p4] nvarchar(192) NOT NULL,
  CONSTRAINT [four_part_keys_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [fractional_times] (
  [id] int NOT NULL,
  [starts_at] time NOT NULL DEFAULT N'12:34:56.1234567',
  [created_at] datetime2 NOT NULL DEFAULT N'2026-01-02T03:04:05.1234567',
  CONSTRAINT [fractional_times_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [json_keys] (
  [doc] nvarchar(max) NOT NULL
);

CREATE TABLE [json_refs] (
  [id] int NOT NULL,
  [doc] nvarchar(max) NOT NULL,
  CONSTRAINT [json_refs_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [json_unique] (
  [id] int NOT NULL,
  [doc] nvarchar(max) NOT NULL,
  CONSTRAINT [json_unique_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [leaf] (
  [id] int NOT NULL,
  [left_id] int NOT NULL,
  [right_id] int NOT NULL,
  CONSTRAINT [leaf_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [left] (
  [id] int NOT NULL,
  [root_id] int NOT NULL,
  CONSTRAINT [left_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [long_comments] (
  [id] int NOT NULL,
  [note] nvarchar(max) NOT NULL,
  [surrogate_note] nvarchar(max) NOT NULL,
  CONSTRAINT [long_comments_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [long_unique] (
  [id] int NOT NULL,
  [code] nvarchar(1000) NOT NULL,
  CONSTRAINT [long_unique_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [long_unique_code_key] UNIQUE ([code])
);

CREATE TABLE [no_key_rows] (
  [note] nvarchar(max) NOT NULL,
  [value] int NOT NULL
);

CREATE TABLE [nullable_unique] (
  [id] int NOT NULL,
  [code] nvarchar(20) NULL,
  [alt_code] nvarchar(20) NULL,
  CONSTRAINT [nullable_unique_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [nullable_unique_code_key] UNIQUE ([code])
);

CREATE TABLE [nullable_unique_refs] (
  [id] int NOT NULL,
  [code] nvarchar(20) NULL,
  CONSTRAINT [nullable_unique_refs_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [oversized_types] (
  [id] int NOT NULL,
  [pg_varchar] nvarchar(max) NOT NULL,
  [mysql_char] nchar(256) NOT NULL,
  [mysql_varchar] nvarchar(max) NOT NULL,
  [sqlserver_char] nvarchar(max) NOT NULL,
  [sqlserver_varchar] nvarchar(max) NOT NULL,
  [pg_decimal] decimal(38, 2) NOT NULL,
  [mysql_decimal] decimal(38, 31) NOT NULL,
  CONSTRAINT [oversized_types_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [oversized_unique] (
  [id] int NOT NULL,
  [code] nvarchar(450) NOT NULL,
  CONSTRAINT [oversized_unique_pkey] PRIMARY KEY ([id]),
  CONSTRAINT [oversized_unique_code_key] UNIQUE ([code])
);

CREATE TABLE [required_a] (
  [id] int NOT NULL,
  [b_id] int NOT NULL,
  CONSTRAINT [required_a_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [required_b] (
  [id] int NOT NULL,
  [a_id] int NOT NULL,
  CONSTRAINT [required_b_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [required_child] (
  [id] int NOT NULL,
  [a_id] int NOT NULL,
  CONSTRAINT [required_child_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [right] (
  [id] int NOT NULL,
  [root_id] int NOT NULL,
  CONSTRAINT [right_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [root] (
  [id] int NOT NULL,
  [leaf_id] int NULL,
  CONSTRAINT [root_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [text_keys] (
  [code] nvarchar(450) NOT NULL,
  [label] nvarchar(450) NOT NULL,
  [tag] nvarchar(450) NOT NULL,
  CONSTRAINT [text_keys_pkey] PRIMARY KEY ([code]),
  CONSTRAINT [text_keys_label_key] UNIQUE ([label])
);

CREATE TABLE [text_refs] (
  [id] int NOT NULL,
  [text_key_code] nvarchar(450) NOT NULL,
  CONSTRAINT [text_refs_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [tree_nodes] (
  [id] int NOT NULL,
  [parent_id] int NULL,
  CONSTRAINT [tree_nodes_pkey] PRIMARY KEY ([id])
);

CREATE TABLE [unique_only] (
  [code] nvarchar(20) NOT NULL,
  [label] nvarchar(max) NOT NULL,
  CONSTRAINT [unique_only_code_key] UNIQUE ([code])
);

CREATE TABLE [wide_rows] (
  [id] int NOT NULL,
  [v] nvarchar(max) NOT NULL,
  CONSTRAINT [wide_rows_pkey] PRIMARY KEY ([id])
);

CREATE UNIQUE INDEX [five_part_keys_ux] ON [five_part_keys] ([q1], [q2], [q3], [q4], [q5]);
CREATE UNIQUE INDEX [four_part_keys_ux] ON [four_part_keys] ([p1], [p2], [p3], [p4]);
CREATE UNIQUE INDEX [nullable_unique_alt_code_ux] ON [nullable_unique] ([alt_code]) WHERE [alt_code] IS NOT NULL;
CREATE INDEX [text_keys_tag_ix] ON [text_keys] ([tag]);

ALTER TABLE [cycle_a] ADD CONSTRAINT [cycle_a_b_id_fkey] FOREIGN KEY ([b_id]) REFERENCES [cycle_b] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [cycle_b] ADD CONSTRAINT [cycle_b_a_id_fkey] FOREIGN KEY ([a_id]) REFERENCES [cycle_a] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [default_children] ADD CONSTRAINT [default_children_parent_id_fkey] FOREIGN KEY ([parent_id]) REFERENCES [default_parents] ([id]) ON DELETE SET DEFAULT ON UPDATE NO ACTION;
ALTER TABLE [five_part_refs] ADD CONSTRAINT [five_part_refs_q1_q2_q3_q4_q5_fkey] FOREIGN KEY ([q1], [q2], [q3], [q4], [q5]) REFERENCES [five_part_keys] ([q1], [q2], [q3], [q4], [q5]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [fixed_refs] ADD CONSTRAINT [fixed_refs_fixed_code_fkey] FOREIGN KEY ([fixed_code]) REFERENCES [fixed_keys] ([code]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [leaf] ADD CONSTRAINT [leaf_left_id_fkey] FOREIGN KEY ([left_id]) REFERENCES [left] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [leaf] ADD CONSTRAINT [leaf_right_id_fkey] FOREIGN KEY ([right_id]) REFERENCES [right] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [left] ADD CONSTRAINT [left_root_id_fkey] FOREIGN KEY ([root_id]) REFERENCES [root] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [nullable_unique_refs] ADD CONSTRAINT [nullable_unique_refs_code_fkey] FOREIGN KEY ([code]) REFERENCES [nullable_unique] ([code]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [required_a] ADD CONSTRAINT [required_a_b_id_fkey] FOREIGN KEY ([b_id]) REFERENCES [required_b] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [required_b] ADD CONSTRAINT [required_b_a_id_fkey] FOREIGN KEY ([a_id]) REFERENCES [required_a] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [required_child] ADD CONSTRAINT [required_child_a_id_fkey] FOREIGN KEY ([a_id]) REFERENCES [required_a] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [right] ADD CONSTRAINT [right_root_id_fkey] FOREIGN KEY ([root_id]) REFERENCES [root] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [root] ADD CONSTRAINT [root_leaf_id_fkey] FOREIGN KEY ([leaf_id]) REFERENCES [leaf] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [text_refs] ADD CONSTRAINT [text_refs_text_key_code_fkey] FOREIGN KEY ([text_key_code]) REFERENCES [text_keys] ([code]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [tree_nodes] ADD CONSTRAINT [tree_nodes_parent_id_fkey] FOREIGN KEY ([parent_id]) REFERENCES [tree_nodes] ([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

DECLARE @schema_name sysname = SCHEMA_NAME();
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'ttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt', @level0type = N'SCHEMA', @level0name = @schema_name, @level1type = N'TABLE', @level1name = N'long_comments';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', @level0type = N'SCHEMA', @level0name = @schema_name, @level1type = N'TABLE', @level1name = N'long_comments', @level2type = N'COLUMN', @level2name = N'note';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'sssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss', @level0type = N'SCHEMA', @level0name = @schema_name, @level1type = N'TABLE', @level1name = N'long_comments', @level2type = N'COLUMN', @level2name = N'surrogate_note';
