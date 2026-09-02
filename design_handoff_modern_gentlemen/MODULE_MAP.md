# Section Library compatibility map

This is the migration contract for `Modern Gentlemen Section Library (standalone).html`. The source contains 145 numbered static compositions: sections 001–068, hero treatments 069–115, Vogue editorial heroes 116–125, and CMS/site modules 126–145.

The new builder does not embed the exported HTML. It recreates each design as a native, responsive, accessible block preset with editable content and independent design controls. Shared structural families keep the system maintainable without sacrificing the original compositions.

Status meanings:

- **Native** — an explicit numbered preset is selectable in the builder now.
- **Compatible** — the present block catalogue can reproduce the composition; a numbered one-click preset remains to be added.
- **Queued** — requires a new family or meaningful family extension.

|   # | Source composition           | Builder family / preset                       | Status     |
| --: | ---------------------------- | --------------------------------------------- | ---------- |
| 001 | Editorial Split Hero         | `heroStudio.editorialSplit`                   | Native     |
| 002 | Category Rail                | `twoUpCategory`                               | Compatible |
| 003 | The Index                    | `numberedIndex`                               | Compatible |
| 004 | Long-Read Feature            | `featureSplit`                                | Compatible |
| 005 | The Store                    | `productRow`                                  | Compatible |
| 006 | Contributor Spotlight        | `testimonials`                                | Compatible |
| 007 | Manifesto Pull-Quote         | `manifesto` / `pullQuote`                     | Compatible |
| 008 | By the Numbers               | `statsBand`                                   | Compatible |
| 009 | The Archive                  | `editorialFeed`                               | Compatible |
| 010 | Social Gallery               | Gallery family                                | Queued     |
| 011 | The Debate                   | `interview`                                   | Compatible |
| 012 | The Field Guide              | `numberedIndex`                               | Compatible |
| 013 | Spec Comparison              | Comparison family                             | Queued     |
| 014 | Dispatch Banner              | `newsletter`                                  | Compatible |
| 015 | The Interview                | `interview`                                   | Compatible |
| 016 | A Brief History              | `timeline`                                    | Compatible |
| 017 | Letter from the Editor       | `interview` / `storyBand`                     | Compatible |
| 018 | Member Voices                | `testimonials`                                | Compatible |
| 019 | The Briefing                 | `numberedIndex`                               | Compatible |
| 020 | Featured Series              | `latestGrid`                                  | Compatible |
| 021 | Start Here                   | `numberedIndex`                               | Compatible |
| 022 | Current Issue                | `featureSplit`                                | Compatible |
| 023 | Membership Tiers             | Pricing family                                | Queued     |
| 024 | The Calendar                 | `timeline`                                    | Compatible |
| 025 | Destinations                 | `latestGrid`                                  | Compatible |
| 026 | Editors' Desk                | `testimonials`                                | Compatible |
| 027 | Cover Takeover               | `heroCoverStar`                               | Compatible |
| 028 | The Drop                     | `productRow`                                  | Compatible |
| 029 | Profile Lead                 | Profile family                                | Queued     |
| 030 | Fit Check                    | Lookbook family                               | Queued     |
| 031 | Video Hub                    | `nativeVideo` + layout blocks                 | Compatible |
| 032 | The List                     | `numberedIndex`                               | Compatible |
| 033 | The Awards                   | Awards family                                 | Queued     |
| 034 | The Regimen                  | `numberedIndex` / `articleGrid`               | Compatible |
| 035 | Watch of the Week            | `featureSplit`                                | Compatible |
| 036 | What I've Learned            | `pullQuote` / `interview`                     | Compatible |
| 037 | The Op-Eds                   | `editorialFeed`                               | Compatible |
| 038 | The Big Read Opener          | `editorialHero`                               | Compatible |
| 039 | Weekend Watchlist            | `articleGrid`                                 | Compatible |
| 040 | Ask MG                       | Advice/Q&A family                             | Queued     |
| 041 | Best Bars                    | Directory family                              | Queued     |
| 042 | Heritage Band                | `storyBand`                                   | Compatible |
| 043 | In Partnership               | `featureSplit`                                | Compatible |
| 044 | The Rundown                  | `editorialFeed`                               | Compatible |
| 045 | Motoring Spotlight           | `featureSplit`                                | Compatible |
| 046 | Interiors Feature            | `featureSplit`                                | Compatible |
| 047 | The Objects                  | `productRow`                                  | Compatible |
| 048 | The Lounge                   | `coverCards`                                  | Compatible |
| 049 | The Cloth                    | `featureSplit`                                | Compatible |
| 050 | The Cabinet                  | `productRow`                                  | Compatible |
| 051 | Heat Check                   | `latestGrid`                                  | Compatible |
| 052 | Trending Now                 | `numberedIndex`                               | Compatible |
| 053 | Culture Mosaic               | `coverCards` / `latestGrid`                   | Compatible |
| 054 | The Vote                     | Poll family                                   | Queued     |
| 055 | Overheard                    | `pullQuote`                                   | Compatible |
| 056 | On Rotation                  | Playlist family                               | Queued     |
| 057 | The Uniform                  | `featureSplit` / `productRow`                 | Compatible |
| 058 | Price Points                 | Comparison family                             | Queued     |
| 059 | The Restoration              | Before/after family                           | Queued     |
| 060 | The Seasonal Edit            | `productRow` / `coverCards`                   | Compatible |
| 061 | Reader's Garage              | Community gallery family                      | Queued     |
| 062 | The Glossary                 | Accordion/glossary family                     | Queued     |
| 063 | The Debrief, Aloud           | Audio family                                  | Queued     |
| 064 | The Marketplace              | `productRow`                                  | Compatible |
| 065 | Anatomy Of                   | Hotspot/explainer family                      | Queued     |
| 066 | Second Opinion               | `interview`                                   | Compatible |
| 067 | The Wager                    | Prediction/scorecard family                   | Queued     |
| 068 | House Rules                  | `numberedIndex`                               | Compatible |
| 069 | Hero: Full-Bleed Cover       | `heroStudio.fullBleedCover`                   | Native     |
| 070 | Hero: Type Masthead          | `heroStudio.typeMasthead`                     | Native     |
| 071 | Hero: Triptych               | `heroStudio.triptych`                         | Native     |
| 072 | Hero: Broadsheet Stack       | Hero Studio II                                | Queued     |
| 073 | Hero: Sidebar Rail           | Hero Studio II                                | Queued     |
| 074 | Hero: Red Field              | `heroStudio` tone controls                    | Compatible |
| 075 | Hero: Split Diagonal         | Hero Studio II                                | Queued     |
| 076 | Hero: Framed Cover           | `heroCoverStar` extension                     | Queued     |
| 077 | Hero: Quote Opener           | `pullQuote` / Hero Studio                     | Compatible |
| 078 | Hero: Collage Grid           | Collage family                                | Queued     |
| 079 | Hero: Film Still             | `editorialHero`                               | Compatible |
| 080 | Hero: Countdown Drop         | Commerce hero family                          | Queued     |
| 081 | Hero: Index Opener           | `numberedIndex` + Hero Studio                 | Compatible |
| 082 | Hero: Marquee Ticker         | Ticker family                                 | Queued     |
| 083 | Hero: Ledger Split           | Hero Studio II                                | Queued     |
| 084 | Hero: Cover Star             | `heroCoverStar`                               | Compatible |
| 085 | Hero: Classic Masthead       | `masthead`                                    | Compatible |
| 086 | Hero: Salon Split            | Hero Studio II                                | Queued     |
| 087 | Hero: Heat Board             | Ranking family                                | Queued     |
| 088 | Hero: Centerfold             | Hero Studio II                                | Queued     |
| 089 | Hero: Drop Feed              | Commerce hero family                          | Queued     |
| 090 | Hero: Interior View          | `featureSplit` / Hero Studio                  | Compatible |
| 091 | Hero: The Picks              | `latestGrid` / Hero Studio                    | Compatible |
| 092 | Hero: Screening Room         | Video hero family                             | Queued     |
| 093 | Hero: The Daily              | `editorialFeed` / Hero Studio                 | Compatible |
| 094 | Hero: The Essay              | `editorialHero`                               | Compatible |
| 095 | Hero: The Hundred            | Ranking family                                | Queued     |
| 096 | Hero: Profile Duplex         | Profile family                                | Queued     |
| 097 | Hero: Members' Hour          | Membership hero family                        | Queued     |
| 098 | Hero: Double Portrait        | Portrait family                               | Queued     |
| 099 | Hero: Quiet Luxury           | `editorialHero`                               | Compatible |
| 100 | Hero: Versus                 | Comparison hero family                        | Queued     |
| 101 | Hero: The Ranking            | Ranking family                                | Queued     |
| 102 | Hero: Drop Clock             | Commerce hero family                          | Queued     |
| 103 | Hero: After Dark             | `editorialHero` / Hero Studio                 | Compatible |
| 104 | Hero: The Issue              | Issue/cover family                            | Queued     |
| 105 | Hero: Cover Wall             | Collage family                                | Queued     |
| 106 | Hero: Index Mono             | `numberedIndex` + Hero Studio                 | Compatible |
| 107 | Hero: Lower Case             | `heroStudio.typeMasthead` typography controls | Compatible |
| 108 | Hero: The Wire               | Ticker/news family                            | Queued     |
| 109 | Hero: Open Door              | `featureSplit` / Hero Studio                  | Compatible |
| 110 | Hero: Filmstrip              | Filmstrip family                              | Queued     |
| 111 | Hero: Room Index             | Directory hero family                         | Queued     |
| 112 | Hero: The Seal               | Badge/seal hero family                        | Queued     |
| 113 | Hero: New Fiction            | `editorialHero`                               | Compatible |
| 114 | Hero: Live Desk              | Live/news family                              | Queued     |
| 115 | Hero: Still Life             | `editorialHero` / Hero Studio                 | Compatible |
| 116 | Vogue 6A · Cover Story       | Vogue hero family                             | Queued     |
| 117 | Vogue 6B · Centered Masthead | Vogue hero family                             | Queued     |
| 118 | Vogue 6C · Asymmetric        | Vogue hero family                             | Queued     |
| 119 | Vogue 6D · Portrait Grid     | Vogue hero family                             | Queued     |
| 120 | Vogue 6E · Runway Strip      | Vogue hero family                             | Queued     |
| 121 | Vogue 6F · Pull-Quote        | Vogue hero family                             | Queued     |
| 122 | Vogue 6G · Split Hero        | Vogue hero family                             | Queued     |
| 123 | Vogue 6H · Stacked Features  | Vogue hero family                             | Queued     |
| 124 | Vogue 6I · The Index         | Vogue hero family                             | Queued     |
| 125 | Vogue 6J · Photo Mosaic      | Vogue hero family                             | Queued     |
| 126 | Category Pill Bar            | Taxonomy navigation family                    | Queued     |
| 127 | Hero Post Grid (1 + 3)       | `featuredLead` + `latestGrid`                 | Compatible |
| 128 | Latest Film Carousel         | Carousel family                               | Queued     |
| 129 | Featured Post Band           | `storyBand` / `featuredLead`                  | Compatible |
| 130 | Latest News Three-Up         | `latestGrid`                                  | Compatible |
| 131 | Filterable Archive Grid      | `editorialFeed` binding/filter extension      | Queued     |
| 132 | Subscribe CTA Split          | `newsletter` / `ctaBand`                      | Compatible |
| 133 | Social Follow Strip          | Social links family                           | Queued     |
| 134 | Mega Footer                  | Global footer builder area                    | Queued     |
| 135 | Newsletter Modal             | Overlay/modal system                          | Queued     |
| 136 | Contributors Row             | `testimonials` extension                      | Queued     |
| 137 | Trending Ticker              | Ticker family                                 | Queued     |
| 138 | List + Sidebar               | `columns` + `editorialFeed`                   | Compatible |
| 139 | Search Overlay Results       | Global search experience                      | Queued     |
| 140 | Pagination / Load More       | `editorialFeed` pagination controls           | Compatible |
| 141 | Announcement Bar             | Global header builder area                    | Queued     |
| 142 | Audio / Podcast List         | Audio family                                  | Queued     |
| 143 | Topic Cloud                  | Taxonomy navigation family                    | Queued     |
| 144 | Editor's Letter              | `interview` / `pullQuote`                     | Compatible |
| 145 | Related Reading Strip        | Related-content family                        | Queued     |

## Porting contract

For every queued composition:

1. Preserve its numbered identity and visual signature as a named preset.
2. Separate content from presentation; do not hard-code article, product, or image data into the renderer.
3. Expose meaningful controls for layout, type, color, spacing, media, responsive behavior, and visibility instead of mirroring raw CSS properties blindly.
4. Register the component in `components/sections/registry.ts` and its complete contract in `lib/blocks/manifests/`.
5. Supply valid insertion defaults, responsive behavior, keyboard/accessibility semantics, and focused unit coverage.
6. Keep existing blocks and routes operational until a native preset proves it can reproduce them.

The next recommended production slices are Hero Studio II (072–083), interactive editorial utilities (054, 062, 063), and the Vogue hero family (116–125).
