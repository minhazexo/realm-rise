# BUILD A PROFESSIONAL KINGDOM ADVENTURE GAME

You are a **senior AAA-style game developer, gameplay designer, frontend engineer, UI/UX designer, systems architect, and performance engineer**.

Your task is to build a complete, polished, highly replayable browser game using:

* React
* JSX
* Vite
* Phaser 4
* JavaScript
* HTML5
* CSS
* WebGL
* Responsive UI

The game must feel like a **real commercial-quality adventure/kingdom-building game**, not a basic coding demo.

Do NOT create a static mockup.

Do NOT create fake buttons that do nothing.

Every major interaction must actually work.

The player should begin as an ordinary survivor with almost nothing and gradually become the ruler of a powerful kingdom.

---

# 1. GAME CONCEPT

Create an adventure game called:

# "RISE OF THE REALM"

Core fantasy:

> "You begin with nothing. Explore an unknown world, survive its dangers, gather resources, fight enemies, recruit people, establish a settlement, build a kingdom, defend your territory, discover ancient secrets, and eventually become the ruler of the realm."

The player starts with:

* basic clothing
* a simple weapon
* very little food
* no kingdom
* no army
* no buildings
* no followers
* no reputation
* no wealth

The world should gradually transform around the player.

The player should feel:

**survival → discovery → power → leadership → kingdom → legend**

---

# 2. MOST IMPORTANT DESIGN PRINCIPLE

Create a strong gameplay loop:

```text
EXPLORE
   ↓
DISCOVER
   ↓
GATHER
   ↓
SURVIVE
   ↓
FIGHT
   ↓
LOOT
   ↓
CRAFT
   ↓
UPGRADE
   ↓
RECRUIT
   ↓
BUILD
   ↓
PROTECT
   ↓
EXPAND
   ↓
CONQUER
   ↓
BECOME KING / QUEEN
```

Every system should feed another system.

For example:

Wood
→ buildings

Stone
→ walls

Iron
→ weapons

Food
→ population

Gold
→ trade

Knowledge
→ technology

Reputation
→ recruitment

Army
→ conquest

Territory
→ resources

Resources
→ stronger kingdom

Kingdom
→ larger threats

Larger threats
→ stronger progression

This should create a continuous gameplay loop.

---

# 3. GAME STYLE

Use a visually impressive **2D top-down adventure/strategy style**.

Think of a combination of:

* survival adventure
* RPG progression
* kingdom management
* exploration
* crafting
* tactical combat
* territory expansion
* narrative quests

Do NOT simply copy another game.

Create an original identity.

The world should feel:

* mysterious
* dangerous
* beautiful
* alive
* atmospheric
* rewarding

---

# 4. WORLD

Create a large explorable procedural or semi-procedural world.

The world should contain multiple biomes.

Initial biomes:

1. Forest
2. Plains
3. Mountains
4. Riverlands
5. Swamp
6. Desert
7. Frozen North
8. Ancient Ruins
9. Volcanic Lands
10. Enemy Territories

Each biome should have:

* unique environment
* unique resources
* unique enemies
* unique wildlife
* unique visual atmosphere
* unique music/ambience
* different difficulty
* special discoveries

Example:

FOREST:

Resources:

* wood
* berries
* herbs
* mushrooms
* stone

Enemies:

* wolves
* bandits
* wild boars

Rare discovery:

* ancient shrine

---

# 5. WORLD EXPLORATION

The player should control a character directly.

Controls:

Desktop:

* WASD / Arrow keys = movement
* Mouse = interaction
* E = interact
* I = inventory
* M = map
* C = crafting
* B = build mode
* J = journal
* ESC = pause

Mobile:

* virtual joystick
* interaction button
* attack button
* dodge button
* inventory button
* map button

Movement should feel smooth.

Add:

* acceleration
* deceleration
* walking animation
* running
* stamina
* collision
* camera follow
* camera smoothing

---

# 6. PLAYER CHARACTER

Allow the player to choose:

* male
* female

Allow customization:

* name
* skin tone
* hair
* hair color
* clothing
* starting personality

Do not make character creation overly complicated.

The character should visually evolve.

Starting:

* simple clothing
* wooden weapon

Later:

* leather armor
* iron armor
* steel armor
* royal armor
* legendary armor

The player's appearance should communicate progression.

---

# 7. PLAYER STATS

Create a real RPG progression system.

Stats:

```text
Health
Stamina
Strength
Defense
Agility
Attack
Critical Chance
Movement Speed
Mining
Woodcutting
Crafting
Survival
Leadership
Charisma
Luck
```

Use meaningful progression.

Do not make every upgrade simply:

"+5% damage"

Different stats should unlock different gameplay possibilities.

Example:

High charisma:

* recruit better NPCs
* unlock better dialogue
* obtain better trade prices

High survival:

* gather more resources
* survive harsh environments

High leadership:

* command larger armies

---

