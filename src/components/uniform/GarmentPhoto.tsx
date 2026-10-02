import Image from "next/image";
import type { Garment, GarmentKind } from "@/lib/uniform";

// A studio "photograph" of a garment: grey sweep backdrop, soft cast shadow and film grain.
// Used as a stand-in until real photos exist (pass `garment.photo` to use a real one).

const HANGER = "M50 12.5c0-3 1.8-4.6 4-4.6s3.8 1.6 3.8 3.8c0 2.4-1.9 3.4-3.8 4.6L50 18.8M50 18.8 27.5 29.5M50 18.8 72.5 29.5";
const BAR = "M31 27.5h38M50 27.5V12.5c0-3 1.8-4.6 4-4.6s3.8 1.6 3.8 3.8";

type Shape = { body: string; details?: string; hang: "hanger" | "bar" | "floor" };

const SHAPES: Record<GarmentKind, Shape> = {
  tee: {
    hang: "hanger",
    body: "M30 30 42 27Q50 31.5 58 27L70 30 80 42 72 47.5 68 43.5V93H32V43.5L28 47.5 20 42Z",
    details: "M42 27Q50 34 58 27",
  },
  shirt: {
    hang: "hanger",
    body: "M32 30 43 26.5 50 33.5 57 26.5 68 30 74 44 78.5 89 71 90 67 51V99H33V51L29 90 21.5 89 26 44Z",
    details: "M50 33.5V99M43 26.5 47 36 50 33.5 53 36 57 26.5M36 52h8v9h-8z",
  },
  jacket: {
    hang: "hanger",
    body: "M30 30 43 26.5 50 35 57 26.5 70 30 76 46 80.5 87 72.5 88 68.5 53 69.5 93H30.5L31.5 53 27.5 88 19.5 87 24 46Z",
    details: "M50 35V93M35 70h10v11H35zM55 70h10v11H55zM30.5 88.5h39",
  },
  coat: {
    hang: "hanger",
    body: "M31 30 43 26.5 50 36 57 26.5 69 30 75 46 79 96 71.5 97 68 54 71 113H29L32 54 28.5 97 21 96 25 46Z",
    details: "M50 36 47 113M43 26.5 46 44 50 36M57 26.5 54 44M34 78h9M57 78h9",
  },
  vest: {
    hang: "hanger",
    body: "M36 30 44 27.5 50 46 56 27.5 64 30 66 44 70.5 48V97H29.5V48L34 44Z",
    details: "M50 46V97M34 70h9M57 70h9",
  },
  trousers: {
    hang: "bar",
    body: "M34 29.5H66L70.5 109H56.5L50 52 43.5 109H29.5Z",
    details: "M34 35.5H66M50 35.5V52",
  },
  shorts: {
    hang: "bar",
    body: "M33 29.5H67L71 72H54.5L50 52 45.5 72H29Z",
    details: "M33 35.5H67M50 35.5V52",
  },
  tote: {
    hang: "floor",
    body: "M30 58H70L72 104H28Z",
    details: "M40 58C40 34 60 34 60 58",
  },
  cap: {
    hang: "floor",
    body: "M32 96C32 72 68 72 68 96ZM62 96C74 95.5 83 97 84 99.5 75 101 60 100.5 50 100Z",
    details: "M50 74V96M41 77 44 96M59 77 56 96",
  },
};

export default function GarmentPhoto({
  garment,
  className,
  sizes,
}: {
  garment: Garment;
  className?: string;
  sizes?: string;
}) {
  if (garment.photo) {
    return (
      <div className={`gphoto ${className ?? ""}`}>
        <Image src={garment.photo} alt={`${garment.name}, ${garment.type}`} fill sizes={sizes ?? "33vw"} className="gphoto-img" />
      </div>
    );
  }

  const s = SHAPES[garment.kind];
  const gid = `g-${garment.id}`;
  return (
    <div className={`gphoto ${className ?? ""}`} role="img" aria-label={`${garment.name}, ${garment.type} (mock-up)`}>
      <svg className="gphoto-svg" viewBox="0 0 100 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--g-garment-hi)" />
            <stop offset="0.55" stopColor="var(--g-garment)" />
            <stop offset="1" stopColor="var(--g-garment-lo)" />
          </linearGradient>
          <filter id={`${gid}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
          <filter id={`${gid}-edge`}>
            <feGaussianBlur stdDeviation="0.25" />
          </filter>
        </defs>

        {/* cast shadow: on the wall for hanging pieces, on the floor for standing ones */}
        {s.hang === "floor" ? (
          <ellipse cx="50" cy={garment.kind === "cap" ? 100 : 104.5} rx="27" ry="3.2" fill="var(--g-shadow)" filter={`url(#${gid}-soft)`} />
        ) : (
          <path d={s.body} transform="translate(3.5 3)" fill="var(--g-shadow)" filter={`url(#${gid}-soft)`} />
        )}

        {s.hang !== "floor" && (
          <path d={s.hang === "hanger" ? HANGER : BAR} fill="none" stroke="var(--g-hanger)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        )}

        <g filter={`url(#${gid}-edge)`}>
          <path d={s.body} fill={`url(#${gid}-fill)`} />
          {garment.kind === "tote" && (
            <path d={s.details} fill="none" stroke={`url(#${gid}-fill)`} strokeWidth="3" strokeLinecap="round" />
          )}
          {s.details && garment.kind !== "tote" && (
            <path d={s.details} fill="none" stroke="var(--g-seam)" strokeWidth="0.45" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {garment.kind === "shirt" &&
            [42, 56, 70, 84].map((y) => <circle key={y} cx="51.6" cy={y} r="0.75" fill="var(--g-seam)" />)}
        </g>
      </svg>
    </div>
  );
}
