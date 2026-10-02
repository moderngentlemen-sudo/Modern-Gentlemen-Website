import type { BlockCategory } from "./types";

/** Stable identities: these are new sections, never replacements for older studies. */
export const MG_SIGNATURE_SECTIONS = [
  {
    id: "coverStory",
    name: "The Cover Story",
    group: "Editorial",
    category: "hero",
    description: "A magazine cover composition with a portrait, oversized headline and side notes.",
  },
  {
    id: "dispatchDesk",
    name: "The Dispatch Desk",
    group: "Editorial",
    category: "editorial",
    description: "A lead story beside a compact desk of editorial dispatches.",
  },
  {
    id: "styleForecast",
    name: "The Style Forecast",
    group: "Style",
    category: "editorial",
    description: "A wide fashion image followed by a three-part seasonal edit.",
  },
  {
    id: "capsuleWardrobe",
    name: "The Capsule Wardrobe",
    group: "Style",
    category: "editorial",
    description: "An outfit portrait beside four numbered wardrobe essentials.",
  },
  {
    id: "watchVault",
    name: "The Watch Vault",
    group: "Collectors",
    category: "editorial",
    description: "A collector's three-watch display with individual reference notes.",
  },
  {
    id: "collectorComparison",
    name: "The Collector Comparison",
    group: "Collectors",
    category: "editorial",
    description: "A semantic comparison table for objects, materials and ownership considerations.",
  },
  {
    id: "openRoad",
    name: "The Open Road",
    group: "Motoring",
    category: "editorial",
    description: "A panoramic driving story with a numbered route beneath it.",
  },
  {
    id: "garageNotes",
    name: "The Garage Notes",
    group: "Motoring",
    category: "editorial",
    description: "A vehicle profile paired with a structured notebook of observations.",
  },
  {
    id: "greatEscapes",
    name: "The Great Escapes",
    group: "Travel",
    category: "editorial",
    description: "A staggered destination triptych with space for travel context.",
  },
  {
    id: "fortyEightHours",
    name: "48 Hours, Well Spent",
    group: "Travel",
    category: "editorial",
    description: "A city itinerary with an ordered schedule and destination image.",
  },
  {
    id: "hotelRegister",
    name: "The Hotel Register",
    group: "Travel",
    category: "editorial",
    description: "A generous address list for remarkable stays, each with an image and notes.",
  },
  {
    id: "chefsCounter",
    name: "The Chef’s Counter",
    group: "Taste",
    category: "people",
    description: "A culinary profile with a large image and three kitchen perspectives.",
  },
  {
    id: "cellarNotes",
    name: "The Cellar Notes",
    group: "Taste",
    category: "editorial",
    description: "A vertical tasting notebook beside a cellar or bottle portrait.",
  },
  {
    id: "afterHours",
    name: "After Hours",
    group: "Taste",
    category: "editorial",
    description: "An evening guide in a dark horizontal composition.",
  },
  {
    id: "culturalRadar",
    name: "The Cultural Radar",
    group: "Culture",
    category: "editorial",
    description:
      "A clear date-and-place ledger for exhibitions, performances and cultural moments.",
  },
  {
    id: "screeningNotes",
    name: "The Screening Notes",
    group: "Culture",
    category: "editorial",
    description: "A cinematic still with a film notebook and editorial viewing context.",
  },
  {
    id: "inGoodCompany",
    name: "In Good Company",
    group: "Culture",
    category: "people",
    description: "A portrait interview with expandable questions and answers.",
  },
  {
    id: "makersMethods",
    name: "Makers & Methods",
    group: "Culture",
    category: "people",
    description: "A four-step process story showing the people and detail behind an object.",
  },
  {
    id: "livingWell",
    name: "The Art of Living Well",
    group: "Living",
    category: "editorial",
    description: "A residential feature with an architectural image and a room-by-room edit.",
  },
  {
    id: "dailyRitual",
    name: "The Daily Practice",
    group: "Living",
    category: "editorial",
    description: "A restrained morning-to-evening sequence for grooming and considered routines.",
  },
  {
    id: "residence",
    name: "The Residence",
    group: "Experiences",
    category: "hero",
    description: "An estate-led cultural hospitality feature with three programmable experiences.",
  },
  {
    id: "mgPresents",
    name: "Modern Gentlemen Presents",
    group: "Experiences",
    category: "editorial",
    description:
      "One headline gathering and two supporting experiences, with editable status labels.",
  },
  {
    id: "brandPerspective",
    name: "A Brand Perspective",
    group: "Partnerships",
    category: "editorial",
    description:
      "A clearly disclosed partner story with a spacious image-and-editorial composition.",
  },
  {
    id: "readingList",
    name: "The Considered Reading List",
    group: "Editorial",
    category: "editorial",
    description: "A numbered reading desk with expandable editorial annotations.",
  },
] as const satisfies readonly {
  id: string;
  name: string;
  group: string;
  category: BlockCategory;
  description: string;
}[];