# 8. LEVEL SYSTEM

Player begins at:

Level 1

Maximum initial level:

Level 50

Later architecture should allow:

Level 100+

XP can come from:

* exploration
* combat
* quests
* gathering
* crafting
* discovering locations
* defeating bosses
* kingdom achievements

Each level should provide:

* stat points
* skill points
* occasional unlocks

Show satisfying:

* XP animation
* level-up animation
* sound
* notification

---

# 9. SKILL TREE

Create a professional skill tree.

Branches:

### SURVIVAL

* Better gathering
* Food preservation
* Hunting
* Herbalism
* Survival instincts

### WARRIOR

* Sword mastery
* Heavy attacks
* Shield mastery
* Critical strikes
* Berserker

### RANGER

* Bow mastery
* Precision
* Tracking
* Stealth
* Long-range attacks

### CRAFTSMAN

* Better tools
* Faster crafting
* Advanced weapons
* Advanced armor
* Master smith

### LEADER

* Recruitment
* Morale
* Army capacity
* Command bonuses
* Kingdom efficiency

### RULER

* Tax efficiency
* Trade
* Diplomacy
* Territory expansion
* Royal authority

Make the tree visually beautiful.

Locked skills should communicate why they are locked.

---

# 10. RESOURCES

Create a complete resource economy.

Basic:

* Wood
* Stone
* Fiber
* Food
* Water

Intermediate:

* Iron
* Coal
* Leather
* Clay
* Herbs

Advanced:

* Steel
* Gold
* Silver
* Crystal
* Ancient Relics

Rare:

* Dragon Scale
* Moonstone
* Ancient Core
* Royal Artifact

Every resource must have a purpose.

Avoid useless resources.

---

# 11. INVENTORY

Create a professional inventory system.

Features:

* grid inventory
* item stacking
* item icons
* rarity
* item description
* equipment slots
* drag/drop
* sorting
* filtering
* search
* item comparison

Item rarities:

```text
Common
Uncommon
Rare
Epic
Legendary
Mythic
```

Items should have meaningful differences.

---

# 12. EQUIPMENT

Equipment slots:

* Weapon
* Off-hand
* Helmet
* Chest
* Gloves
* Boots
* Ring
* Amulet

Weapons:

* wooden sword
* iron sword
* steel sword
* great sword
* bow
* crossbow
* spear
* axe
* legendary weapons

Allow upgrades.

---

# 13. GATHERING

The player should physically interact with the environment.

Examples:

Approach tree:

> Press E to gather wood.

Approach rock:

> Mine stone.

Approach iron deposit:

> Mine iron.

Approach berry bush:

> Gather berries.

Add:

* gathering animation
* particles
* sound
* progress indicator
* resource popup
* tool durability

Better tools should improve gathering.

---

# 14. CRAFTING

Create a full crafting system.

Crafting categories:

### Survival

* campfire
* torch
* basic shelter
* cooking station

### Tools

* axe
* pickaxe
* hammer
* fishing rod

### Weapons

* sword
* bow
* spear
* shield

### Armor

* leather armor
* iron armor
* steel armor

### Kingdom

* storage
* walls
* gates
* towers
* workshops

Crafting should require actual resources.

---

# 15. SURVIVAL

Add lightweight survival mechanics.

Stats:

* Hunger
* Thirst
* Health
* Stamina
* Temperature

Do NOT make survival annoying.

The purpose is to create tension, not frustration.

For example:

Low hunger:

* reduced stamina

Very low hunger:

* reduced health regeneration

Cold environment:

* slower movement

Hot environment:

* increased thirst

---

# 16. DAY / NIGHT SYSTEM

Implement a real day/night cycle.

Day:

* safer
* better visibility
* NPC activity

Night:

* darker
* stronger monsters
* special creatures
* rare resources
* hidden events

Add:

* dynamic lighting
* shadows
* ambient effects
* stars
* moon
* sunrise
* sunset

Night should feel dangerous but beautiful.

---

# 17. WEATHER

Add:

* rain
* storm
* fog
* snow
* heat
* clear weather

Weather should influence gameplay.

Rain:

* extinguishes campfires
* affects visibility

Fog:

* reduces vision

Snow:

* reduces movement

Storm:

* dangerous travel

Do not overcomplicate the system.

---

# 18. COMBAT

Combat must feel responsive.

Basic attacks:

* light attack
* heavy attack
* dodge
* block
* ranged attack

Add:

* hit effects
* damage numbers
* knockback
* attack animations
* impact particles
* screen shake
* sound effects

Combat should not be turn-based.

Make it real-time.

---

# 19. ENEMY SYSTEM

Create multiple enemy categories.

Wildlife:

* wolf
* boar
* bear

Bandits:

* scout
* archer
* swordsman
* brute
* captain

Monsters:

* goblin
* skeleton
* beast
* corrupted creature

Bosses:

* Alpha Wolf
* Bandit King
* Ancient Guardian
* Swamp Witch
* Frost Warden
* Dragon

Every enemy should have:

* health
* attack
* defense
* movement
* attack pattern
* detection range
* loot table

Avoid enemies simply walking toward the player.

Use basic AI states:

```text
IDLE
PATROL
DETECT
CHASE
ATTACK
RETREAT
SEARCH
DEAD
```

---

# 20. BOSS ENCOUNTERS

Bosses should be memorable.

Each boss should have:

* unique arena
* intro
* unique attacks
* phases
* special music
* unique loot
* reward

Example:

DRAGON:

Phase 1:

* ground attacks

Phase 2:

* fire breath

Phase 3:

* flying attacks

Phase 4:

* enraged mode

Boss fights should feel like major achievements.

---

# 21. NPC SYSTEM

Create living NPCs.

NPC categories:

* farmer
* miner
* blacksmith
* merchant
* hunter
* soldier
* healer
* builder
* scholar
* noble
* spy

NPCs should have:

* name
* profession
* personality
* level
* happiness
* loyalty
* skills

Some NPCs can join the player's settlement.

---

# 22. RECRUITMENT

The player should not magically receive an army.

They must build relationships.

Recruitment methods:

* rescue NPCs
* complete quests
* help villages
* defeat bandits
* pay mercenaries
* gain reputation

NPCs should have requirements.

Example:

A legendary blacksmith might require:

* Reputation 50
* Kingdom level 3
* 500 gold
* completed blacksmith quest

---

# 23. SETTLEMENT CREATION

This is the game's major transition.

Initially:

The player has nothing.

Then:

### Stage 1

Camp

↓

### Stage 2

Settlement

↓

### Stage 3

Village

↓

### Stage 4

Town

↓

### Stage 5

City

↓

### Stage 6

Kingdom

↓

### Stage 7

Empire

The visual environment should evolve dramatically.

---

# 24. BUILDING SYSTEM

Allow the player to build.

Building categories:

### RESIDENTIAL

* hut
* house
* cottage
* manor

### RESOURCE

* woodcutter
* mine
* farm
* quarry

### PRODUCTION

* workshop
* blacksmith
* tannery
* kitchen

### MILITARY

* barracks
* archery range
* stable
* watchtower
* fortress

### GOVERNMENT

* town hall
* treasury
* courthouse
* royal palace

### DEFENSE

* wall
* gate
* tower
* moat

### SPECIAL

* temple
* library
* academy
* market
* harbor

Buildings should have:

* construction cost
* construction time
* level
* upgrade requirements
* gameplay effect

---

# 25. KINGDOM MANAGEMENT

Once the settlement becomes large enough, introduce kingdom management.

Dashboard:

```text
Population
Food
Gold
Wood
Stone
Iron
Happiness
Morale
Defense
Military Power
Territory
Reputation
Kingdom Level
```

The player becomes responsible for their people.

---

# 26. POPULATION

Population should matter.

Citizens require:

* food
* housing
* safety

Citizens can work as:

* farmers
* miners
* woodcutters
* builders
* soldiers
* merchants
* craftsmen

More population:

* more production

BUT

* more food consumption

* more housing requirements

This creates meaningful decisions.

---

# 27. KINGDOM HAPPINESS

Track:

* food availability
* safety
* taxes
* housing
* employment
* entertainment

Low happiness:

* citizens leave
* productivity decreases
* protests may occur

High happiness:

* productivity increases
* population grows
* better NPCs arrive

---

# 28. ECONOMY

Implement:

* gold
* taxation
* markets
* trade
* merchants

Allow:

BUY

SELL

TRADE

IMPORT

EXPORT

Different regions should have different resource prices.

Example:

Mountain:

Iron is cheap.

Coast:

Fish is cheap.

Desert:

Water is expensive.

This encourages exploration and trade.

---

# 29. TERRITORY

The world should contain claimable territory.

The player starts with a small area.

Expand by:

* exploration
* building outposts
* defeating enemies
* completing objectives

Territory should provide:

* resources
* strategic locations
* villages
* mines
* forests
* ancient ruins

---

# 30. FACTIONS

Create competing factions.

Examples:

### THE IRON KINGDOM

Military focused.

### THE VERDANT CLANS

Nature focused.

### THE MERCHANT LEAGUE

Economy focused.

### THE ASHEN LEGION

Aggressive faction.

### THE ANCIENT ORDER

Mystery/magic focused.

Each faction should have:

* territory
* leaders
* culture
* army
* relationships
* goals

---

# 31. DIPLOMACY

Allow:

* friendly relations
* neutral relations
* trade agreements
* alliances
* non-aggression pacts
* threats
* war

Player decisions should affect relationships.

Do not make diplomacy purely cosmetic.

---

# 32. QUEST SYSTEM

Create a dynamic quest system.

Quest categories:

* exploration
* hunting
* gathering
* rescue
* escort
* assassination
* defense
* diplomacy
* kingdom
* boss
* mystery

