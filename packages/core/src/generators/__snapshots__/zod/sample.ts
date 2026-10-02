import { z } from "zod";

export const orderStatusSchema = z.enum(["pending", "paid", "shipped"]);

export const orderItemsSchema = z.object({
  tenant_id: z.guid(),
  order_number: z.int32(),
  line_number: z.int32(),
  quantity: z.int32(),
});

export const ordersSchema = z.object({
  tenant_id: z.guid(),
  order_number: z.int32(),
  status: orderStatusSchema,
  total: z.string().regex(new RegExp("^-?0*[0-9]{1,10}(\\.[0-9]{1,2})?$")),
  user_id: z.string().regex(new RegExp("^-?(0|[1-9][0-9]*)$")),
});

export const tagsSchema = z.object({
  id: z.guid(),
});

export const tenantsSchema = z.object({
  id: z.guid(),
});

export const userProfilesSchema = z.object({
  user_id: z.string().regex(new RegExp("^-?(0|[1-9][0-9]*)$")),
  bio: z.string().nullable(),
});

export const userTagsSchema = z.object({
  users_id: z.string().regex(new RegExp("^-?(0|[1-9][0-9]*)$")),
  tags_id: z.guid(),
  assigned_at: z.iso.datetime({ offset: true }),
});

export const usersSchema = z.object({
  id: z.string().regex(new RegExp("^-?(0|[1-9][0-9]*)$")),
  tenant_id: z.guid(),
  email: z.string().max(255),
  manager_id: z.string().regex(new RegExp("^-?(0|[1-9][0-9]*)$")).nullable(),
  created_at: z.iso.datetime({ offset: true }),
  location: z.unknown().nullable(),
});
