CREATE TABLE `all_types` (
  `id` INT NOT NULL,
  `smallint_value` SMALLINT NOT NULL DEFAULT -32768,
  `integer_value` INT NOT NULL DEFAULT 42,
  `bigint_value` BIGINT NOT NULL DEFAULT 9223372036854775807,
  `decimal_value` DECIMAL(12, 2) NOT NULL DEFAULT 1234567890.12,
  `real_value` FLOAT NOT NULL DEFAULT 1.5e10,
  `double_value` DOUBLE NOT NULL DEFAULT -2.25,
  `boolean_value` BOOLEAN NOT NULL DEFAULT TRUE,
  `char_value` CHAR(3) NOT NULL DEFAULT 'abc',
  `varchar_value` VARCHAR(20) NOT NULL DEFAULT 'it''s',
  `text_value` LONGTEXT NOT NULL DEFAULT ('a\\b'),
  `uuid_value` CHAR(36) NOT NULL DEFAULT '123e4567-e89b-12d3-a456-426614174000',
  `date_value` DATE NOT NULL DEFAULT '2026-01-02',
  `time_value` TIME(6) NOT NULL DEFAULT '12:34:56.789',
  `timestamp_value` DATETIME(6) NOT NULL DEFAULT '2026-01-02T03:04:05',
  `timestamptz_value` TIMESTAMP(6) NOT NULL DEFAULT '2026-01-02T03:04:05.123+07:00',
  `timestamp_now` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `timestamptz_now` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `json_value` JSON NOT NULL DEFAULT ('{"note":"it''s"}'),
  `binary_value` LONGBLOB,
  `enum_value` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `auto_integer` (
  `id` INT AUTO_INCREMENT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `auto_smallint` (
  `id` SMALLINT AUTO_INCREMENT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `auto_trailing` (
  `a` INT NOT NULL,
  `id` BIGINT AUTO_INCREMENT NOT NULL,
  PRIMARY KEY (`a`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `auto_wide_key` (
  `id` BIGINT AUTO_INCREMENT NOT NULL,
  `code_a` VARCHAR(700) NOT NULL,
  `code_b` VARCHAR(700) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `binary_keys` (
  `id` INT NOT NULL,
  `hash` LONGBLOB NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `char_unique` (
  `id` INT NOT NULL,
  `code` VARCHAR(300) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `char_unique_code_key` UNIQUE (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `custom_required` (
  `id` INT NOT NULL,
  `payload` tsvector NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `custom_values` (
  `id` INT NOT NULL,
  `shape` geometry(Point, 4326),
  `address` inet NOT NULL DEFAULT '127.0.0.1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `cycle_a` (
  `id` INT NOT NULL,
  `b_id` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `cycle_b` (
  `id` INT NOT NULL,
  `a_id` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `default_children` (
  `id` INT NOT NULL,
  `parent_id` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `default_parents` (
  `id` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `five_part_keys` (
  `id` INT NOT NULL,
  `q1` VARCHAR(700) NOT NULL,
  `q2` VARCHAR(700) NOT NULL,
  `q3` VARCHAR(700) NOT NULL,
  `q4` VARCHAR(700) NOT NULL,
  `q5` VARCHAR(700) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `five_part_refs` (
  `id` INT NOT NULL,
  `q1` VARCHAR(700) NOT NULL,
  `q2` VARCHAR(700) NOT NULL,
  `q3` VARCHAR(700) NOT NULL,
  `q4` VARCHAR(700) NOT NULL,
  `q5` VARCHAR(700) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `fixed_keys` (
  `code` VARCHAR(500) NOT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `fixed_refs` (
  `id` INT NOT NULL,
  `fixed_code` VARCHAR(500) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `fixed_unique` (
  `id` INT NOT NULL,
  `code` VARCHAR(768) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fixed_unique_code_key` UNIQUE (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `flags` (
  `id` INT NOT NULL,
  `status` ENUM('active', 'inactive'),
  `is_primary` BOOLEAN NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `flags_is_primary_key` UNIQUE (`is_primary`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `four_part_keys` (
  `id` INT NOT NULL,
  `p1` VARCHAR(192) NOT NULL,
  `p2` VARCHAR(192) NOT NULL,
  `p3` VARCHAR(192) NOT NULL,
  `p4` VARCHAR(192) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `fractional_times` (
  `id` INT NOT NULL,
  `starts_at` TIME(6) NOT NULL DEFAULT '12:34:56.123456',
  `created_at` DATETIME(6) NOT NULL DEFAULT '2026-01-02T03:04:05.123456',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `json_keys` (
  `doc` JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `json_refs` (
  `id` INT NOT NULL,
  `doc` JSON NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `json_unique` (
  `id` INT NOT NULL,
  `doc` JSON NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `leaf` (
  `id` INT NOT NULL,
  `left_id` INT NOT NULL,
  `right_id` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `left` (
  `id` INT NOT NULL,
  `root_id` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `long_comments` (
  `id` INT NOT NULL,
  `note` LONGTEXT NOT NULL COMMENT 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  `surrogate_note` LONGTEXT NOT NULL COMMENT 'ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci COMMENT='tttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt';

CREATE TABLE `long_unique` (
  `id` INT NOT NULL,
  `code` VARCHAR(768) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `long_unique_code_key` UNIQUE (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `no_key_rows` (
  `note` LONGTEXT NOT NULL,
  `value` INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `nullable_unique` (
  `id` INT NOT NULL,
  `code` VARCHAR(20),
  `alt_code` VARCHAR(20),
  PRIMARY KEY (`id`),
  CONSTRAINT `nullable_unique_code_key` UNIQUE (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `nullable_unique_refs` (
  `id` INT NOT NULL,
  `code` VARCHAR(20),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `oversized_types` (
  `id` INT NOT NULL,
  `pg_varchar` LONGTEXT NOT NULL,
  `mysql_char` VARCHAR(256) NOT NULL,
  `mysql_varchar` LONGTEXT NOT NULL,
  `sqlserver_char` VARCHAR(4001) NOT NULL,
  `sqlserver_varchar` VARCHAR(4001) NOT NULL,
  `pg_decimal` DECIMAL(65, 2) NOT NULL,
  `mysql_decimal` DECIMAL(40, 30) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `oversized_unique` (
  `id` INT NOT NULL,
  `code` VARCHAR(768) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `oversized_unique_code_key` UNIQUE (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `required_a` (
  `id` INT NOT NULL,
  `b_id` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `required_b` (
  `id` INT NOT NULL,
  `a_id` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `required_child` (
  `id` INT NOT NULL,
  `a_id` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `right` (
  `id` INT NOT NULL,
  `root_id` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `root` (
  `id` INT NOT NULL,
  `leaf_id` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `text_keys` (
  `code` VARCHAR(255) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `tag` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`code`),
  CONSTRAINT `text_keys_label_key` UNIQUE (`label`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `text_refs` (
  `id` INT NOT NULL,
  `text_key_code` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `tree_nodes` (
  `id` INT NOT NULL,
  `parent_id` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `unique_only` (
  `code` VARCHAR(20) NOT NULL,
  `label` LONGTEXT NOT NULL,
  CONSTRAINT `unique_only_code_key` UNIQUE (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `wide_rows` (
  `id` INT NOT NULL,
  `v` LONGTEXT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE UNIQUE INDEX `four_part_keys_ux` ON `four_part_keys` (`p1`, `p2`, `p3`, `p4`);
CREATE UNIQUE INDEX `nullable_unique_alt_code_ux` ON `nullable_unique` (`alt_code`);
CREATE INDEX `text_keys_tag_ix` ON `text_keys` (`tag`);
CREATE INDEX `auto_trailing_id_idx` ON `auto_trailing` (`id`);
CREATE INDEX `auto_wide_key_id_idx` ON `auto_wide_key` (`id`);

ALTER TABLE `cycle_a` ADD CONSTRAINT `cycle_a_b_id_fkey` FOREIGN KEY (`b_id`) REFERENCES `cycle_b` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `cycle_b` ADD CONSTRAINT `cycle_b_a_id_fkey` FOREIGN KEY (`a_id`) REFERENCES `cycle_a` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `default_children` ADD CONSTRAINT `default_children_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `default_parents` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `fixed_refs` ADD CONSTRAINT `fixed_refs_fixed_code_fkey` FOREIGN KEY (`fixed_code`) REFERENCES `fixed_keys` (`code`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `leaf` ADD CONSTRAINT `leaf_left_id_fkey` FOREIGN KEY (`left_id`) REFERENCES `left` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `leaf` ADD CONSTRAINT `leaf_right_id_fkey` FOREIGN KEY (`right_id`) REFERENCES `right` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `left` ADD CONSTRAINT `left_root_id_fkey` FOREIGN KEY (`root_id`) REFERENCES `root` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `nullable_unique_refs` ADD CONSTRAINT `nullable_unique_refs_code_fkey` FOREIGN KEY (`code`) REFERENCES `nullable_unique` (`code`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `required_a` ADD CONSTRAINT `required_a_b_id_fkey` FOREIGN KEY (`b_id`) REFERENCES `required_b` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `required_b` ADD CONSTRAINT `required_b_a_id_fkey` FOREIGN KEY (`a_id`) REFERENCES `required_a` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `required_child` ADD CONSTRAINT `required_child_a_id_fkey` FOREIGN KEY (`a_id`) REFERENCES `required_a` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `right` ADD CONSTRAINT `right_root_id_fkey` FOREIGN KEY (`root_id`) REFERENCES `root` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `root` ADD CONSTRAINT `root_leaf_id_fkey` FOREIGN KEY (`leaf_id`) REFERENCES `leaf` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE `text_refs` ADD CONSTRAINT `text_refs_text_key_code_fkey` FOREIGN KEY (`text_key_code`) REFERENCES `text_keys` (`code`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `tree_nodes` ADD CONSTRAINT `tree_nodes_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `tree_nodes` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
