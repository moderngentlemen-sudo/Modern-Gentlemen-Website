-- Modern Gentlemen — seed data
-- Loads the 16-product catalog (verbatim from starter/lib/catalog.ts / design_files/mg-catalog.js)
-- plus a demo homepage `pages` row and the 5 editorial categories, so the app
-- has real content to render immediately after `0001_init.sql`.
--
-- Run after the migration:  supabase db reset   (applies migrations + seed)
--   or paste into the Supabase SQL editor after the schema exists.
--
-- NOTE: image paths mirror the current placeholder set in starter/public/images.
--       Swap to Supabase Storage URLs when real photography is uploaded.

-- ---------------------------------------------------------------------------
-- PRODUCTS  (idempotent upsert on slug)
-- ---------------------------------------------------------------------------
insert into public.products (slug, cat, cat_label, name, price, tag, material, blurb, story, specs, images, position) values
('travel-watch-roll','Watches','WATCHES','Travel Watch Roll, Waxed Canvas',145,'NEW',
 'Waxed cotton canvas · full-grain leather',
 'A three-slot roll that keeps a weekend’s worth of watches from knocking together in a bag.',
 E'We wanted a watch roll that wasn’t precious about itself — something you could throw in a duffel and forget. The shell is a dry, British-milled waxed canvas that softens with handling; the interior is a brushed suede that won’t mark a polished case.\n\nThree padded slots hold cases up to 44mm, and the whole thing rolls down to the size of a paperback. It ships flat and breaks in fast.',
 '[["Capacity","3 watches, up to 44mm"],["Shell","Waxed cotton canvas"],["Lining","Brushed microsuede"],["Closure","Leather tie strap"],["Dimensions","28 × 12 cm rolled"],["Made in","Portugal"]]',
 '{images/watch-gear.jpg,images/hero-cover.jpg,images/film-watchmaker.jpg}',1),
('suede-two-piece-strap','Watches','WATCHES','Suede Two-Piece Strap, 20mm',52,'',
 'Italian suede · quick-release spring bars',
 'The one strap swap that makes a steel sports watch feel like a Sunday.',
 E'Cut from a soft, closely-napped Italian suede and backed with a water-resistant membrane so a caught shower doesn’t ruin the afternoon. Quick-release spring bars mean you can change it without tools in under a minute.\n\nAvailable in a taupe that flatters almost everything and a deep petrol blue for the brave.',
 '[["Lug width","20mm"],["Material","Italian suede"],["Backing","Water-resistant membrane"],["Hardware","Quick-release spring bars"],["Buckle","Brushed steel"],["Made in","Italy"]]',
 '{images/hero-cover.jpg,images/watch-gear.jpg,images/style-mono.jpg}',2),
('field-chronometer','Watches','WATCHES','MG Field Chronometer, 38mm',380,'LIMITED',
 'Brushed 316L steel · sapphire crystal',
 'A no-date field watch at the exact size a field watch should be.',
 E'Our house watch, made in a run of 300. A 38mm brushed-steel case, a matte anthracite dial with fully-lumed numerals, and a Japanese automatic movement you can actually service anywhere.\n\nNo date window, no cyclops, no clutter — just a legible dial and a domed sapphire crystal that catches the light like glass should.',
 '[["Case","38mm brushed 316L steel"],["Movement","Miyota 9039 automatic"],["Crystal","Domed sapphire, AR-coated"],["Water resist.","100m"],["Lume","Super-LumiNova BGW9"],["Edition","300 pieces"]]',
 '{images/film-watchmaker.jpg,images/watch-gear.jpg,images/hero-cover.jpg}',3),
('unstructured-wool-blazer','Style','STYLE','Unstructured Wool Blazer',420,'',
 'Italian hopsack wool · half-lined',
 'A jacket with the ease of a cardigan and the manners of tailoring.',
 E'Cut from a breathable Italian hopsack and built without shoulder padding or chest canvas, so it moves and packs like knitwear but reads as a proper blazer across a table.\n\nHalf-lined in cupro for shape, with patch pockets and a soft natural shoulder. Wear it over a tee or a knit; it does both without complaint.',
 '[["Cloth","Italian hopsack wool"],["Construction","Unstructured, half-lined"],["Lining","Cupro"],["Pockets","Three patch"],["Buttons","Corozo"],["Made in","Portugal"]]',
 '{images/style-mono.jpg,images/film-tailor.jpg,images/hero-cover.jpg}',4),
