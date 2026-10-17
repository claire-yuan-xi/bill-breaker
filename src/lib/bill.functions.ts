import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchUSBillText } from "./fetch-bill.server";

const STATE_RE = /^[A-Z]{2,4}$/;
const BILL_NO_RE = /^[A-Za-z]{1,8}[.\s-]?\d{1,6}$/;

export type BillMeta = {
  id: string;
  jurisdiction: string;
  sourceUrl: string;
  textProvided: boolean;
  notice: string | null;
};

function sourceFor(state: string, billNo: string): string {
  if (state === "US") {
    return `https://www.congress.gov/quick-search/legislation?wordsPhrases=&legislationNumbers=${encodeURIComponent(billNo)}`;
  }
  return `https://legiscan.com/gaits/search?state=${state}&bill_number=${encodeURIComponent(billNo)}`;
}

// Lightweight metadata for the page header.
// The actual analysis lives in the streaming /api/explain-bill endpoint
// (which writes a server-side 7-day cache shared across all viewers).
export const getBillMeta = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        state: z.string().regex(STATE_RE).default("US"),
        billNo: z.string().regex(BILL_NO_RE).or(z.literal("")),
        hasText: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<BillMeta> => {
    const { state, billNo, hasText } = data;
    const id = billNo ? `${state} ${billNo}`.trim() : "pasted bill";
    let sourceUrl = sourceFor(state, billNo || "");
    let notice: string | null = null;

    // For federal bills without pasted text, try to confirm the bill exists
    // and resolve the canonical congress.gov URL.
    if (!hasText && state === "US" && billNo) {
      const fetched = await fetchUSBillText(billNo);
      if (fetched) {
        sourceUrl = fetched.sourceUrl;
      } else {
        notice =
          "Could not auto-fetch this bill from congress.gov. Open the official source, copy the text, and paste it on the Paste tab.";
      }
    } else if (!hasText && state !== "US" && billNo) {
      notice =
        "State bill text cannot be auto-fetched. Open the official source, copy the text, and paste it on the Paste tab.";
    }

    return {
      id,
      jurisdiction: state,
      sourceUrl,
      textProvided: hasText,
      notice,
    };
  });
