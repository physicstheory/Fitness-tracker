import { Check } from "lucide-react";
import { EQUIPMENT, equipmentName } from "../data/equipment";
import { setState, useAppState } from "../store";

export function setEquipment(list: string[]) {
  setState((s) => ({
    ...s,
    // Keep the free-text field in sync; it's what the coach prompts read.
    profile: { ...s.profile, equipmentList: list, equipment: list.length ? list.map(equipmentName).join(", ") : "Bodyweight only" },
  }));
}

/** Tap to toggle the equipment you have. */
export function EquipmentPicker() {
  const owned = useAppState().profile.equipmentList ?? [];
  const toggle = (id: string) => setEquipment(owned.includes(id) ? owned.filter((x) => x !== id) : [...owned, id]);
  return (
    <div className="equip-grid">
      {EQUIPMENT.map((e) => {
        const on = owned.includes(e.id);
        return (
          <button key={e.id} className={`equip ${on ? "on" : ""}`} onClick={() => toggle(e.id)} aria-pressed={on}>
            <span style={{ fontSize: 22 }}>{e.emoji}</span>
            <span className="small" style={{ fontWeight: 700, flex: 1, textAlign: "left" }}>
              {e.name}
            </span>
            <span className="equip-check">{on && <Check size={14} />}</span>
          </button>
        );
      })}
    </div>
  );
}