Quest structure:

```text
Quest
↓
Objective
↓
Decision
↓
Consequence
↓
Reward
```

Some quests should have multiple outcomes.

---

# 33. STORY

Create an overarching story.

Beginning:

The player arrives in an unknown land after a mysterious disaster.

They discover:

The land was once ruled by a great civilization.

The civilization disappeared.

Ancient ruins remain.

Powerful factions are fighting over the land.

Something ancient is awakening.

Eventually the player discovers:

The fate of the realm is connected to the kingdom they are building.

Create chapters.

Example:

### CHAPTER I

The Stranger

### CHAPTER II

The First Fire

### CHAPTER III

A Place to Call Home

### CHAPTER IV

The Rising Banner

### CHAPTER V

War Comes

### CHAPTER VI

The Lost Civilization

### CHAPTER VII

The Ancient Threat

### CHAPTER VIII

Crown of the Realm

---

# 34. PLAYER CHOICES

Add meaningful choices.

Example:

A starving village asks for food.

Option A:

Give them food.

→ reputation increases

Option B:

Demand payment.

→ gold increases

→ reputation decreases

Option C:

Ignore them.

→ village may collapse

Choices should create consequences.

---

# 35. RANDOM WORLD EVENTS

Create events that make the world feel alive.

Examples:

* merchant caravan arrives
* wolf pack attacks
* traveling trader
* abandoned camp
* meteor crash
* bandit raid
* wandering hero
* mysterious traveler
* treasure map
* village requests help
* plague
* harvest festival
* royal messenger
* enemy invasion

Events should not happen constantly.

Use controlled randomness.

---

# 36. EXPLORATION REWARDS

Exploration should always feel worthwhile.

Possible discoveries:

* treasure
* ruins
* caves
* villages
* rare resources
* NPCs
* secret bosses
* ancient artifacts
* hidden paths
* lore

Use "curiosity rewards".

When players see something interesting in the distance, they should want to investigate.

---

# 37. MYSTERY SYSTEM

Do not reveal everything immediately.

Hide:

* ancient ruins
* mysterious symbols
* hidden caves
* unknown factions
* legendary weapons
* secret bosses

Let the player gradually understand the world.

---

# 38. SAVE SYSTEM

Implement robust local save functionality.

Save:

* player position
* inventory
* equipment
* level
* XP
* skills
* resources
* buildings
* population
* kingdom
* quests
* discovered locations
* faction relationships
* world state

Use:

localStorage or IndexedDB.

Create:

SAVE

LOAD

NEW GAME

DELETE SAVE

AUTO SAVE

Show:

"Game Saved"

Do not lose progress on refresh.

---

# 39. GAME UI

Create a premium UI.

HUD:

Top:

```text
❤️ Health
⚡ Stamina
🍖 Food
💧 Water
🪙 Gold
```

Bottom:

Hotbar:

```text
1 2 3 4 5 6 7 8
```

Side:

Quest tracker.

Minimap:

Top-right.

UI style:

* medieval
* elegant
* dark fantasy
* subtle glass effects
* parchment textures where appropriate
* gold accents
* clean typography
* strong hierarchy

Avoid generic Bootstrap-looking interfaces.

---

# 40. MAIN MENU

Create a cinematic main menu.

Buttons:

```text
CONTINUE
NEW GAME
LOAD GAME
SETTINGS
HOW TO PLAY
CREDITS
```

Background:

Animated kingdom landscape.

Include:

* moving clouds
* birds
* fog
* subtle particles
* ambient animation

---

# 41. PAUSE MENU

Press ESC.

Show:

```text
RESUME
INVENTORY
QUESTS
MAP
SKILLS
KINGDOM
SETTINGS
SAVE GAME
MAIN MENU
```

---

# 42. MAP

Create a beautiful world map.

Features:

* discovered areas
* undiscovered areas
* player position
* settlements
* enemies
* resources
* quests
* faction borders
* fast travel points

Fog of war.

The player must explore to reveal the world.

---

# 43. FAST TRAVEL

Unlock fast travel after discovering locations.

Fast travel requires:

* discovered location
* safe route

Optional:

* food cost
* time advancement

Do not allow fast travel everywhere immediately.

---

# 44. AUDIO

Implement an audio architecture.

Sounds:

* footsteps
* sword attacks
* mining
* chopping
* crafting
* UI clicks
* level-up
* enemy attacks
* environmental ambience

Music:

* exploration
* combat
* night
* kingdom
* boss
* victory
* danger

Music should transition smoothly.

---

# 45. VISUAL FEEDBACK

Every important action needs feedback.

Examples:

Collect wood:

```text
+5 Wood
```

Level up:

```text
LEVEL UP!
Level 7
```

Complete quest:

```text
QUEST COMPLETE
+250 XP
+50 Gold
```

Build structure:

```text
TOWN HALL CONSTRUCTED
```

