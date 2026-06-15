/**
 * Image store types — shared by server + (future) client.
 *
 * The Frame stores image blobs on disk with a JSON sidecar per image (no SQL).
 * This mirrors the eink-frame gallery store. The full upload/crop/thumb pipeline
 * is ported in #185; this scaffold only establishes the dir layout + sidecar shape.
 */

export type Orientation = 'horizontal' | 'vertical';

/** Normalised crop rectangle in [0,1] source-relative coordinates. */
export type Crop = { x: number; y: number; w: number; h: number };

/** Up to two independent crops — one per device orientation. */
export type Crops = Partial<Record<Orientation, Crop>>;

/** Sidecar JSON written next to each image under `.metadata/<stem>.json`. */
export type SidecarMeta = {
  width?: number;
  height?: number;
  crops?: Crops;
};

/** A gallery image as listed by the store. */
export type FrameImage = {
  name: string;
  size: number;
  mtime: number;
  crops: Crops;
};
