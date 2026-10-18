"use client";

import HoverTranslate from "@/components/HoverTranslate";

// Opens the site-wide contact dialog (mounted in the studio layout).
export default function SheetContactButton() {
  return (
    <button
      type="button"
      className="sheet-btn"
      onClick={() => window.dispatchEvent(new CustomEvent("studio:contact"))}
    >
      <HoverTranslate en="contact" no="kontakt" align="end" />
    </button>
  );
}
