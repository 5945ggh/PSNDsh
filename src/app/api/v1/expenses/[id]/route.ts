import { z } from "zod";
import { assertSameOrigin, jsonData, jsonError, noContent, readJson, serviceForRequest } from "@/lib/api/http";
import { ApplicationError } from "@/lib/application/error";

const updateInput = z.object({
  amountCents: z.number().int().positive().optional(),
  occurredAt: z.string().nullable().optional(),
  occurredOn: z.string().nullable().optional(),
  occurrencePrecision: z.enum(["datetime", "date"]).optional(),
  note: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  paymentMethodId: z.string().nullable().optional(),
  reviewStatus: z.enum(["pending", "reviewed"]).optional(),
  tagIds: z.array(z.string()).optional(),
  recoverableCents: z.number().int().nonnegative().optional(),
  settled: z.boolean().optional(),
}).strict();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const expense = serviceForRequest(request).getExpenseById((await context.params).id);
    if (!expense) return jsonError(new ApplicationError("EXPENSE_NOT_FOUND", "开销记录不存在"));
    return jsonData(expense);
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    return jsonData(serviceForRequest(request).updateExpense((await context.params).id, updateInput.parse(await readJson(request))));
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    serviceForRequest(request).deleteExpense((await context.params).id);
    return noContent();
  } catch (error) { return jsonError(error); }
}
