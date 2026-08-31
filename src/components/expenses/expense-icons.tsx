import {
  Banknote, Briefcase, Car, CircleHelp, Coffee, CreditCard, Fuel, Gift,
  GraduationCap, HeartPulse, Home, Plane, ShoppingCart, Smartphone, Tag,
  Ticket, Utensils, Wallet, type LucideIcon,
} from "lucide-react";
import type { ExpenseIconKey } from "@/lib/domain/types";

export const EXPENSE_ICON_OPTIONS: ReadonlyArray<{ key: ExpenseIconKey; label: string }> = [
  { key: "utensils", label: "餐饮" }, { key: "coffee", label: "咖啡" },
  { key: "shopping-cart", label: "购物" }, { key: "car", label: "交通" },
  { key: "plane", label: "旅行" }, { key: "home", label: "居住" },
  { key: "briefcase", label: "工作" }, { key: "graduation-cap", label: "教育" },
  { key: "heart-pulse", label: "健康" }, { key: "wallet", label: "钱包" },
  { key: "credit-card", label: "银行卡" }, { key: "banknote", label: "现金" },
  { key: "smartphone", label: "手机" }, { key: "gift", label: "礼物" },
  { key: "ticket", label: "票券" }, { key: "fuel", label: "燃油" },
  { key: "tag", label: "标签" }, { key: "circle-help", label: "其他" },
];

const ICONS: Record<ExpenseIconKey, LucideIcon> = {
  utensils: Utensils, coffee: Coffee, "shopping-cart": ShoppingCart, car: Car,
  plane: Plane, home: Home, briefcase: Briefcase, "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse, wallet: Wallet, "credit-card": CreditCard,
  banknote: Banknote, smartphone: Smartphone, gift: Gift, ticket: Ticket, fuel: Fuel,
  tag: Tag, "circle-help": CircleHelp,
};

export const getExpenseIcon = (iconKey: ExpenseIconKey | null | undefined, fallback: ExpenseIconKey = "tag") =>
  ICONS[iconKey ?? fallback] ?? ICONS[fallback];

export const expenseIconLabel = (iconKey: ExpenseIconKey | null | undefined) =>
  EXPENSE_ICON_OPTIONS.find((option) => option.key === iconKey)?.label ?? "未设置图标";