('raw-selvedge-denim','Style','STYLE','Raw Selvedge Denim, 14oz',175,'BESTSELLER',
 '14oz Japanese selvedge · natural indigo',
 'Stiff, honest denim that becomes uniquely yours in about a month.',
 E'Woven on vintage shuttle looms in Okayama from a 14oz natural-indigo yarn, then cut to a straight, slightly tapered leg that works with boots or sneakers.\n\nThese start rigid and fade to a personal map of everywhere you sit, walk and lean. Wear them hard, wash them rarely.',
 '[["Weight","14oz"],["Denim","Japanese selvedge"],["Dye","Natural indigo"],["Fit","Straight, slight taper"],["Hardware","Copper rivets"],["Made in","Japan"]]',
 '{images/film-workshop.jpg,images/style-mono.jpg,images/film-tailor.jpg}',5),
('oxford-cloth-shirt','Style','STYLE','Everyday Oxford, Button-Down',110,'',
 'Long-staple cotton oxford · unlined collar',
 'The shirt you reach for when you can’t be bothered to think about it.',
 E'A proper oxford-cloth button-down in a soft, long-staple cotton that only gets better with washing. The collar rolls the way a good OCBD collar should — no fusing, no stiff board look.\n\nA relaxed-but-not-boxy fit that tucks cleanly or hangs well untucked over denim.',
 '[["Cloth","Long-staple cotton oxford"],["Collar","Unlined button-down"],["Fit","Relaxed classic"],["Buttons","Mother-of-pearl"],["Placket","Box-pleat back"],["Made in","Portugal"]]',
 '{images/film-tailor.jpg,images/style-mono.jpg,images/hero-cover.jpg}',6),
('merino-crew-knit','Style','STYLE','Fine-Gauge Merino Crew',130,'',
 'Extra-fine merino · fully-fashioned',
 'A thin, warm crew that layers under a blazer without any bulk.',
 E'Knitted from an extra-fine 19.5-micron merino that feels smooth rather than scratchy against the skin, in a gauge fine enough to disappear under tailoring.\n\nFully-fashioned seams keep the shoulders clean, and it holds its shape through a whole winter of wear.',
 '[["Yarn","Extra-fine merino, 19.5μm"],["Gauge","14gg fine"],["Seams","Fully-fashioned"],["Neck","Ribbed crew"],["Care","Cool hand wash"],["Made in","Scotland"]]',
 '{images/style-mono.jpg,images/film-workshop.jpg,images/grooming.jpg}',7),
('seven-minute-kit','Grooming','GROOMING','The Seven-Minute Kit',68,'BESTSELLER',
 'Face wash · moisturiser · balm',
 'Everything for a face, nothing you’ll never use — three steps, seven minutes.',
 E'We got tired of nine-bottle routines nobody keeps up. This is three things done well: a gentle gel cleanser, a light SPF-free day moisturiser, and a beard-and-jaw balm that doubles as a post-shave.\n\nAll fragrance-light, all in refillable aluminium, all sized to fit a dopp kit. Start here.',
 '[["Contains","Cleanser, moisturiser, balm"],["Cleanser","100ml gel"],["Moisturiser","50ml light"],["Balm","30ml"],["Fragrance","Trace cedar"],["Packaging","Refillable aluminium"]]',
 '{images/grooming.jpg,images/film-workshop.jpg,images/style-mono.jpg}',8),
('cedar-vetiver-edp','Grooming','GROOMING','Cedar & Vetiver, 50ml EDP',95,'',
 'Eau de parfum · 50ml',
 'A dry, woody everyday scent that never announces itself before you do.',
 E'Built around Haitian vetiver and Virginia cedar with a whisper of black pepper up top — a warm, dry, close-wearing scent that reads as clean rather than loud.\n\nA true eau de parfum concentration that lasts the working day without shouting across a meeting.',
 '[["Type","Eau de parfum"],["Volume","50ml"],["Top","Black pepper, bergamot"],["Heart","Vetiver"],["Base","Virginia cedar, musk"],["Made in","France"]]',
 '{images/film-watchmaker.jpg,images/grooming.jpg,images/hero-cover.jpg}',9),
('safety-razor-set','Grooming','GROOMING','Machined Safety Razor Set',78,'',
 'Machined brass · 20 blades',
 'One razor, a lifetime of five-pence blades, and a closer shave.',
 E'A weighty, closed-comb safety razor machined from solid brass that will outlive every cartridge system you’ve owned. The heft does the work, so you press less and nick less.\n\nComes with a stand and a starter tin of twenty Swedish steel blades.',
 '[["Material","Machined brass"],["Head","Closed comb"],["Weight","98g"],["Includes","Stand + 20 blades"],["Blade","Standard double-edge"],["Made in","Germany"]]',
 '{images/film-workshop.jpg,images/grooming.jpg,images/watch-gear.jpg}',10),
