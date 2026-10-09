# Compact Create header and supplied logo

Create mode combines the map name, owner/sharing information, map picker, Map settings and New map in a compact header. The repeated WORLDVIEW MAP eyebrow and redundant View in Map Library button are hidden in the account editor. The top navigation remains available. Map expansion controls use less padding, with responsive wrapping on narrow screens.

These header changes apply only to the account editor. Other modes retain their existing layout. The original supplied WebP replaces the old brand icon across modes and standalone exports. It is embedded unchanged in the HTML; CSS fits the central symbol and its transparent margins beside the Harmonious name. No image service or external image request is needed.

Local visual checks at 1440×900 and 1024×650 gained approximately 141 pixels of canvas height. At 390×844 the gain was 79 pixels. At 320×568, the canvas keeps its 230-pixel minimum height but starts 118 pixels higher, bringing the canvas and footer onto the screen. Map settings, map selection, expansion/collapse, switching away and returning to Create, and logo loading were checked. Captures are in build/design-review/create-header-*.png.

See [deployment status](deployment-status.md) for publication status. This change needs no database migration.
