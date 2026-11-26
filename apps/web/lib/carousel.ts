// Lógica pura del carrusel de imágenes de una publicación.

export const clampIndex = (index: number, count: number): number =>
    count <= 0 ? 0 : Math.min(Math.max(index, 0), count - 1);

// Diapositiva visible según el desplazamiento horizontal del carril.
export const indexFromScroll = (scrollLeft: number, slideWidth: number, count: number): number =>
    slideWidth <= 0 ? 0 : clampIndex(Math.round(scrollLeft / slideWidth), count);

// Siguiente posición al pulsar anterior (-1) o siguiente (+1). Se detiene en los extremos.
export const stepIndex = (current: number, delta: number, count: number): number =>
    clampIndex(current + delta, count);

// Tecla de navegación del carrusel o del visor: devuelve el cambio de posición o null.
export const keyToDelta = (key: string): number | null =>
    key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : null;

// Las diapositivas que conviene tener cargadas: la actual y sus vecinas.
export const nearbyIndexes = (current: number, count: number): number[] =>
    [current - 1, current, current + 1].filter((index) => index >= 0 && index < count);
