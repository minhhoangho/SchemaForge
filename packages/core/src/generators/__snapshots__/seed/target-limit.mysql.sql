INSERT INTO `all_types` (`id`, `smallint_value`, `integer_value`, `bigint_value`, `decimal_value`, `real_value`, `double_value`, `boolean_value`, `char_value`, `varchar_value`, `text_value`, `uuid_value`, `date_value`, `time_value`, `timestamp_value`, `timestamptz_value`, `timestamp_now`, `timestamptz_now`, `json_value`, `binary_value`, `enum_value`) VALUES
  (1, -26668, 729542903, 2082846120, 750329344.87, 8241.52, 3820.76, FALSE, 'e_1', 'varchar_value_1', 'text_value_1', 'bac07737-e3fc-4537-8fce-01f5876ed4e7', '2026-07-05', '08:42:01', '2026-08-30T12:49:57', '2026-07-03T21:41:01+00:00', '2026-05-06T19:27:11', '2026-08-26T18:45:41+00:00', '{"value":919}', FROM_BASE64('M7gyGQ=='), 'inactive'),
  (2, -19141, 1597383677, 857011259, 385633377.58, 633.35, 9760.96, TRUE, 'e_2', 'varchar_value_2', 'text_value_2', '192d42da-ff11-4fc4-9475-41970d898cd4', '2026-10-18', '08:42:49', '2026-02-20T02:21:40', '2026-08-31T04:32:53+00:00', '2026-01-08T17:19:09', '2026-12-27T00:01:39+00:00', '{"value":327}', FROM_BASE64('DufU/w=='), 'inactive'),
  (3, -20120, 954790182, 1806488819, 613397647.28, 6165.96, 3747.29, FALSE, 'e_3', 'varchar_value_3', 'text_value_3', '1a89e0c1-1f77-40dd-a2d2-6ca52aaedb9e', '2026-05-05', '07:15:20', '2026-12-26T16:17:20', '2026-06-15T12:25:31+00:00', '2026-03-24T14:00:15', '2026-01-09T17:00:40+00:00', '{"value":367}', FROM_BASE64('U5dGbQ=='), 'active');

INSERT INTO `auto_integer` (`id`) VALUES
  (1),
  (2),
  (3);

INSERT INTO `auto_smallint` (`id`) VALUES
  (1),
  (2),
  (3);

INSERT INTO `auto_trailing` (`a`, `id`) VALUES
  (1, 1),
  (2, 2),
  (3, 3);

INSERT INTO `auto_wide_key` (`id`, `code_a`, `code_b`) VALUES
  (1, 'code_a_1', 'code_b_1'),
  (2, 'code_a_2', 'code_b_2'),
  (3, 'code_a_3', 'code_b_3');

INSERT INTO `binary_keys` (`id`, `hash`) VALUES
  (1, FROM_BASE64('lYAM9g==')),
  (2, FROM_BASE64('ggFTGA==')),
  (3, FROM_BASE64('qxCMmw=='));

INSERT INTO `char_unique` (`id`, `code`) VALUES
  (1, 'code_1'),
  (2, 'code_2'),
  (3, 'code_3');

INSERT INTO `custom_values` (`id`, `shape`) VALUES
  (1, NULL),
  (2, NULL),
  (3, NULL);

INSERT INTO `cycle_a` (`id`, `b_id`) VALUES
  (1, NULL),
  (2, NULL),
  (3, NULL);

INSERT INTO `cycle_b` (`id`, `a_id`) VALUES
  (1, 3),
  (2, 3),
  (3, 2);

INSERT INTO `default_parents` (`id`) VALUES
  (1),
  (2),
  (3);

INSERT INTO `default_children` (`id`, `parent_id`) VALUES
  (1, 1),
  (2, 2),
  (3, 2);

INSERT INTO `five_part_keys` (`id`, `q1`, `q2`, `q3`, `q4`, `q5`) VALUES
  (1, 'q1_1', 'q2_1', 'q3_1', 'q4_1', 'q5_1'),
  (2, 'q1_2', 'q2_2', 'q3_2', 'q4_2', 'q5_2'),
  (3, 'q1_3', 'q2_3', 'q3_3', 'q4_3', 'q5_3');

INSERT INTO `five_part_refs` (`id`, `q1`, `q2`, `q3`, `q4`, `q5`) VALUES
  (1, 'q1_2', 'q2_2', 'q3_2', 'q4_2', 'q5_2'),
  (2, 'q1_3', 'q2_3', 'q3_3', 'q4_3', 'q5_3'),
  (3, 'q1_2', 'q2_2', 'q3_2', 'q4_2', 'q5_2');

INSERT INTO `fixed_keys` (`code`) VALUES
  ('code_1'),
  ('code_2'),
  ('code_3');

INSERT INTO `fixed_refs` (`id`, `fixed_code`) VALUES
  (1, 'code_1'),
  (2, 'code_1'),
  (3, 'code_2');

INSERT INTO `fixed_unique` (`id`, `code`) VALUES
  (1, 'code_1'),
  (2, 'code_2'),
  (3, 'code_3');

INSERT INTO `flags` (`id`, `status`, `is_primary`) VALUES
  (1, 'active', TRUE),
  (2, 'active', FALSE);

