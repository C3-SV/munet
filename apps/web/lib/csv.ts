export type CsvValue = string | number | null | undefined;

// Escapa una celda CSV y neutraliza fórmulas de Excel.
// `literal` desactiva la neutralización: solo para valores que genera o valida el sistema
// (por ejemplo credenciales), donde un apóstrofe inicial haría que la persona no pueda entrar.
export const escapeCsvCell = (
    value: CsvValue,
    { literal = false }: { literal?: boolean } = {},
): string => {
    const text = value === null || value === undefined ? "" : String(value);
    const safeText = !literal && /^[=+\-@]/.test(text) ? `'${text}` : text;

    return `"${safeText.replace(/"/g, '""')}"`;
};

// Construye un CSV con BOM para que Excel respete las tildes.
// `literalColumns` son los índices de columna que se escriben sin neutralizar fórmulas.
export const buildCsv = (
    headers: string[],
    rows: CsvValue[][],
    { literalColumns = [] }: { literalColumns?: number[] } = {},
): string => {
    const lines = [headers, ...rows].map((row, rowIndex) =>
        row
            .map((value, column) =>
                escapeCsvCell(value, {
                    // Los encabezados nunca son literales.
                    literal: rowIndex > 0 && literalColumns.includes(column),
                }),
            )
            .join(","),
    );

    return `\uFEFF${lines.join("\r\n")}\r\n`;
};

// Descarga un CSV generado en el navegador y libera la URL temporal.
export const downloadCsv = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 0);
};
