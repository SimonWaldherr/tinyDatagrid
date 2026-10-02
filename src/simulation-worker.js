import { mandelbrot } from "./simulations.js";
self.onmessage = ({ data }) => {
  try {
    const {
      rows = 96,
      columns = 128,
      centerX = -0.5,
      centerY = 0,
      span = 3.5,
      iterations = 200,
    } = data;
    if (
      !Number.isInteger(rows) ||
      !Number.isInteger(columns) ||
      rows < 1 ||
      columns < 1 ||
      rows * columns > 1000000 ||
      !Number.isFinite(centerX) ||
      !Number.isFinite(centerY) ||
      !Number.isFinite(span) ||
      span <= 0
    )
      throw new RangeError("Invalid raster parameters");
    mandelbrot(centerX, centerY, iterations);
    const values = new Uint16Array(rows * columns);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++)
        values[r * columns + c] = mandelbrot(
          centerX + ((c + 0.5) / columns - 0.5) * span,
          centerY + (((r + 0.5) / rows - 0.5) * span * rows) / columns,
          iterations,
        );
      if (r % 8 === 0) self.postMessage({ progress: (r + 1) / rows });
    }
    self.postMessage({ values }, [values.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
