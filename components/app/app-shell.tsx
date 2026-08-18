"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowsClockwise,
  CaretDown,
  ChartBar,
  Gear,
  List,
  Package,
  Receipt,
  SignOut,
  Storefront,
  Users,
} from "@phosphor-icons/react";
import { usePharmacyStore, useCurrentStaff, useHydrated } from "@/lib/store/pharmacy-store";
import { navFor, ROLE_LABEL, type NavItem } from "./nav";
import { SignInGate } from "./sign-in-gate";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Kbd,
  Sheet,
  SheetContent,
  SheetTitle,
  ThemeToggle,
  TooltipProvider,
} from "@/components/ui";
import { useHotkeys } from "@/lib/hooks/use-hotkeys";
import { cn } from "@/lib/utils";

const ICONS = { Storefront, Package, Receipt, ChartBar, Gear, Users } as const;

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] px-3 text-[0.875rem] font-medium",
        // 44px minimum on touch; the desktop rail keeps its denser 36px rows.
        "min-h-11 py-2.5 lg:min-h-0 lg:py-2",
        "transition-colors duration-150 ease-[var(--ease-out-quart)]",
        active
          ? "bg-brand-subtle text-brand-text"
          : "text-text-secondary hover:bg-surface-hover hover:text-text",
      )}
    >
      <Icon size={18} weight={active ? "fill" : "regular"} aria-hidden="true" />
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const staff = useCurrentStaff();
  const signOut = usePharmacyStore((s) => s.signOut);
  const resetDemo = usePharmacyStore((s) => s.resetDemo);
  const shopName = usePharmacyStore((s) => s.settings.shopName);
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const items = React.useMemo(() => navFor(staff?.role), [staff?.role]);

  // "g then <key>" jumps between sections, the convention every keyboard-driven
  // tool uses. Cheap to learn, and it keeps the operator's hands where the
  // scanner is.
  const goMode = React.useRef(false);
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const el = event.target as HTMLElement | null;
      if (el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable)) return;
      if (goMode.current) {
        const match = items.find((i) => i.shortcut?.endsWith(event.key.toLowerCase()));
        goMode.current = false;
        if (match) {
          event.preventDefault();
          router.push(match.href);
        }
        return;
      }
      if (event.key.toLowerCase() === "g" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        goMode.current = true;
        window.setTimeout(() => (goMode.current = false), 1200);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, router]);

  useHotkeys({ escape: () => setMobileNavOpen(false) });

  // The store rehydrates from localStorage after first paint. Rendering the
  // signed-out gate before that would flash it at an already signed-in operator.
  if (!hydrated) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg-sunken">
        <span className="sr-only">Loading</span>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-border">
          <div className="h-full w-1/3 rounded-full bg-brand motion-safe:animate-[ui-shimmer_1.1s_linear_infinite]" />
        </div>
      </div>
    );
  }

  if (!staff) return <SignInGate />;

  const sidebar = (
    <>
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Image src="/brand/foxquart-logo.svg" alt="" width={22} height={22} className="rounded-[5px]" />
        <span className="truncate text-[0.9375rem] font-medium tracking-[-0.02em] text-text">
          {shopName}
        </span>
      </div>

      <nav aria-label="Sections" className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            onNavigate={() => setMobileNavOpen(false)}
          />
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left transition-colors duration-150 ease-[var(--ease-out-quart)] hover:bg-surface-hover lg:min-h-0"
            >
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-[0.75rem] font-medium text-brand-text"
              >
                {staff.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-medium text-text">{staff.name}</span>
                <span className="block text-[0.75rem] text-text-tertiary">{ROLE_LABEL[staff.role]}</span>
              </span>
              <CaretDown size={13} className="shrink-0 text-text-tertiary" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-[15rem]">
            <DropdownMenuLabel>Signed in as {staff.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={<SignOut size={15} />}
              onSelect={() => {
                setMobileNavOpen(false);
                signOut();
              }}
            >
              Hand over the till
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={<ArrowsClockwise size={15} />}
              destructive
              onSelect={() => {
                setMobileNavOpen(false);
                resetDemo();
                router.push("/pos");
              }}
            >
              Reset demo data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh bg-bg">
        <aside className="hidden w-[15rem] shrink-0 flex-col border-r border-border bg-surface lg:flex">
          {sidebar}
        </aside>

        {/* Below lg the rail becomes a drawer. Radix owns the focus trap, the
            Escape key, the scroll lock and the backdrop dismissal, so none of
            those are re-implemented here and none of them can drift. */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            showClose={false}
            className="w-[17rem] max-w-[85vw] lg:hidden"
          >
            <SheetTitle className="sr-only">Sections</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              className="-ml-1.5 size-11 lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <List size={20} />
            </Button>

            {/* One line at 360px: the name truncates rather than wrapping the
                header onto a second row. */}
            <span className="min-w-0 truncate text-[0.9375rem] font-medium tracking-[-0.02em] text-text lg:hidden">
              {shopName}
            </span>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span className="hidden items-center gap-1.5 text-[0.75rem] text-text-tertiary md:flex">
                <Kbd size="sm">g</Kbd>
                <span>then a section key to jump</span>
              </span>
              <ThemeToggle />
            </div>
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
