interface CardProps {
    children: React.ReactNode;
    className?: string;
}

export const Card = ({ children, className = "" }: CardProps) => (
    <div
        className={`bg-white border border-gray-100 rounded-2xl shadow-sm p-6 ${className}`}
    >
        {children}
    </div>
);
