export type Tone = "green" | "amber" | "red";

export const TONE: Record<Tone, { icon: string; bubble: string }> = {
  green: { icon: "text-[var(--primary)]", bubble: "bg-emerald-100 dark:bg-emerald-900/25" },
  amber: { icon: "text-[var(--warning)]", bubble: "bg-amber-100 dark:bg-amber-900/25" },
  red: { icon: "text-[var(--danger)]", bubble: "bg-red-100 dark:bg-red-900/25" },
};

export const StatTile = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: Tone;
}) => (
  <div className="card p-5 flex items-start justify-between gap-3 shadow-[var(--shadow-card)]">
    <div>
      <div className="flex items-center gap-2 text-sm text-[var(--muted)] font-medium">
        <Icon size={18} />
        {label}
      </div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
    </div>
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${TONE[tone].bubble}`}>
      <Icon size={22} className={TONE[tone].icon} />
    </div>
  </div>
);

export default StatTile;
