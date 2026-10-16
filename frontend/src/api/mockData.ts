import type { Fighter } from './types'

export type SeedFighter = Fighter & { elo: number }

const handPicked: SeedFighter[] = [
  // People
  { id: 'tyson', name: 'Prime Mike Tyson', shortName: 'Tyson', category: 'people', count: 1, emoji: '🥊', weightKg: 100, heightCm: 178, age: 22, secretWeapon: 'Peek-a-boo style', weakness: 'Ear-related distractions', elo: 1290 },
  { id: 'the-rock', name: 'Dwayne Johnson', shortName: 'The Rock', category: 'people', count: 1, emoji: '🪨', weightKg: 118, heightCm: 196, age: 54, secretWeapon: 'The People’s Elbow', weakness: 'Cheat days', elo: 1260 },
  { id: 'arnold', name: 'Arnold, 1977', shortName: 'Arnold', category: 'people', count: 1, emoji: '💪', weightKg: 107, heightCm: 188, age: 30, secretWeapon: 'Five Mr. Olympia titles', weakness: 'Leg day pump', elo: 1240 },
  { id: 'shaq', name: 'Shaquille O’Neal', shortName: 'Shaq', category: 'people', count: 1, emoji: '🏀', weightKg: 147, heightCm: 216, age: 54, secretWeapon: 'Being 7 feet tall', weakness: 'Free throws', elo: 1225 },
  { id: 'lebron', name: 'LeBron James', shortName: 'LeBron', category: 'people', count: 1, emoji: '👑', weightKg: 113, heightCm: 206, age: 41, secretWeapon: 'Chase-down block', weakness: 'Flopping instinct', elo: 1180 },
  { id: 'ramsay', name: 'Gordon Ramsay', shortName: 'Ramsay', category: 'people', count: 1, emoji: '🔪', weightKg: 95, heightCm: 188, age: 60, secretWeapon: 'Knife skills', weakness: 'Raw opponents upset him', elo: 1050 },
  { id: 'lincoln', name: 'Abraham Lincoln', shortName: 'Lincoln', category: 'people', count: 1, emoji: '🎩', weightKg: 82, heightCm: 193, age: 56, secretWeapon: 'Undefeated-ish wrestler', weakness: 'Theater tickets', elo: 1040 },
  { id: 'keanu', name: 'Keanu Reeves', shortName: 'Keanu', category: 'people', count: 1, emoji: '🕶️', weightKg: 84, heightCm: 186, age: 62, secretWeapon: 'John Wick training', weakness: 'Too polite to finish', elo: 1030 },
  { id: 'gosling', name: 'Ryan Gosling', shortName: 'Gosling', category: 'people', count: 1, emoji: '🚗', weightKg: 78, heightCm: 184, age: 46, secretWeapon: 'Silent stare', weakness: 'Literally just Ken', elo: 1000 },
  { id: 'cruise', name: 'Tom Cruise', shortName: 'Cruise', category: 'people', count: 1, emoji: '🏍️', weightKg: 68, heightCm: 170, age: 64, secretWeapon: 'Does his own stunts', weakness: 'Couch jumping', elo: 960 },
  { id: 'obama', name: 'Barack Obama', shortName: 'Obama', category: 'people', count: 1, emoji: '🧑‍💼', weightKg: 82, heightCm: 185, age: 65, secretWeapon: 'Secret Service', weakness: 'Has to stay presidential', elo: 930 },
  { id: 'swift', name: 'Taylor Swift', shortName: 'Taylor', category: 'people', count: 1, emoji: '🎤', weightKg: 60, heightCm: 180, age: 36, secretWeapon: 'Will write a song about you', weakness: 'Three-hour set fatigue', elo: 870 },
  { id: 'devito', name: 'Danny DeVito', shortName: 'DeVito', category: 'people', count: 1, weightKg: 70, heightCm: 147, age: 81, secretWeapon: 'Low center of gravity', weakness: 'Stairs', elo: 780 },
  { id: 'ali', name: 'Prime Muhammad Ali', shortName: 'Ali', category: 'people', count: 1, emoji: '🦋', weightKg: 98, heightCm: 191, age: 24, secretWeapon: 'Float like a butterfly', weakness: 'Won’t stop talking', elo: 1300 },
  { id: 'bruce-lee', name: 'Bruce Lee', shortName: 'Bruce Lee', category: 'people', count: 1, emoji: '🥋', weightKg: 61, heightCm: 172, age: 32, secretWeapon: 'One-inch punch', weakness: 'Light frame', elo: 1270 },
  { id: 'norris', name: 'Chuck Norris', shortName: 'Chuck', category: 'people', count: 1, emoji: '🤠', weightKg: 77, heightCm: 178, age: 40, secretWeapon: 'Roundhouse kick', weakness: 'None, reportedly', elo: 1220 },
  { id: 'rousey', name: 'Ronda Rousey', shortName: 'Rousey', category: 'people', count: 1, emoji: '🥇', weightKg: 61, heightCm: 170, age: 29, secretWeapon: 'Armbar', weakness: 'Head kicks', elo: 1150 },
  { id: '1000-toddlers', name: '1,000 toddlers', shortName: 'the toddlers', category: 'people', count: 1000, emoji: '🧒', weightKg: 13, secretWeapon: 'Biting', weakness: 'Nap time', elo: 1350 },
  { id: '50-mall-cops', name: '50 mall cops', shortName: 'the mall cops', category: 'people', count: 50, emoji: '👮', weightKg: 85, secretWeapon: 'Segways', weakness: 'Food court', elo: 1260 },
  { id: '100-men', name: '100 men', shortName: 'the men', category: 'people', count: 100, emoji: '🧍', weightKg: 80, secretWeapon: 'Teamwork', weakness: 'Arguing about the plan', elo: 1480 },

  // Fictional
  { id: 'superman', name: 'Superman', shortName: 'Superman', category: 'fictional', count: 1, emoji: '🦸', weightKg: 107, secretWeapon: 'Heat vision', weakness: 'Green rocks', elo: 1890 },
  { id: 'gandalf', name: 'Gandalf', shortName: 'Gandalf', category: 'fictional', count: 1, emoji: '🧙', weightKg: 75, secretWeapon: 'You shall not pass', weakness: 'Fireworks obsession', elo: 1560 },
  { id: 'batman', name: 'Batman', shortName: 'Batman', category: 'fictional', count: 1, emoji: '🦇', weightKg: 95, secretWeapon: 'Prep time', weakness: 'No actual powers', elo: 1440 },
  { id: 'shrek', name: 'Shrek', shortName: 'Shrek', category: 'fictional', count: 1, emoji: '🧌', weightKg: 200, secretWeapon: 'Onion layers', weakness: 'Wants to be left alone', elo: 1300 },
  { id: 'pikachu', name: 'Pikachu', shortName: 'Pikachu', category: 'fictional', count: 1, emoji: '⚡', weightKg: 6, secretWeapon: 'Thunderbolt', weakness: 'Ground types', elo: 1190 },
  { id: 'goku', name: 'Goku', shortName: 'Goku', category: 'fictional', count: 1, emoji: '🐉', weightKg: 62, secretWeapon: 'Kamehameha', weakness: 'Always lets you power up', elo: 1860 },
  { id: 'hulk', name: 'The Hulk', shortName: 'the Hulk', category: 'fictional', count: 1, emoji: '💚', weightKg: 635, secretWeapon: 'Gets angrier', weakness: 'Calms down', elo: 1700 },
  { id: 'wonder-woman', name: 'Wonder Woman', shortName: 'Wonder Woman', category: 'fictional', count: 1, weightKg: 75, secretWeapon: 'Lasso of truth', weakness: 'Too honest', elo: 1620 },
  { id: 'vader', name: 'Darth Vader', shortName: 'Vader', category: 'fictional', count: 1, weightKg: 136, secretWeapon: 'The Force choke', weakness: 'Stairs', elo: 1580 },
  { id: 'yoda', name: 'Yoda', shortName: 'Yoda', category: 'fictional', count: 1, weightKg: 13, secretWeapon: 'Backflips', weakness: 'Needs a cane', elo: 1480 },
  { id: 'spider-man', name: 'Spider-Man', shortName: 'Spider-Man', category: 'fictional', count: 1, emoji: '🕷️', weightKg: 76, secretWeapon: 'Spider-sense', weakness: 'Homework', elo: 1420 },
  { id: 'sonic', name: 'Sonic', shortName: 'Sonic', category: 'fictional', count: 1, emoji: '💨', weightKg: 35, secretWeapon: 'Speed', weakness: 'Water', elo: 1050 },
  { id: 'mario', name: 'Mario', shortName: 'Mario', category: 'fictional', count: 1, emoji: '🍄', weightKg: 80, secretWeapon: 'Fire flower', weakness: 'One hit and he shrinks', elo: 980 },
  { id: 'garfield', name: 'Garfield', shortName: 'Garfield', category: 'fictional', count: 1, emoji: '🍝', weightKg: 9, secretWeapon: 'Sarcasm', weakness: 'Lasagna', elo: 720 },
  { id: 'pooh', name: 'Winnie the Pooh', shortName: 'Pooh', category: 'fictional', count: 1, emoji: '🍯', weightKg: 10, secretWeapon: 'Friends in the woods', weakness: 'Honey pots', elo: 690 },
  { id: 'spongebob', name: 'SpongeBob', shortName: 'SpongeBob', category: 'fictional', count: 1, emoji: '🧽', weightKg: 0.5, secretWeapon: 'Karate gloves', weakness: 'Dries out', elo: 840 },

  // Animals
  { id: 't-rex', name: '1 T. rex', shortName: 'the T. rex', category: 'animals', count: 1, emoji: '🦖', weightKg: 8000, secretWeapon: 'Bite 3,600 kg', weakness: 'Extinct', elo: 1660 },
  { id: 'elephant', name: '1 elephant', shortName: 'the elephant', category: 'animals', count: 1, emoji: '🐘', weightKg: 6000, secretWeapon: 'Tusks', weakness: 'Mice, allegedly', elo: 1610 },
  { id: '5-gorillas', name: '5 gorillas', shortName: 'the gorillas', category: 'animals', count: 5, emoji: '🦍', weightKg: 160, secretWeapon: 'Can open hatches', weakness: 'Easily bored', elo: 1520 },
  { id: '1000-bees', name: '1,000 bees', shortName: 'the bees', category: 'animals', count: 1000, emoji: '🐝', weightKg: 0.0001, secretWeapon: '1,000 stingers', weakness: 'Die after stinging', elo: 1450 },
  { id: 'grizzly', name: '1 grizzly', shortName: 'the grizzly', category: 'animals', count: 1, emoji: '🐻', weightKg: 300, secretWeapon: 'Thick fur', weakness: 'Loves honey', elo: 1400 },
  { id: 'gorilla', name: '1 gorilla', shortName: 'the gorilla', category: 'animals', count: 1, emoji: '🦍', weightKg: 160, secretWeapon: 'Punch 1,300 kg', weakness: 'Pure panic', elo: 1330 },
  { id: 'kangaroo', name: '1 kangaroo', shortName: 'the kangaroo', category: 'animals', count: 1, emoji: '🦘', weightKg: 90, secretWeapon: 'Tail-balanced kick', weakness: 'Hops away', elo: 1180 },
  { id: 'goose', name: '1 angry goose', shortName: 'the goose', category: 'animals', count: 1, emoji: '🦢', weightKg: 5, secretWeapon: 'No fear whatsoever', weakness: 'Bread', elo: 1010 },
  { id: '50-chickens', name: '50 chickens', shortName: 'the chickens', category: 'animals', count: 50, emoji: '🐔', weightKg: 2.5, secretWeapon: 'Descended from dinosaurs', weakness: 'Can’t fly either', elo: 930 },
  { id: 'cat', name: '1 house cat', shortName: 'the cat', category: 'animals', count: 1, emoji: '🐈', weightKg: 4.5, secretWeapon: 'Nine lives', weakness: 'Laser pointers', elo: 880 },
  { id: '400-ants', name: '400 ants', shortName: 'the ants', category: 'animals', count: 400, emoji: '🐜', weightKg: 0.000003, secretWeapon: 'Lift 50× body weight', weakness: 'A single shoe', elo: 760 },
  { id: 'chihuahua', name: 'The Taco Bell chihuahua', shortName: 'the chihuahua', category: 'animals', count: 1, emoji: '🐕', weightKg: 2.5, secretWeapon: 'Unshakeable confidence', weakness: 'Fits in a purse', elo: 700 },

  // Objects
  { id: 'tank', name: '1 tank', shortName: 'the tank', category: 'objects', count: 1, imageUrl: '/fighters/tank.svg', weightKg: 62000, secretWeapon: '120 mm cannon', weakness: 'Tight corners', elo: 1720 },
  { id: 'mower', name: '1 riding mower', shortName: 'the mower', category: 'objects', count: 1, emoji: '🚜', weightKg: 250, secretWeapon: 'Spinning blades', weakness: 'Top speed 8 km/h', elo: 1180 },
  { id: 'bowling-ball', name: '1 bowling ball', shortName: 'the bowling ball', category: 'objects', count: 1, emoji: '🎳', weightKg: 7, secretWeapon: 'Gravity', weakness: 'Needs a thrower', elo: 940 },
  { id: 'cart', name: '1 shopping cart', shortName: 'the cart', category: 'objects', count: 1, emoji: '🛒', weightKg: 15, secretWeapon: 'One wobbly wheel', weakness: 'Steers itself', elo: 860 },
  { id: 'toaster', name: '1 sentient toaster', shortName: 'the toaster', category: 'objects', count: 1, emoji: '🍞', weightKg: 2, secretWeapon: 'Bathtub threat', weakness: 'Unplugged', elo: 820 },
]

