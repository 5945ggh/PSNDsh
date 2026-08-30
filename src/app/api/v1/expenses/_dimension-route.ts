import { z } from "zod";

export const dimensionCreateSchema = z.object({
  name: z.string().trim().min(1),
}).strict();

export const dimensionMergeSchema = z.object({
  targetId: z.string().min(1),
}).strict();

export const readIncludeArchived = (request: Request) => {
  const value = new URL(request.url).searchParams.get("includeArchived");
  return value === "1" || value === "true";
};