Use:

* particles
* animations
* sounds
* subtle camera shake
* floating text
* screen transitions

Do not overdo effects.

---

# 46. PROGRESSION

Create multiple progression layers.

### PLAYER

Level

↓

Skills

↓

Equipment

↓

Abilities

### SETTLEMENT

Camp

↓

Village

↓

Town

↓

City

↓

Kingdom

### WORLD

Explore

↓

Discover

↓

Claim

↓

Control

### STORY

Chapter 1

↓

Chapter 2

↓

Chapter 3

↓

Endgame

The player should always have something meaningful to work toward.

---

# 47. ENDGAME

The game should NOT simply end when the player builds a kingdom.

Endgame goals:

* conquer rival factions
* unite the realm
* defeat ancient threat
* build legendary capital
* discover all ancient artifacts
* complete world mysteries
* reach maximum kingdom level
* create the strongest economy
* become High King / High Queen

Multiple endings are preferred.

---

# 48. ADDICTION / RETENTION DESIGN

Do NOT use manipulative monetization.

Instead make the gameplay naturally compelling.

Use:

### SHORT-TERM GOALS

"Gather 20 wood."

### MEDIUM-TERM GOALS

"Build your first blacksmith."

### LONG-TERM GOALS

"Turn your settlement into a kingdom."

### EPIC GOALS

"Unite the entire realm."

Always give the player:

* something to do
* something to unlock
* something to discover
* something to improve
* something to look forward to

Avoid unnecessary grinding.

Every 5–15 minutes of play should ideally produce a meaningful accomplishment.

---

# 49. "ONE MORE THING" DESIGN

Build moments that naturally create:

> "I'll just do one more thing."

Examples:

Player is exploring.

They see:

"Unknown Ruins"

They investigate.

They find:

"Ancient Key"

The key unlocks:

"Hidden Cave"

Inside:

"Legendary Weapon"

The weapon requires:

"Ancient Crystal"

The crystal is found in:

"Frozen North"

This creates organic progression.

Never rely on artificial timers to create engagement.

---

# 50. ACHIEVEMENTS

Create achievements.

Examples:

### FIRST BLOOD

Defeat your first enemy.

### HOMESTEAD

Build your first settlement.

### BLACKSMITH

Craft your first weapon.

### RULER

Establish your kingdom.

### CONQUEROR

Capture your first enemy territory.

### EXPLORER

Discover 25 locations.

### LEGEND

Defeat a legendary boss.

### EMPEROR

Control 50% of the realm.

Show achievements in a dedicated panel.

---

# 51. PERFORMANCE

This is extremely important.

The game must remain smooth.

Target:

60 FPS where hardware allows.

Use:

* object pooling
* lazy loading
* asset caching
* texture atlases
* efficient collision
* spatial partitioning
* chunk loading
* limited active AI
* throttled background systems

Do not render thousands of unnecessary objects.

Only simulate nearby NPCs/enemies at full detail.

Use simplified simulation for distant entities.

---

# 52. WORLD CHUNK SYSTEM

Do not load the entire world into active memory.

Divide world into chunks.

Example:

```text
World
 ├── Chunk -1,-1
 ├── Chunk 0,-1
 ├── Chunk 1,-1
 ├── Chunk -1,0
 ├── Chunk 0,0
 ├── Chunk 1,0
 ├── Chunk -1,1
 ├── Chunk 0,1
 └── Chunk 1,1
```

Load nearby chunks.

Unload distant chunks.

Keep persistent world state separately.

---

# 53. AI ARCHITECTURE

Use clean state machines.

NPC:

```text
IDLE
WORK
EAT
REST
TALK
TRAVEL
FLEE
FIGHT
```

Enemy:

```text
IDLE
PATROL
DETECT
CHASE
ATTACK
RETREAT
SEARCH
DEAD
```

Do not write giant monolithic AI functions.

---

# 54. CODE ARCHITECTURE

Use clean separation.

Recommended structure:

```text
src/
├── app/
│   ├── App.jsx
│   ├── routes/
│   └── components/
│
├── game/
│   ├── main.js
│   ├── config.js
│   │
│   ├── scenes/
│   │   ├── BootScene.js
│   │   ├── PreloadScene.js
│   │   ├── WorldScene.js
│   │   ├── CombatScene.js
│   │   └── KingdomScene.js
│   │
│   ├── entities/
│   │   ├── Player.js
│   │   ├── Enemy.js
│   │   ├── NPC.js
│   │   └── Building.js
│   │
│   ├── systems/
│   │   ├── CombatSystem.js
│   │   ├── InventorySystem.js
│   │   ├── CraftingSystem.js
│   │   ├── QuestSystem.js
│   │   ├── EconomySystem.js
│   │   ├── KingdomSystem.js
│   │   ├── WeatherSystem.js
│   │   ├── DayNightSystem.js
│   │   └── SaveSystem.js
│   │
│   ├── world/
│   │   ├── WorldGenerator.js
│   │   ├── ChunkManager.js
│   │   ├── BiomeGenerator.js
│   │   └── ResourceSpawner.js
│   │
│   └── data/
│       ├── items.js
│       ├── enemies.js
│       ├── buildings.js
│       ├── quests.js
│       ├── skills.js
│       └── factions.js
│
├── ui/
│   ├── HUD.jsx
│   ├── Inventory.jsx
│   ├── Crafting.jsx
│   ├── Map.jsx
│   ├── Skills.jsx
│   ├── QuestPanel.jsx
│   ├── KingdomPanel.jsx
│   └── Settings.jsx
│
├── hooks/
├── store/
├── utils/
└── styles/
```

