import { useEffect, useRef, useState } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import {
  RiAnthropicFill,
  RiArrowRightLine,
  RiDeepseekFill,
  RiGeminiFill,
  RiMetaFill,
  RiOpenaiFill,
  RiSearchLine,
} from "@remixicon/react";
import { AuthCard } from "@/components/application/auth/auth-card";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { Badge } from "@/components/base/badges/badge";
import { ButtonLink } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { InputBase, TextField } from "@/components/base/input/input";
import { Kbd } from "@/components/base/kbd/kbd";
import { Capabilities } from "./capabilities";
import { Console } from "./console";
import { Contact, Faq, Pricing, Process, Testimonial, Work } from "./sections";
import { cx } from "@/utils/cx";

const LINKS = [
  { href: "#services", label: "Services" },
  { href: "#work", label: "Work" },
  { href: "#process", label: "Process" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const WORKS_WITH = [
  { icon: RiOpenaiFill, label: "OpenAI" },
  { icon: RiAnthropicFill, label: "Anthropic" },
  { icon: RiGeminiFill, label: "Gemini" },
  { icon: RiMetaFill, label: "Llama" },
  { icon: RiDeepseekFill, label: "DeepSeek" },
];

function Mark({ spinning, className }: { spinning?: boolean; className?: string }) {
  return <img src="/mark.png" alt="" className={cx(spinning && "mark-spin", className)} />;
}

/** Reverse UI's Command K, on the native <dialog>: jump to any section. */
function CommandMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const items = [...LINKS, { href: "#contact", label: "Book a discovery call" }, { href: "mailto:hello@stayon.site", label: "Email hello@stayon.site" }];
  const hits = items.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase()));

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
      className="m-auto mt-[12vh] w-[min(560px,calc(100vw-2rem))] rounded-3xl border border-border-button-default bg-background-primary-default p-2 text-text-primary shadow-xl backdrop:bg-black/70"
    >
      <form method="dialog" onSubmit={(e) => (e.preventDefault(), hits[0] && go(hits[0].href))}>
        <TextField aria-label="Search the site" value={query} onChange={setQuery} autoFocus>
          <InputBase leadingIcon={RiSearchLine} placeholder="Where do you want to go?" />
        </TextField>
      </form>
      <ul className="mt-2 flex flex-col">
        {hits.map((i) => (
          <li key={i.href}>
            <button
              type="button"
              onClick={() => go(i.href)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start text-body-medium text-text-primary transition-colors duration-150 outline-none hover:bg-background-primary-hover focus-visible:bg-background-primary-hover"
            >
              {i.label}
              <RiArrowRightLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
            </button>
          </li>
        ))}
        {hits.length === 0 && <li className="px-3 py-2.5 text-body-regular text-text-tertiary">Nothing matches. Try “pricing” or “work”.</li>}
      </ul>
    </dialog>
  );
}

