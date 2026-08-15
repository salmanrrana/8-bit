import type { Level } from "./types.ts";

export const LEVELS: Level[] = [
  {
    id: "whitepaper-run",
    title: "THE WHITEPAPER RUN",
    description: "Build Bitcoin from the broken world to the whitepaper.",
    theme: "city",
    worldW: 5200,
    goal: { x: 5102, y: 128, w: 22, h: 48 },
    zones: [
      { x: 0, name: "BROKEN WORLD", sky: "#52675b", sky2: "#2c3432", ground: "#4a4d47", accent: "#7d3a2c", text: "2008: money printers and broken banks." },
      { x: 720, name: "CYPHERPUNKS", sky: "#435070", sky2: "#24283e", ground: "#3b4055", accent: "#8d6de8", text: "Cryptography gives the individual a shield." },
      { x: 1450, name: "GENESIS", sky: "#6b778a", sky2: "#30394b", ground: "#565d63", accent: "#f7931a", text: "Mine the genesis block and keep moving." },
      { x: 2300, name: "BLOCKCHAIN", sky: "#66a2d8", sky2: "#345a88", ground: "#2f8d50", accent: "#ffd166", text: "Blocks link together. Enemies cannot rewrite them." },
      { x: 3150, name: "NETWORK", sky: "#5eb7c7", sky2: "#2a6770", ground: "#298766", accent: "#36bd63", text: "Nodes, miners, and users harden the network." },
      { x: 4000, name: "HANDOFF", sky: "#526b9f", sky2: "#222c55", ground: "#3e5f48", accent: "#f4ead2", text: "Satoshi fades. The system keeps running." },
      { x: 4700, name: "WHITEPAPER", sky: "#6aa9f2", sky2: "#385a93", ground: "#2f8d50", accent: "#f7931a", text: "Reach the whitepaper. The code lives on." }
    ],
    layout: {
      ground: [
        [0, 620], [700, 450], [1220, 360], [1640, 520], [2260, 460],
        [2820, 520], [3420, 460], [3920, 360], [4380, 330], [4800, 400]
      ],
      platforms: [
        [236, 154, 72, 14, "ledger"], [350, 128, 56, 14, "question"],
        [762, 154, 70, 14, "ledger"], [936, 132, 54, 14, "question"],
        [1288, 142, 78, 14, "ledger"], [1518, 150, 64, 14, "question"],
        [1788, 132, 58, 14, "ledger"], [1998, 154, 76, 14, "ledger"],
        [2328, 144, 76, 14, "question"], [2548, 120, 62, 14, "ledger"],
        [2860, 152, 72, 14, "ledger"], [3066, 132, 64, 14, "question"],
        [3460, 146, 78, 14, "ledger"], [3668, 120, 64, 14, "ledger"],
        [3970, 150, 74, 14, "question"], [4230, 134, 72, 14, "ledger"],
        [4480, 152, 62, 14, "ledger"], [4842, 150, 78, 14, "question"]
      ],
      blockStacks: [
        [540, 2], [1120, 3], [2190, 2], [3340, 3], [4720, 2]
      ],
      coinArcs: [
        [156, 132, 5], [770, 126, 5], [1268, 112, 6], [1770, 104, 5],
        [2380, 112, 6], [2896, 120, 5], [3494, 112, 6], [4216, 106, 5],
        [4848, 116, 6]
      ],
      pages: [
        [610, 150], [1194, 138], [1626, 124], [2206, 136], [2786, 138],
        [3366, 122], [3890, 136], [4550, 138], [5024, 116]
      ],
      enemies: [
        [420, 178, 450, 575, "banker"], [880, 178, 822, 1060, "printer"],
        [1346, 178, 1280, 1470, "banker"], [1900, 178, 1850, 2100, "printer"],
        [2448, 178, 2398, 2700, "miner"], [3230, 178, 3020, 3320, "banker"],
        [3550, 178, 3480, 3770, "printer"], [4100, 178, 4016, 4300, "miner"],
        [4890, 178, 4820, 5040, "banker"]
      ],
      hazards: [
        [655, 190, 40, 15], [1162, 190, 42, 15], [1570, 190, 42, 15],
        [2762, 190, 42, 15], [3378, 190, 42, 15], [3870, 190, 42, 15],
        [4338, 190, 42, 15]
      ],
      checkpoints: [
        { x: 760, y: 172, index: 1, name: "CYPHERPUNKS" },
        { x: 1510, y: 172, index: 2, name: "GENESIS" },
        { x: 2350, y: 172, index: 3, name: "BLOCKCHAIN" },
        { x: 3180, y: 172, index: 4, name: "NETWORK" },
        { x: 4020, y: 172, index: 5, name: "HANDOFF" },
        { x: 4750, y: 172, index: 6, name: "WHITEPAPER" }
      ]
    }
  },
  {
    id: "running-bitcoin",
    title: "RUNNING BITCOIN",
    description: "Run a node, harden the code, and grow the network with Hal and the early builders.",
    theme: "network",
    worldW: 5600,
    goal: { x: 5502, y: 128, w: 22, h: 48 },
    labels: { coin: "SATS", pageStat: "PATCHES", pageNote: "Patch" },
    zones: [
      { x: 0, name: "FIRST SEND", sky: "#1d2138", sky2: "#0e1020", ground: "#2a2e44", accent: "#36bd63", text: "Block 170: the first coins ever sent." },
      { x: 780, name: "RUNNING BITCOIN", sky: "#22304e", sky2: "#101a30", ground: "#2f3a52", accent: "#4aa8f0", text: "Running bitcoin. The first nodes wake up." },
      { x: 1650, name: "BUG REPORTS", sky: "#2a3a52", sky2: "#16223a", ground: "#34465c", accent: "#ffd166", text: "Bug reports roll in. The code gets read." },
      { x: 2550, name: "HARDENING", sky: "#395066", sky2: "#1d3346", ground: "#2f8d50", accent: "#36bd63", text: "A patch closes the hole. The chain heals." },
      { x: 3500, name: "MINING RACE", sky: "#4a6b6f", sky2: "#24484c", ground: "#2f8d50", accent: "#f7931a", text: "Hashes climb. Honest work secures the ledger." },
      { x: 4550, name: "THE NETWORK", sky: "#6aa9f2", sky2: "#385a93", ground: "#2f8d50", accent: "#f7931a", text: "More builders join. No one owns it now." }
    ],
    layout: {
      ground: [
        [0, 640], [720, 470], [1270, 420], [1770, 500], [2350, 470],
        [2900, 520], [3500, 400], [4060, 380], [4520, 440], [5040, 560]
      ],
      platforms: [
        [300, 150, 70, 14, "ledger"], [430, 124, 54, 14, "question"],
        [820, 150, 72, 14, "ledger"], [980, 128, 54, 14, "question"],
        [1120, 146, 64, 14, "ledger"],
        [1700, 140, 70, 14, "ledger"], [1900, 132, 56, 14, "question"],
        [2120, 150, 74, 14, "ledger"],
        [2560, 144, 76, 14, "question"], [2740, 122, 62, 14, "ledger"],
        [2980, 150, 72, 14, "ledger"], [3180, 132, 64, 14, "question"],
        [3905, 170, 44, 12, "confirm", { periodMs: 1800, phaseMs: 0, onMs: 1300 }],
        [3970, 166, 44, 12, "confirm", { periodMs: 1800, phaseMs: 600, onMs: 1300 }],
        [4035, 170, 44, 12, "confirm", { periodMs: 1800, phaseMs: 1200, onMs: 1300 }],
        [4560, 146, 72, 14, "ledger"], [4720, 124, 60, 14, "question"],
        [4860, 118, 44, 12, "confirm", { periodMs: 2000, phaseMs: 0, onMs: 1300 }],
        [5080, 148, 72, 14, "ledger"], [5260, 130, 64, 14, "question"]
      ],
      blockStacks: [
        [600, 2], [1340, 2], [2680, 3], [3300, 2], [4860, 2]
      ],
      coinArcs: [
        [180, 130, 5], [430, 100, 5], [840, 124, 6], [1140, 110, 5],
        [1700, 116, 6], [2140, 110, 6], [2760, 118, 5], [3220, 108, 6],
        [3960, 150, 5], [4760, 110, 6], [5260, 116, 5]
      ],
      pages: [
        [560, 150], [1080, 126], [1480, 122], [2160, 128], [2780, 130],
        [3320, 118], [4040, 118], [4875, 96], [5320, 128]
      ],
      enemies: [
        [420, 178, 380, 600, "fud"], [900, 178, 820, 1150, "chargeback"],
        [1380, 178, 1300, 1660, "fud"], [1950, 178, 1820, 2240, "exploit"],
        [2480, 178, 2380, 2780, "chargeback"], [3050, 178, 2940, 3380, "fud"],
        [3650, 178, 3540, 3880, "exploit"], [4200, 178, 4150, 4420, "chargeback"],
        [4650, 178, 4540, 4920, "fud"], [5150, 178, 5060, 5400, "exploit"]
      ],
      hazards: [
        [500, 190, 36, 15], [1080, 190, 42, 15], [2000, 190, 42, 15],
        [2980, 190, 42, 15], [3700, 190, 40, 15], [4660, 190, 42, 15]
      ],
      checkpoints: [
        { x: 800, y: 172, index: 1, name: "RUNNING BITCOIN" },
        { x: 1800, y: 172, index: 2, name: "BUG REPORTS" },
        { x: 2600, y: 172, index: 3, name: "HARDENING" },
        { x: 3560, y: 172, index: 4, name: "MINING RACE" },
        { x: 4600, y: 172, index: 5, name: "THE NETWORK" }
      ],
      allies: [
        { kind: "hal", x: 340, y: 182, triggerX: 290, name: "HAL FINNEY", line: "Hal Finney: got the coins — thanks!" },
        { kind: "nodes", x: 4930, y: 184, triggerX: 4880, name: "EARLY BUILDERS", line: "Early builders: more nodes online." }
      ]
    }
  },
  {
    id: "internet-of-money",
    title: "THE INTERNET OF MONEY",
    description: "Take the word on tour — talks, meetups, and sats from Chicago to the world.",
    theme: "tour",
    worldW: 6000,
    goal: { x: 5902, y: 128, w: 22, h: 48 },
    labels: { coin: "SATS", pageStat: "TALKS", pageNote: "Talk" },
    zones: [
      { x: 0, name: "FIRST TALK", sky: "#3a2f4e", sky2: "#1c1530", ground: "#3e3450", accent: "#f7931a", text: "2013: one talk turns a room of skeptics curious." },
      { x: 820, name: "WORLD TOUR", sky: "#4e3358", sky2: "#251536", ground: "#45374f", accent: "#ffd166", text: "City to city, the same question: what is money?" },
      { x: 1700, name: "THE LIVING ROOM", sky: "#5c3a50", sky2: "#2b1830", ground: "#4a3a44", accent: "#36bd63", text: "Chicago: a living-room meetup. Bring folding chairs." },
      { x: 2600, name: "BANKER PUSHBACK", sky: "#6b4448", sky2: "#331f26", ground: "#54423c", accent: "#d64533", text: "The banks push back. The message keeps moving." },
      { x: 3500, name: "THE CRACKDOWN", sky: "#75504a", sky2: "#3a2521", ground: "#5a463a", accent: "#8d6de8", text: "Three-letter agencies watch. Nodes keep syncing." },
      { x: 4400, name: "NO OFF SWITCH", sky: "#8a6a4e", sky2: "#45301f", ground: "#2f8d50", accent: "#36bd63", text: "Too many nodes, too many minds. No off switch." },
      { x: 5300, name: "INTERNET OF MONEY", sky: "#e08a4a", sky2: "#7a3d2a", ground: "#2f8d50", accent: "#f7931a", text: "Not just money — the internet of money." }
    ],
    layout: {
      ground: [
        [0, 700], [780, 500], [1360, 480], [1920, 560], [2560, 520],
        [3160, 500], [3740, 280], [4200, 420], [4700, 540], [5320, 680]
      ],
      platforms: [
        [260, 152, 72, 14, "ledger"], [400, 126, 56, 14, "question"],
        [560, 164, 40, 10, "crowd"],
        [880, 150, 70, 14, "ledger"], [1050, 128, 56, 14, "question"],
        [1200, 148, 64, 14, "ledger"],
        [1480, 164, 44, 10, "crowd"],
        [1780, 146, 70, 14, "ledger"], [1960, 130, 56, 14, "question"],
        [2160, 150, 74, 14, "ledger"], [2360, 126, 60, 14, "ledger"],
        [2680, 148, 76, 14, "question"], [2860, 124, 62, 14, "ledger"],
        [3080, 150, 72, 14, "ledger"], [3280, 130, 64, 14, "question"],
        [3580, 146, 70, 14, "ledger"], [3800, 128, 60, 14, "question"],
        [4080, 166, 48, 10, "crowd"],
        [4480, 148, 72, 14, "ledger"], [4660, 124, 58, 14, "question"],
        [4840, 162, 44, 10, "crowd"],
        [5000, 148, 70, 14, "ledger"], [5160, 128, 60, 14, "question"],
        [5420, 150, 74, 14, "ledger"], [5600, 128, 62, 14, "question"],
        [5760, 150, 66, 14, "ledger"]
      ],
      blockStacks: [
        [640, 2], [1240, 2], [2440, 2], [3560, 2], [4940, 3], [5700, 2]
      ],
      coinArcs: [
        [170, 128, 5], [560, 96, 5], [900, 122, 6], [1230, 108, 5],
        [1500, 92, 5], [1820, 118, 6], [2200, 112, 5], [2700, 120, 6],
        [3120, 112, 5], [3600, 118, 5], [4084, 128, 5], [4520, 120, 6],
        [4856, 88, 5], [5440, 122, 5], [5780, 110, 6]
      ],
      pages: [
        [500, 150], [1495, 100], [1990, 116], [2390, 112], [2890, 110],
        [3830, 114], [4104, 118], [4850, 84], [5560, 130]
      ],
      enemies: [
        [430, 178, 380, 540, "suit"], [1000, 178, 940, 1120, "agent"],
        [1880, 178, 1800, 2080, "suit"], [2760, 178, 2660, 2960, "suit"],
        [3300, 178, 3220, 3440, "agent"], [3800, 178, 3750, 3980, "wiretap"],
        [4310, 178, 4270, 4560, "suit"], [4720, 178, 4640, 4980, "wiretap"],
        [5480, 178, 5400, 5680, "suit"], [5780, 178, 5730, 5880, "agent"]
      ],
      hazards: [
        [660, 190, 36, 15], [1150, 190, 40, 15], [2110, 190, 42, 15],
        [3020, 190, 42, 15], [3470, 190, 38, 15], [5060, 190, 42, 15]
      ],
      checkpoints: [
        { x: 860, y: 172, index: 1, name: "WORLD TOUR" },
        { x: 1740, y: 172, index: 2, name: "THE LIVING ROOM" },
        { x: 2640, y: 172, index: 3, name: "BANKER PUSHBACK" },
        { x: 3540, y: 172, index: 4, name: "THE CRACKDOWN" },
        { x: 4440, y: 172, index: 5, name: "NO OFF SWITCH" },
        { x: 5340, y: 172, index: 6, name: "INTERNET OF MONEY" }
      ],
      allies: [
        { kind: "mallers", x: 2120, y: 182, w: 26, h: 22, triggerX: 2070, name: "JACK & BILL MALLERS", line: "Jack & Bill Mallers: meetup's in our living room." },
        { kind: "crowd", x: 5150, y: 182, w: 32, h: 22, triggerX: 5115, name: "THE CROWD", line: "The crowd: we hold our own keys now." }
      ]
    }
  },
  {
    id: "shitcoin-city",
    title: "SHITCOIN CITY",
    description: "2021 mania: a shill on every corner. Stay focused, stack sats, clear the venues.",
    theme: "mania",
    mode: "overworld",
    labels: { coin: "SATS", pageStat: "STASHES", pageNote: "Stash" },
    worldW: 512,
    goal: { x: 0, y: 0, w: 0, h: 0 },
    zone: { name: "SHITCOIN CITY", sky: "#2a2438", sky2: "#141020", ground: "#565d63", accent: "#8d6de8", text: "2021: a shill on every corner. Stack sats. Clear the venues." },
    spawn: { tx: 8, ty: 12 },
    map: [
      "################################",
      "#..............................#",
      "#.#####...c...#####...c..#####.#",
      "#.#####.......#####......#####.#",
      "#.##1##.......##2##......##3##.#",
      "#.....c...o..............c.....#",
      "#..............................#",
      "#...####.......#####......c....#",
      "#...####...c...#####...####....#",
      "#...####.......##4##...####....#",
      "#..........................o...#",
      "#..o.....c.....................#",
      "#..............................#",
      "#~~~~~....#####....c....####...#",
      "#~~~~~....#####.........####...#",
      "#~~~~~....#####.........####...#",
      "#~~~~~.c..........o.......c....#",
      "#~~~~~~..............c.........#",
      "#~~~~~~....###............###..#",
      "#~~~~~~....###.....c......#X#..#",
      "#~~~~~~~.......................#",
      "#~~~~~~~~..c......o......c.....#",
      "#~~~~~~~~......................#",
      "################################"
    ],
    npcs: [
      { kind: "dokwon", tx: 3, ty: 5, name: "DO KWON", lines: ["Do Kwon: LUNA never goes down. 20% yield, forever.", "You: cool story. Stacking sats."] },
      { kind: "sbf", tx: 18, ty: 5, name: "SBF", lines: ["SBF: FTX is fine. The funds are... around.", "You: not your keys, not your coins."] },
      { kind: "vitalik", tx: 12, ty: 11, name: "VITALIK", lines: ["Vitalik: Ethereum scales right after the merge.", "You: neat. Still stacking sats."] },
      { kind: "influencer", tx: 21, ty: 10, name: "INFLUENCER", lines: ["Influencer: my new token is a guaranteed 100x, ser.", "You: hard pass. Sats only."] },
      { kind: "maxi", tx: 10, ty: 17, name: "MAXI", lines: ["Maxi: tick tock, next block. Stay humble.", "You: tick tock."] },
      { kind: "warner", tx: 14, ty: 5, name: "SHAKEN TRADER", lines: ["Trader: careful in there — turrets shoot shitcoins!", "Trader: jump the coins, stomp the guns.", "You: noted. Sats don't flinch."] }
    ],
    venues: {
      "1": {
        key: "1", index: 1, name: "LUNA LOUNGE", worldW: 880, spawnX: 22,
        zone: { name: "LUNA LOUNGE", sky: "#1d3a38", sky2: "#0b191c", ground: "#25443c", accent: "#36bd63", text: "Do Kwon's lounge: 20% yield forever, they say. Clear it." },
        goal: { x: 842, y: 140, w: 20, h: 64 },
        layout: {
          ground: [[0, 340], [420, 460]],
          platforms: [
            [170, 150, 64, 14, "ledger"], [300, 128, 56, 14, "question"],
            [352, 158, 56, 14, "ledger"],
            [470, 148, 66, 14, "ledger"], [620, 126, 56, 14, "question"],
            [740, 150, 62, 14, "ledger"]
          ],
          coinArcs: [[100, 126, 4], [300, 108, 5], [360, 132, 3], [600, 110, 5]],
          pages: [[770, 126]],
          enemies: [
            [130, 178, 90, 240, "shiller"], [280, 178, 250, 335, "shiller"],
            [500, 178, 440, 610, "degen"], [700, 178, 650, 820, "shiller"]
          ],
          hazards: [[560, 190, 40, 15]]
        }
      },
      "2": {
        key: "2", index: 2, name: "FTX ARENA", worldW: 960, spawnX: 22,
        zone: { name: "FTX ARENA", sky: "#16204a", sky2: "#0a0f26", ground: "#232c4e", accent: "#4aa8f0", text: "Watch the shitcoin shooters — hop the coins, stomp the guns." },
        goal: { x: 922, y: 140, w: 20, h: 64 },
        layout: {
          ground: [[0, 300], [380, 320], [780, 180]],
          platforms: [
            [150, 150, 60, 14, "ledger"], [250, 128, 56, 14, "question"],
            [312, 158, 56, 14, "ledger"],
            [440, 148, 68, 14, "ledger"], [560, 126, 58, 14, "question"],
            [706, 156, 62, 14, "ledger"],
            [820, 148, 60, 14, "ledger"]
          ],
          coinArcs: [[110, 128, 4], [330, 134, 3], [460, 120, 5], [700, 128, 4], [850, 118, 4]],
          pages: [[886, 124]],
          enemies: [
            [140, 178, 100, 250, "rugpull"],
            [600, 178, 600, 600, "shitgun"],
            [460, 178, 400, 560, "shiller"],
            [900, 178, 900, 900, "shitgun"],
            [820, 178, 790, 880, "degen"]
          ],
          hazards: [[520, 190, 38, 15]]
        }
      },
      "3": {
        key: "3", index: 3, name: "LEVERAGE CASINO", worldW: 1040, spawnX: 22,
        zone: { name: "LEVERAGE CASINO", sky: "#3a2b18", sky2: "#1c1408", ground: "#4a3a22", accent: "#ffd166", text: "100x or nothing — and the house shoots back. Clear the floor." },
        goal: { x: 1002, y: 140, w: 20, h: 64 },
        layout: {
          ground: [[0, 260], [340, 280], [700, 140], [920, 120]],
          platforms: [
            [160, 150, 62, 14, "ledger"], [272, 156, 58, 14, "ledger"],
            [380, 128, 56, 14, "question"], [520, 148, 66, 14, "ledger"],
            [630, 158, 60, 14, "ledger"],
            [760, 126, 56, 14, "question"], [848, 154, 62, 14, "ledger"],
            [940, 128, 56, 14, "question"]
          ],
          coinArcs: [[120, 126, 4], [290, 132, 3], [420, 108, 5], [650, 132, 3], [770, 104, 4], [950, 110, 4]],
          pages: [[964, 106]],
          enemies: [
            [150, 178, 110, 250, "degen"], [420, 178, 350, 560, "degen"],
            [560, 178, 500, 610, "shiller"],
            [730, 178, 710, 830, "degen"],
            [960, 178, 960, 960, "shitgun"]
          ],
          hazards: [[470, 190, 38, 15], [745, 190, 40, 15]]
        }
      },
      "4": {
        key: "4", index: 4, name: "ICO TOWER", worldW: 1120, spawnX: 22,
        zone: { name: "ICO TOWER", sky: "#33204a", sky2: "#170e24", ground: "#3c2a52", accent: "#8d6de8", text: "Grab the SAT CANNON — blast the token walls and clear the tower." },
        goal: { x: 1082, y: 140, w: 20, h: 64 },
        weapon: "satcannon",
        layout: {
          ground: [[0, 480], [560, 560]],
          platforms: [
            [150, 150, 60, 14, "ledger"], [280, 130, 58, 14, "question"],
            [430, 148, 62, 14, "ledger"], [492, 158, 56, 14, "ledger"],
            [650, 128, 56, 14, "question"], [790, 150, 62, 14, "ledger"],
            [950, 128, 56, 14, "question"]
          ],
          coinArcs: [[110, 128, 4], [350, 118, 5], [610, 112, 4], [830, 120, 4], [1000, 112, 4]],
          pages: [[1036, 106]],
          enemies: [
            [140, 178, 100, 230, "shiller"],
            [330, 178, 330, 330, "shitgun"],
            [410, 178, 375, 445, "rugpull"],
            [740, 178, 740, 740, "shitgun"],
            [800, 178, 780, 900, "degen"],
            [1010, 178, 1010, 1010, "shitgun"],
            [980, 178, 960, 1050, "shiller"]
          ],
          hazards: [[600, 190, 40, 15]],
          barricades: [[250, 4], [712, 4], [925, 4]]
        }
      }
    }
  }
];
