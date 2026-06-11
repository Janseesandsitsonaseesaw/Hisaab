import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/**
 * Renders a scannable barcode as an inline SVG.
 * Falls back to nothing if the value can't be encoded (e.g. non-numeric for EAN13).
 */
export default function Barcode({ value, height = 32, format = "EAN13" }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!value || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, String(value), {
        format,
        height,
        displayValue: true,
        fontSize: 11,
        margin: 0,
        width: 1.4,
      });
    } catch (err) {
      // Invalid value for the chosen format (e.g. wrong length for EAN13) — try CODE128 fallback
      try {
        JsBarcode(svgRef.current, String(value), {
          format: "CODE128",
          height,
          displayValue: true,
          fontSize: 11,
          margin: 0,
          width: 1.4,
        });
      } catch {
        // give up silently
      }
    }
  }, [value, height, format]);

  if (!value) return null;
  return <svg ref={svgRef} className="product-card-barcode-svg" />;
}
