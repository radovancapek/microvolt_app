import { cn } from "@/lib/cn";

export function PillButton({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  const base =
    "rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2";
  const styles =
    variant === "primary"
      ? "bg-micro-lime text-black hover:opacity-90 focus:ring-micro-lime focus:ring-offset-micro-paper"
      : "bg-white/0 text-black/80 ring-1 ring-black/10 hover:bg-white focus:ring-black/20 focus:ring-offset-micro-paper";

  return <button className={cn(base, styles, className)} {...props} />;
}