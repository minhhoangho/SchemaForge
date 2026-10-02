INSERT INTO [2fa codes] ([code], [__proto__]) VALUES
  (N'code_1', N'proto_1'),
  (N'code_2', NULL),
  (N'code_3', N'proto_3');

INSERT INTO [bảng có tên dài đúng sáu mươi ba byte theo utf-8 nhé] ([id], [mã duy nhất]) VALUES
  (1, N'ma_duy_nhat_1'),
  (2, N'ma_duy_nhat_2'),
  (3, N'ma_duy_nhat_3');

INSERT INTO [người dùng] ([id], [họ tên], [USER_ID], [ma], [má], [ghi chú]) VALUES
  (N'0a4c75a8-148b-4b7f-9413-34471e88c512', N'ho_ten_1', 994025309, N'ma_1', N'ma_1', N'ghi_chu_1'),
  (N'e0b9b7f4-dddc-4e67-9e95-70e00fc18cdf', N'ho_ten_2', -1608992785, N'ma_2', N'ma_2', N'ghi_chu_2'),
  (N'288878a1-283f-4f96-b713-a56772cce06a', NULL, 161868220, N'ma_3', N'ma_3', N'ghi_chu_3');

INSERT INTO [order] ([id], [select], [group], [người dùng id], [updated_by], [trạng thái]) VALUES
  (1, N'select_1', 1143494150, N'0a4c75a8-148b-4b7f-9413-34471e88c512', N'288878a1-283f-4f96-b713-a56772cce06a', N'má'),
  (2, N'select_2', 1001039841, N'288878a1-283f-4f96-b713-a56772cce06a', N'288878a1-283f-4f96-b713-a56772cce06a', N'chờ xử lý'),
  (3, N'select_3', -268590644, N'e0b9b7f4-dddc-4e67-9e95-70e00fc18cdf', N'0a4c75a8-148b-4b7f-9413-34471e88c512', N'đã giao');

INSERT INTO [order items] ([id]) VALUES
  (1),
  (2),
  (3);

INSERT INTO [order_items] ([id]) VALUES
  (1),
  (2),
  (3);

INSERT INTO [tên "lạ" `x` [y]] 'z' \ w] ([id], [tên "lạ" `x` [y]] 'z' \ w]) VALUES
  (1, N'ten_la_x_y_z_w_1'),
  (2, N'ten_la_x_y_z_w_2'),
  (3, N'ten_la_x_y_z_w_3');

INSERT INTO [用户] ([id], [名字]) VALUES
  (1, N'value_1'),
  (2, N'value_2'),
  (3, N'value_3');
