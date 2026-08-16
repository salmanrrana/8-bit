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

export type Theme = "city" | "network" | "tour" | "mania";

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

export type Venue = {
  key: string;
  index: number;
  name: string;
  worldW: number;
  spawnX: number;
  zone: Omit<Zone, "x">;
  goal: Box;
  weapon?: "satcannon";
  layout: Layout;
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
  venues: Record<string, Venue>;
};

export type Level = SideLevel | OverworldLevel;

export type Phase = "title" | "playing" | "paused" | "complete" | "gameover";

export type SubMode = "side" | "overworld" | "venue";
