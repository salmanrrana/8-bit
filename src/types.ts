export type EnemyType =
  | "banker"
  | "printer"
  | "miner"
  | "fud"
  | "chargeback"
  | "exploit"
  | "suit"
  | "agent"
  | "wiretap"
  | "shiller"
  | "rugpull"
  | "degen"
  | "shitgun";

export type PlatformKind =
  | "ground"
  | "ledger"
  | "question"
  | "confirm"
  | "crowd"
  | "block"
  | "barricade";

export type ConfirmCycle = {
  periodMs: number;
  phaseMs: number;
  onMs: number;
};

export type Theme = "city" | "network" | "tour" | "mania" | "wallstreet";

export type GoalKind = "up" | "down" | "exit";

export type Zone = {
  x: number;
  name: string;
  sky: string;
  sky2: string;
  ground: string;
  accent: string;
  text: string;
};

export type Labels = {
  coin?: string;
  pageStat?: string;
  pageNote?: string;
};

export type CheckpointDef = {
  x: number;
  y: number;
  index: number;
  name: string;
};

export type AllyDef = {
  kind: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  triggerX: number;
  name: string;
  line: string;
};

export type Layout = {
  ground: Array<[x: number, w: number]>;
  platforms: Array<
    | [x: number, y: number, w: number, h: number, kind: PlatformKind]
    | [x: number, y: number, w: number, h: number, kind: PlatformKind, cycle: ConfirmCycle]
  >;
  blockStacks?: Array<[x: number, count: number]>;
  coinArcs: Array<[x: number, y: number, count: number]>;
  pages: Array<[x: number, y: number]>;
  enemies: Array<[x: number, y: number, minX: number, maxX: number, type: EnemyType]>;
  hazards: Array<[x: number, y: number, w: number, h: number]>;
  checkpoints?: CheckpointDef[];
  allies?: AllyDef[];
  barricades?: Array<[x: number, count: number]>;
};

export type NpcDef = {
  kind: string;
  tx: number;
  ty: number;
  name: string;
  lines: string[];
};

/** Overworld taxi traffic: ping-pong route on a fixed clock. */
export type TaxiRoute = {
  axis: "v" | "h";
  lane?: number;
  row?: number;
  from: number;
  to: number;
  speed: number;
  phase: number;
};

/** One floor of a multi-floor venue (Level 5). Floors list top-to-bottom as played. */
export type VenueFloor = {
  name: string;
  worldW: number;
  spawnX: number;
  zone: Omit<Zone, "x">;
  goal: Box & { kind?: GoalKind };
  /** Where a stairwell ("up"/"down") goal leads; index into floors[]. */
  goalTo?: number;
  hint?: string;
  layout: Layout;
};

export type Venue = {
  key: string;
  index: number;
  name: string;
  worldW: number;
  spawnX: number;
  zone: Omit<Zone, "x">;
  goal: Box & { kind?: GoalKind };
  weapon?: "satcannon";
  layout: Layout;
  /** Multi-floor building; when present, layout/goal are ignored in play. */
  floors?: VenueFloor[];
};

export type Box = { x: number; y: number; w: number; h: number };

export type SideLevel = {
  id: string;
  title: string;
  description: string;
  theme: Theme;
  mode?: "side";
  worldW: number;
  goal: Box;
  labels?: Labels;
  zones: Zone[];
  layout: Layout;
};

export type OverworldLevel = {
  id: string;
  title: string;
  description: string;
  theme: Theme;
  mode: "overworld";
  labels?: Labels;
  worldW: number;
  goal: Box;
  zone: Omit<Zone, "x">;
  spawn: { tx: number; ty: number };
  map: string[];
  npcs: NpcDef[];
  taxis?: TaxiRoute[];
  venues: Record<string, Venue>;
};

export type Level = SideLevel | OverworldLevel;

export type Phase = "title" | "playing" | "paused" | "complete" | "gameover";

export type SubMode = "side" | "overworld" | "venue";
