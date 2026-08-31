import { z } from "zod";

export const expenseIconKeySchema = z.enum([
  "utensils", "coffee", "shopping-cart", "car", "plane", "home", "briefcase",
  "graduation-cap", "heart-pulse", "wallet", "credit-card", "banknote", "smartphone",
  "gift", "ticket", "fuel", "tag", "circle-help",
]);

export const dimensionCreateSchema = z.object({
  name: z.string().trim().min(1),
  iconKey: expenseIconKeySchema.nullable().optional(),
}).strict();

export const dimensionMergeSchema = z.object({
  targetId: z.string().min(1),
}).strict();

export const readIncludeArchived = (request: Request) => {
  const value = new URL(request.url).searchParams.get("includeArchived");
  return value === "1" || value === "true";
};
