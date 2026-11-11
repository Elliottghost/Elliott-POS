import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value ? value : undefined))
    .optional();

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .max(190)
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time such as 08:30.");

export const branchInputSchema = z.object({
  name: z.string().trim().min(2, "Branch name is required.").max(80),
  code: z
    .string()
    .trim()
    .min(2, "Branch code is required.")
    .max(10)
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Branch code may contain letters, numbers and hyphens only.",
    )
    .transform((value) => value.toUpperCase()),
  address: z.string().trim().min(3, "Address is required.").max(160),
  city: z.string().trim().min(2).max(80).default("Kigali"),
  phone: optionalText(32),
  email: z
    .union([z.literal(""), emailSchema])
    .transform((value) => (value ? value : undefined))
    .optional(),
  openingTime: timeSchema.default("08:00"),
  closingTime: timeSchema.default("23:00"),
  isActive: z.boolean().default(true),
});

export type BranchInput = z.infer<typeof branchInputSchema>;

export const staffCreateSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
  email: emailSchema,
  phone: optionalText(32),
  roleId: z.string().trim().min(2, "Select a role."),
  branchId: z
    .string()
    .trim()
    .transform((value) => (value ? value : undefined))
    .optional(),
  password: z.string().min(1, "An initial password is required."),
  employeeCode: z
    .string()
    .trim()
    .min(2, "Employee code is required.")
    .max(20)
    .transform((value) => value.toUpperCase()),
  jobTitle: optionalText(80),
  employmentType: z
    .enum(["full_time", "part_time", "contract", "intern"])
    .default("full_time"),
  hiredAt: optionalText(20),
  nationalId: optionalText(40),
  residentialAddress: optionalText(160),
  emergencyContactName: optionalText(80),
  emergencyContactPhone: optionalText(32),
  notes: optionalText(500),
});

export type StaffCreateInput = z.infer<typeof staffCreateSchema>;

export const staffUpdateSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
  email: emailSchema,
  phone: optionalText(32),
  roleId: z.string().trim().min(2, "Select a role."),
  branchId: z
    .string()
    .trim()
    .transform((value) => (value ? value : undefined))
    .optional(),
  jobTitle: optionalText(80),
  employmentType: z.enum([
    "full_time",
    "part_time",
    "contract",
    "intern",
  ]),
  nationalId: optionalText(40),
  residentialAddress: optionalText(160),
  emergencyContactName: optionalText(80),
  emergencyContactPhone: optionalText(32),
  notes: optionalText(500),
  isActive: z.boolean().default(true),
});

export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;

/* -------------------------------------------------------------------------- */
/* Point of sale                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Staff type prices in whole francs ("8,500"); money is stored in cents so
 * every arithmetic step stays exact.
 */
export const moneyInputSchema = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .max(20)
  .transform((value, ctx) => {
    const cleaned = value.replace(/[,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
      ctx.addIssue({ code: "custom", message: "Enter an amount such as 8,500." });
      return z.NEVER;
    }
    const amount = Math.round(Number(cleaned) * 100);
    if (amount < 1) {
      ctx.addIssue({ code: "custom", message: "Amount must be greater than zero." });
      return z.NEVER;
    }
    if (amount > 100_000_000_000) {
      ctx.addIssue({ code: "custom", message: "That amount is too large." });
      return z.NEVER;
    }
    return amount;
  });

export const menuCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required.").max(60),
  description: optionalText(200),
  sortOrder: z.coerce.number().int().min(0).max(999).default(100),
  isActive: z.boolean().default(true),
});

export type MenuCategoryInput = z.infer<typeof menuCategorySchema>;

export const menuItemSchema = z.object({
  categoryId: z.string().trim().min(1, "Choose a category."),
  name: z.string().trim().min(2, "Dish name is required.").max(80),
  description: optionalText(300),
  price: moneyInputSchema,
  station: z.enum(["kitchen", "bar", "pastry"]).default("kitchen"),
  prepMinutes: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(360)])
    .transform((value) => (value === "" ? undefined : Number(value)))
    .optional(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;

export const KITCHEN_STATUSES = ["queued", "preparing", "ready", "served"] as const;

export type KitchenStatus = (typeof KITCHEN_STATUSES)[number];

export const KITCHEN_STATUS_LABELS: Record<(typeof KITCHEN_STATUSES)[number], string> = {
  queued: "Queued",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
};

export const ORDER_CHANNELS = ["dine_in", "takeaway", "bar", "room_service"] as const;
export const PAYMENT_METHODS = ["cash", "momo", "card"] as const;

export const ORDER_CHANNEL_LABELS: Record<(typeof ORDER_CHANNELS)[number], string> = {
  dine_in: "Dine in",
  takeaway: "Takeaway",
  bar: "Bar",
  room_service: "Room service",
};

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cash: "Cash",
  momo: "Mobile money",
  card: "Card",
};

