INSERT INTO [tags] ([id]) VALUES
  (N'f85fc778-14ce-490a-9675-d5d1e4f1817e'),
  (N'52f908ad-9048-42e5-a8ce-0e0643dae4d4'),
  (N'56ab18c9-f061-494c-9a7a-e3cccf76d6cc');

INSERT INTO [tenants] ([id]) VALUES
  (N'14dff6f0-2768-4189-8345-572dc88367b9'),
  (N'f8828d79-030c-496d-bf42-ec11ea269aae'),
  (N'186daa03-01d7-4b72-85fd-0aa39c080478');

SET IDENTITY_INSERT [users] ON;
INSERT INTO [users] ([id], [tenant_id], [email], [manager_id], [created_at], [location]) VALUES
  (1, N'f8828d79-030c-496d-bf42-ec11ea269aae', N'email_1', NULL, N'2026-07-05T02:41:33Z', NULL),
  (2, N'14dff6f0-2768-4189-8345-572dc88367b9', N'email_2', 1, N'2026-05-15T06:27:42Z', NULL),
  (3, N'14dff6f0-2768-4189-8345-572dc88367b9', N'email_3', 2, N'2026-05-22T12:30:28Z', NULL);
SET IDENTITY_INSERT [users] OFF;

INSERT INTO [orders] ([tenant_id], [order_number], [status], [total], [user_id]) VALUES
  (N'790262ec-a5cb-49a9-b064-5f764a74db70', 1, N'shipped', 450463497.90, 1),
  (N'01fcc062-455b-40ce-bfec-99e1310b90dd', 2, N'pending', 784077283.02, 1),
  (N'25747bdb-d537-47ca-a22f-a8be87be7c7a', 3, N'pending', 280772963.09, 2);

INSERT INTO [order_items] ([tenant_id], [order_number], [line_number], [quantity]) VALUES
  (N'25747bdb-d537-47ca-a22f-a8be87be7c7a', 3, 1, -900892718),
  (N'25747bdb-d537-47ca-a22f-a8be87be7c7a', 3, 2, -1236171027),
  (N'01fcc062-455b-40ce-bfec-99e1310b90dd', 2, 3, -1706561432);

INSERT INTO [user_profiles] ([user_id], [bio]) VALUES
  (1, N'bio_1'),
  (3, N'bio_2'),
  (2, N'bio_3');

INSERT INTO [user_tags] ([users_id], [tags_id], [assigned_at]) VALUES
  (3, N'f85fc778-14ce-490a-9675-d5d1e4f1817e', N'2026-06-15T14:09:06Z'),
  (1, N'52f908ad-9048-42e5-a8ce-0e0643dae4d4', N'2026-03-12T02:00:53Z'),
  (2, N'52f908ad-9048-42e5-a8ce-0e0643dae4d4', N'2026-05-01T14:47:41Z');
