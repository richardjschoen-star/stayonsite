import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { Badge } from "@/components/base/badges/badge";
import { ButtonLink } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { InputBase, TextField } from "@/components/base/input/input";
import { Kbd } from "@/components/base/kbd/kbd";
import { cx } from "@/utils/cx";
import {
  RiAnthropicFill,
  RiArrowRightLine,
  RiDeepseekFill,
  RiGeminiFill,
  RiMetaFill,
  RiOpenaiFill,
  RiSearchLine,
} from "@remixicon/react";
import { MotionConfig, motion } from "motion/react";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Capabilities } from "./capabilities";
import { Console } from "./console";
import { Contact, Faq, Process, Testimonial, Work } from "./sections";

const LINKS = [
  { href: "#services", label: "Services" },
  { href: "#work", label: "Work" },
  { href: "#process", label: "Process" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const HEADLINE = ["AI", "software", "that", "stays", "on", "site"];

const WORKS_WITH = [
  { icon: RiOpenaiFill, label: "OpenAI" },
  { icon: RiAnthropicFill, label: "Anthropic" },
  { icon: RiGeminiFill, label: "Gemini" },
  { icon: RiMetaFill, label: "Llama" },
  { icon: RiDeepseekFill, label: "DeepSeek" },
];

function Mark({
  spinning,
  className,
  style,
}: {
  spinning?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src="/mark.png"
      alt=""
      style={style}
      className={cx(spinning && "mark-spin", className)}
    />
  );
}

/** Stagger for the `.rise` entrance. */
const delay = (ms: number, extra?: CSSProperties) =>
  ({ "--d": `${ms}ms`, ...extra }) as CSSProperties;

/** Bencho's moving nav pill: follows the pointer, rests on the section in view. */
function NavLinks() {
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach(
          (e) =>
            e.isIntersecting &&
            setActive(e.target.id === "top" ? null : `#${e.target.id}`),
        ),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    ["#top", ...LINKS.map((l) => l.href)].forEach((href) => {
      const el = document.querySelector(href);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  const lit = hover ?? active;
  return (
    <ul
      className="hidden items-center gap-1 lg:flex"
      onPointerLeave={() => setHover(null)}
    >
      {LINKS.map((l) => (
        <li
          key={l.href}
          className="relative"
          onPointerEnter={() => setHover(l.href)}
        >
          {lit === l.href && (
            <motion.span
              layoutId="nav-pill"
              aria-hidden
              className="absolute inset-0 rounded-lg bg-background-secondary-default"
              transition={{
                type: "spring",
                stiffness: 520,
                damping: 42,
                mass: 0.7,
              }}
            />
          )}
          <a
            href={l.href}
            className={cx(
              "relative block rounded-lg px-2.5 py-1.5 text-body-medium transition-colors duration-150 outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              lit === l.href ? "text-text-primary" : "text-text-secondary",
            )}
          >
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Reverse UI's Command K, on the native <dialog>: jump to any section. */
function CommandMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const items = [
    ...LINKS,
    { href: "#contact", label: "Book a discovery call" },
    { href: "mailto:hello@stayon.site", label: "Email hello@stayon.site" },
  ];
  const hits = items.filter((i) =>
    i.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const go = (href: string) => {
    onClose();
    window.location.href = href;
  };

  return (
    <dialog
      ref={ref}
      onClose={() => (onClose(), setQuery(""))}
      onClick={(e) => e.target === ref.current && onClose()}
      className="pop-dialog m-auto mt-[12vh] w-[min(560px,calc(100vw-2rem))] rounded-3xl border border-border-button-default bg-background-primary-default p-2 text-text-primary shadow-xl backdrop:bg-black/70"
    >
      <form
        method="dialog"
        onSubmit={(e) => (e.preventDefault(), hits[0] && go(hits[0].href))}
      >
        <TextField
          aria-label="Search the site"
          value={query}
          onChange={setQuery}
          autoFocus
        >
          <InputBase
            leadingIcon={RiSearchLine}
            placeholder="Where do you want to go?"
          />
        </TextField>
      </form>
      <ul className="mt-2 flex flex-col">
        {hits.map((i, n) => (
          <li
            key={i.href}
            className="rise"
            style={delay(n * 25, {
              "--rise": "4px",
              "--blur": "2px",
            } as CSSProperties)}
          >
            <button
              type="button"
              onClick={() => go(i.href)}
              className="nudge flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start text-body-medium text-text-primary transition-colors duration-150 outline-none hover:bg-background-primary-hover focus-visible:bg-background-primary-hover"
            >
              {i.label}
              <RiArrowRightLine
                className="size-4 text-foreground-icon-tertiary"
                aria-hidden
              />
            </button>
          </li>
        ))}
        {hits.length === 0 && (
          <li className="px-3 py-2.5 text-body-regular text-text-tertiary">
            Nothing matches. Try “pricing” or “work”.
          </li>
        )}
      </ul>
    </dialog>
  );
}

function Nav({ onSearch }: { onSearch: () => void }) {
  return (
    <header className="sticky top-0 z-40">
      {/* Bencho's progressive blur: the bar dissolves into the page instead of ending on a line. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background-full to-transparent backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_45%,transparent)]"
      />
      <nav
        aria-label="Main"
        className="relative mx-auto flex max-w-[1240px] items-center gap-6 px-4 py-4 sm:px-6"
      >
        <a
          href="#top"
          className="group flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <Mark className="size-6 transition-[rotate] duration-[600ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:rotate-60 motion-reduce:transition-none" />
          <span className="text-title-3-medium text-text-primary">
            Stayon<span className="italic">Site</span>
          </span>
        </a>
        <NavLinks />
        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onSearch}
            className="hidden h-9 w-52 items-center gap-2 rounded-full bg-background-secondary-default ps-3 pe-1.5 text-body-medium text-text-placeholder transition-colors duration-150 outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring md:flex"
          >
            <RiSearchLine
              className="size-4 text-foreground-icon-tertiary"
              aria-hidden
            />
            Search
            <Kbd className="ms-auto">⌘K</Kbd>
          </button>
          <IconButton
            icon={RiSearchLine}
            aria-label="Search"
            onClick={onSearch}
            className="md:hidden"
          />
          <ThemeToggle appearance="segmented" size="small" />
          <LinkButton
            variant="secondary"
            href="/console"
            className="hidden px-2 sm:inline-flex"
          >
            Client login
          </LinkButton>
          <ButtonLink href="#contact" size="small">
            Book a call
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}

function Hero({
  running,
  onRunningChange,
}: {
  running: boolean;
  onRunningChange: (r: boolean) => void;
}) {
  return (
    <section id="top" className="flex flex-col gap-16 pt-14 pb-10 sm:pt-20">
      <div className="mx-auto flex max-w-[1080px] flex-col items-center gap-7 px-4 text-center">
        <a
          href="#services"
          style={delay(0)}
          className="rise sweep-ring nudge flex items-center gap-2 rounded-full border py-1 ps-1 pe-3 text-body-2-medium text-text-secondary transition-colors duration-150 outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <Badge color="primary">New</Badge>
          Agents now run on air-gapped Kubernetes
          <RiArrowRightLine className="size-3.5" aria-hidden />
        </a>
        <h1 className="text-hero-semibold font-stretch-semi-condensed text-balance text-text-primary">
          {HEADLINE.map((w, i) => (
            <Fragment key={w}>
              {i > 0 && " "}
              <span className="rise inline-block" style={delay(80 + i * 70)}>
                {w}
              </span>
            </Fragment>
          ))}
          <Mark
            spinning={running}
            style={delay(560)}
            className="mark-in ms-[0.14em] inline-block size-[0.62em] align-baseline"
          />
        </h1>
        <p
          className="rise max-w-[58ch] text-headline-regular text-pretty text-text-secondary"
          style={delay(480, {
            "--rise": "12px",
            "--blur": "3px",
          } as CSSProperties)}
        >
          StayonSite designs, builds and runs AI agents, copilots and search for
          your business. Everything is deployed inside your own cloud or data
          center, so your data never leaves your network.
        </p>
        <div
          className="rise flex flex-wrap items-center justify-center gap-3"
          style={delay(580, {
            "--rise": "12px",
            "--blur": "3px",
          } as CSSProperties)}
        >
          <ButtonLink href="#contact" className="shine">
            Book a discovery call
          </ButtonLink>
          <ButtonLink href="#work" variant="secondary">
            See our work
          </ButtonLink>
        </div>
        <div
          className="rise flex flex-col items-center gap-3 pt-4"
          style={delay(680, {
            "--rise": "8px",
            "--blur": "2px",
          } as CSSProperties)}
        >
          <p className="text-body-2-medium text-text-tertiary">
            Model-agnostic. We ship with
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {WORKS_WITH.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-1.5 text-body-medium text-text-secondary transition-colors duration-150 hover:text-text-primary"
              >
                <Icon
                  className="size-4 text-foreground-icon-secondary"
                  aria-hidden
                />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div
        className="rise"
        style={delay(760, {
          "--rise": "40px",
          "--blur": "4px",
        } as CSSProperties)}
      >
        <Console onRunningChange={onRunningChange} />
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    {
      title: "Services",
      links: [
        ["Agents", "#services"],
        ["Search", "#services"],
        ["Copilots", "#services"],
        ["Infrastructure", "#services"],
      ],
    },
    {
      title: "Company",
      links: [
        ["Work", "#work"],
        ["Process", "#process"],
        ["Pricing", "#pricing"],
        ["FAQ", "#faq"],
      ],
    },
    {
      title: "Contact",
      links: [
        ["hello@stayon.site", "mailto:hello@stayon.site"],
        ["Book a call", "#contact"],
      ],
    },
  ];
  return (
    <footer className="overflow-clip border-t border-separator-border">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 pt-16 sm:grid-cols-[2fr_1fr_1fr_1fr] sm:px-6">
        <p className="max-w-[32ch] text-body-regular text-text-secondary">
          An AI software studio. We build systems that run in your environment
          and stay there.
        </p>
        {cols.map((c) => (
          <div key={c.title} className="flex flex-col gap-3">
            <p className="text-body-medium text-text-primary">{c.title}</p>
            <ul className="flex flex-col gap-2">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="inline-block text-body-regular text-text-secondary transition-[color,translate] duration-150 hover:translate-x-0.5 hover:text-text-primary"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        className="mx-auto flex max-w-[1240px] items-end gap-[0.06em] px-4 pt-16 pb-[0.14em] text-wordmark-medium font-stretch-semi-condensed text-text-primary select-none sm:px-6"
        aria-hidden
      >
        <span className="reveal reveal-short">
          Stayon<span className="italic">Site</span>
        </span>
        <Mark className="scroll-spin mb-[0.08em] size-[0.5em]" />
      </div>
      <div className="mx-auto flex max-w-[1240px] justify-between gap-4 px-4 py-6 text-body-2-medium text-text-tertiary sm:px-6">
        <span>© 2026 StayonSite</span>
        <span className="flex gap-4">
          <a href="/privacy/" className="hover:text-text-primary">
            Privacy
          </a>
          <a href="/terms/" className="hover:text-text-primary">
            Terms
          </a>
        </span>
      </div>
    </footer>
  );
}

export default function App() {
  const [running, setRunning] = useState(true);
  const [search, setSearch] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // One listener feeds every .spotlight card its pointer position.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(
        ".spotlight",
      );
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--x", `${e.clientX - r.left}px`);
      el.style.setProperty("--y", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background-full text-text-primary">
        <Nav onSearch={() => setSearch(true)} />
        <main>
          <Hero running={running} onRunningChange={setRunning} />
          <Capabilities />
          <Work />
          <Process />
          {/* <Pricing /> paused; see sections.tsx */}
          <Testimonial />
          <Faq />
          <Contact />
        </main>
        <Footer />
        <CommandMenu open={search} onClose={() => setSearch(false)} />
      </div>
    </MotionConfig>
  );
}