('card-holder','Accessories','ACCESSORIES','Full-Grain Card Holder',85,'',
 'Vegetable-tanned full-grain leather',
 'Four cards, a folded note, and nothing you don’t need in a back pocket.',
 E'Cut from a single piece of vegetable-tanned full-grain leather and saddle-stitched by hand, this holds four cards snugly and a couple of folded notes in the centre.\n\nStarts firm and tan, ages to a deep honey patina that’s entirely your own.',
 '[["Leather","Veg-tanned full-grain"],["Capacity","4 cards + notes"],["Stitch","Hand saddle-stitch"],["Slots","2 outer, 1 centre"],["Edges","Hand-burnished"],["Made in","England"]]',
 '{images/film-tailor.jpg,images/style-mono.jpg,images/hero-cover.jpg}',11),
('brass-shoe-horn','Accessories','ACCESSORIES','Brass Shoe Horn, Long',38,'',
 'Solid brass · 60cm',
 'The small dignity of never crushing the heel of a good shoe again.',
 E'A 60cm solid-brass shoe horn so you can put on shoes standing up, like an adult. Weighty, cool to the touch, and handsome enough to leave by the door.\n\nThe brass develops a soft patina; leave it or polish it, both look right.',
 '[["Material","Solid brass"],["Length","60cm"],["Weight","240g"],["Finish","Raw, patinating"],["Hang loop","Leather cord"],["Made in","England"]]',
 '{images/watch-gear.jpg,images/film-workshop.jpg,images/film-tailor.jpg}',12),
('waxed-holdall','Accessories','ACCESSORIES','Weekender Holdall, Waxed',265,'NEW',
 'Waxed canvas · bridle leather',
 'Two nights away in one bag that looks better the more it’s used.',
 E'A generous carry-all in the same dry waxed canvas as our watch roll, trimmed in English bridle leather and riveted where it counts. Fits two nights of clothes, a dopp kit and a pair of shoes.\n\nAn interior zip pocket keeps a passport and charger findable, and the base is reinforced so it stands up on its own.',
 '[["Shell","Waxed cotton canvas"],["Trim","English bridle leather"],["Capacity","38 litres"],["Base","Reinforced, footed"],["Strap","Detachable, padded"],["Made in","England"]]',
 '{images/hero-cover.jpg,images/film-tailor.jpg,images/watch-gear.jpg}',13),
('silk-knit-tie','Accessories','ACCESSORIES','Silk Knit Tie, Flat-End',62,'',
 'Woven silk · flat-end',
 'The one tie that dresses down a suit and dresses up an oxford.',
 E'A woven silk knit with a flat end and a textured hand that sits somewhere between formal and easy — the tie for a blazer-and-denim register.\n\nKnots small and neat, never slippery, in colours chosen to go with everything we sell.',
 '[["Material","Woven silk"],["Width","6cm flat-end"],["Length","145cm"],["Knot","Small, neat"],["Colours","Six house shades"],["Made in","Italy"]]',
 '{images/film-tailor.jpg,images/style-mono.jpg,images/grooming.jpg}',14),
('wool-watch-cap','Style','STYLE','Ribbed Wool Watch Cap',45,'',
 'Lambswool · ribbed knit',
 'A short, honest beanie with no logo and no slouch.',
 E'A tight-ribbed watch cap in soft lambswool, knitted short so it sits at the ear without swallowing your head. No branding, no pom, no fuss.\n\nWarm enough for a real winter, thin enough to stuff in a coat pocket.',
 '[["Yarn","Lambswool"],["Knit","Ribbed"],["Fit","Short cuff"],["Branding","None"],["Care","Cool hand wash"],["Made in","Scotland"]]',
 '{images/style-mono.jpg,images/grooming.jpg,images/film-workshop.jpg}',15),
('leather-belt','Accessories','ACCESSORIES','Bridle Leather Belt, 35mm',95,'',
 'English bridle leather · solid brass',
 'One belt, cut to your length, that you’ll re-buckle for a decade.',
 E'Cut from a strip of English bridle leather and finished with a solid-brass roller buckle you can swap yourself. We punch it to your waist so it sits on the middle hole from day one.\n\nA true buy-it-for-life belt that darkens handsomely with wear.',
 '[["Leather","English bridle"],["Width","35mm"],["Buckle","Solid brass roller"],["Fixing","Screw-set, swappable"],["Sizing","Punched to order"],["Made in","England"]]',
 '{images/film-tailor.jpg,images/hero-cover.jpg,images/style-mono.jpg}',16)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- CATEGORIES  (the 5 editorial sections)
