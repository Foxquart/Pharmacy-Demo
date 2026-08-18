import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The social card, generated rather than screenshotted.
 *
 * Sits at the app root, so every route inherits it unless it ships its own.
 * Kept deliberately plain: a link preview is rendered at roughly 500px wide in
 * a chat list, so anything smaller than the subline is unreadable and anything
 * busier than this reads as noise at that size.
 *
 * The twelve swatches along the foot are the same OKLCH hues the bento uses for
 * the twelve racks, so the card and the page it opens share a palette.
 */

export const alt = "Meridian Pharmacy, chemist on 100 Feet Road, Indiranagar, Bengaluru";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The twelve rack hues, as sRGB.
 *
 * Satori does NOT understand `oklch()` and silently paints it black, which is
 * how the first render lost the entire colour strip. These are the exact same
 * `oklch(0.70 0.14 H)` values the bento uses, converted once; the muted entry
 * is the devices rack, which drops chroma to read as steel.
 */
const RACK_COLOURS = [
  "#e57691", "#e87876", "#e67d58", "#e0843e",
  "#be9a11", "#7db04e", "#3db87c", "#00b7c3",
  "#58a2f2", "#8f9ec2", "#ac89e8", "#dd78ae",
];

/** oklch(0.545 0.128 155), the `success` token, converted for the same reason. */
const OPEN_GREEN = "#15854e";

export default async function OpenGraphImage() {
  // Static instances, not variable fonts. Satori parses a variable TTF's
  // outlines through the default instance and then trips over the missing
  // named-instance table ("Cannot read properties of undefined (reading
  // '256')"), which fails the production export while dev happens to survive.
  // WOFF is fine here; only WOFF2 is unsupported.
  const [lexend, inter] = await Promise.all([
    readFile(join(process.cwd(), "app/_og/Lexend-300.woff")),
    readFile(join(process.cwd(), "app/_og/Inter-400.woff")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#fbfaf8",
          padding: "72px 80px 0",
          fontFamily: "Lexend",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 22,
              color: "#6d6a64",
              fontFamily: "Inter",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                backgroundColor: OPEN_GREEN,
                display: "flex",
              }}
            />
            Open 8:30 am to 10:30 pm, seven days a week
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 96,
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: "#2a2723",
              marginTop: 30,
              maxWidth: 900,
            }}
          >
            Meridian Pharmacy
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 34,
              lineHeight: 1.35,
              color: "#5c584f",
              marginTop: 26,
              maxWidth: 800,
            }}
          >
            Your everyday chemist on 100 Feet Road, Indiranagar. Prescriptions,
            first aid and the things you actually run out of.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 36,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 25,
                color: "#6d6a64",
                fontFamily: "Inter",
              }}
            >
              No. 42, 4th Cross · Bengaluru 560038 · +91 80 4512 7788
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  backgroundColor: "#1C1F26",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 3,
                    backgroundColor: "#FB4F02",
                    display: "flex",
                  }}
                />
              </div>
              <div style={{ display: "flex", fontSize: 25, color: "#5c584f" }}>
                Built by Foxquart
              </div>
            </div>
          </div>

          {/* The twelve racks, as a band of colour across the foot. */}
          <div style={{ display: "flex", width: "100%", height: 14 }}>
            {RACK_COLOURS.map((colour) => (
              <div
                key={colour}
                style={{ display: "flex", flex: 1, height: "100%", backgroundColor: colour }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Lexend", data: lexend, style: "normal", weight: 300 },
        { name: "Inter", data: inter, style: "normal", weight: 400 },
      ],
    },
  );
}
