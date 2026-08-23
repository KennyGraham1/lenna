/* =====================================================
   Plant catalogue — 7 sets organised from beginner to rare
   Each plant: { id, name, icon, price }
   Prices increase across sets to keep the game loop fun.
   ===================================================== */

export type Plant = { id: string; name: string; icon: string; price: number };
export type PlantSet = { id: number; name: string; color: string; plants: Plant[] };
export type CatalogPlant = Plant & { setId: number; setName: string };

export const PLANT_SETS: PlantSet[] = [
  {
    id: 1,
    name: "Beginner Plants",
    color: "#7cc47c",
    plants: [
      { id: "s1-cactus",      name: "Cactus",         icon: "🌵", price: 1000 },
      { id: "s1-daisy",       name: "Daisy",          icon: "🌼", price: 1500 },
      { id: "s1-sunflower",   name: "Sunflower",      icon: "🌻", price: 2000 },
      { id: "s1-aloe",        name: "Aloe vera",      icon: "🌿", price: 2000 },
      { id: "s1-tomato",      name: "Tomato plant",   icon: "🍅", price: 2500 },
      { id: "s1-mint",        name: "Mint",           icon: "🌿", price: 1500 },
      { id: "s1-basil",       name: "Basil",          icon: "🌱", price: 1500 },
      { id: "s1-tulip",       name: "Tulip",          icon: "🌷", price: 2000 },
      { id: "s1-lavender",    name: "Lavender",       icon: "💜", price: 2500 },
      { id: "s1-grass",       name: "Grass plant",    icon: "🌾", price: 1000 }
    ]
  },
  {
    id: 2,
    name: "Garden Plants",
    color: "#59b259",
    plants: [
      { id: "s2-rose",        name: "Rose",            icon: "🌹", price: 4000 },
      { id: "s2-strawberry",  name: "Strawberry plant",icon: "🍓", price: 4500 },
      { id: "s2-carrot",      name: "Carrot plant",    icon: "🥕", price: 4000 },
      { id: "s2-lettuce",     name: "Lettuce",         icon: "🥬", price: 3500 },
      { id: "s2-cabbage",     name: "Cabbage",         icon: "🥗", price: 4000 },
      { id: "s2-pumpkin",     name: "Pumpkin plant",   icon: "🎃", price: 5500 },
      { id: "s2-potato",      name: "Potato plant",    icon: "🥔", price: 4000 },
      { id: "s2-pea",         name: "Pea plant",       icon: "🌱", price: 3500 },
      { id: "s2-corn",        name: "Corn plant",      icon: "🌽", price: 5000 },
      { id: "s2-rosemary",    name: "Rosemary",        icon: "🌿", price: 3500 },
      { id: "s2-thyme",       name: "Thyme",           icon: "🌿", price: 3500 },
      { id: "s2-parsley",     name: "Parsley",         icon: "🌿", price: 3500 }
    ]
  },
  {
    id: 3,
    name: "Flower Plants",
    color: "#e879b7",
    plants: [
      { id: "s3-lily",         name: "Lily",          icon: "🌸", price: 6000 },
      { id: "s3-orchid",       name: "Orchid",        icon: "🪷", price: 7500 },
      { id: "s3-bluebell",     name: "Bluebell",      icon: "🔔", price: 6500 },
      { id: "s3-marigold",     name: "Marigold",      icon: "🌼", price: 6000 },
      { id: "s3-hibiscus",     name: "Hibiscus",      icon: "🌺", price: 7000 },
      { id: "s3-poppy",        name: "Poppy",         icon: "🌺", price: 6500 },
      { id: "s3-daffodil",     name: "Daffodil",      icon: "🌼", price: 6500 },
      { id: "s3-violet",       name: "Violet",        icon: "💐", price: 6000 },
      { id: "s3-jasmine",      name: "Jasmine",       icon: "🌸", price: 7500 },
      { id: "s3-peony",        name: "Peony",         icon: "🌸", price: 7500 },
      { id: "s3-hydrangea",    name: "Hydrangea",     icon: "💠", price: 7000 },
      { id: "s3-cherry-blossom", name: "Cherry blossom", icon: "🌸", price: 8000 }
    ]
  },
  {
    id: 4,
    name: "Houseplants",
    color: "#3f9a4d",
    plants: [
      { id: "s4-snake",        name: "Snake plant",      icon: "🐍", price: 9000 },
      { id: "s4-spider",       name: "Spider plant",     icon: "🕷️", price: 8500 },
      { id: "s4-peace-lily",   name: "Peace lily",       icon: "🌿", price: 9500 },
      { id: "s4-rubber",       name: "Rubber plant",     icon: "🪴", price: 10000 },
      { id: "s4-monstera",     name: "Monstera",         icon: "🍃", price: 12000 },
      { id: "s4-pothos",       name: "Pothos",           icon: "🌿", price: 9000 },
      { id: "s4-fiddle",       name: "Fiddle leaf fig",  icon: "🌳", price: 13000 },
      { id: "s4-zz",           name: "ZZ plant",         icon: "🪴", price: 10000 },
      { id: "s4-chinese-money",name: "Chinese money plant", icon: "🪙", price: 11000 },
      { id: "s4-string-pearls",name: "String of pearls", icon: "🟢", price: 11500 },
      { id: "s4-boston-fern",  name: "Boston fern",      icon: "🌿", price: 9500 },
      { id: "s4-calathea",     name: "Calathea",         icon: "🌱", price: 11000 }
    ]
  },
  {
    id: 5,
    name: "Tropical Plants",
    color: "#ffb84d",
    plants: [
      { id: "s5-palm",         name: "Palm tree",         icon: "🌴", price: 15000 },
      { id: "s5-banana",       name: "Banana plant",      icon: "🍌", price: 14000 },
      { id: "s5-pineapple",    name: "Pineapple plant",   icon: "🍍", price: 15000 },
      { id: "s5-coconut",      name: "Coconut tree",      icon: "🥥", price: 16000 },
      { id: "s5-bop",          name: "Bird of paradise",  icon: "🦜", price: 17000 },
      { id: "s5-bamboo",       name: "Bamboo",            icon: "🎋", price: 13000 },
      { id: "s5-passionfruit", name: "Passionfruit vine", icon: "🍇", price: 15500 },
      { id: "s5-mango",        name: "Mango tree",        icon: "🥭", price: 17000 },
      { id: "s5-papaya",       name: "Papaya tree",       icon: "🌴", price: 16500 },
      { id: "s5-dragonfruit",  name: "Dragon fruit cactus", icon: "🐉", price: 18000 },
      { id: "s5-frangipani",   name: "Frangipani",        icon: "🌺", price: 14500 },
      { id: "s5-fern-palm",    name: "Fern palm",         icon: "🌿", price: 13500 }
    ]
  },
  {
    id: 6,
    name: "Rare Plants",
    color: "#9b6dd6",
    plants: [
      { id: "s6-venus",        name: "Venus flytrap",     icon: "🪤", price: 22000 },
      { id: "s6-pitcher",      name: "Pitcher plant",     icon: "🏺", price: 22000 },
      { id: "s6-bonsai",       name: "Bonsai tree",       icon: "🎍", price: 28000 },
      { id: "s6-ghost-orchid", name: "Ghost orchid",      icon: "👻", price: 30000 },
      { id: "s6-black-rose",   name: "Black rose",        icon: "🥀", price: 25000 },
      { id: "s6-blue-rose",    name: "Blue rose",         icon: "💙", price: 26000 },
      { id: "s6-corpse",       name: "Corpse flower",     icon: "💀", price: 28000 },
      { id: "s6-jade-vine",    name: "Jade vine",         icon: "💚", price: 27000 },
      { id: "s6-chocolate",    name: "Chocolate cosmos",  icon: "🍫", price: 25000 },
      { id: "s6-queen-night",  name: "Queen of the night cactus", icon: "🌙", price: 29000 },
      { id: "s6-rainbow-euc",  name: "Rainbow eucalyptus",icon: "🌈", price: 30000 },
      { id: "s6-silver-sword", name: "Silver sword plant",icon: "⚔️", price: 28000 }
    ]
  },
  {
    id: 7,
    name: "Tree Set",
    color: "#2f7d3d",
    plants: [
      { id: "s7-apple",        name: "Apple tree",       icon: "🍎", price: 35000 },
      { id: "s7-lemon",        name: "Lemon tree",       icon: "🍋", price: 35000 },
      { id: "s7-orange",       name: "Orange tree",      icon: "🍊", price: 36000 },
      { id: "s7-peach",        name: "Peach tree",       icon: "🍑", price: 36000 },
      { id: "s7-cherry",       name: "Cherry tree",      icon: "🍒", price: 38000 },
      { id: "s7-olive",        name: "Olive tree",       icon: "🫒", price: 38000 },
      { id: "s7-oak",          name: "Oak tree",         icon: "🌳", price: 40000 },
      { id: "s7-maple",        name: "Maple tree",       icon: "🍁", price: 42000 },
      { id: "s7-willow",       name: "Willow tree",      icon: "🌳", price: 42000 },
      { id: "s7-pine",         name: "Pine tree",        icon: "🌲", price: 40000 },
      { id: "s7-pohutukawa",   name: "Pohutukawa tree",  icon: "🌺", price: 45000 },
      { id: "s7-kauri",        name: "Kauri tree",       icon: "🌲", price: 50000 }
    ]
  }
];

// Quick lookup
export const PLANT_BY_ID: Record<string, CatalogPlant> = {};
PLANT_SETS.forEach((set) => {
  set.plants.forEach((p) => {
    PLANT_BY_ID[p.id] = { ...p, setId: set.id, setName: set.name };
  });
});

export const STREAK_MILESTONES = [1, 3, 7, 14, 30, 100];

export const REMINDER_MESSAGES = [
  "💧 Time to drink water!",
  "🌿 Stay hydrated, gardener.",
  "🌻 Your garden needs you!",
  "🪴 Drink water to grow your plant collection.",
  "💦 A sip of water keeps your streak alive.",
  "🌱 Your plants are thirsty — and so are you!"
];