export type SignatureSection = (typeof MG_SIGNATURE_SECTIONS)[number];
export type SignatureId = SignatureSection["id"];
export type SignatureType = `mgSignature_${SignatureId}`;
export const signatureType = (id: SignatureId): SignatureType => `mgSignature_${id}`;

export interface SignatureEntry {
  title: string;
  text?: string;
  meta?: string;
  detail?: string;
  image?: string;
  alt?: string;
  href?: string;
}

export interface SignatureProps {
  title: string;
  eyebrow?: string;
  intro?: string;
  image?: string;
  imageAlt?: string;
  caption?: string;
  items?: SignatureEntry[];
  cta?: { label: string; href: string };
  tone?: "theme" | "dark";
  spacing?: "comfortable" | "compact";
  imagePosition?: "center" | "top" | "bottom";
  disclosure?: string;
}

const entry = (title: string, text: string, meta?: string, detail?: string): SignatureEntry => ({
  title,
  text,
  ...(meta ? { meta } : {}),
  ...(detail ? { detail } : {}),
});

/** Evergreen starter copy. No invented event dates, product prices or partner relationships. */
export const SIGNATURE_DEFAULTS: Record<SignatureId, SignatureProps> = {
  coverStory: {
    title: "A life of substance.",
    eyebrow: "The Modern Gentlemen edit",
    intro: "The people, places and pursuits that make a life well lived.",
    items: [
      entry("An eye for detail", "The quiet decisions that define personal style.", "Style"),
      entry(
        "In good company",
        "Conversations with people who care deeply about their craft.",
        "Culture"
      ),
    ],
  },
  dispatchDesk: {
    title: "Worth your attention.",
    eyebrow: "From the editorial desk",
    intro: "A concise selection of ideas, discoveries and stories to spend time with.",
    items: [
      entry(
        "The enduring appeal of doing less",
        "Finding the distinction between having more and choosing well.",
        "The lead"
      ),
      entry("Objects with a point of view", "Design that rewards a closer look.", "Design"),
      entry("Take the longer route", "The pleasure of leaving room for discovery.", "Travel"),
      entry("A new perspective", "An invitation to see the familiar differently.", "Culture"),
    ],
  },
  styleForecast: {
    title: "A change of pace.",
    eyebrow: "The style forecast",
    intro: "Texture, proportion and a wardrobe that moves naturally between occasions.",
    items: [
      entry("Soft structure", "Tailoring with ease, presence and room to move.", "01 / Shape"),
      entry("Tactile layers", "Let fabric bring character to a simple palette.", "02 / Texture"),
      entry(
        "The finishing note",
        "A considered accessory changes the whole conversation.",
        "03 / Detail"
      ),
    ],
  },
  capsuleWardrobe: {
    title: "Fewer pieces. More possibility.",
    eyebrow: "The capsule wardrobe",
    intro: "A working edit of essentials, chosen to earn their place.",
    items: [
      entry(
        "The unstructured jacket",
        "A versatile starting point for relaxed tailoring.",
        "Foundation"
      ),
      entry("The fine knit", "An understated layer with year-round relevance.", "Texture"),
      entry("The straight-leg trouser", "A clean line that grounds the silhouette.", "Proportion"),
      entry("The everyday loafer", "A finishing touch that travels between settings.", "Finish"),
    ],
  },
  watchVault: {
    title: "Time, considered.",
    eyebrow: "Inside the watch vault",
    intro: "Three perspectives on what makes a watch worth returning to.",
    items: [
      entry(
        "The daily companion",
        "A balanced case and an easy presence on the wrist.",
        "Everyday",
        "Comfort · Legibility · Versatility"
      ),
      entry(
        "The dress watch",
        "The beauty of restraint, down to the smallest detail.",
        "Occasion",
        "Proportion · Finish · Simplicity"
      ),
      entry(
        "The conversation piece",
        "An independent point of view and a story to discover.",
        "Character",
        "Craft · Design · Provenance"
      ),
    ],
  },
  collectorComparison: {
    title: "A closer comparison.",
    eyebrow: "The collector’s notebook",
    intro: "Compare the qualities that matter before making a considered choice.",
    items: [
      entry(
        "The everyday piece",
        "Comfortable, adaptable and easy to live with.",
        "Versatility",
        "Consider fit, maintenance and how often you will use it."
      ),
      entry(
        "The statement piece",
        "A distinctive expression of design and personality.",
        "Character",
        "Consider proportion, finish and the story behind it."
      ),
      entry(
        "The heirloom piece",
        "An object whose value grows through personal meaning.",
        "Longevity",
        "Consider serviceability, construction and provenance."
      ),
    ],
  },
  openRoad: {
    title: "The long way is the point.",
    eyebrow: "On the open road",
    intro: "Driving as an experience: a good route, an unhurried stop and something worth seeing.",
    items: [
      entry(
        "Leave the familiar",
        "Begin where the traffic thins and the landscape opens.",
        "Departure"
      ),
      entry(
        "Make room for a stop",
        "Find a table, a view or a conversation along the way.",
        "Interlude"
      ),
      entry("Arrive without rushing", "The destination is only part of the story.", "Arrival"),
    ],
  },
  garageNotes: {
    title: "Character, beyond the numbers.",
    eyebrow: "From the garage",
    intro: "A driver’s notebook on the details that turn engineering into an experience.",
    items: [
      entry("Design", "How proportion and purpose meet.", "01"),
      entry("The drive", "Steering, response and the feel of the road.", "02"),
      entry("The cabin", "Materials, visibility and everyday ease.", "03"),
      entry("Living with it", "The considerations that remain after the first impression.", "04"),
    ],
  },
  greatEscapes: {
    title: "Somewhere worth slowing down.",
    eyebrow: "The travel edit",
    intro: "Places to reconnect with a different rhythm.",
    items: [
      entry("By the water", "Days shaped by light, open horizons and long lunches.", "Coast"),
      entry("Above it all", "A quiet retreat with space to think.", "Mountains"),
      entry("A city, rediscovered", "Familiar streets through a more curious lens.", "City"),
    ],
  },
  fortyEightHours: {
    title: "48 hours, well spent.",
    eyebrow: "The city itinerary",
    intro:
      "An unhurried framework for a weekend away. Add your own addresses and local discoveries.",
    items: [
      entry(
        "A proper arrival",
        "Check in, take a walk and find your bearings.",
        "Day 01 · Afternoon"
      ),
      entry(
        "A table for the evening",
        "Leave time for dinner and the conversation after it.",
        "Day 01 · Evening"
      ),
      entry(
        "A different perspective",
        "Explore a gallery, a neighborhood or a maker’s studio.",
        "Day 02 · Morning"
      ),
      entry(
        "One last stop",
        "Make room for the place you almost walked past.",
        "Day 02 · Afternoon"
      ),
    ],
  },
  hotelRegister: {
    title: "Addresses with character.",
    eyebrow: "The hotel register",
    intro: "A place to stay should be part of the reason to go.",
    items: [
      entry(
        "The intimate city house",
        "Thoughtful design and a sense of neighborhood.",
        "City stay",
        "Best for / A cultural weekend"
      ),
      entry(
        "The coastal retreat",
        "Open space, natural light and a slower tempo.",
        "Coastal stay",
        "Best for / Time by the water"
      ),
      entry(
        "The country escape",
        "A welcoming table and a landscape to explore.",
        "Country stay",
        "Best for / A change of pace"
      ),
    ],
  },
  chefsCounter: {
    title: "Good taste begins with curiosity.",
    eyebrow: "At the chef’s counter",
    intro: "An intimate look at ingredients, instinct and the people behind a memorable meal.",
    items: [
      entry("The ingredient", "Start with what is at its best.", "Origin"),
      entry("The technique", "Care and repetition turn knowledge into instinct.", "Craft"),
      entry("The welcome", "Hospitality is the detail people remember.", "Experience"),
    ],
  },
  cellarNotes: {
    title: "A story in every glass.",
    eyebrow: "The cellar notes",
    intro: "Exploring taste through place, patience and the pleasure of sharing.",
    items: [
      entry("Place", "The landscape and traditions behind a bottle.", "01 / Origin"),
      entry("Time", "How patience changes texture and expression.", "02 / Character"),
      entry("Company", "The meal and the people that make it memorable.", "03 / Occasion"),
    ],
  },
  afterHours: {
    title: "When the evening opens up.",
    eyebrow: "Modern Gentlemen / After hours",
    intro: "An edit of rooms, records and rituals for the hours after sunset.",
    tone: "dark",
    items: [
      entry(
        "A room with atmosphere",
        "Good lighting, attentive service and a place to settle in.",
        "The address"
      ),
      entry(
        "Something worth hearing",
        "Music that deserves your full attention.",
        "The soundtrack"
      ),
      entry(
        "Stay for the conversation",
        "Let the best part of the night take its time.",
        "The company"
      ),
    ],
  },
  culturalRadar: {
    title: "Keep a little space for culture.",
    eyebrow: "On our radar",
    intro: "An editorial ledger for the exhibitions, performances and ideas on your agenda.",
    items: [
      entry(
        "On the stage",
        "A performance worth building an evening around.",
        "Theatre",
        "Add date / City"
      ),
      entry(
        "Inside the gallery",
        "An artist or exhibition that shifts your perspective.",
        "Art",
        "Add date / City"
      ),
      entry(
        "On the screen",
        "A film that stays with you after the credits.",
        "Film",
        "Add date / City"
      ),
      entry(
        "In conversation",
        "An exchange of ideas with room for the unexpected.",
        "Ideas",
        "Add date / City"
      ),
    ],
  },
  screeningNotes: {
    title: "Stay for the story.",
    eyebrow: "The screening notes",
    intro: "Film, craft and the conversations that begin when the lights come up.",
    tone: "dark",
    items: [
      entry("The point of view", "What the film asks us to notice.", "Perspective"),
      entry("Behind the frame", "The creative decisions that shape a world.", "Craft"),
      entry(
        "After the credits",
        "The questions worth carrying into the conversation.",
        "Reflection"
      ),
    ],
  },
  inGoodCompany: {
    title: "The people behind the perspective.",
    eyebrow: "In good company",
    intro: "A portrait of character, ambition and the work that matters.",
    items: [
      entry(
        "What first drew you to your craft?",
        "Add the subject’s approved answer here.",
        "Origins"
      ),
      entry(
        "Which detail do you always come back to?",
        "Add the subject’s approved answer here.",
        "Practice"
      ),
      entry(
        "What would you like to explore next?",
        "Add the subject’s approved answer here.",
        "Possibility"
      ),
    ],
  },
  makersMethods: {
    title: "Made with intention.",
    eyebrow: "Makers & methods",
    intro: "Follow an idea from the first sketch to the final detail.",
    items: [
      entry("The idea", "A question, a need or a point of view.", "01"),
      entry("The material", "Understand what it can do before asking more of it.", "02"),
      entry("The making", "Skill, patience and the willingness to refine.", "03"),
      entry("The finishing touch", "The small decision that makes the whole feel right.", "04"),
    ],
  },
  livingWell: {
    title: "Room for a considered life.",
    eyebrow: "Architecture & interiors",
    intro: "Spaces that make the everyday feel a little more intentional.",
    items: [
      entry("The gathering room", "A place designed around conversation.", "Living"),
      entry("The quiet corner", "Light, texture and space for a moment alone.", "Retreat"),
      entry("The open door", "A natural connection to what lies beyond.", "Outdoors"),
    ],
  },
  dailyRitual: {
    title: "The small things, done well.",
    eyebrow: "The daily practice",
    intro: "Simple routines that bring a sense of care to the day.",
    items: [
      entry("Begin with space", "A little time before the demands of the day.", "Morning"),
      entry(
        "Reset your attention",
        "Step away, take a breath and return with intention.",
        "Afternoon"
      ),
      entry("Close the day", "Put things in order and make room to unwind.", "Evening"),
    ],
  },
  residence: {
    title: "A setting for extraordinary encounters.",
    eyebrow: "Modern Gentlemen / The Residence",
    intro:
      "A private setting for cultural conversation, considered hospitality and memorable experiences.",
    items: [
      entry("Gather", "Intimate dinners, salons and shared perspectives.", "Hospitality"),
      entry("Discover", "Objects, installations and experiences to explore.", "Experience"),
      entry("Connect", "Time and space for meaningful conversation.", "Community"),
    ],
  },
  mgPresents: {
    title: "Good company. Exceptional occasions.",
    eyebrow: "Modern Gentlemen Presents",
    intro: "A platform for gatherings at the intersection of culture, craft and a life well lived.",
    items: [
      entry(
        "The signature gathering",
        "A distinctive setting, a thoughtful program and people worth knowing.",
        "Program concept",
        "Add confirmed dates and details"
      ),
      entry(
        "An intimate dinner",
        "A shared table and a conversation with purpose.",
        "Program concept",
        "Add confirmed dates and details"
      ),
      entry(
        "A cultural encounter",
        "An opportunity to experience a different perspective.",
        "Program concept",
        "Add confirmed dates and details"
      ),
    ],
  },
  brandPerspective: {
    title: "The story behind the distinction.",
    eyebrow: "A brand perspective",
    intro: "Explore a point of view through the materials, people and ideas that bring it to life.",
    disclosure: "Partner story",
    items: [
      entry("A point of view", "Introduce the partner’s approved perspective.", "Philosophy"),
      entry(
        "Attention to detail",
        "Show the work, materials and decisions behind the finished result.",
        "Craft"
      ),
      entry("A lasting impression", "Explain what makes the experience meaningful.", "Experience"),
    ],
  },
  readingList: {
    title: "Set aside a little time.",
    eyebrow: "The considered reading list",
    intro: "Stories to return to, with a note on why each deserves a place on your list.",
    items: [
      entry(
        "On choosing well",
        "A perspective on the relationship between taste and attention.",
        "Style & substance"
      ),
      entry(
        "The value of craft",
        "Why the process can be as compelling as the finished object.",
        "People & process"
      ),
      entry(
        "A sense of place",
        "How a destination changes when you make time to notice it.",
        "Travel & culture"
      ),
      entry(
        "The art of hospitality",
        "Small gestures that make people feel welcome.",
        "Living & company"
      ),
    ],
  },
};
