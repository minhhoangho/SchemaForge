INSERT INTO [all_types] ([id], [smallint_value], [integer_value], [bigint_value], [decimal_value], [real_value], [double_value], [boolean_value], [char_value], [varchar_value], [text_value], [uuid_value], [date_value], [time_value], [timestamp_value], [timestamptz_value], [timestamp_now], [timestamptz_now], [json_value], [binary_value], [enum_value]) VALUES
  (1, -26668, 729542903, 2082846120, 750329344.87, 8241.52, 3820.76, 0, N'e_1', N'varchar_value_1', N'text_value_1', N'bac07737-e3fc-4537-8fce-01f5876ed4e7', N'2026-07-05', N'08:42:01', N'2026-08-30T12:49:57', N'2026-07-03T21:41:01Z', N'2026-05-06T19:27:11', N'2026-08-26T18:45:41Z', N'{"value":919}', CAST(N'' AS XML).value('xs:base64Binary("M7gyGQ==")', 'varbinary(max)'), N'inactive'),
  (2, -19141, 1597383677, 857011259, 385633377.58, 633.35, 9760.96, 1, N'e_2', N'varchar_value_2', N'text_value_2', N'192d42da-ff11-4fc4-9475-41970d898cd4', N'2026-10-18', N'08:42:49', N'2026-02-20T02:21:40', N'2026-08-31T04:32:53Z', N'2026-01-08T17:19:09', N'2026-12-27T00:01:39Z', N'{"value":327}', CAST(N'' AS XML).value('xs:base64Binary("DufU/w==")', 'varbinary(max)'), N'inactive'),
  (3, -20120, 954790182, 1806488819, 613397647.28, 6165.96, 3747.29, 0, N'e_3', N'varchar_value_3', N'text_value_3', N'1a89e0c1-1f77-40dd-a2d2-6ca52aaedb9e', N'2026-05-05', N'07:15:20', N'2026-12-26T16:17:20', N'2026-06-15T12:25:31Z', N'2026-03-24T14:00:15', N'2026-01-09T17:00:40Z', N'{"value":367}', CAST(N'' AS XML).value('xs:base64Binary("U5dGbQ==")', 'varbinary(max)'), N'active');

SET IDENTITY_INSERT [auto_integer] ON;
INSERT INTO [auto_integer] ([id]) VALUES
  (1),
  (2),
  (3);
SET IDENTITY_INSERT [auto_integer] OFF;

SET IDENTITY_INSERT [auto_smallint] ON;
INSERT INTO [auto_smallint] ([id]) VALUES
  (1),
  (2),
  (3);
SET IDENTITY_INSERT [auto_smallint] OFF;

SET IDENTITY_INSERT [auto_trailing] ON;
INSERT INTO [auto_trailing] ([a], [id]) VALUES
  (1, 1),
  (2, 2),
  (3, 3);
SET IDENTITY_INSERT [auto_trailing] OFF;

SET IDENTITY_INSERT [auto_wide_key] ON;
INSERT INTO [auto_wide_key] ([id], [code_a], [code_b]) VALUES
  (1, N'code_a_1', N'code_b_1'),
  (2, N'code_a_2', N'code_b_2'),
  (3, N'code_a_3', N'code_b_3');
SET IDENTITY_INSERT [auto_wide_key] OFF;

INSERT INTO [binary_keys] ([id], [hash]) VALUES
  (1, CAST(N'' AS XML).value('xs:base64Binary("lYAM9g==")', 'varbinary(max)')),
  (2, CAST(N'' AS XML).value('xs:base64Binary("ggFTGA==")', 'varbinary(max)')),
  (3, CAST(N'' AS XML).value('xs:base64Binary("qxCMmw==")', 'varbinary(max)'));

INSERT INTO [char_unique] ([id], [code]) VALUES
  (1, N'code_1'),
  (2, N'code_2'),
  (3, N'code_3');

INSERT INTO [custom_values] ([id], [shape]) VALUES
  (1, NULL),
  (2, NULL),
  (3, NULL);

INSERT INTO [cycle_a] ([id], [b_id]) VALUES
  (1, NULL),
  (2, NULL),
  (3, NULL);

INSERT INTO [cycle_b] ([id], [a_id]) VALUES
  (1, 3),
  (2, 3),
  (3, 2);

INSERT INTO [default_parents] ([id]) VALUES
  (1),
  (2),
  (3);

INSERT INTO [default_children] ([id], [parent_id]) VALUES
  (1, 1),
  (2, 2),
  (3, 2);

INSERT INTO [five_part_keys] ([id], [q1], [q2], [q3], [q4], [q5]) VALUES
  (1, N'q1_1', N'q2_1', N'q3_1', N'q4_1', N'q5_1'),
  (2, N'q1_2', N'q2_2', N'q3_2', N'q4_2', N'q5_2'),
  (3, N'q1_3', N'q2_3', N'q3_3', N'q4_3', N'q5_3');

INSERT INTO [five_part_refs] ([id], [q1], [q2], [q3], [q4], [q5]) VALUES
  (1, N'q1_2', N'q2_2', N'q3_2', N'q4_2', N'q5_2'),
  (2, N'q1_3', N'q2_3', N'q3_3', N'q4_3', N'q5_3'),
  (3, N'q1_2', N'q2_2', N'q3_2', N'q4_2', N'q5_2');

INSERT INTO [fixed_keys] ([code]) VALUES
  (N'code_1'),
  (N'code_2'),
  (N'code_3');

