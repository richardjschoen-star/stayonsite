import { RiCheckLine, RiDownload2Line, RiPrinterLine, RiShieldCheckLine } from "@remixicon/react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/base/buttons/button";
import { api } from "../api";
import { forceRefresh, projectOf, toast } from "../store";
import type { Invoice, Snapshot } from "../types";
import { fmtDay, fmtMoney } from "../ui";

function numberToWords(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const below1000 = (v: number): string => {
    if (v === 0) return "";
    if (v < 20) return ones[v];
    if (v < 100) return tens[Math.floor(v / 10)] + (v % 10 ? " " + ones[v % 10] : "");
    return ones[Math.floor(v / 100)] + " Hundred" + (v % 100 ? " " + below1000(v % 100) : "");
  };
  const scales = ["", " Thousand", " Million", " Billion"];
  let num = Math.floor(n);
  let i = 0;
  let res = "";
  while (num > 0) {
    const chunk = num % 1000;
    if (chunk) res = below1000(chunk) + scales[i] + (res ? " " + res : "");
    num = Math.floor(num / 1000);
    i++;
  }
  return res.trim();
}

export function InvoiceSheetModal({ s, invoice, onClose }: { s: Snapshot; invoice: Invoice; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const project = projectOf(s, invoice.project_id);
  const verifyUrl = `${location.origin}/console/${s.org.slug}/settings/billing?invoice=${encodeURIComponent(invoice.id)}`;
  const amountFormatted = fmtMoney(invoice.amount_cents, invoice.currency);
  const wholeUnits = Math.floor(invoice.amount_cents / 100);
  const words = `${invoice.currency} ${numberToWords(wholeUnits)} Only.`;
  const authDate = invoice.authorized_at
    ? new Date(invoice.authorized_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
    : "";

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(verifyUrl, { margin: 1, width: 160, color: { dark: "#0f172a", light: "#ffffff" } })
      .then((url) => active && setQrUrl(url))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [verifyUrl]);

  const authorize = async () => {
    setBusy(true);
    try {
      await api("POST", `invoice/${invoice.id}/authorize`, {});
      await forceRefresh();
      toast("Invoice authorized", { tone: "success" });
    } catch (e) {
      toast((e as Error).message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const printPdf = () => {
    const html = sheetRef.current?.outerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return toast("Allow popups to print/save as PDF", { tone: "error" });
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((el) => el.outerHTML).join("\n");
    w.document.write(`<!DOCTYPE html><html><head><title>${invoice.number}</title>${styles}<style>@page{size:A4;margin:10mm}body{background:#fff!important;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${html}<script>window.onload=()=>{setTimeout(()=>{window.print();},250);};</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border-button-default bg-background-secondary-default shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator-border px-5 py-3">
          <div>
            <p className="text-body-semibold text-text-primary">{invoice.number}</p>
            <p className="text-caption-1-medium text-text-tertiary">
              {invoice.authorized_at ? `Authorized by ${invoice.authorized_name}` : "Pending Staff Authorization"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {s.viewer.staff && !invoice.authorized_at && (
              <Button size="small" leadingIcon={RiShieldCheckLine} disabled={busy} onClick={authorize}>
                {busy ? "Authorizing…" : "Authorize Invoice"}
              </Button>
            )}
            <Button size="small" variant="secondary" leadingIcon={RiPrinterLine} onClick={printPdf}>
              Save / Print PDF
            </Button>
            <a
              href={`/api/portal/invoice/${invoice.id}/pdf`}
              download
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-button-default bg-background-primary-default px-3 text-body-2-medium text-text-primary hover:bg-background-secondary-hover"
            >
              <RiDownload2Line className="size-4" />
              Quick PDF
            </a>
            <Button size="small" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* Scrollable A4 Sheet */}
        <div className="overflow-y-auto bg-neutral-900/60 p-4 sm:p-6">
          <div ref={sheetRef} className="mx-auto w-full max-w-[780px] rounded-lg border border-slate-300 bg-white p-6 text-[11px] leading-snug text-slate-900 shadow-lg sm:p-8">
            {/* Top Bar */}
            <div className="relative flex items-center justify-center pb-2">
              <span className="text-[13px] font-bold tracking-wide text-blue-700 uppercase">INVOICE</span>
              <span className="absolute right-0 text-[10px] font-medium text-slate-600 uppercase">ORIGINAL FOR RECIPIENT</span>
            </div>

            <div className="border border-slate-800">
              {/* Header */}
              <div className="grid grid-cols-12 border-b border-slate-800">
                <div className="col-span-6 flex items-start gap-3 border-r border-slate-800 p-3">
                  <img src="/mark.png" alt="StayonSite" className="size-12 shrink-0 rounded-xl border border-slate-200 bg-slate-950 object-contain p-1.5" />
                  <div>
                    <div className="text-[13px] font-bold tracking-tight text-slate-900">STAYONSITE</div>
                    <div className="text-slate-700">Software &amp; Digital Product Studio</div>
                    <div className="mt-0.5 text-slate-600">Web: stayon.site</div>
                    <div className="text-slate-600">Email: hello@stayon.site</div>
                    <div className="mt-0.5 font-medium text-slate-700">SAC: 998314 (IT Design &amp; Development)</div>
                  </div>
                </div>
                <div className="col-span-6 grid grid-cols-2">
                  <div className="border-r border-b border-slate-800 p-2.5">
                    <div className="text-[10px] text-slate-500">Invoice #:</div>
                    <div className="mt-0.5 font-bold text-slate-900">{invoice.number}</div>
                  </div>
                  <div className="border-b border-slate-800 p-2.5">
                    <div className="text-[10px] text-slate-500">Invoice Date:</div>
                    <div className="mt-0.5 font-bold text-slate-900">{invoice.issued ? fmtDay(invoice.issued) : "—"}</div>
                  </div>
                  <div className="border-r border-slate-800 p-2.5">
                    <div className="text-[10px] text-slate-500">Project / SOW:</div>
                    <div className="mt-0.5 font-bold text-slate-900">{project?.name ?? "General"}</div>
                  </div>
                  <div className="p-2.5">
                    <div className="text-[10px] text-slate-500">Due Date:</div>
                    <div className="mt-0.5 font-bold text-slate-900">{invoice.due ? fmtDay(invoice.due) : "—"}</div>
                  </div>
                </div>
              </div>

              {/* Client & Engagement */}
              <div className="grid grid-cols-12 border-b border-slate-800">
                <div className="col-span-6 border-r border-slate-800 p-3">
                  <div className="text-[10px] font-medium text-slate-500">Billed To:</div>
                  <div className="mt-0.5 text-[12px] font-bold text-slate-900">{s.org.name}</div>
                  <div className="mt-0.5 text-slate-700">Workspace: {s.org.slug}</div>
                </div>
                <div className="col-span-6 p-3">
                  <div className="text-[10px] font-medium text-slate-500">Settlement Details:</div>
                  <div className="mt-0.5 font-semibold text-slate-900">{project?.name ?? "StayonSite Services"}</div>
                  <div className="mt-0.5 text-slate-600">Currency: {invoice.currency} · Status: {invoice.status.toUpperCase()}</div>
                </div>
              </div>

              {/* Line Items */}
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-100 text-[10px] font-bold text-slate-800">
                    <th className="w-8 border-r border-slate-800 px-2 py-1.5 text-center">#</th>
                    <th className="border-r border-slate-800 px-2.5 py-1.5 text-left">Item / Service Description</th>
                    <th className="w-16 border-r border-slate-800 px-2 py-1.5 text-center">SAC</th>
                    <th className="w-24 border-r border-slate-800 px-2 py-1.5 text-right">Rate</th>
                    <th className="w-12 border-r border-slate-800 px-2 py-1.5 text-center">Qty</th>
                    <th className="w-24 border-r border-slate-800 px-2 py-1.5 text-right">Taxable Value</th>
                    <th className="w-20 border-r border-slate-800 px-2 py-1.5 text-right">Tax</th>
                    <th className="w-24 px-2.5 py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="align-top">
                    <td className="h-36 border-r border-slate-800 px-2 py-3 text-center">1</td>
                    <td className="border-r border-slate-800 px-2.5 py-3">
                      <div className="font-bold text-slate-900">{project ? `${project.name} — Software Services` : "Software & Design Services"}</div>
                      {invoice.note && <div className="mt-1 text-[10px] text-slate-600">{invoice.note}</div>}
                    </td>
                    <td className="border-r border-slate-800 px-2 py-3 text-center tabular-nums">998314</td>
                    <td className="border-r border-slate-800 px-2 py-3 text-right tabular-nums">{amountFormatted}</td>
                    <td className="border-r border-slate-800 px-2 py-3 text-center tabular-nums">1</td>
                    <td className="border-r border-slate-800 px-2 py-3 text-right tabular-nums">{amountFormatted}</td>
                    <td className="border-r border-slate-800 px-2 py-3 text-right text-[10px] text-slate-600">0.00<br />(Non-GST)</td>
                    <td className="px-2.5 py-3 text-right font-semibold tabular-nums">{amountFormatted}</td>
                  </tr>
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t border-slate-800">
                <div className="grid grid-cols-12 border-b border-slate-800 text-[10px]">
                  <div className="col-span-7 px-3 py-1.5 text-slate-700">Total Items / Qty : 1 / 1.00</div>
                  <div className="col-span-3 px-2 py-1.5 text-right font-semibold text-slate-700">Taxable Amount</div>
                  <div className="col-span-2 px-2.5 py-1.5 text-right font-semibold tabular-nums">{amountFormatted}</div>
                </div>
                <div className="grid grid-cols-12 border-b border-slate-800 bg-slate-50">
                  <div className="col-span-7 px-3 py-2" />
                  <div className="col-span-3 px-2 py-2 text-right text-[13px] font-bold text-slate-900">Total</div>
                  <div className="col-span-2 px-2.5 py-2 text-right text-[13px] font-bold text-slate-900 tabular-nums">{amountFormatted}</div>
                </div>
                <div className="border-b border-slate-800 px-3 py-1.5 text-[10px] text-slate-700">
                  <span className="text-slate-500">Total amount (in words):</span> <span className="font-semibold text-slate-900">{words}</span>
                </div>
              </div>

              {/* SAC Table */}
              <table className="w-full border-collapse border-b border-slate-800 text-[10px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-50 text-slate-700">
                    <th className="border-r border-slate-800 px-3 py-1 text-left">SAC</th>
                    <th className="border-r border-slate-800 px-3 py-1 text-right">Taxable Value</th>
                    <th className="border-r border-slate-800 px-3 py-1 text-right">Tax Rate</th>
                    <th className="border-r border-slate-800 px-3 py-1 text-right">Tax Amount</th>
                    <th className="px-3 py-1 text-right">Total Tax Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border-r border-slate-800 px-3 py-1 tabular-nums">998314</td>
                    <td className="border-r border-slate-800 px-3 py-1 text-right tabular-nums">{amountFormatted}</td>
                    <td className="border-r border-slate-800 px-3 py-1 text-right">0% (Non-GST)</td>
                    <td className="border-r border-slate-800 px-3 py-1 text-right tabular-nums">0.00</td>
                    <td className="px-3 py-1 text-right tabular-nums">0.00</td>
                  </tr>
                </tbody>
              </table>

              {/* Status Strip */}
              {invoice.status === "paid" && (
                <div className="flex items-center justify-end gap-1.5 border-b border-slate-800 bg-emerald-50/70 px-3 py-1.5">
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <RiCheckLine className="size-3" />
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700">Amount Paid</span>
                </div>
              )}

              {/* Bottom 3-Column Footer */}
              <div className="grid grid-cols-12 border-b border-slate-800">
                <div className="col-span-5 space-y-1 border-r border-slate-800 p-3 text-[10px]">
                  <div className="mb-1 font-bold text-slate-900">Bank &amp; Remittance Details:</div>
                  <div><span className="text-slate-500">Beneficiary:</span> <span className="font-medium">StayonSite</span></div>
                  <div><span className="text-slate-500">Portal:</span> <span className="font-medium">https://stayon.site/console</span></div>
                  <div><span className="text-slate-500">Billing Email:</span> <span className="font-medium">hello@stayon.site</span></div>
                  <div><span className="text-slate-500">Reference #:</span> <span className="font-medium">{invoice.number}</span></div>
                </div>

                <div className="col-span-3 flex flex-col items-center justify-center border-r border-slate-800 p-3 text-center">
                  <div className="mb-1 text-[10px] font-semibold text-slate-800">Verify Online</div>
                  {qrUrl ? (
                    <img src={qrUrl} alt="Verify Invoice QR" className="size-16 rounded border border-slate-200" />
                  ) : (
                    <div className="size-16 rounded border border-slate-200 bg-slate-50" />
                  )}
                  <div className="mt-1 text-[8px] text-slate-500">Scan to verify</div>
                </div>

                <div className="col-span-4 flex flex-col items-center justify-between p-3 text-center">
                  <div className="text-[10px] font-bold tracking-wide text-slate-800">For STAYONSITE</div>
                  {invoice.authorized_at ? (
                    <div className="my-1 flex flex-col items-center">
                      <svg viewBox="0 0 120 76" className="h-14 w-24 text-blue-800" aria-label="Authorized Seal & Signature">
                        <circle cx="38" cy="38" r="32" fill="none" stroke="currentColor" strokeWidth="1.6" />
                        <circle cx="38" cy="38" r="26" fill="none" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2.5 2" />
                        <text x="38" y="21" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="currentColor" letterSpacing="1">STAYONSITE</text>
                        <rect x="10" y="31" width="56" height="14" rx="2.5" fill="#ffffff" stroke="currentColor" strokeWidth="1.2" />
                        <text x="38" y="40.5" textAnchor="middle" fontSize="7.2" fontWeight="bold" fill="currentColor" letterSpacing="0.7">AUTHORIZED</text>
                        <text x="38" y="59" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="currentColor">{authDate}</text>
                        <path d="M58 46 C66 26, 74 20, 78 38 C81 50, 88 26, 94 34 C98 40, 104 32, 114 35" fill="none" stroke="#1e3a8a" strokeWidth="1.8" strokeLinecap="round" />
                        <path d="M62 52 Q86 48 112 51" fill="none" stroke="#1e3a8a" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="my-2 rounded-md border border-dashed border-amber-400 bg-amber-50 px-2.5 py-1 text-[9px] font-medium text-amber-800">
                      Pending Staff Authorization
                    </div>
                  )}
                  <div className="text-[10px] text-slate-700">
                    {invoice.authorized_at ? (
                      <>
                        <span className="font-bold text-slate-900">{invoice.authorized_name}</span>
                        {invoice.authorized_title ? ` · ${invoice.authorized_title}` : ""}
                        <div className="text-[8px] text-slate-500">Authorized Signatory</div>
                      </>
                    ) : (
                      "Authorized Signatory"
                    )}
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-12 text-[10px]">
                <div className="col-span-5 border-r border-slate-800 p-3">
                  <div className="mb-1 font-bold text-slate-900">Notes:</div>
                  <div className="text-slate-600">Thank you for your business with StayonSite.</div>
                </div>
                <div className="col-span-7 p-3">
                  <div className="mb-1 font-bold text-slate-900">Terms and Conditions:</div>
                  <ol className="list-inside list-decimal space-y-0.5 text-slate-600">
                    <li>Services rendered as per the accepted Master Services Agreement.</li>
                    <li>Please quote Invoice # {invoice.number} in all correspondence.</li>
                    <li>This is a digitally authorized invoice and requires no physical signature.</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 text-[9px] text-slate-500">
              <span>Page 1 / 1 &nbsp; This is a digitally generated document.</span>
              <span>stayon.site</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
