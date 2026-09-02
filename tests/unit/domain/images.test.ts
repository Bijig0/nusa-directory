import { describe, expect, it } from 'vitest';
import { sniffFormat, readImageInfo, readJpegOrientation, rotationFor, fitWithin, watermarkPlacement } from '@/domain/images';

/** Minimal JPEG: SOI, APP1 Exif (orientation 6, big-endian), SOF0 640x480, EOI. */
const jpegWithOrientation = (orientation: number): Uint8Array => {
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0];
  const app1 = [0xff, 0xe1, 0, exif.length + 2, ...exif];
  const sof0 = [0xff, 0xc0, 0, 11, 8, 0x01, 0xe0, 0x02, 0x80, 1, 1, 0x11, 0];
  return new Uint8Array([0xff, 0xd8, ...app1, ...sof0, 0xff, 0xd9]);
};

describe('images', () => {
  it('sniffs formats', () => {
    expect(sniffFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(sniffFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(sniffFormat(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('webp');
    expect(sniffFormat(new Uint8Array([0x47, 0x49, 0x46]))).toBeUndefined();
  });
  it('reads JPEG dimensions and EXIF orientation', () => {
    const b = jpegWithOrientation(6);
    expect(readImageInfo(b)).toEqual({ format: 'jpeg', width: 640, height: 480 });
    expect(readJpegOrientation(b)).toBe(6);
    expect(readJpegOrientation(jpegWithOrientation(1))).toBe(1);
    expect(rotationFor(6)).toBe(90);
    expect(rotationFor(3)).toBe(180);
    expect(rotationFor(8)).toBe(270);
    expect(rotationFor(1)).toBe(0);
  });
  it('reads PNG dimensions', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x03, 0x20, 0, 0, 0x02, 0x58]);
    expect(readImageInfo(png)).toEqual({ format: 'png', width: 800, height: 600 });
  });
  it('fits within bounds without upscaling', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(300, 500, 1600)).toEqual({ width: 300, height: 500 });
  });
  it('places the watermark bottom-right with a margin', () => {
    expect(watermarkPlacement(1000, 800, 220, 60)).toEqual({ x: 750, y: 710 });
  });
});
