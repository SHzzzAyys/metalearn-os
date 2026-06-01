import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  TextareaHTMLAttributes
} from "react";
import { clsx } from "clsx";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-900 bg-emerald-950 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(6,95,70,0.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-800 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function SecondaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/70 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "inline-flex size-10 items-center justify-center rounded-xl border border-zinc-200 bg-white/85 text-zinc-800 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={clsx("rounded-[1.25rem] border border-white/70 bg-white/82 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur", className)} {...props} />;
}

export function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm">
      <div className="text-xs font-semibold tracking-[0.08em] text-zinc-500">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-zinc-950">{value}</div>
      {detail ? <div className="mt-1 text-sm text-zinc-600">{detail}</div> : null}
    </div>
  );
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800",
        className
      )}
      {...props}
    />
  );
}

export function Field({ label, children, hint }: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-zinc-900">{label}</span>
      {children}
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "min-h-11 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100",
        className
      )}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "min-h-28 rounded-xl border border-zinc-200 bg-white/90 px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100",
        className
      )}
      {...props}
    />
  );
}

export interface ModuleNavItem {
  href: string;
  label: string;
  description: string;
  badge?: string;
}

const defaultModules: ModuleNavItem[] = [
  { href: "/", label: "首页", description: "今天该做什么" },
  { href: "/library", label: "资料", description: "材料与证据" },
  { href: "/review", label: "复习", description: "校准提取" },
  { href: "/explain", label: "解释", description: "费曼追问" },
  { href: "/compass", label: "罗盘", description: "计划与反思" },
  { href: "/insights", label: "洞察", description: "校准报告" },
  { href: "/settings", label: "设置", description: "隐私与 AI" }
];

export function ProductShell({
  currentPath,
  title,
  subtitle,
  children,
  actions,
  modules = defaultModules
}: PropsWithChildren<{ currentPath: string; title: string; subtitle: string; actions?: ReactNode; modules?: ModuleNavItem[] }>) {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_8%_0%,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_88%_8%,rgba(20,184,166,0.12),transparent_30%),linear-gradient(180deg,#fbfaf7_0%,#eef7f3_100%)] text-zinc-950">
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:shadow" href="#main-content">
        跳到主要内容
      </a>
      <div className="pointer-events-none fixed inset-0 opacity-[0.28] [background-image:linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="relative mx-auto grid w-full max-w-[1480px] gap-5 px-4 pb-28 pt-4 md:px-6 lg:grid-cols-[260px_1fr] lg:py-4">
        <aside className="hidden lg:block">
          <div className="sticky top-4 grid gap-4">
            <div className="rounded-[1.5rem] border border-white/70 bg-white/78 p-4 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-sm font-semibold text-emerald-700">MetaLearn OS</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-zinc-950">掌握系统</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">把材料变成提取、解释和校准证据。</p>
            </div>
            <ModuleNav currentPath={currentPath} modules={modules} />
          </div>
        </aside>
        <section className="grid min-w-0 gap-5">
          <header className="rounded-[1.75rem] border border-white/70 bg-white/72 p-4 shadow-[0_20px_70px_rgba(15,23,42,0.07)] backdrop-blur md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-700 lg:hidden">MetaLearn OS</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-zinc-950 md:text-5xl">{title}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 md:text-base">{subtitle}</p>
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          </header>
          <div id="main-content">{children}</div>
        </section>
      </div>
      <div className="fixed inset-x-4 bottom-4 z-40 lg:hidden">
        <MobileNav currentPath={currentPath} modules={modules.slice(0, 5)} />
      </div>
    </main>
  );
}