Keep systems modular.

Do not put the entire game inside App.jsx.

---

# 55. STATE MANAGEMENT

Create a centralized game state.

Separate:

### GAME STATE

* player
* world
* enemies
* NPCs
* quests

### UI STATE

* inventory open
* map open
* pause menu
* selected item

### PERSISTENT STATE

* save data
* settings
* achievements

Avoid unnecessary React re-renders.

The Phaser game loop should not depend on React re-rendering every frame.

---

# 56. REACT + PHASER COMMUNICATION

Use a clean bridge/event system.

React should control:

* menus
* inventory UI
* kingdom UI
* settings
* quest panels

Phaser should control:

* movement
* combat
* world
* enemies
* physics
* animations

Communication should happen through:

* events
* commands
* controlled state synchronization

Do NOT force every Phaser frame through React.

---

# 57. RESPONSIVE DESIGN

The game must work on:

* desktop
* laptop
* tablet
* mobile

Desktop:

Keyboard + mouse.

Mobile:

Touch controls.

Do not simply shrink the desktop interface.

Create mobile-specific layouts.

---

# 58. ACCESSIBILITY

Include:

* adjustable volume
* music toggle
* sound effects toggle
* screen shake toggle
* reduced motion
* text size options
* control remapping where practical

Use readable typography.

---

# 59. SETTINGS

Create:

Graphics:

* quality
* particles
* shadows
* effects

Audio:

* master
* music
* SFX

Gameplay:

* difficulty
* auto-save

Accessibility:

* reduced motion
* UI scale
* text size

---

# 60. DIFFICULTY

Provide:

### STORY

Relaxed survival.

### NORMAL

Recommended.

### HARD

More dangerous world.

### LEGENDARY

Hardcore experience.

Difficulty should affect:

* enemy strength
* resource availability
* survival pressure
* kingdom threats

Do not simply multiply enemy health.

---

# 61. TUTORIAL

Do NOT dump a giant tutorial window on the player.

Teach through gameplay.

Example:

NPC:

> "The forest nearby should have enough wood for a camp."

Objective:

> Gather 10 Wood.

Then:

> Build Campfire.

Then:

> Hunt for Food.

Then:

> Survive your first night.

Gradually introduce mechanics.

---

# 62. FIRST 30 MINUTES

The first 30 minutes are extremely important.

Design them carefully.

### MINUTE 0–5

Character introduction.

Explore.

Gather.

Learn movement.

### MINUTE 5–10

First combat.

Build camp.

Craft weapon.

### MINUTE 10–15

Meet NPC.

Receive first major quest.

### MINUTE 15–20

Discover settlement location.

Build first structures.

### MINUTE 20–25

Recruit first NPCs.

Unlock crafting.

### MINUTE 25–30

First major threat.

Defend settlement.

End with:

> "Your settlement has survived. But someone is watching from beyond the forest."

This should create curiosity for the next session.

---

# 63. VISUAL DESIGN

The game should look premium.

Use:

* layered environments
* atmospheric lighting
* particles
* subtle bloom where appropriate
* animated water
* grass movement
* weather
* shadows
* fog
* environmental animation

The world should never feel completely static.

Add small details:

* birds
* butterflies
* falling leaves
* fireflies
* smoke
* water movement
* NPC activity

---

# 64. UI DESIGN PRINCIPLES

Do NOT make the UI look like a normal business dashboard.

It should feel like a game.

Use:

* dark fantasy palette
* parchment panels
* metal/wood accents
* elegant icons
* strong typography
* subtle animations

Avoid:

* excessive gradients
* giant rounded cards everywhere
* excessive glassmorphism
* generic SaaS UI
* huge empty spaces

---

# 65. ANIMATION

Use animation everywhere appropriate.

Examples:

Buttons:

hover → subtle movement

click → small compression

Inventory:

open → scale/fade

Level up:

screen effect

Building:

construction animation

Combat:

impact animation

Quest:

reward animation

Use animation to communicate state, not just decoration.

---

# 66. GAME FEEL

Prioritize "game feel".

Actions must feel satisfying.

When collecting:

```text
resource animation
+
sound
+
floating text
+
small particle effect
```

When attacking:

