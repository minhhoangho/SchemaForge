CREATE TABLE `order_items` (
  `tenant_id` CHAR(36) NOT NULL,
  `order_number` INT NOT NULL,
  `line_number` INT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`tenant_id`, `order_number`, `line_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `orders` (
  `tenant_id` CHAR(36) NOT NULL,
  `order_number` INT NOT NULL,
  `status` ENUM('pending', 'paid', 'shipped') NOT NULL DEFAULT 'pending',
  `total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `user_id` BIGINT NOT NULL,
  PRIMARY KEY (`tenant_id`, `order_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `tags` (
  `id` CHAR(36) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `tenants` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `user_profiles` (
  `user_id` BIGINT NOT NULL,
  `bio` LONGTEXT,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `user_tags` (
  `users_id` BIGINT NOT NULL,
  `tags_id` CHAR(36) NOT NULL,
  `assigned_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`users_id`, `tags_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE `users` (
  `id` BIGINT AUTO_INCREMENT NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `manager_id` BIGINT,
  `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `location` geometry(Point, 4326),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE UNIQUE INDEX `users_tenant_id_email_key` ON `users` (`tenant_id`, `email`);

ALTER TABLE `order_items` ADD CONSTRAINT `order_items_tenant_id_order_number_fkey` FOREIGN KEY (`tenant_id`, `order_number`) REFERENCES `orders` (`tenant_id`, `order_number`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `user_tags` ADD CONSTRAINT `user_tags_users_id_fkey` FOREIGN KEY (`users_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `user_tags` ADD CONSTRAINT `user_tags_tags_id_fkey` FOREIGN KEY (`tags_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `users` ADD CONSTRAINT `users_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE `users` ADD CONSTRAINT `users_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
