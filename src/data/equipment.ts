export interface Equipment {
  id: string;
  name: string;
  emoji: string;
}

/** Equipment the user can own. Exercises needing only "always" items are available to everyone. */
export const EQUIPMENT: Equipment[] = [
  { id: "dumbbells", name: "Dumbbells", emoji: "🏋️" },
  { id: "barbell", name: "Barbell & plates", emoji: "🏋️‍♂️" },
  { id: "bench", name: "Bench", emoji: "🛋️" },
  { id: "squat_rack", name: "Squat rack", emoji: "🗄️" },
  { id: "pullup_bar", name: "Pull-up bar", emoji: "🧗" },
  { id: "dip_bars", name: "Dip bars", emoji: "⏸️" },
  { id: "kettlebell", name: "Kettlebell", emoji: "🔔" },
  { id: "bands", name: "Resistance bands", emoji: "🪢" },
  { id: "cable", name: "Cable machine", emoji: "🎛️" },
  { id: "leg_press", name: "Leg press machine", emoji: "🦿" },
  { id: "mat", name: "Exercise mat", emoji: "🧘" },
  { id: "jump_rope", name: "Jump rope", emoji: "➰" },
];

/** Things everyone has. */
export const ALWAYS_AVAILABLE = new Set(["none", "wall", "floor"]);

const KEYWORDS: [RegExp, string][] = [
  [/dumb-?bell|\bdb\b/i, "dumbbells"],
  [/barbell|\bbb\b|plates?\b/i, "barbell"],
  [/bench/i, "bench"],
  [/squat rack|power rack|\brack\b/i, "squat_rack"],
  [/pull-?up bar|chin-?up bar/i, "pullup_bar"],
  [/dip (bars|station)|parallel bars/i, "dip_bars"],
  [/kettle-?bell|\bkb\b/i, "kettlebell"],
  [/band/i, "bands"],
  [/cable|pulley|machine|lat pull-?down/i, "cable"],
  [/leg press/i, "leg_press"],
  [/jump rope|skipping rope/i, "jump_rope"],
];

/** Guesses the equipment an exercise needs from free text (for imported exercises). */
export function inferEquipment(text: string): string[] {
  const found = new Set<string>();
  for (const [re, id] of KEYWORDS) if (re.test(text)) found.add(id);
  if (found.has("leg_press")) found.delete("cable");
  return [...found];
}

/** Weighted = the load comes from equipment, so a weight is logged per set. */
export const WEIGHTED_EQUIPMENT = new Set(["dumbbells", "barbell", "kettlebell", "cable", "leg_press"]);

export const equipmentName = (id: string) => EQUIPMENT.find((e) => e.id === id)?.name ?? id;