-- ---------------------------------------------------------------------------
insert into public.categories (slug, name, intro) values
('style',   'Style',    'Tailoring, casualwear, footwear and the art of getting dressed without thinking about it.'),
('grooming','Grooming', 'Skincare, fragrance and shaving — short routines that actually stick.'),
('watches', 'Watches',  'Chronographs, dress watches and the mechanics of keeping time well.'),
('culture', 'Culture',  'Essays, interviews and the machines and men worth writing about.'),
('film',    'Film',     'MG Film — short documentaries on craft, from coachbuilders to watchmakers.')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- HOMEPAGE  (the ordered section Block[] the <SectionRenderer/> renders)
-- This mirrors the homepage prototype's section order. Copy is verbatim from
-- design_files/Modern Gentlemen Homepage.dc.html — extend/adjust as the build
-- brings each section to pixel-fidelity.
-- ---------------------------------------------------------------------------
insert into public.pages (slug, title, seo, sections) values
('home', 'Modern Gentlemen',
 '{"title":"Modern Gentlemen — A field guide to the considered life","description":"Style, grooming, watches, culture and film for the modern gentleman."}',
 '[
   {"_key":"hero","_type":"heroCoverStar",
    "eyebrow":"COVER STORY — ISSUE 042","kicker":"The Cover Interview",
    "headline":"Speed, Considered",
    "sub":"Why the modern gentleman drives slow cars fast — on patience, stewardship, and the machines we keep.",
    "media":{"kind":"image","image":"images/hero-cover.jpg"},
    "cta":{"label":"READ THE COVER STORY","href":"/article/speed-considered","style":"solid"},
    "mobileHeight":"fullscreen"},
   {"_key":"latest","_type":"latestGrid","heading":"The Latest","eyebrow":"New this week","variant":"sixUp",
    "items":[
      {"kicker":"CULTURE · 042","title":"The Art of Arriving Early","href":"/article/the-art-of-arriving-early","meta":"6 MIN"},
      {"kicker":"STYLE · 041","title":"Racing Green Is the New Navy","href":"/article/racing-green-is-the-new-navy","image":"images/style-mono.jpg"},
      {"kicker":"WATCHES · 040","title":"Why Dial Symmetry Matters","href":"/article/why-dial-symmetry-matters","image":"images/watch-gear.jpg"},
      {"kicker":"GROOMING · 039","title":"The Case Against 12-Step Routines","href":"/article/the-case-against-12-step-routines","image":"images/grooming.jpg"},
      {"kicker":"CULTURE · 038","title":"The Analog Weekend","href":"/article/the-analog-weekend","image":"images/film-workshop.jpg"}
    ]},
   {"_key":"style","_type":"featureSplit","variant":"fullBleed","eyebrow":"Style",
    "title":"The Monochrome Wardrobe, Engineered","href":"/style","cta":{"label":"DISCOVER MORE","href":"/style"},
    "image":"images/style-mono.jpg"},
   {"_key":"twoup","_type":"twoUpCategory","items":[
     {"kicker":"Grooming","title":"The Seven-Minute Standard","sub":"Four products, seven minutes, done properly. A pit-stop routine for sharp mornings.","href":"/grooming","image":"images/grooming.jpg"},
     {"kicker":"Watches & Gear","title":"Chronographs Born on the Grid","sub":"From pit wall to dinner table — six racing chronographs that earned their place.","href":"/watches","image":"images/watch-gear.jpg"}
   ]},
   {"_key":"promise","_type":"storyBand","eyebrow":"Our promise",
    "quote":"PRESERVING TASTE WHILE DEFINING NEW STYLE",
    "attribution":"We believe luxury and utility don’t have to be at odds. Modern Gentlemen exists to help men keep their most precious possession — their time — and spend it well.",
    "cta":{"label":"CONTINUE READING","href":"/about","style":"outline"}},
   {"_key":"film","_type":"filmStills","heading":"MG Film","eyebrow":"Watch","items":[
     {"title":"Inside a Coachbuilder’s Workshop","duration":"14:20","image":"images/film-workshop.jpg"},
     {"title":"A Tailor’s Archive","duration":"09:52","image":"images/film-tailor.jpg"},
     {"title":"The Watchmaker of the Grid","duration":"11:38","image":"images/film-watchmaker.jpg"}
   ]},
   {"_key":"news","_type":"newsletter","heading":"The Debrief. Weekly, considered.","eyebrow":"Join the family",
    "sub":"One considered email a week. No noise, ever.","buttonLabel":"SUBSCRIBE"}
 ]')
on conflict (slug) do nothing;
