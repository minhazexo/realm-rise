// Shared panel prop/row types. One home so a panel can be read alone.

export interface PanelsProps {
  panel: string | null | undefined;
}

export interface IconProps {
  id: string;
  size?: number;
}

export interface InventoryEntry {
  id: string;
  iid?: string;
  qty?: number;
}

export interface EquippedItem {
  id: string;
  dur?: number | null;
}

export interface RecipeCompare {
  note?: string;
  dmgDelta?: number;
  armorDelta?: number;
  equippedId?: string;
  critDelta?: number;
}

export interface RecipeUI {
  id: string;
  cat: string;
  out: string;
  cost: Record<string, number>;
  station?: string;
  durSec?: number;
  def?: { name?: string };
  reason?: string;
  compare?: RecipeCompare;
}

export interface CraftQueueState {
  id: string;
  name: string;
  total: number;
  done: number;
}

export interface SkillDef {
  id: string;
  branch?: string;
  name?: string;
  desc?: string;
  maxRank: number;
  req?: Record<string, number>;
}

export interface BranchDef {
  id: string;
  label?: string;
  color?: string;
}

export interface BuildingDef {
  key: string;
  label?: string;
  desc?: string;
  cost: Record<string, number>;
  requiresStage?: number;
}

export interface CitizenInfo {
  uid?: string;
  name?: string;
  role?: string;
  skillLv?: number;
}

export interface PoiInfo {
  id: string;
  name?: string;
  x: number;
  y: number;
}

export interface FactionInfo {
  key: string;
  name?: string;
  status?: string;
}

export interface JournalStep {
  done?: boolean;
  text?: string;
  have?: number | string;
  need?: number | string;
}

export interface SideQuest {
  id: string;
  title?: string;
  steps: JournalStep[];
}

export interface JournalSnapshot {
  none?: boolean;
  chapter?: number | string;
  title?: string;
  steps: JournalStep[];
  side?: SideQuest[];
}

export interface TradeOffer {
  id: string;
  buy: number;
}

export interface SaveSummary {
  name?: string;
  level?: number;
  day?: number;
}
