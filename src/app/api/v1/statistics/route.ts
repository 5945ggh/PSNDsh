import { z } from "zod";
import { jsonData, jsonError, serviceForRequest } from "@/lib/api/http";
import { statisticsScaleSchema, weekStartSchema } from "@/lib/application/contract";

const querySchema = z.object({
  scale: statisticsScaleSchema.default("week"),
  weekStart: weekStartSchema.optional(),
}).refine((input) => !input.weekStart || input.scale === "week", {
  message: "weekStart 仅支持周统计",
  path: ["weekStart"],
});

export function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({
      scale: url.searchParams.get("scale") ?? undefined,
      weekStart: url.searchParams.get("weekStart") ?? undefined,
    });
    return jsonData(serviceForRequest(request).getStatisticsPayload(query.scale, query.weekStart));
  } catch (error) { return jsonError(error); }
}
