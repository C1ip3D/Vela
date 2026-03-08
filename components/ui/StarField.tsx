"use client";

export function StarField() {
    // Generate deterministic star positions
    const stars = [
        { x: 5, y: 8, size: 1, delay: 0 },
        { x: 15, y: 22, size: 1.5, delay: 1.2 },
        { x: 28, y: 5, size: 1, delay: 0.5 },
        { x: 35, y: 45, size: 2, delay: 2.1 },
        { x: 42, y: 18, size: 1, delay: 0.8 },
        { x: 55, y: 32, size: 1.5, delay: 1.5 },
        { x: 62, y: 8, size: 1, delay: 0.3 },
        { x: 70, y: 55, size: 2, delay: 2.5 },
        { x: 78, y: 25, size: 1, delay: 1.0 },
        { x: 85, y: 42, size: 1.5, delay: 0.7 },
        { x: 92, y: 12, size: 1, delay: 1.8 },
        { x: 18, y: 65, size: 1.5, delay: 2.0 },
        { x: 45, y: 72, size: 1, delay: 0.4 },
        { x: 68, y: 78, size: 2, delay: 1.3 },
        { x: 88, y: 68, size: 1, delay: 0.9 },
        { x: 22, y: 88, size: 1.5, delay: 2.3 },
        { x: 50, y: 92, size: 1, delay: 0.6 },
        { x: 75, y: 85, size: 1.5, delay: 1.7 },
        { x: 95, y: 90, size: 1, delay: 2.8 },
        { x: 8, y: 50, size: 2, delay: 1.1 },
    ];

    return (
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
            {stars.map((star, i) => (
                <div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        left: `${star.x}%`,
                        top: `${star.y}%`,
                        width: `${star.size}px`,
                        height: `${star.size}px`,
                        background: star.size >= 2 ? "rgba(232, 236, 255, 0.7)" : "rgba(196, 210, 230, 0.4)",
                        boxShadow: star.size >= 2
                            ? "0 0 6px rgba(124,158,245,0.4)"
                            : "0 0 3px rgba(124,158,245,0.2)",
                        animation: `twinkle ${3 + star.delay}s ease-in-out ${star.delay}s infinite`,
                    }}
                />
            ))}

            {/* Subtle constellation lines overlay */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
                <line x1="5%" y1="8%" x2="15%" y2="22%" stroke="#A5B4FC" strokeWidth="0.5" />
                <line x1="15%" y1="22%" x2="28%" y2="5%" stroke="#A5B4FC" strokeWidth="0.5" />
                <line x1="35%" y1="45%" x2="55%" y2="32%" stroke="#A5B4FC" strokeWidth="0.5" />
                <line x1="55%" y1="32%" x2="70%" y2="55%" stroke="#A5B4FC" strokeWidth="0.5" />
                <line x1="78%" y1="25%" x2="92%" y2="12%" stroke="#A5B4FC" strokeWidth="0.5" />
                <line x1="18%" y1="65%" x2="45%" y2="72%" stroke="#A5B4FC" strokeWidth="0.5" />
                <line x1="68%" y1="78%" x2="88%" y2="68%" stroke="#A5B4FC" strokeWidth="0.5" />
            </svg>
        </div>
    );
}
