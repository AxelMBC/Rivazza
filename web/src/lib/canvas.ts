export const sizeCanvas = (
  canvas: HTMLCanvasElement,
  pixelWidth: number,
  pixelHeight: number,
) => {
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
};

export const sizeToDevice = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number,
) => sizeCanvas(canvas, Math.round(width * dpr), Math.round(height * dpr));
