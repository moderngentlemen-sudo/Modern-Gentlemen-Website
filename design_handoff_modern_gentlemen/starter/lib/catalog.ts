import type { Product } from "./cart/types";

/**
 * Ported verbatim from design_files/mg-catalog.js — the 16-product catalog.
 * For a real store, replace this with Shopify Storefront data (keep the helper
 * signatures so callers don't change). See 01_ARCHITECTURE.md.
 */
export const products: Product[] = [
    { slug: 'travel-watch-roll', cat: 'Watches', catLabel: 'WATCHES', name: 'Travel Watch Roll, Waxed Canvas', price: 145, tag: 'NEW',
      material: 'Waxed cotton canvas · full-grain leather',
      blurb: 'A three-slot roll that keeps a weekend’s worth of watches from knocking together in a bag.',
      story: 'We wanted a watch roll that wasn’t precious about itself — something you could throw in a duffel and forget. The shell is a dry, British-milled waxed canvas that softens with handling; the interior is a brushed suede that won’t mark a polished case.\n\nThree padded slots hold cases up to 44mm, and the whole thing rolls down to the size of a paperback. It ships flat and breaks in fast.',
      specs: [['Capacity', '3 watches, up to 44mm'], ['Shell', 'Waxed cotton canvas'], ['Lining', 'Brushed microsuede'], ['Closure', 'Leather tie strap'], ['Dimensions', '28 × 12 cm rolled'], ['Made in', 'Portugal']],
      images: ['images/watch-gear.jpg', 'images/hero-cover.jpg', 'images/film-watchmaker.jpg'] },
    { slug: 'suede-two-piece-strap', cat: 'Watches', catLabel: 'WATCHES', name: 'Suede Two-Piece Strap, 20mm', price: 52, tag: '',
      material: 'Italian suede · quick-release spring bars',
      blurb: 'The one strap swap that makes a steel sports watch feel like a Sunday.',
      story: 'Cut from a soft, closely-napped Italian suede and backed with a water-resistant membrane so a caught shower doesn’t ruin the afternoon. Quick-release spring bars mean you can change it without tools in under a minute.\n\nAvailable in a taupe that flatters almost everything and a deep petrol blue for the brave.',
      specs: [['Lug width', '20mm'], ['Material', 'Italian suede'], ['Backing', 'Water-resistant membrane'], ['Hardware', 'Quick-release spring bars'], ['Buckle', 'Brushed steel'], ['Made in', 'Italy']],
      images: ['images/hero-cover.jpg', 'images/watch-gear.jpg', 'images/style-mono.jpg'] },
    { slug: 'field-chronometer', cat: 'Watches', catLabel: 'WATCHES', name: 'MG Field Chronometer, 38mm', price: 380, tag: 'LIMITED',
      material: 'Brushed 316L steel · sapphire crystal',
      blurb: 'A no-date field watch at the exact size a field watch should be.',
      story: 'Our house watch, made in a run of 300. A 38mm brushed-steel case, a matte anthracite dial with fully-lumed numerals, and a Japanese automatic movement you can actually service anywhere.\n\nNo date window, no cyclops, no clutter — just a legible dial and a domed sapphire crystal that catches the light like glass should.',
      specs: [['Case', '38mm brushed 316L steel'], ['Movement', 'Miyota 9039 automatic'], ['Crystal', 'Domed sapphire, AR-coated'], ['Water resist.', '100m'], ['Lume', 'Super-LumiNova BGW9'], ['Edition', '300 pieces']],
      images: ['images/film-watchmaker.jpg', 'images/watch-gear.jpg', 'images/hero-cover.jpg'] },
    { slug: 'unstructured-wool-blazer', cat: 'Style', catLabel: 'STYLE', name: 'Unstructured Wool Blazer', price: 420, tag: '',
      material: 'Italian hopsack wool · half-lined',
      blurb: 'A jacket with the ease of a cardigan and the manners of tailoring.',
      story: 'Cut from a breathable Italian hopsack and built without shoulder padding or chest canvas, so it moves and packs like knitwear but reads as a proper blazer across a table.\n\nHalf-lined in cupro for shape, with patch pockets and a soft natural shoulder. Wear it over a tee or a knit; it does both without complaint.',
      specs: [['Cloth', 'Italian hopsack wool'], ['Construction', 'Unstructured, half-lined'], ['Lining', 'Cupro'], ['Pockets', 'Three patch'], ['Buttons', 'Corozo'], ['Made in', 'Portugal']],
      images: ['images/style-mono.jpg', 'images/film-tailor.jpg', 'images/hero-cover.jpg'] },
    { slug: 'raw-selvedge-denim', cat: 'Style', catLabel: 'STYLE', name: 'Raw Selvedge Denim, 14oz', price: 175, tag: 'BESTSELLER',
      material: '14oz Japanese selvedge · natural indigo',
      blurb: 'Stiff, honest denim that becomes uniquely yours in about a month.',
      story: 'Woven on vintage shuttle looms in Okayama from a 14oz natural-indigo yarn, then cut to a straight, slightly tapered leg that works with boots or sneakers.\n\nThese start rigid and fade to a personal map of everywhere you sit, walk and lean. Wear them hard, wash them rarely.',
      specs: [['Weight', '14oz'], ['Denim', 'Japanese selvedge'], ['Dye', 'Natural indigo'], ['Fit', 'Straight, slight taper'], ['Hardware', 'Copper rivets'], ['Made in', 'Japan']],
      images: ['images/film-workshop.jpg', 'images/style-mono.jpg', 'images/film-tailor.jpg'] },
    { slug: 'oxford-cloth-shirt', cat: 'Style', catLabel: 'STYLE', name: 'Everyday Oxford, Button-Down', price: 110, tag: '',
      material: 'Long-staple cotton oxford · unlined collar',
      blurb: 'The shirt you reach for when you can’t be bothered to think about it.',
      story: 'A proper oxford-cloth button-down in a soft, long-staple cotton that only gets better with washing. The collar rolls the way a good OCBD collar should — no fusing, no stiff board look.\n\nA relaxed-but-not-boxy fit that tucks cleanly or hangs well untucked over denim.',
      specs: [['Cloth', 'Long-staple cotton oxford'], ['Collar', 'Unlined button-down'], ['Fit', 'Relaxed classic'], ['Buttons', 'Mother-of-pearl'], ['Placket', 'Box-pleat back'], ['Made in', 'Portugal']],
      images: ['images/film-tailor.jpg', 'images/style-mono.jpg', 'images/hero-cover.jpg'] },
    { slug: 'merino-crew-knit', cat: 'Style', catLabel: 'STYLE', name: 'Fine-Gauge Merino Crew', price: 130, tag: '',
      material: 'Extra-fine merino · fully-fashioned',
      blurb: 'A thin, warm crew that layers under a blazer without any bulk.',
      story: 'Knitted from an extra-fine 19.5-micron merino that feels smooth rather than scratchy against the skin, in a gauge fine enough to disappear under tailoring.\n\nFully-fashioned seams keep the shoulders clean, and it holds its shape through a whole winter of wear.',
      specs: [['Yarn', 'Extra-fine merino, 19.5μm'], ['Gauge', '14gg fine'], ['Seams', 'Fully-fashioned'], ['Neck', 'Ribbed crew'], ['Care', 'Cool hand wash'], ['Made in', 'Scotland']],
      images: ['images/style-mono.jpg', 'images/film-workshop.jpg', 'images/grooming.jpg'] },
    { slug: 'seven-minute-kit', cat: 'Grooming', catLabel: 'GROOMING', name: 'The Seven-Minute Kit', price: 68, tag: 'BESTSELLER',
      material: 'Face wash · moisturiser · balm',
      blurb: 'Everything for a face, nothing you’ll never use — three steps, seven minutes.',
      story: 'We got tired of nine-bottle routines nobody keeps up. This is three things done well: a gentle gel cleanser, a light SPF-free day moisturiser, and a beard-and-jaw balm that doubles as a post-shave.\n\nAll fragrance-light, all in refillable aluminium, all sized to fit a dopp kit. Start here.',
      specs: [['Contains', 'Cleanser, moisturiser, balm'], ['Cleanser', '100ml gel'], ['Moisturiser', '50ml light'], ['Balm', '30ml'], ['Fragrance', 'Trace cedar'], ['Packaging', 'Refillable aluminium']],
      images: ['images/grooming.jpg', 'images/film-workshop.jpg', 'images/style-mono.jpg'] },
    { slug: 'cedar-vetiver-edp', cat: 'Grooming', catLabel: 'GROOMING', name: 'Cedar & Vetiver, 50ml EDP', price: 95, tag: '',
      material: 'Eau de parfum · 50ml',
      blurb: 'A dry, woody everyday scent that never announces itself before you do.',
      story: 'Built around Haitian vetiver and Virginia cedar with a whisper of black pepper up top — a warm, dry, close-wearing scent that reads as clean rather than loud.\n\nA true eau de parfum concentration that lasts the working day without shouting across a meeting.',
      specs: [['Type', 'Eau de parfum'], ['Volume', '50ml'], ['Top', 'Black pepper, bergamot'], ['Heart', 'Vetiver'], ['Base', 'Virginia cedar, musk'], ['Made in', 'France']],
      images: ['images/film-watchmaker.jpg', 'images/grooming.jpg', 'images/hero-cover.jpg'] },
    { slug: 'safety-razor-set', cat: 'Grooming', catLabel: 'GROOMING', name: 'Machined Safety Razor Set', price: 78, tag: '',
      material: 'Machined brass · 20 blades',
      blurb: 'One razor, a lifetime of five-pence blades, and a closer shave.',
      story: 'A weighty, closed-comb safety razor machined from solid brass that will outlive every cartridge system you’ve owned. The heft does the work, so you press less and nick less.\n\nComes with a stand and a starter tin of twenty Swedish steel blades.',
      specs: [['Material', 'Machined brass'], ['Head', 'Closed comb'], ['Weight', '98g'], ['Includes', 'Stand + 20 blades'], ['Blade', 'Standard double-edge'], ['Made in', 'Germany']],
      images: ['images/film-workshop.jpg', 'images/grooming.jpg', 'images/watch-gear.jpg'] },
    { slug: 'card-holder', cat: 'Accessories', catLabel: 'ACCESSORIES', name: 'Full-Grain Card Holder', price: 85, tag: '',
      material: 'Vegetable-tanned full-grain leather',
      blurb: 'Four cards, a folded note, and nothing you don’t need in a back pocket.',
      story: 'Cut from a single piece of vegetable-tanned full-grain leather and saddle-stitched by hand, this holds four cards snugly and a couple of folded notes in the centre.\n\nStarts firm and tan, ages to a deep honey patina that’s entirely your own.',
      specs: [['Leather', 'Veg-tanned full-grain'], ['Capacity', '4 cards + notes'], ['Stitch', 'Hand saddle-stitch'], ['Slots', '2 outer, 1 centre'], ['Edges', 'Hand-burnished'], ['Made in', 'England']],
      images: ['images/film-tailor.jpg', 'images/style-mono.jpg', 'images/hero-cover.jpg'] },
    { slug: 'brass-shoe-horn', cat: 'Accessories', catLabel: 'ACCESSORIES', name: 'Brass Shoe Horn, Long', price: 38, tag: '',
      material: 'Solid brass · 60cm',
      blurb: 'The small dignity of never crushing the heel of a good shoe again.',
      story: 'A 60cm solid-brass shoe horn so you can put on shoes standing up, like an adult. Weighty, cool to the touch, and handsome enough to leave by the door.\n\nThe brass develops a soft patina; leave it or polish it, both look right.',
      specs: [['Material', 'Solid brass'], ['Length', '60cm'], ['Weight', '240g'], ['Finish', 'Raw, patinating'], ['Hang loop', 'Leather cord'], ['Made in', 'England']],
      images: ['images/watch-gear.jpg', 'images/film-workshop.jpg', 'images/film-tailor.jpg'] },
    { slug: 'waxed-holdall', cat: 'Accessories', catLabel: 'ACCESSORIES', name: 'Weekender Holdall, Waxed', price: 265, tag: 'NEW',
      material: 'Waxed canvas · bridle leather',
      blurb: 'Two nights away in one bag that looks better the more it’s used.',
      story: 'A generous carry-all in the same dry waxed canvas as our watch roll, trimmed in English bridle leather and riveted where it counts. Fits two nights of clothes, a dopp kit and a pair of shoes.\n\nAn interior zip pocket keeps a passport and charger findable, and the base is reinforced so it stands up on its own.',
      specs: [['Shell', 'Waxed cotton canvas'], ['Trim', 'English bridle leather'], ['Capacity', '38 litres'], ['Base', 'Reinforced, footed'], ['Strap', 'Detachable, padded'], ['Made in', 'England']],
      images: ['images/hero-cover.jpg', 'images/film-tailor.jpg', 'images/watch-gear.jpg'] },
    { slug: 'silk-knit-tie', cat: 'Accessories', catLabel: 'ACCESSORIES', name: 'Silk Knit Tie, Flat-End', price: 62, tag: '',
      material: 'Woven silk · flat-end',
      blurb: 'The one tie that dresses down a suit and dresses up an oxford.',
      story: 'A woven silk knit with a flat end and a textured hand that sits somewhere between formal and easy — the tie for a blazer-and-denim register.\n\nKnots small and neat, never slippery, in colours chosen to go with everything we sell.',
      specs: [['Material', 'Woven silk'], ['Width', '6cm flat-end'], ['Length', '145cm'], ['Knot', 'Small, neat'], ['Colours', 'Six house shades'], ['Made in', 'Italy']],
      images: ['images/film-tailor.jpg', 'images/style-mono.jpg', 'images/grooming.jpg'] },
    { slug: 'wool-watch-cap', cat: 'Style', catLabel: 'STYLE', name: 'Ribbed Wool Watch Cap', price: 45, tag: '',
      material: 'Lambswool · ribbed knit',
      blurb: 'A short, honest beanie with no logo and no slouch.',
      story: 'A tight-ribbed watch cap in soft lambswool, knitted short so it sits at the ear without swallowing your head. No branding, no pom, no fuss.\n\nWarm enough for a real winter, thin enough to stuff in a coat pocket.',
      specs: [['Yarn', 'Lambswool'], ['Knit', 'Ribbed'], ['Fit', 'Short cuff'], ['Branding', 'None'], ['Care', 'Cool hand wash'], ['Made in', 'Scotland']],
      images: ['images/style-mono.jpg', 'images/grooming.jpg', 'images/film-workshop.jpg'] },
    { slug: 'leather-belt', cat: 'Accessories', catLabel: 'ACCESSORIES', name: 'Bridle Leather Belt, 35mm', price: 95, tag: '',
      material: 'English bridle leather · solid brass',
      blurb: 'One belt, cut to your length, that you’ll re-buckle for a decade.',
      story: 'Cut from a strip of English bridle leather and finished with a solid-brass roller buckle you can swap yourself. We punch it to your waist so it sits on the middle hole from day one.\n\nA true buy-it-for-life belt that darkens handsomely with wear.',
      specs: [['Leather', 'English bridle'], ['Width', '35mm'], ['Buckle', 'Solid brass roller'], ['Fixing', 'Screw-set, swappable'], ['Sizing', 'Punched to order'], ['Made in', 'England']],
      images: ['images/film-tailor.jpg', 'images/hero-cover.jpg', 'images/style-mono.jpg'] }
  ];

const bySlug: Record<string, Product> = Object.fromEntries(products.map((p) => [p.slug, p]));

export const groups = ["All", "Style", "Watches", "Grooming", "Accessories"] as const;

export const allProducts = () => products.slice();
export const getProduct = (slug: string): Product | null => bySlug[slug] || null;
export const byGroup = (group: string) => (group === "All" ? products.slice() : products.filter((p) => p.cat === group));
export function related(slug: string, n = 4): Product[] {
  const p = bySlug[slug];
  if (!p) return products.slice(0, n);
  const same = products.filter((x) => x.cat === p.cat && x.slug !== slug);
  const rest = products.filter((x) => x.cat !== p.cat);
  return same.concat(rest).slice(0, n);
}
export const formatGBP = (n: number) => "£" + Number(n).toLocaleString("en-GB");