INSERT INTO `four_part_keys` (`id`, `p1`, `p2`, `p3`, `p4`) VALUES
  (1, 'p1_1', 'p2_1', 'p3_1', 'p4_1'),
  (2, 'p1_2', 'p2_2', 'p3_2', 'p4_2'),
  (3, 'p1_3', 'p2_3', 'p3_3', 'p4_3');

INSERT INTO `fractional_times` (`id`, `starts_at`, `created_at`) VALUES
  (1, '17:52:32', '2026-10-03T18:08:57'),
  (2, '11:15:14', '2026-04-28T01:06:17'),
  (3, '23:04:53', '2026-10-09T02:13:40');

INSERT INTO `json_keys` (`doc`) VALUES
  ('{"value":111}'),
  ('{"value":475}'),
  ('{"value":152}');

INSERT INTO `json_unique` (`id`, `doc`) VALUES
  (1, '{"value":631}'),
  (2, '{"value":523}'),
  (3, '{"value":856}');

INSERT INTO `json_refs` (`id`, `doc`) VALUES
  (1, '{"value":856}'),
  (2, '{"value":631}'),
  (3, '{"value":523}');

INSERT INTO `long_comments` (`id`, `note`, `surrogate_note`) VALUES
  (1, 'note_1', 'surrogate_note_1'),
  (2, 'note_2', 'surrogate_note_2'),
  (3, 'note_3', 'surrogate_note_3');

INSERT INTO `long_unique` (`id`, `code`) VALUES
  (1, 'code_1'),
  (2, 'code_2'),
  (3, 'code_3');

INSERT INTO `no_key_rows` (`note`, `value`) VALUES
  ('note_1', 680512464),
  ('note_2', -2024683812),
  ('note_3', -1097183343);

INSERT INTO `nullable_unique` (`id`, `code`, `alt_code`) VALUES
  (1, 'code_1', 'alt_code_1'),
  (2, 'code_2', 'alt_code_2'),
  (3, 'code_3', 'alt_code_3');

INSERT INTO `nullable_unique_refs` (`id`, `code`) VALUES
  (1, 'code_3'),
  (2, 'code_1'),
  (3, 'code_2');

INSERT INTO `oversized_types` (`id`, `pg_varchar`, `mysql_char`, `mysql_varchar`, `sqlserver_char`, `sqlserver_varchar`, `pg_decimal`, `mysql_decimal`) VALUES
  (1, 'pg_varchar_1', 'mysql_char_1', 'mysql_varchar_1', 'sqlserver_char_1', 'sqlserver_varchar_1', 954638464.91, 983148276.6784687621492733882805745271054),
  (2, 'pg_varchar_2', 'mysql_char_2', 'mysql_varchar_2', 'sqlserver_char_2', 'sqlserver_varchar_2', 752496475.98, 624835936.8131158258809413735435127836087),
  (3, 'pg_varchar_3', 'mysql_char_3', 'mysql_varchar_3', 'sqlserver_char_3', 'sqlserver_varchar_3', 749689704.24, 913598098.1133903833505502475544049458440);

INSERT INTO `oversized_unique` (`id`, `code`) VALUES
  (1, 'code_1'),
  (2, 'code_2'),
  (3, 'code_3');

INSERT INTO `root` (`id`, `leaf_id`) VALUES
  (1, NULL),
  (2, NULL),
  (3, NULL);

INSERT INTO `left` (`id`, `root_id`) VALUES
  (1, 3),
  (2, 2),
  (3, 2);

INSERT INTO `right` (`id`, `root_id`) VALUES
  (1, 2),
  (2, 2),
  (3, 1);

INSERT INTO `leaf` (`id`, `left_id`, `right_id`) VALUES
  (1, 1, 3),
  (2, 1, 2),
  (3, 3, 1);

INSERT INTO `text_keys` (`code`, `label`, `tag`) VALUES
  ('code_1', 'label_1', 'tag_1'),
  ('code_2', 'label_2', 'tag_2'),
  ('code_3', 'label_3', 'tag_3');

INSERT INTO `text_refs` (`id`, `text_key_code`) VALUES
  (1, 'code_1'),
  (2, 'code_1'),
  (3, 'code_1');

INSERT INTO `tree_nodes` (`id`, `parent_id`) VALUES
  (1, NULL),
  (2, 1),
  (3, 2);

INSERT INTO `unique_only` (`code`, `label`) VALUES
  ('code_1', 'label_1'),
  ('code_2', 'label_2'),
  ('code_3', 'label_3');

INSERT INTO `wide_rows` (`id`, `v`) VALUES
  (1, 'v_1'),
  (2, 'v_2'),
  (3, 'v_3');

UPDATE `cycle_a` SET `b_id` = 1 WHERE `id` = 1;
UPDATE `cycle_a` SET `b_id` = 3 WHERE `id` = 2;
UPDATE `cycle_a` SET `b_id` = 1 WHERE `id` = 3;
UPDATE `root` SET `leaf_id` = 3 WHERE `id` = 1;
UPDATE `root` SET `leaf_id` = 3 WHERE `id` = 2;
UPDATE `root` SET `leaf_id` = 3 WHERE `id` = 3;
