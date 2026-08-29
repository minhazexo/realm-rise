// Skill tree: six branches with meaningful effects consumed by Player.recompute().
export const BRANCHES = [
  { id: 'survival', label: 'Survival', color: '#6fbf73' },
  { id: 'warrior', label: 'Warrior', color: '#e05a4e' },
  { id: 'ranger', label: 'Ranger', color: '#63b6d8' },
  { id: 'craftsman', label: 'Craftsman', color: '#e8a13a' },
  { id: 'leader', label: 'Leader', color: '#b071e0' },
  { id: 'ruler', label: 'Ruler', color: '#e8c94b' }
];

export const SKILLS = [
  { id: 'surv_gather', branch: 'survival', name: 'Keen Harvesting', desc: '+12% resource yield per rank.', maxRank: 3, fx: { gatherYield: 0.12 } },
  { id: 'surv_appetite', branch: 'survival', name: 'Iron Stomach', desc: '-15% hunger/thirst drain per rank.', maxRank: 2, fx: { drainResist: 0.15 } },
  { id: 'surv_hunter', branch: 'survival', name: 'Master Hunter', desc: '+25% meat & hide drops per rank.', maxRank: 2, req: { surv_gather: 2 }, fx: { huntLoot: 0.25 } },
  { id: 'surv_herbalism', branch: 'survival', name: 'Herbal Lore', desc: 'Medicine heals +20% more per rank.', maxRank: 2, req: { surv_hunter: 1 }, fx: { healPower: 0.2 } },
  { id: 'surv_instincts', branch: 'survival', name: 'Wilderness Instincts', desc: '+15% sprint efficiency; sense ambushes early.', maxRank: 2, req: { surv_appetite: 1 }, fx: { sprintEff: 0.15, ambushSense: 1 } },

  { id: 'war_mastery', branch: 'warrior', name: 'Sword Mastery', desc: '+10% melee damage per rank.', maxRank: 3, fx: { meleeDmg: 0.1 } },
  { id: 'war_heavy', branch: 'warrior', name: 'Heavy Strikes', desc: 'Unlocks heavy attacks; +15% heavy damage per rank.', maxRank: 3, req: { war_mastery: 2 }, fx: { unlockHeavy: 1, heavyDmg: 0.15 } },
  { id: 'war_shield', branch: 'warrior', name: 'Shield Discipline', desc: '-20% blocking stamina cost per rank.', maxRank: 2, fx: { blockStaminaSave: 0.2 } },
  { id: 'war_crit', branch: 'warrior', name: 'Critical Strikes', desc: '+6% critical chance per rank.', maxRank: 2, req: { war_mastery: 1 }, fx: { critChance: 0.06 } },
  { id: 'war_berserk', branch: 'warrior', name: 'Berserker', desc: 'Below 35% HP: +30% damage per rank.', maxRank: 1, req: { war_crit: 1, war_heavy: 1 }, fx: { berserk: 0.3 } },

  { id: 'rang_mastery', branch: 'ranger', name: 'Bow Mastery', desc: '+12% ranged damage per rank.', maxRank: 3, fx: { rangedDmg: 0.12 } },
  { id: 'rang_precision', branch: 'ranger', name: 'Precision', desc: '+8% ranged critical chance per rank.', maxRank: 2, req: { rang_mastery: 2 }, fx: { rangedCrit: 0.08 } },
  { id: 'rang_track', branch: 'ranger', name: 'Tracker', desc: 'Reveals more markers on the world map.', maxRank: 2, fx: { mapDetail: 1 } },
  { id: 'rang_stealth', branch: 'ranger', name: 'Stealth Walker', desc: 'Enemies notice you 18% later per rank.', maxRank: 2, fx: { stealth: 0.18 } },
  { id: 'rang_longshot', branch: 'ranger', name: 'Longshot', desc: '+15% bow range per rank.', maxRank: 2, req: { rang_precision: 1 }, fx: { bowRange: 0.15 } },

  { id: 'cra_tools', branch: 'craftsman', name: 'Careful Hands', desc: 'Tools lose 20% less durability per rank.', maxRank: 2, fx: { toolWear: -0.2 } },
  { id: 'cra_speed', branch: 'craftsman', name: 'Quick Crafting', desc: '-12% craft time per rank.', maxRank: 2, fx: { craftSpeed: 0.12 } },
  { id: 'cra_weaponry', branch: 'craftsman', name: 'Advanced Weaponry', desc: 'Unlocks master-tier weapon crafting.', maxRank: 1, req: { cra_speed: 1 }, fx: { unlockAdvancedCraft: 1 } },
  { id: 'cra_armory', branch: 'craftsman', name: 'Master Armorer', desc: '+10% armor value crafted, per rank.', maxRank: 2, req: { cra_tools: 1 }, fx: { armorBonus: 0.1 } },
  { id: 'cra_smith', branch: 'craftsman', name: 'Grandmaster Smith', desc: 'Repairs restore full durability.', maxRank: 1, req: { cra_weaponry: 1, cra_armory: 1 }, fx: { perfectRepair: 1 } },

  { id: 'led_recruit', branch: 'leader', name: 'Force Multiplier', desc: '+1 army command capacity per rank.', maxRank: 3, fx: { armyCap: 1 } },
  { id: 'led_morale', branch: 'leader', name: 'Inspiring Presence', desc: '+4 settlement happiness per rank.', maxRank: 2, fx: { happinessFlat: 4 } },
  { id: 'led_command', branch: 'leader', name: 'Battle Command', desc: '+8% military power per rank.', maxRank: 2, req: { led_recruit: 1 }, fx: { militaryPower: 0.08 } },
  { id: 'led_efficiency', branch: 'leader', name: 'Kingdom Efficiency', desc: '+10% citizen production per rank.', maxRank: 2, fx: { production: 0.1 } },
  { id: 'led_legend', branch: 'leader', name: 'Living Legend', desc: 'Famous recruits cost 25% less.', maxRank: 1, req: { led_morale: 1 }, fx: { recruitDiscount: 0.25 } },

  { id: 'rul_tax', branch: 'ruler', name: 'Fair Tithes', desc: '+15% tax income per rank.', maxRank: 2, fx: { taxBonus: 0.15 } },
  { id: 'rul_trade', branch: 'ruler', name: 'Royal Charter', desc: '+8% better trade margins per rank.', maxRank: 2, fx: { tradeBonus: 0.08 } },
  { id: 'rul_diplo', branch: 'ruler', name: 'Silver Tongue', desc: 'Diplomatic gifts are 30% cheaper.', maxRank: 1, req: { rul_trade: 1 }, fx: { diploDiscount: 0.3 } },
  { id: 'rul_expand', branch: 'ruler', name: 'Banner Roads', desc: 'Territories produce +12% per rank.', maxRank: 2, req: { rul_tax: 1 }, fx: { territoryOutput: 0.12 } },
  { id: 'rul_authority', branch: 'ruler', name: 'Royal Authority', desc: '+1 to every attribute.', maxRank: 1, req: { rul_diplo: 1, rul_expand: 1 }, fx: { allStats: 1 } }
];

export const SKILL_MAP = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