INSERT INTO [fixed_refs] ([id], [fixed_code]) VALUES
  (1, N'code_1'),
  (2, N'code_1'),
  (3, N'code_2');

INSERT INTO [fixed_unique] ([id], [code]) VALUES
  (1, N'code_1'),
  (2, N'code_2'),
  (3, N'code_3');

INSERT INTO [flags] ([id], [status], [is_primary]) VALUES
  (1, N'active', 1),
  (2, N'active', 0);

INSERT INTO [four_part_keys] ([id], [p1], [p2], [p3], [p4]) VALUES
  (1, N'p1_1', N'p2_1', N'p3_1', N'p4_1'),
  (2, N'p1_2', N'p2_2', N'p3_2', N'p4_2'),
  (3, N'p1_3', N'p2_3', N'p3_3', N'p4_3');

INSERT INTO [fractional_times] ([id], [starts_at], [created_at]) VALUES
  (1, N'17:52:32', N'2026-10-03T18:08:57'),
  (2, N'11:15:14', N'2026-04-28T01:06:17'),
  (3, N'23:04:53', N'2026-10-09T02:13:40');

INSERT INTO [json_keys] ([doc]) VALUES
  (N'{"value":111}'),
  (N'{"value":475}'),
  (N'{"value":152}');

INSERT INTO [json_unique] ([id], [doc]) VALUES
  (1, N'{"value":631}'),
  (2, N'{"value":523}'),
  (3, N'{"value":856}');

INSERT INTO [json_refs] ([id], [doc]) VALUES
  (1, N'{"value":856}'),
  (2, N'{"value":631}'),
  (3, N'{"value":523}');

INSERT INTO [long_comments] ([id], [note], [surrogate_note]) VALUES
  (1, N'note_1', N'surrogate_note_1'),
  (2, N'note_2', N'surrogate_note_2'),
  (3, N'note_3', N'surrogate_note_3');

INSERT INTO [long_unique] ([id], [code]) VALUES
  (1, N'code_1'),
  (2, N'code_2'),
  (3, N'code_3');

INSERT INTO [no_key_rows] ([note], [value]) VALUES
  (N'note_1', 680512464),
  (N'note_2', -2024683812),
  (N'note_3', -1097183343);

INSERT INTO [nullable_unique] ([id], [code], [alt_code]) VALUES
  (1, N'code_1', N'alt_code_1'),
  (2, N'code_2', N'alt_code_2'),
  (3, N'code_3', N'alt_code_3');

INSERT INTO [nullable_unique_refs] ([id], [code]) VALUES
  (1, N'code_3'),
  (2, N'code_1'),
  (3, N'code_2');

INSERT INTO [oversized_types] ([id], [pg_varchar], [mysql_char], [mysql_varchar], [sqlserver_char], [sqlserver_varchar], [pg_decimal], [mysql_decimal]) VALUES
  (1, N'pg_varchar_1', N'mysql_char_1', N'mysql_varchar_1', N'sqlserver_char_1', N'sqlserver_varchar_1', 954638464.91, 983148276.6784687621492733882805745271054),
  (2, N'pg_varchar_2', N'mysql_char_2', N'mysql_varchar_2', N'sqlserver_char_2', N'sqlserver_varchar_2', 752496475.98, 624835936.8131158258809413735435127836087),
  (3, N'pg_varchar_3', N'mysql_char_3', N'mysql_varchar_3', N'sqlserver_char_3', N'sqlserver_varchar_3', 749689704.24, 913598098.1133903833505502475544049458440);

INSERT INTO [oversized_unique] ([id], [code]) VALUES
  (1, N'code_1'),
  (2, N'code_2'),
  (3, N'code_3');

INSERT INTO [root] ([id], [leaf_id]) VALUES
  (1, NULL),
  (2, NULL),
  (3, NULL);

INSERT INTO [left] ([id], [root_id]) VALUES
  (1, 3),
  (2, 2),
  (3, 2);

INSERT INTO [right] ([id], [root_id]) VALUES
  (1, 2),
  (2, 2),
  (3, 1);

INSERT INTO [leaf] ([id], [left_id], [right_id]) VALUES
  (1, 1, 3),
  (2, 1, 2),
  (3, 3, 1);

INSERT INTO [text_keys] ([code], [label], [tag]) VALUES
  (N'code_1', N'label_1', N'tag_1'),
  (N'code_2', N'label_2', N'tag_2'),
  (N'code_3', N'label_3', N'tag_3');

INSERT INTO [text_refs] ([id], [text_key_code]) VALUES
  (1, N'code_1'),
  (2, N'code_1'),
  (3, N'code_1');

INSERT INTO [tree_nodes] ([id], [parent_id]) VALUES
  (1, NULL),
  (2, 1),
  (3, 2);

INSERT INTO [unique_only] ([code], [label]) VALUES
  (N'code_1', N'label_1'),
  (N'code_2', N'label_2'),
  (N'code_3', N'label_3');

INSERT INTO [wide_rows] ([id], [v]) VALUES
  (1, N'v_1'),
  (2, N'v_2'),
  (3, N'v_3');

UPDATE [cycle_a] SET [b_id] = 1 WHERE [id] = 1;
UPDATE [cycle_a] SET [b_id] = 3 WHERE [id] = 2;
UPDATE [cycle_a] SET [b_id] = 1 WHERE [id] = 3;
UPDATE [root] SET [leaf_id] = 3 WHERE [id] = 1;
UPDATE [root] SET [leaf_id] = 3 WHERE [id] = 2;
UPDATE [root] SET [leaf_id] = 3 WHERE [id] = 3;