export function ModuleNav({ currentPath, modules }: { currentPath: string; modules: ModuleNavItem[] }) {
  return (
    <nav className="grid gap-1 rounded-[1.5rem] border border-white/70 bg-white/72 p-2 shadow-[0_20px_70px_rgba(15,23,42,0.07)] backdrop-blur" aria-label="MetaLearn modules">
      {modules.map((item) => {
        const active = item.href === "/" ? currentPath === "/" : currentPath.startsWith(item.href);
        return (
          <a
            key={item.href}
            href={item.href}
            className={clsx(
              "group rounded-2xl px-3 py-3 transition duration-200 hover:bg-emerald-50/80 focus:outline-none focus:ring-2 focus:ring-emerald-500",
              active ? "bg-emerald-950 text-white shadow-[0_16px_40px_rgba(6,95,70,0.18)]" : "text-zinc-700"
            )}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">{item.label}</span>
              {item.badge ? <span className={clsx("rounded-md px-1.5 py-0.5 text-xs", active ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800")}>{item.badge}</span> : null}
            </span>
            <span className={clsx("mt-1 block text-xs leading-5", active ? "text-emerald-50" : "text-zinc-500")}>{item.description}</span>
          </a>
        );
      })}
    </nav>
  );
}

export function MobileNav({ currentPath, modules }: { currentPath: string; modules: ModuleNavItem[] }) {
  return (
    <nav className="grid grid-cols-5 gap-1 rounded-2xl border border-white/80 bg-white/92 p-1 shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur" aria-label="Mobile modules">
      {modules.map((item) => {
        const active = item.href === "/" ? currentPath === "/" : currentPath.startsWith(item.href);
        return (
          <a key={item.href} href={item.href} className={clsx("rounded-xl px-2 py-2 text-center text-xs font-semibold transition", active ? "bg-white text-emerald-800 shadow-sm" : "text-zinc-500")}>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

export function TaskRail({ title, children, className }: PropsWithChildren<{ title: string; className?: string }>) {
  return (
    <aside className={clsx("rounded-[1.5rem] bg-emerald-950 p-5 text-white shadow-[0_24px_70px_rgba(6,78,59,0.22)]", className)}>
      <p className="text-sm font-semibold text-emerald-200">{title}</p>
      <div className="mt-4 grid gap-3">{children}</div>
    </aside>
  );
}

export function StatStrip({ items }: { items: Array<{ label: string; value: string; detail?: string; tone?: "neutral" | "good" | "warn" | "danger" }> }) {
  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-white/70 bg-white/72 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold tracking-[0.08em] text-zinc-500">{item.label}</p>
            <span className={clsx("size-2 rounded-full", item.tone === "good" ? "bg-emerald-500" : item.tone === "warn" ? "bg-amber-500" : item.tone === "danger" ? "bg-rose-500" : "bg-zinc-300")} />
          </div>
          <p className="mt-2 font-mono text-xl font-semibold tabular-nums md:text-2xl">{item.value}</p>
          {item.detail ? <p className="mt-1 text-sm text-zinc-600">{item.detail}</p> : null}
        </div>
      ))}
    </section>
  );
}

export function DocumentCard({ title, detail, meta, status, href = "/library" }: { title: string; detail: string; meta: string; status: string; href?: string }) {
  return (
    <article className="rounded-[1.25rem] border border-white/70 bg-white/76 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_70px_rgba(15,23,42,0.1)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <a href={href} className="text-base font-semibold tracking-[-0.01em] text-zinc-950 hover:text-emerald-800">
            {title}
          </a>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">{detail}</p>
        </div>
        <Badge>{status}</Badge>
      </div>
      <p className="mt-4 text-xs font-medium text-zinc-500">{meta}</p>
    </article>
  );
}

export function EvidenceCard({ quote, label = "来源证据", className }: { quote: string; label?: string; className?: string }) {
  return (
    <blockquote className={clsx("rounded-2xl border-l-4 border-emerald-500 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-950", className)}>
      <p className="text-xs font-semibold tracking-[0.08em] text-emerald-700">{label}</p>
      <p className="mt-2">{quote}</p>
    </blockquote>
  );
}

export function ReviewCard({
  title,
  sourceQuote,
  meta,
  sourceVisible = true,
  children
}: PropsWithChildren<{ title: string; sourceQuote: string; meta: string; sourceVisible?: boolean }>) {
  return (
    <article className="rounded-[1.5rem] bg-white/84 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <p className="text-xs font-semibold tracking-[0.08em] text-zinc-500">{meta}</p>
      <h3 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-zinc-950">{title}</h3>
      {sourceVisible ? (
        <EvidenceCard quote={sourceQuote} className="mt-4" />
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
          来源已隐藏。先主动提取，再在自评后查看证据。
        </div>
      )}
      {children ? <div className="mt-5">{children}</div> : null}
    </article>
  );
}

export function ConfidenceSelector({ value, onChange }: { value: 1 | 2 | 3 | 4 | 5; onChange: (value: 1 | 2 | 3 | 4 | 5) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {([1, 2, 3, 4, 5] as const).map((item) => (
        <button
          key={item}
          type="button"
          className={clsx(
            "rounded-2xl border px-3 py-3 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500",
            value === item ? "border-emerald-700 bg-emerald-950 text-white shadow-[0_12px_34px_rgba(6,95,70,0.18)]" : "border-zinc-200 bg-white/80 text-zinc-700 hover:bg-emerald-50"
          )}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-emerald-200 bg-emerald-50/50 p-6 text-center">
      <p className="text-lg font-semibold text-zinc-950">{title}</p>
      <p className="mx-auto mt-2 max-w-[56ch] text-sm leading-6 text-zinc-600">{detail}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SkeletonPanel({ className }: { className?: string }) {
  return <div className={clsx("h-36 animate-pulse rounded-[1.5rem] bg-gradient-to-r from-white/55 via-emerald-50/70 to-white/55", className)} />;
}

export function InlineError({ message }: { message: string }) {
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">{message}</div>;
}

export function ProgressRing({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid size-14 place-items-center rounded-full"
        style={{ background: `conic-gradient(#047857 ${Math.round(clamped * 360)}deg, rgba(15,23,42,0.08) 0deg)` }}
      >
        <div className="grid size-10 place-items-center rounded-full bg-white font-mono text-xs font-semibold tabular-nums">{Math.round(clamped * 100)}%</div>
      </div>
      <p className="text-sm font-semibold text-zinc-700">{label}</p>
    </div>
  );
}

export function TextLink({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={clsx("text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline", className)} {...props} />;
}

export function AppFrame({
  appName,
  subtitle,
  children,
  actions
}: PropsWithChildren<{ appName: string; subtitle: string; actions?: ReactNode }>) {
  return (
    <main className="min-h-[100dvh] bg-zinc-100 text-zinc-950">
      <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-5 md:px-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">MetaLearn Suite</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-zinc-950 md:text-4xl">{appName}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{subtitle}</p>
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>
        {children}
      </div>
    </main>
  );
}