```text
animation
+
impact
+
sound
+
damage number
+
small camera response
```

When leveling:

```text
music sting
+
particles
+
UI animation
+
reward panel
```

---

# 67. NO FAKE SYSTEMS

This is critical.

Do NOT create:

* fake inventory
* fake combat
* fake map
* fake kingdom
* fake NPCs
* fake buttons
* fake save system

If a UI element exists, it should perform its intended action.

If a feature cannot be fully implemented yet, implement a smaller functional version rather than a fake version.

---

# 68. ASSET STRATEGY

Do not assume copyrighted commercial assets are available.

Create an asset abstraction layer.

Example:

```js
assets/
  characters/
  enemies/
  environment/
  buildings/
  items/
  ui/
  audio/
```

Use placeholders where necessary.

But make placeholders visually coherent.

Do not leave random colored squares everywhere in the final experience.

---

# 69. PROCEDURAL CONTENT

Where practical, generate:

* resource locations
* enemy spawn locations
* exploration points
* minor quests
* loot variations

Use deterministic seeds so the world can be recreated.

Example:

```text
World Seed:
847291
```

Same seed:

→ same world

New seed:

→ different world

---

# 70. LOOT SYSTEM

Enemies and chests should have loot tables.

Example:

Wolf:

* meat
* hide
* bone

Bandit:

* gold
* weapon
* food
* random equipment

Boss:

* unique artifact
* large gold reward
* rare material

Rare loot should feel genuinely exciting.

---

# 71. CHESTS

Add:

* wooden chest
* iron chest
* royal chest
* ancient chest

Some chests require:

* keys
* quests
* exploration
* defeating enemies

---

# 72. BUILDING UPGRADES

Buildings should evolve visually.

Example:

Town Hall:

Level 1:

wooden structure

Level 2:

stone structure

Level 3:

fortified hall

Level 4:

castle

Level 5:

royal citadel

The player's kingdom should visibly demonstrate progression.

---

# 73. MILITARY

Once the kingdom becomes advanced:

Recruit:

* militia
* swordsmen
* archers
* cavalry
* elite guards
* royal knights

Army stats:

* attack
* defense
* morale
* movement
* capacity

---

# 74. KINGDOM DEFENSE

Enemies can attack the kingdom.

Implement:

* warning notification
* enemy approach
* defense preparation
* tower attacks
* soldiers
* walls
* battle outcome
* damage to buildings

Do not make attacks random and unfair.

Give the player warning and preparation opportunities.

---

# 75. WAR

Later gameplay can introduce large-scale conflict.

Player can:

* declare war
* defend territory
* attack enemy camps
* capture strategic locations
* negotiate peace

Do NOT attempt to render hundreds of individual units if it harms performance.

Use simplified army simulation where appropriate.

---

# 76. LEGACY SYSTEM

After completing a major campaign, allow the player to create a legacy.

Example:

"House of Raven"

The next playthrough can inherit:

* cosmetic banner
* achievement
* small starting bonus
* discovered lore

Do not make New Game+ overpowered.

---

# 77. UI INFORMATION HIERARCHY

Always show the most important information first.

During combat:

1. Health
2. Enemy
3. Immediate danger
4. Current objective

During exploration:

1. Player
2. Quest
3. Nearby threats
4. Resources

During kingdom management:

1. Food
2. Population
3. Gold
4. Defense
5. Production

Do not overwhelm the player.

---

# 78. ERROR HANDLING

The game must never crash because:

* an asset is missing
* localStorage is unavailable
* an enemy has invalid data
* a resource is missing
* a save file is corrupted

Implement safe fallbacks.

Console errors should be minimized.

---

# 79. CODE QUALITY

Write production-quality code.

Requirements:

* modular
* readable
* reusable
* documented where necessary
* no unnecessary duplication
* no massive components
* no magic numbers where avoidable
* no dead code
* no unused imports
* no console spam

Use constants/configuration for balance values.

Example:

```js
const PLAYER_CONFIG = {
  maxHealth: 100,
  maxStamina: 100,
  movementSpeed: 180
};
```

---

# 80. GAME DATA

Keep balancing data separate from logic.

For example:

```js
const ITEMS = {
  WOOD: {
    id: "wood",
    name: "Wood",
    rarity: "common",
    stackSize: 100
  }
};
```

Do this for:

* items
* enemies
* buildings
* quests
* skills
* factions
* weapons

---

# 81. DEBUG MODE

Create a development-only debug panel.

Allow developers to:

* add resources
* teleport
* spawn enemies
* change time
* change weather
* level up
* unlock skills
* reveal map

Debug mode must be disabled in production.

---

# 82. TESTING

Before considering the game complete, test:

### MOVEMENT

* keyboard
* touch
* collision

### COMBAT

* attack
* damage
* death
* loot

### INVENTORY

* add
* remove
* equip
* unequip
* stack

### CRAFTING

