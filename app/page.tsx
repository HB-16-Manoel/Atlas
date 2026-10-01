"use client";

import {
  useState,
} from "react";

import Image from "next/image";

import Home from "./components/Home";

import Journal from "./components/Journal";

import Planning from "./components/Planning";

import Progress from "./components/Progress";
import Settings from "./components/Settings";
import { useAtlasData } from "./hooks/useAtlasData";

function AtlasLogo({
  compact = false,
  decorative = false,
  sidebar = false,
}: {
  compact?: boolean;
  decorative?: boolean;
  sidebar?: boolean;
}) {
  return (
    <Image
      src="/atlas-icon-512.png"
      alt={
        decorative
          ? ""
          : "Atlas"
      }
      width={512}
      height={512}
      className={
        sidebar
          ? "h-11 w-11 shrink-0 object-contain"
          : compact
          ? "h-8 w-8 shrink-0 object-contain"
          : "h-16 w-16 shrink-0 object-contain"
      }
      priority
    />
  );
}

function AtlasWordmark({
  compact = false,
  sidebarExpanded,
}: {
  compact?: boolean;
  sidebarExpanded?: boolean;
}) {
  return (
    <div
      className={`flex items-center ${
        compact
          ? "gap-2"
          : "gap-3"
      }`}
    >
      <AtlasLogo
        compact={compact}
        decorative
        sidebar={sidebarExpanded !== undefined}
      />

      <span
        aria-label="Atlas"
        className={`${
          compact
            ? "text-[15px] font-semibold leading-none tracking-[0.13em]"
            : "text-[22px] font-semibold leading-none tracking-[0.15em]"
        } ${
          sidebarExpanded !== undefined
            ? `overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-[170ms] motion-reduce:transition-none ${
                sidebarExpanded
                  ? "max-w-24 opacity-100"
                  : "max-w-0 opacity-0"
              }`
            : ""
        }`}
      >
        <span
          aria-hidden="true"
          className="inline-block text-[1.08em] text-[#2F8CFF]"
        >
          A
        </span>

        <span
          aria-hidden="true"
          className="text-[#F4F6FF]"
        >
          TLAS
        </span>
      </span>
    </div>
  );
}

type MobilePage =
  | "Home"
  | "Planning"
  | "Progress"
  | "Journal";

const mobilePages: MobilePage[] = [
  "Home",
  "Planning",
  "Progress",
  "Journal",
];

type DesktopPage = MobilePage | "Settings";

function MobileNavIcon({
  page,
}: {
  page: MobilePage;
}) {
  const iconClasses =
    "h-5 w-5";

  if (page === "Home") {
    return (
      <svg
        aria-hidden="true"
        className={iconClasses}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m3 11 9-8 9 8"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 10v10h14V10M9 20v-6h6v6"
        />
      </svg>
    );
  }

  if (page === "Planning") {
    return (
      <svg
        aria-hidden="true"
        className={iconClasses}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m8.5 14 2 2 4.5-5"
        />
      </svg>
    );
  }

  if (page === "Progress") {
    return (
      <svg
        aria-hidden="true"
        className={iconClasses}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 19V9m6 10V5m6 14v-7m4 7H2"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={iconClasses}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Zm16 0A2.5 2.5 0 0 0 17.5 3H13v17h4.5a2.5 2.5 0 0 1 2.5 2V5.5Z"
      />
    </svg>
  );
}

function DesktopNavIcon({
  page,
}: {
  page: DesktopPage;
}) {
  if (page === "Home" || page === "Planning") {
    return <MobileNavIcon page={page} />;
  }

  if (page === "Progress") {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 5v14h16"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m7 15 4-4 3 3 5-6"
        />
      </svg>
    );
  }

  if (page === "Journal") {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 20h9"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m15 5 3 3"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="3" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"
      />
    </svg>
  );
}