export const orderItemInputSchema = z.object({
  menuItemId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(99),
  notes: optionalText(160),
});

export const orderCreateSchema = z.object({
  branchId: z.string().trim().min(1, "Choose a branch."),
  channel: z.enum(ORDER_CHANNELS).default("dine_in"),
  customerName: optionalText(80),
  tableLabel: optionalText(20),
  guestCount: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(200)])
    .transform((value) => (value === "" ? undefined : Number(value)))
    .optional(),
  notes: optionalText(300),
  items: z.array(orderItemInputSchema).min(1, "Add at least one item.").max(60),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

export const paymentSchema = z.object({
  orderId: z.string().trim().min(1),
  method: z.enum(PAYMENT_METHODS).default("cash"),
  amount: moneyInputSchema,
  reference: optionalText(60),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

/* -------------------------------------------------------------------------- */
/* Restaurant floor & reservations                                            */
/* -------------------------------------------------------------------------- */

export const TABLE_STATUSES = [
  "available",
  "occupied",
  "reserved",
  "unavailable",
] as const;

export const TABLE_STATUS_LABELS: Record<(typeof TABLE_STATUSES)[number], string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  unavailable: "Unavailable",
};

export const tableInputSchema = z.object({
  branchId: z.string().trim().min(1, "Choose a branch."),
  code: z
    .string()
    .trim()
    .min(1, "Table number or name is required.")
    .max(20)
    .transform((value) => value.toUpperCase()),
  name: optionalText(60),
  capacity: z.coerce
    .number()
    .int()
    .min(1, "Seat at least one guest.")
    .max(40, "That is a very large table."),
  section: z.string().trim().min(1, "Add a section.").max(60).default("Main room"),
  status: z.enum(TABLE_STATUSES).default("available"),
  isActive: z.boolean().default(true),
});

export type TableInput = z.infer<typeof tableInputSchema>;

export const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
] as const;

export const RESERVATION_STATUS_LABELS: Record<
  (typeof RESERVATION_STATUSES)[number],
  string
> = {
  pending: "Pending",
  confirmed: "Confirmed",
  seated: "Seated",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const reservationInputSchema = z.object({
  branchId: z.string().trim().min(1, "Choose a branch."),
  tableId: z
    .string()
    .trim()
    .transform((value) => (value ? value : undefined))
    .optional(),
  customerName: z.string().trim().min(2, "Guest name is required.").max(80),
  customerPhone: z
    .string()
    .trim()
    .min(7, "Enter a phone number we can call.")
    .max(24, "That phone number is too long."),
  reservationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
  startTime: timeSchema,
  durationMinutes: z.coerce.number().int().min(30).max(360).default(90),
  guestCount: z.coerce.number().int().min(1, "At least one guest.").max(200),
  status: z.enum(RESERVATION_STATUSES).default("pending"),
  specialRequests: optionalText(300),
});

export type ReservationInput = z.infer<typeof reservationInputSchema>;

export const reservationStatusSchema = z.object({
  reservationId: z.string().trim().min(1),
  status: z.enum(RESERVATION_STATUSES),
  cancellationReason: optionalText(200),
});

/** Branch-level price and availability edit for one menu item. */
export const branchMenuSchema = z.object({
  branchId: z.string().trim().min(1),
  menuItemId: z.string().trim().min(1),
  priceOverride: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((value) => (value ? value : undefined)),
  isAvailable: z.boolean().default(true),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Missing reset token."),
    password: z.string().min(1, "Choose a new password."),
    confirmPassword: z.string().min(1, "Confirm the new password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: z.string().min(1, "Choose a new password."),
    confirmPassword: z.string().min(1, "Confirm the new password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const settingUpdateSchema = z.object({
  key: z.string().min(1),
  value: z.string().max(2000),
});

export function flattenFieldErrors(
  error: z.ZodError,
): Record<string, string[]> {
  const flattened: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    flattened[path] = [...(flattened[path] ?? []), issue.message];
  }
  return flattened;
}
