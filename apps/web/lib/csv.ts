export type CsvValue = string | number | null | undefined;

// Escapa una celda CSV y neutraliza fórmulas de Excel.
export const escapeCsvCell = (value: CsvValue): string => {
    const text = value === null || value === undefined ? "" : String(value);
    const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;

    return `"${safeText.replace(/"/g, '""')}"`;
};

// Construye un CSV con BOM para que Excel respete las tildes.
export const buildCsv = (headers: string[], rows: CsvValue[][]): string => {
    const lines = [headers, ...rows].map((row) =>
        row.map(escapeCsvCell).join(","),
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
