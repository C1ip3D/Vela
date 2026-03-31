import Image from "next/image";

const SIZE_MAP = {
  sm: { height: 80, width: 300 },
  md: { height: 80, width: 300 },
  lg: { height: 80, width: 300 },
};

export function VelaLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { height, width } = SIZE_MAP[size];
  return (
    <Image
      src="/logo.png"
      alt="Vela"
      height={height}
      width={width}
      style={{ height, width: "auto", maxWidth: width, objectFit: "contain" }}
      priority
    />
  );
}