/** Groups of the same animal or object, so the leaderboard has enough entries to scroll through. */
type Template = [id: string, singular: string, plural: string, emoji: string, kg: number, soloElo: number, weapon: string, weakness: string, counts: number[]]

const templates: { category: 'animals' | 'objects'; items: Template[] }[] = [
  {
    category: 'animals',
    items: [
      ['cat', 'house cat', 'house cats', '🐈', 4.5, 880, 'Nine lives each', 'Naps', [5, 20, 100]],
      ['goose', 'angry goose', 'angry geese', '🦢', 5, 1010, 'Zero fear', 'Bread', [3, 10, 50]],
      ['chicken', 'chicken', 'chickens', '🐔', 2.5, 600, 'Pecking order', 'Can’t fly', [10, 200, 1000]],
      ['gorilla', 'gorilla', 'gorillas', '🦍', 160, 1330, 'Grip strength', 'Easily bored', [2, 10]],
      ['grizzly', 'grizzly', 'grizzlies', '🐻', 300, 1400, 'Claws', 'Hibernation', [2, 5]],
      ['wolf', 'wolf', 'wolves', '🐺', 45, 1150, 'Pack tactics', 'Full moons', [1, 6, 30]],
      ['lion', 'lion', 'lions', '🦁', 190, 1450, 'Roar', 'Naps 20 hours a day', [1, 3, 10]],
      ['rhino', 'rhino', 'rhinos', '🦏', 2300, 1500, 'Horn', 'Poor eyesight', [1, 3]],
      ['hippo', 'hippo', 'hippos', '🦛', 1500, 1480, 'Jaws', 'Sunburn', [1, 3]],
      ['croc', 'crocodile', 'crocodiles', '🐊', 500, 1350, 'Death roll', 'Slow on land', [1, 4]],
      ['bull', 'bull', 'bulls', '🐂', 900, 1350, 'Horns', 'Red capes', [1, 4]],
      ['badger', 'honey badger', 'honey badgers', '🦡', 12, 1100, 'Doesn’t care', 'Small', [1, 10]],
      ['shark', 'shark on land', 'sharks on land', '🦈', 900, 650, 'Teeth', 'Can’t breathe', [1, 10]],
      ['penguin', 'penguin', 'penguins', '🐧', 23, 700, 'Slide attack', 'Waddling', [1, 50, 500]],
      ['raccoon', 'raccoon', 'raccoons', '🦝', 8, 800, 'Tiny hands', 'Distracted by trash', [1, 25]],
      ['eagle', 'bald eagle', 'bald eagles', '🦅', 6, 900, 'Talons', 'Patriotic poses', [1, 12]],
      ['python', 'python', 'pythons', '🐍', 90, 1000, 'Squeeze', 'Slow digestion', [1, 5]],
      ['octopus', 'octopus', 'octopuses', '🐙', 15, 850, 'Eight arms', 'Ink runs out', [1, 8]],
      ['scorpion', 'scorpion', 'scorpions', '🦂', 0.03, 500, 'Venom', 'Tiny', [1, 100]],
      ['mini-horse', 'duck-sized horse', 'duck-sized horses', '🐴', 3, 600, 'Stampede', 'Tiny hooves', [100]],
      ['giant-duck', 'horse-sized duck', 'horse-sized ducks', '🦆', 500, 1250, 'Enormous beak', 'Waddles', [1]],
    ],
  },
  {
    category: 'objects',
    items: [
      ['monster-truck', 'monster truck', 'monster trucks', '🛻', 5000, 1600, 'Crushes cars', 'Needs a driver', [1, 3]],
      ['flamethrower', 'flamethrower', 'flamethrowers', '🔥', 9, 1250, 'Fire', 'Runs out of fuel', [1]],
      ['piano', 'falling piano', 'falling pianos', '🎹', 300, 1000, 'Gravity', 'One-time use', [1, 5]],
      ['sword', 'sword', 'swords', '⚔️', 1.5, 700, 'Sharp', 'Needs a hand', [1, 20]],
      ['roomba', 'Roomba', 'Roombas', '🤖', 4, 600, 'Relentless', 'Stairs', [1, 20]],
      ['soccer-ball', 'soccer ball', 'soccer balls', '⚽', 0.4, 450, 'Bounces', 'Deflates', [1, 100]],
      ['cone', 'traffic cone', 'traffic cones', '🚧', 3, 420, 'High visibility', 'Stationary', [1, 50]],
    ],
  },
]

const generated: SeedFighter[] = templates.flatMap(({ category, items }) =>
  items.flatMap(([base, singular, plural, emoji, kg, soloElo, weapon, weakness, counts]) =>
    counts.map((count) => ({
      id: `${base}-${count}`,
      name: `${count.toLocaleString('en-US')} ${count === 1 ? singular : plural}`,
      shortName: `the ${count === 1 ? singular : plural}`,
      category,
      count,
      emoji,
      weightKg: kg,
      secretWeapon: weapon,
      weakness,
      elo: Math.round(Math.min(1840, Math.max(400, soloElo + 110 * Math.log2(count)))),
    })),
  ),
)

export const seedFighters: SeedFighter[] = [...handPicked, ...generated]