/** Client console sign-in, with BoardUI's modal motion. */
function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(o) => !o && onClose()}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 transition-opacity duration-300 ease-out data-[entering]:opacity-0 data-[exiting]:opacity-0"
    >
      <Modal className="transform-gpu transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[opacity,transform,filter] data-[entering]:scale-[0.85] data-[entering]:opacity-0 data-[entering]:blur-[4px] data-[exiting]:scale-[0.85] data-[exiting]:opacity-0 data-[exiting]:blur-[4px]">
        <Dialog aria-label="Sign in to the client console" className="relative outline-none">
          <CloseButton size="sm" aria-label="Close" onClick={onClose} className="absolute end-4 top-4 z-10" />
          <AuthCard
            mode="signin"
            layout="stacked"
            title="Sign in to your console"
            description="For StayonSite clients. Use your company's single sign-on."
            providers={["okta", "microsoft", "google"]}
            onSubmit={onClose}
            onProvider={onClose}
          />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function Nav({ onSearch, onLogin }: { onSearch: () => void; onLogin: () => void }) {
  return (
    <header className="sticky top-0 z-40">
      {/* Bencho's progressive blur: the bar dissolves into the page instead of ending on a line. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background-full to-transparent backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_45%,transparent)]" />
      <nav aria-label="Main" className="relative mx-auto flex max-w-[1240px] items-center gap-6 px-4 py-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
          <Mark className="size-6" />
          <span className="text-title-3-medium text-text-primary">
            Stayon<span className="italic">Site</span>
          </span>
        </a>
        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-lg px-2.5 py-1.5 text-body-medium text-text-secondary transition-colors duration-150 outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onSearch}
            className="hidden h-9 w-52 items-center gap-2 rounded-full bg-background-secondary-default ps-3 pe-1.5 text-body-medium text-text-placeholder transition-colors duration-150 outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring md:flex"
          >
            <RiSearchLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
            Search
            <Kbd className="ms-auto">⌘K</Kbd>
          </button>
          <IconButton icon={RiSearchLine} aria-label="Search" onClick={onSearch} className="md:hidden" />
          <ThemeToggle appearance="segmented" size="small" />
          <LinkButton variant="secondary" onClick={onLogin} className="hidden px-2 sm:inline-flex">
            Client login
          </LinkButton>
          <ButtonLink href="#contact" size="small">Book a call</ButtonLink>
        </div>
      </nav>
    </header>
  );
}

function Hero({ running, onRunningChange }: { running: boolean; onRunningChange: (r: boolean) => void }) {
  return (
    <section id="top" className="flex flex-col gap-16 pt-14 pb-10 sm:pt-20">
      <div className="mx-auto flex max-w-[1080px] flex-col items-center gap-7 px-4 text-center">
        <a
          href="#services"
          className="flex items-center gap-2 rounded-full border border-border-button-default py-1 ps-1 pe-3 text-body-2-medium text-text-secondary transition-colors duration-150 outline-none hover:border-border-button-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <Badge color="primary">New</Badge>
          Agents now run on air-gapped Kubernetes
        </a>
        <h1 className="text-hero-semibold font-stretch-semi-condensed text-balance text-text-primary">
          AI software that stays on site
          <Mark spinning={running} className="ms-[0.14em] inline-block size-[0.62em] align-baseline" />
        </h1>
        <p className="max-w-[58ch] text-headline-regular text-pretty text-text-secondary">
          StayonSite designs, builds and runs AI agents, copilots and search for your business. Everything is deployed inside
          your own cloud or data center, so your data never leaves your network.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="#contact">Book a discovery call</ButtonLink>
          <ButtonLink href="#work" variant="secondary">See our work</ButtonLink>
        </div>
        <div className="flex flex-col items-center gap-3 pt-4">
          <p className="text-body-2-medium text-text-tertiary">Model-agnostic. We ship with</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {WORKS_WITH.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5 text-body-medium text-text-secondary">
                <Icon className="size-4 text-foreground-icon-secondary" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Console onRunningChange={onRunningChange} />
    </section>
  );
}

function Footer() {
  const cols = [
    { title: "Services", links: [["Agents", "#services"], ["Search", "#services"], ["Copilots", "#services"], ["Infrastructure", "#services"]] },
    { title: "Company", links: [["Work", "#work"], ["Process", "#process"], ["Pricing", "#pricing"], ["FAQ", "#faq"]] },
    { title: "Contact", links: [["hello@stayon.site", "mailto:hello@stayon.site"], ["Book a call", "#contact"]] },
  ];
  return (
    <footer className="overflow-hidden border-t border-separator-border">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 pt-16 sm:grid-cols-[2fr_1fr_1fr_1fr] sm:px-6">
        <p className="max-w-[32ch] text-body-regular text-text-secondary">
          An AI software studio. We build systems that run in your environment and stay there.
        </p>
        {cols.map((c) => (
          <div key={c.title} className="flex flex-col gap-3">
            <p className="text-body-medium text-text-primary">{c.title}</p>
            <ul className="flex flex-col gap-2">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="text-body-regular text-text-secondary transition-colors duration-150 hover:text-text-primary">{label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1240px] items-end gap-[0.06em] px-4 pt-16 pb-[0.14em] text-wordmark-medium font-stretch-semi-condensed text-text-primary select-none sm:px-6" aria-hidden>
        <span>
          Stayon<span className="italic">Site</span>
        </span>
        <Mark className="mb-[0.08em] size-[0.5em]" />
      </div>
      <div className="mx-auto flex max-w-[1240px] justify-between gap-4 px-4 py-6 text-body-2-medium text-text-tertiary sm:px-6">
        <span>© 2026 StayonSite</span>
        <span>Built with BoardUI</span>
      </div>
    </footer>
  );
}

export default function App() {
  const [running, setRunning] = useState(true);
  const [search, setSearch] = useState(false);
  const [login, setLogin] = useState(false);

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

  return (
    <div className="min-h-screen bg-background-full text-text-primary">
      <Nav onSearch={() => setSearch(true)} onLogin={() => setLogin(true)} />
      <main>
        <Hero running={running} onRunningChange={setRunning} />
        <Capabilities />
        <Work />
        <Process />
        <Pricing />
        <Testimonial />
        <Faq />
        <Contact />
      </main>
      <Footer />
      <CommandMenu open={search} onClose={() => setSearch(false)} />
      <LoginModal open={login} onClose={() => setLogin(false)} />
    </div>
  );
}