* requirements
* crafting
* failure cases

### QUESTS

* accept
* progress
* complete
* rewards

### BUILDING

* placement
* resource deduction
* construction
* upgrades

### SAVE

* save
* load
* refresh
* corrupted data

### KINGDOM

* population
* resources
* buildings
* defense

---

# 83. DEVELOPMENT STRATEGY

Do NOT attempt to build everything in one giant file.

Build in milestones.

## MILESTONE 1

Core engine.

* React
* Vite
* Phaser
* player
* camera
* world
* movement

## MILESTONE 2

Exploration.

* biomes
* resources
* gathering
* inventory

## MILESTONE 3

Combat.

* weapons
* enemies
* AI
* loot

## MILESTONE 4

Progression.

* XP
* levels
* skills
* equipment

## MILESTONE 5

Settlement.

* building
* crafting
* NPCs

## MILESTONE 6

Kingdom.

* population
* economy
* territory
* diplomacy

## MILESTONE 7

Story.

* quests
* chapters
* factions
* bosses

## MILESTONE 8

Polish.

* audio
* particles
* animation
* responsive UI
* optimization

---

# 84. IMPORTANT IMPLEMENTATION RULE

After every milestone:

1. Run the project.
2. Check for errors.
3. Test the feature manually.
4. Fix broken interactions.
5. Check mobile layout.
6. Check performance.
7. Only then continue.

Never stack 50 untested systems on top of each other.

---

# 85. FINAL QUALITY BAR

Before declaring the project complete, ask:

### Does the game immediately look interesting?

### Does the player understand what to do?

### Is movement satisfying?

### Is combat satisfying?

### Are resources meaningful?

### Is exploration rewarding?

### Is progression addictive because it is rewarding, not because it is artificially slow?

### Does the settlement visibly evolve?

### Does the kingdom feel like something the player actually owns?

### Are player choices meaningful?

### Does the world feel alive?

### Does the game work after refreshing?

### Does the game work on mobile?

### Are there any fake buttons?

### Are there console errors?

### Does the UI look professional?

### Would someone who played for 10 minutes want to see what happens after 30 minutes?

If the answer to any of these is NO, fix it before declaring the game finished.

---

# 86. VERY IMPORTANT — DO NOT OVERENGINEER THE FIRST BUILD

Build a **complete playable vertical slice first**.

The first playable version MUST contain:

* character
* movement
* one biome
* gathering
* inventory
* crafting
* combat
* 3 enemy types
* 1 boss
* NPC
* quest
* camp
* basic building
* day/night
* save/load
* XP
* equipment
* basic kingdom progression

Once this is genuinely playable and polished, expand the world.

Do not create 10 empty biomes before the first biome is fun.

---

# 87. THE FIRST PLAYABLE EXPERIENCE

When the user starts the game, they should immediately experience:

```text
Cinematic Intro
      ↓
Character
      ↓
Unknown Wilderness
      ↓
Movement
      ↓
First Resource
      ↓
First Weapon
      ↓
First Enemy
      ↓
First Victory
      ↓
First Camp
      ↓
First NPC
      ↓
First Quest
      ↓
First Settlement
      ↓
First Threat
      ↓
"I need to build something bigger."
```

The player should never feel like they are reading documentation.

Teach them through play.

---

# 88. FINAL COMMAND TO THE AI DEVELOPER

Build this game as if you are preparing it for a public browser release.

Do not give me a conceptual prototype.

Do not stop after creating the UI.

Do not generate placeholder buttons without functionality.

Do not simplify the architecture into one giant component.

Do not remove major systems merely because they are complicated.

Implement the systems incrementally and keep them connected.

Prioritize:

1. Gameplay
2. Game feel
3. Performance
4. Visual polish
5. UX
6. Code quality
7. Scalability

The final result should feel like:

> **"I started with a wooden sword and a campfire... and now I control an entire kingdom."**

That emotional progression is the heart of the game.

Build the game around that feeling.

# START NOW

First inspect the existing project.

If the project already contains code:

* preserve working functionality
* do not unnecessarily rewrite everything
* identify the current architecture
* integrate the game systems cleanly
* fix existing issues before adding conflicting systems

If starting from scratch:

1. Initialize React + Vite.
2. Install/configure Phaser.
3. Create the React ↔ Phaser bridge.
4. Establish the folder architecture.
5. Create the first playable world.
6. Implement the player.
7. Implement movement.
8. Implement gathering.
9. Implement inventory.
10. Implement combat.
11. Implement the first enemy.
12. Implement the first quest.
13. Implement the first settlement.
14. Implement save/load.
15. Then expand progressively.

At every stage, ensure the project remains runnable.

The final command must work:

```bash
npm run dev
```

And the production build must work:

```bash
npm run build
```

No broken imports.

No missing components.

No unused critical dependencies.

No fake functionality.

No unfinished core loop.

Create a genuinely playable, polished, extensible kingdom adventure game.
