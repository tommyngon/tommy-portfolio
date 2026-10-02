// "uniform" — Tommy's clothing line. Placeholder pieces for the catalogue mock-up.
// Like Hadeland Glassverk's 1965 catalogue (named after Norwegian places), each piece is
// named after a Trondheim neighbourhood. Add `photo: "/uniform/<file>.jpg"` to a piece to
// replace its mock-up with a real photograph.

export type GarmentKind =
  | "shirt"
  | "jacket"
  | "tote"
  | "cap"
  | "trousers"
  | "tee"
  | "vest"
  | "coat"
  | "shorts";

export type Garment = {
  id: string;
  name: string;
  type: string;
  kind: GarmentKind;
  photo?: string;
};

export const GARMENTS: Garment[] = [
  { id: "0001", name: "BAKKLANDET", type: "overshirt", kind: "shirt" },
  { id: "0002", name: "LADE", type: "work jacket", kind: "jacket" },
  { id: "0003", name: "MUNKHOLMEN", type: "tote", kind: "tote" },
  { id: "0004", name: "ILA", type: "cap", kind: "cap" },
  { id: "0005", name: "NIDELVA", type: "trousers", kind: "trousers" },
  { id: "0006", name: "SOLSIDEN", type: "t-shirt", kind: "tee" },
  { id: "0007", name: "TYHOLT", type: "vest", kind: "vest" },
  { id: "0008", name: "BYÅSEN", type: "coat", kind: "coat" },
  { id: "0009", name: "LERKENDAL", type: "shorts", kind: "shorts" },
];
