interface CardProps {
    children: React.ReactNode;
    className?: string;
}

export const Card = ({ children, className = "" }: CardProps) => (
    <div
        className={`rounded-2xl p-6 ${className}`}
        style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-sm)",
        }}
    >
        {children}
    </div>
);
