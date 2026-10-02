INSERT INTO "2fa codes" ("code", "__proto__") VALUES
  ('code_1', 'proto_1'),
  ('code_2', NULL),
  ('code_3', 'proto_3');

INSERT INTO "bảng có tên dài đúng sáu mươi ba byte theo utf-8 nhé" ("id", "mã duy nhất") VALUES
  (1, 'ma_duy_nhat_1'),
  (2, 'ma_duy_nhat_2'),
  (3, 'ma_duy_nhat_3');

INSERT INTO "người dùng" ("id", "họ tên", "USER_ID", "ma", "má", "ghi chú") VALUES
  ('0a4c75a8-148b-4b7f-9413-34471e88c512', 'ho_ten_1', 994025309, 'ma_1', 'ma_1', 'ghi_chu_1'),
  ('e0b9b7f4-dddc-4e67-9e95-70e00fc18cdf', 'ho_ten_2', -1608992785, 'ma_2', 'ma_2', 'ghi_chu_2'),
  ('288878a1-283f-4f96-b713-a56772cce06a', NULL, 161868220, 'ma_3', 'ma_3', 'ghi_chu_3');

INSERT INTO "order" ("id", "select", "group", "người dùng id", "updated_by", "trạng thái") VALUES
  (1, 'select_1', 1143494150, '0a4c75a8-148b-4b7f-9413-34471e88c512', '288878a1-283f-4f96-b713-a56772cce06a', 'má'),
  (2, 'select_2', 1001039841, '288878a1-283f-4f96-b713-a56772cce06a', '288878a1-283f-4f96-b713-a56772cce06a', 'chờ xử lý'),
  (3, 'select_3', -268590644, 'e0b9b7f4-dddc-4e67-9e95-70e00fc18cdf', '0a4c75a8-148b-4b7f-9413-34471e88c512', 'đã giao');

INSERT INTO "order items" ("id") VALUES
  (1),
  (2),
  (3);

INSERT INTO "order_items" ("id") VALUES
  (1),
  (2),
  (3);

INSERT INTO "tên ""lạ"" `x` [y] 'z' \ w" ("id", "tên ""lạ"" `x` [y] 'z' \ w") VALUES
  (1, 'ten_la_x_y_z_w_1'),
  (2, 'ten_la_x_y_z_w_2'),
  (3, 'ten_la_x_y_z_w_3');

INSERT INTO "用户" ("id", "名字") VALUES
  (1, 'value_1'),
  (2, 'value_2'),
  (3, 'value_3');
