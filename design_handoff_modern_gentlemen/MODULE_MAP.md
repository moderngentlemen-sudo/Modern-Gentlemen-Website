# Section Library compatibility map

This is the migration contract for `Modern Gentlemen Section Library.dc.html`.
That checked-in source contains 125 numbered static compositions: sections
01–68, hero treatments 69–115, and Vogue editorial heroes 116–125. The 20
CMS/site modules numbered 126–145 are additive platform presets derived from the
original product brief; they are retained here, but are not represented in that
standalone source artifact.

The new builder does not embed the exported HTML. Every design is now a native, responsive, accessible block preset with editable content and independent design controls. Shared structural families keep the system maintainable without sacrificing the original compositions.

Status meanings:

- **Native** — an explicit numbered preset is selectable in the builder now.
- **Platform** — an additive native preset from the product brief, outside the
  checked-in Section Library source.
- **Compatible** — the present block catalogue can reproduce the composition; a numbered one-click preset remains to be added.
- **Queued** — requires a new family or meaningful family extension.

|   # | Source composition           | Builder family / preset              | Status   |
| --: | ---------------------------- | ------------------------------------ | -------- |
|  01 | Editorial Split Hero         | `heroStudio.editorialSplit`          | Native   |
|  02 | Category Rail                | `sectionStudio.categoryRail`         | Native   |
|  03 | The Index                    | `sectionStudio.theIndex`             | Native   |
|  04 | Long-Read Feature            | `sectionStudio.longReadFeature`      | Native   |
|  05 | The Store                    | `sectionStudio.theStore`             | Native   |
|  06 | Contributor Spotlight        | `sectionStudio.contributorSpotlight` | Native   |
|  07 | Manifesto Pull-Quote         | `sectionStudio.manifestoPullQuote`   | Native   |
|  08 | By the Numbers               | `sectionStudio.byTheNumbers`         | Native   |
|  09 | The Archive                  | `sectionStudio.theArchive`           | Native   |
|  10 | Social Gallery               | `sectionStudio.socialGallery`        | Native   |
|  11 | The Debate                   | `sectionStudio.theDebate`            | Native   |
|  12 | The Field Guide              | `sectionStudio.theFieldGuide`        | Native   |
|  13 | Spec Comparison              | `sectionStudio.specComparison`       | Native   |
|  14 | Dispatch Banner              | `sectionStudio.dispatchBanner`       | Native   |
|  15 | The Interview                | `sectionStudio.theInterview`         | Native   |
|  16 | A Brief History              | `sectionStudio.briefHistory`         | Native   |
|  17 | Letter from the Editor       | `sectionStudio.letterFromEditor`     | Native   |
|  18 | Member Voices                | `sectionStudio.memberVoices`         | Native   |
|  19 | The Briefing                 | `sectionStudio.theBriefing`          | Native   |
|  20 | Featured Series              | `sectionStudio.featuredSeries`       | Native   |
|  21 | Start Here                   | `sectionStudio.startHere`            | Native   |
|  22 | Current Issue                | `sectionStudio.currentIssue`         | Native   |
|  23 | Membership Tiers             | `sectionStudio.membershipTiers`      | Native   |
|  24 | The Calendar                 | `sectionStudio.theCalendar`          | Native   |
|  25 | Destinations                 | `sectionStudio.destinations`         | Native   |
|  26 | Editors' Desk                | `sectionStudio.editorsDesk`          | Native   |
|  27 | Cover Takeover               | `sectionStudio.coverTakeover`        | Native   |
|  28 | The Drop                     | `sectionStudio.theDrop`              | Native   |
|  29 | Profile Lead                 | `sectionStudio.profileLead`          | Native   |
|  30 | Fit Check                    | `sectionStudio.fitCheck`             | Native   |
|  31 | Video Hub                    | `sectionStudio.videoHub`             | Native   |
|  32 | The List                     | `sectionStudio.theList`              | Native   |
|  33 | The Awards                   | `sectionStudio.theAwards`            | Native   |
|  34 | The Regimen                  | `sectionStudio.theRegimen`           | Native   |
|  35 | Watch of the Week            | `sectionStudio.watchOfWeek`          | Native   |
|  36 | What I've Learned            | `sectionStudio.whatIveLearned`       | Native   |
|  37 | The Op-Eds                   | `sectionStudio.theOpEds`             | Native   |
|  38 | The Big Read Opener          | `sectionStudio.bigReadOpener`        | Native   |
|  39 | Weekend Watchlist            | `sectionStudio.weekendWatchlist`     | Native   |
|  40 | Ask MG                       | `sectionStudio.askMg`                | Native   |
|  41 | Best Bars                    | `sectionStudio.bestBars`             | Native   |
|  42 | Heritage Band                | `sectionStudio.heritageBand`         | Native   |
|  43 | In Partnership               | `sectionStudio.inPartnership`        | Native   |
|  44 | The Rundown                  | `sectionStudio.theRundown`           | Native   |
|  45 | Motoring Spotlight           | `sectionStudio.motoringSpotlight`    | Native   |
|  46 | Interiors Feature            | `sectionStudio.interiorsFeature`     | Native   |
|  47 | The Objects                  | `sectionStudio.theObjects`           | Native   |
|  48 | The Lounge                   | `sectionStudio.theLounge`            | Native   |
|  49 | The Cloth                    | `sectionStudio.theCloth`             | Native   |
|  50 | The Cabinet                  | `sectionStudio.theCabinet`           | Native   |
|  51 | Heat Check                   | `sectionStudio.heatCheck`            | Native   |
|  52 | Trending Now                 | `sectionStudio.trendingNow`          | Native   |
|  53 | Culture Mosaic               | `sectionStudio.cultureMosaic`        | Native   |
|  54 | The Vote                     | `sectionStudio.theVote`              | Native   |
|  55 | Overheard                    | `sectionStudio.overheard`            | Native   |
|  56 | On Rotation                  | `sectionStudio.onRotation`           | Native   |
|  57 | The Uniform                  | `sectionStudio.theUniform`           | Native   |
|  58 | Price Points                 | `sectionStudio.pricePoints`          | Native   |
|  59 | The Restoration              | `sectionStudio.theRestoration`       | Native   |
|  60 | The Seasonal Edit            | `sectionStudio.seasonalEdit`         | Native   |
|  61 | Reader's Garage              | `sectionStudio.readersGarage`        | Native   |
|  62 | The Glossary                 | `sectionStudio.theGlossary`          | Native   |
|  63 | The Debrief, Aloud           | `sectionStudio.debriefAloud`         | Native   |
|  64 | The Marketplace              | `sectionStudio.theMarketplace`       | Native   |
|  65 | Anatomy Of                   | `sectionStudio.anatomyOf`            | Native   |
|  66 | Second Opinion               | `sectionStudio.secondOpinion`        | Native   |
|  67 | The Wager                    | `sectionStudio.theWager`             | Native   |
|  68 | House Rules                  | `sectionStudio.houseRules`           | Native   |
|  69 | Hero: Full-Bleed Cover       | `heroStudio.fullBleedCover`          | Native   |
|  70 | Hero: Type Masthead          | `heroStudio.typeMasthead`            | Native   |
|  71 | Hero: Triptych               | `heroStudio.triptych`                | Native   |
|  72 | Hero: Broadsheet Stack       | `heroStudio.broadsheetStack`         | Native   |
|  73 | Hero: Sidebar Rail           | `heroStudio.sidebarRail`             | Native   |
|  74 | Hero: Red Field              | `heroStudio.redField`                | Native   |
|  75 | Hero: Split Diagonal         | `heroStudio.splitDiagonal`           | Native   |
|  76 | Hero: Framed Cover           | `heroStudio.framedCover`             | Native   |
|  77 | Hero: Quote Opener           | `heroStudio.quoteOpener`             | Native   |
|  78 | Hero: Collage Grid           | `heroStudio.collageGrid`             | Native   |
|  79 | Hero: Film Still             | `heroStudio.filmStill`               | Native   |
|  80 | Hero: Countdown Drop         | `heroStudio.countdownDrop`           | Native   |
|  81 | Hero: Index Opener           | `heroStudio.indexOpener`             | Native   |
|  82 | Hero: Marquee Ticker         | `heroStudio.marqueeTicker`           | Native   |
|  83 | Hero: Ledger Split           | `heroStudio.ledgerSplit`             | Native   |
|  84 | Hero: Cover Star             | `heroStudio.coverStar`               | Native   |
|  85 | Hero: Classic Masthead       | `heroStudio.classicMasthead`         | Native   |
|  86 | Hero: Salon Split            | `heroStudio.salonSplit`              | Native   |
|  87 | Hero: Heat Board             | `heroStudio.heatBoard`               | Native   |
|  88 | Hero: Centerfold             | `heroStudio.centerfold`              | Native   |
|  89 | Hero: Drop Feed              | `heroStudio.dropFeed`                | Native   |
|  90 | Hero: Interior View          | `heroStudio.interiorView`            | Native   |
|  91 | Hero: The Picks              | `heroStudio.thePicks`                | Native   |
|  92 | Hero: Screening Room         | `heroStudio.screeningRoom`           | Native   |
|  93 | Hero: The Daily              | `heroStudio.theDaily`                | Native   |
|  94 | Hero: The Essay              | `heroStudio.theEssay`                | Native   |
|  95 | Hero: The Hundred            | `heroStudio.theHundred`              | Native   |
|  96 | Hero: Profile Duplex         | `heroStudio.profileDuplex`           | Native   |
|  97 | Hero: Members' Hour          | `heroStudio.membersHour`             | Native   |
|  98 | Hero: Double Portrait        | `heroStudio.doublePortrait`          | Native   |
|  99 | Hero: Quiet Luxury           | `heroStudio.quietLuxury`             | Native   |
| 100 | Hero: Versus                 | `heroStudio.versus`                  | Native   |
| 101 | Hero: The Ranking            | `heroStudio.theRanking`              | Native   |
| 102 | Hero: Drop Clock             | `heroStudio.dropClock`               | Native   |
| 103 | Hero: After Dark             | `heroStudio.afterDark`               | Native   |
| 104 | Hero: The Issue              | `heroStudio.theIssue`                | Native   |
| 105 | Hero: Cover Wall             | `heroStudio.coverWall`               | Native   |
| 106 | Hero: Index Mono             | `heroStudio.indexMono`               | Native   |
| 107 | Hero: Lower Case             | `heroStudio.lowerCase`               | Native   |
| 108 | Hero: The Wire               | `heroStudio.theWire`                 | Native   |
| 109 | Hero: Open Door              | `heroStudio.openDoor`                | Native   |
| 110 | Hero: Filmstrip              | `heroStudio.filmstrip`               | Native   |
| 111 | Hero: Room Index             | `heroStudio.roomIndex`               | Native   |
| 112 | Hero: The Seal               | `heroStudio.theSeal`                 | Native   |
| 113 | Hero: New Fiction            | `heroStudio.newFiction`              | Native   |
| 114 | Hero: Live Desk              | `heroStudio.liveDesk`                | Native   |
| 115 | Hero: Still Life             | `heroStudio.stillLife`               | Native   |
| 116 | Vogue 6A · Cover Story       | `heroStudio.vogueCoverStory`         | Native   |
| 117 | Vogue 6B · Centered Masthead | `heroStudio.vogueCenteredMasthead`   | Native   |
| 118 | Vogue 6C · Asymmetric        | `heroStudio.vogueAsymmetric`         | Native   |
| 119 | Vogue 6D · Portrait Grid     | `heroStudio.voguePortraitGrid`       | Native   |
| 120 | Vogue 6E · Runway Strip      | `heroStudio.vogueRunwayStrip`        | Native   |
| 121 | Vogue 6F · Pull-Quote        | `heroStudio.voguePullQuote`          | Native   |
| 122 | Vogue 6G · Split Hero        | `heroStudio.vogueSplitHero`          | Native   |
| 123 | Vogue 6H · Stacked Features  | `heroStudio.vogueStackedFeatures`    | Native   |
| 124 | Vogue 6I · The Index         | `heroStudio.vogueIndex`              | Native   |
| 125 | Vogue 6J · Photo Mosaic      | `heroStudio.voguePhotoMosaic`        | Native   |
| 126 | Category Pill Bar            | `sectionStudio.categoryPillBar`      | Platform |
| 127 | Hero Post Grid (1 + 3)       | `sectionStudio.heroPostGrid`         | Platform |
| 128 | Latest Film Carousel         | `sectionStudio.latestFilmCarousel`   | Platform |
| 129 | Featured Post Band           | `sectionStudio.featuredPostBand`     | Platform |
| 130 | Latest News Three-Up         | `sectionStudio.latestNewsThreeUp`    | Platform |
| 131 | Filterable Archive Grid      | `sectionStudio.filterableArchive`    | Platform |
| 132 | Subscribe CTA Split          | `sectionStudio.subscribeCtaSplit`    | Platform |
| 133 | Social Follow Strip          | `sectionStudio.socialFollowStrip`    | Platform |
| 134 | Mega Footer                  | `sectionStudio.megaFooter`           | Platform |
| 135 | Newsletter Modal             | `sectionStudio.newsletterModal`      | Platform |
| 136 | Contributors Row             | `sectionStudio.contributorsRow`      | Platform |
| 137 | Trending Ticker              | `sectionStudio.trendingTicker`       | Platform |
| 138 | List + Sidebar               | `sectionStudio.listSidebar`          | Platform |
| 139 | Search Overlay Results       | `sectionStudio.searchResults`        | Platform |
| 140 | Pagination / Load More       | `sectionStudio.paginationLoadMore`   | Platform |
| 141 | Announcement Bar             | `sectionStudio.announcementBar`      | Platform |
| 142 | Audio / Podcast List         | `sectionStudio.audioPodcastList`     | Platform |
| 143 | Topic Cloud                  | `sectionStudio.topicCloud`           | Platform |
| 144 | Editor's Letter              | `sectionStudio.editorsLetter`        | Platform |
| 145 | Related Reading Strip        | `sectionStudio.relatedReading`       | Platform |

## Porting contract

For every queued composition:

1. Preserve its numbered identity and visual signature as a named preset.
2. Separate content from presentation; do not hard-code article, product, or image data into the renderer.
3. Expose meaningful controls for layout, type, color, spacing, media, responsive behavior, and visibility instead of mirroring raw CSS properties blindly.
4. Register the component in `components/sections/registry.ts` and its complete contract in `lib/blocks/manifests/`.
5. Supply valid insertion defaults, responsive behavior, keyboard/accessibility semantics, and focused unit coverage.
6. Keep existing blocks and routes operational until a native preset proves it can reproduce them.

All 125 source compositions have native numbered presets, alongside 20 additive
platform presets. The next quality slice is screenshot-level responsive
comparison against the source catalogue, followed by targeted polish where a
preset's visual signature diverges.