function DesktopNavItem({
  page,
  active,
  expanded,
  onSelect,
}: {
  page: DesktopPage;
  active: boolean;
  expanded: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      aria-label={page}
      title={page}
      className={`group flex min-h-11 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-lg py-2 text-left text-[14px] font-medium tracking-[-0.01em] outline-none transition-[background-color,color,padding] duration-[170ms] focus-visible:ring-2 focus-visible:ring-[#7892FF]/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0F18] active:bg-white/[0.07] motion-reduce:transition-none ${
        expanded
          ? "px-3"
          : "px-2"
      } ${
        active
          ? "bg-white/[0.06] text-white"
          : "text-white/50 hover:bg-white/[0.035] hover:text-white/85"
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center transition-colors duration-200 ${
          active
            ? "text-[#7F98FF]"
            : "text-white/38 group-hover:text-white/70"
        }`}
      >
        <DesktopNavIcon page={page} />
      </span>
      <span
        className={`whitespace-nowrap transition-opacity duration-[140ms] motion-reduce:transition-none ${
          expanded
            ? "opacity-100"
            : "opacity-0"
        }`}
      >
        {page}
      </span>
    </button>
  );
}

function DesktopSidebar({
  activePage,
  onSelect,
}: {
  activePage: string;
  onSelect: (page: DesktopPage) => void;
}) {
  const [
    hovered,
    setHovered,
  ] = useState(false);
  const [
    keyboardFocused,
    setKeyboardFocused,
  ] = useState(false);
  const expanded =
    hovered ||
    keyboardFocused;

  return (
    <aside
      aria-label="Desktop navigation"
      data-expanded={expanded}
      onPointerEnter={() =>
        setHovered(true)
      }
      onPointerLeave={() =>
        setHovered(false)
      }
      onPointerDownCapture={() =>
        setKeyboardFocused(false)
      }
      onFocusCapture={(event) =>
        setKeyboardFocused(
          event.target instanceof HTMLElement &&
            event.target.matches(":focus-visible")
        )
      }
      onBlurCapture={(event) => {
        const nextTarget =
          event.relatedTarget;

        if (
          !(nextTarget instanceof Node) ||
          !event.currentTarget.contains(
            nextTarget
          )
        ) {
          setKeyboardFocused(false);
        }
      }}
      className={`hidden h-dvh shrink-0 overflow-hidden border-r border-white/[0.08] bg-[#0D0F18] transition-[width] duration-[170ms] ease-out motion-reduce:transition-none md:sticky md:top-0 md:flex md:flex-col ${
        expanded
          ? "w-52"
          : "w-[76px]"
      }`}
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-5 pt-6">
        <div className="overflow-hidden whitespace-nowrap">
          <AtlasWordmark sidebarExpanded={expanded} />
        </div>

        <div className="flex flex-1 items-start pt-[clamp(3rem,8vh,5rem)]">
          <div className="w-full">
            <nav aria-label="Primary navigation" className="space-y-1">
              {mobilePages.map(
                (
                  page
                ) => (
                  <DesktopNavItem
                    key={page}
                    page={page}
                    active={activePage === page}
                    expanded={expanded}
                    onSelect={() =>
                      onSelect(
                        page
                      )
                    }
                  />
                )
              )}
            </nav>

            <div className="mt-8 border-t border-white/[0.07] pt-4">
              <DesktopNavItem
                page="Settings"
                active={activePage === "Settings"}
                expanded={expanded}
                onSelect={() =>
                  onSelect(
                    "Settings"
                  )
                }
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ============================================================
 * MAIN ATLAS APP
 * ============================================================
 */

export default function AtlasApp() {
  const [
    activePage,
    setActivePage,
  ] = useState(
    "Home"
  );

  const {
    tasks,
    setTasks,
    habits,
    setHabits,
    events,
    setEvents,
    journalEntries,
    setJournalEntries,
    taskHistory,
    dataLoading,
    dataError,
    dataSource,
    syncStatus,
    syncMessage,
    retry,
  } = useAtlasData();

  if (dataLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#11131D] text-white">
        <p className="text-sm text-white/45">Loading Atlas…</p>
      </main>
    );
  }

  if (dataError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#11131D] px-6 text-white">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Atlas couldn&apos;t load your cloud data.</h1>
          <p className="mt-2 text-sm leading-6 text-white/45">{dataError}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-5 min-h-11 rounded-xl bg-[#5B7CFF] px-5 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  /* ============================================================
   * APP
   * ============================================================
   */

  return (
    <main className="min-h-dvh overflow-x-clip bg-[#11131D] text-white">
      <div className="flex min-h-dvh">

        {/* ====================================================
         * SIDEBAR
         * ==================================================== */}

        <DesktopSidebar
          activePage={activePage}
          onSelect={setActivePage}
        />

        {/* ====================================================
         * MAIN
         * ==================================================== */}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.08] bg-[#11131D]/95 px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)] backdrop-blur-xl md:hidden">
            <AtlasWordmark
              compact
            />

            <button
              type="button"
              aria-label="Open Settings"
              aria-current={
                activePage === "Settings"
                  ? "page"
                  : undefined
              }
              onClick={() =>
                setActivePage(
                  "Settings"
                )
              }
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors active:bg-white/[0.06] ${
                activePage === "Settings"
                  ? "bg-[#5B7CFF]/15 text-[#7892FF]"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"
                />
              </svg>
            </button>
          </header>

          <section
          className={`min-w-0 flex-1 ${
            activePage === "Home"
              ? "px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-4 sm:px-5 md:px-10 md:py-4"
              : activePage === "Progress"
                ? "px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-4 sm:px-5 md:p-10"
                : "px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-4 sm:px-5 md:p-10"
          }`}
        >

          {/* HOME */}

          {activePage ===
            "Home" && (
           <Home
  tasks={
    tasks
  }

  habits={
    habits
  }

  events={
    events
  }

  journalEntries={
    journalEntries
  }

  taskHistory={
    taskHistory
  }

  onNavigate={
    setActivePage
  }
/>
          )}

          {/* PLANNING */}

          {activePage ===
            "Planning" && (
            <Planning
              tasks={
                tasks
              }

              setTasks={
                setTasks
              }

              habits={
                habits
              }

              setHabits={
                setHabits
              }

              events={
                events
              }

              setEvents={
                setEvents
              }
            />
          )}

          {/* PROGRESS */}

          {activePage ===
            "Progress" && (
            <Progress
              tasks={
                tasks
              }

              habits={
                habits
              }
            />
          )}

          {/* JOURNAL */}

          {activePage ===
            "Journal" && (
            <Journal
              tasks={
                tasks
              }

              habits={
                habits
              }

              entries={
                journalEntries
              }

              setEntries={
                setJournalEntries
              }
            />
          )}

          {/* SETTINGS */}

          {activePage ===
            "Settings" && (
            <Settings
              dataSource={dataSource}
              syncStatus={syncStatus}
              syncMessage={syncMessage}
            />
          )}
          </section>
        </div>

        <nav
          aria-label="Mobile navigation"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-[#11131D]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.375rem)] pt-1.5 backdrop-blur-xl md:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
            {mobilePages.map(
              (
                page
              ) => {
                const isActive =
                  activePage ===
                  page;

                return (
                  <button
                    type="button"
                    key={
                      page
                    }
                    aria-current={
                      isActive
                        ? "page"
                        : undefined
                    }
                    onClick={() =>
                      setActivePage(
                        page
                      )
                    }
                    className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors active:bg-white/[0.04] ${
                      isActive
                        ? "text-[#7892FF]"
                        : "text-white/45 hover:bg-white/5 hover:text-white/75"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute top-0 h-0.5 w-5 rounded-full transition-colors ${
                        isActive
                          ? "bg-[#5B7CFF]"
                          : "bg-transparent"
                      }`}
                    />

                    <MobileNavIcon
                      page={
                        page
                      }
                    />
                    <span>
                      {
                        page
                      }
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </nav>
      </div>
    </main>
  );
}
