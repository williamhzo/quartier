# Quartier -- App Ideas

French open data web app built on the [datagouv MCP server](https://github.com/datagouv/datagouv-mcp).

---

## Priority Ideas

### 1. City Relocation Comparator (DVF-first)

Personally relevant -- William + Manon exploring moving cities. Pull DVF (real estate transaction prices), crime stats, air quality, INSEE demographics, public transport coverage. Score and rank French cities on custom dimensions.

"Find cities with: housing under 3K/m2, tech scene, good air, TGV to Paris."

Interactive filters, map view.

**Sharper scope:** Start with DVF only. One killer feature: type a city name, see median price/m2 by neighborhood, trend over 3 years, with a comparison mode (city A vs city B). Ship that in a weekend. Then layer on dimensions one at a time. Each new dimension = a new tweet/post.

**Why:** You need it, it's emotional, great build-in-public arc, layerable.

---

### 2. MCP Natural Language Query UI ("Perplexity for French Data")

Wire the datagouv MCP into a conversational interface. Ask "which French cities had the most economic growth in 5 years?" or "where in Paris has crime decreased most?" MCP server already exists, you're building the UX + prompting layer on top.

**Sharper scope:** Don't build a generic "ask anything" chat. Build a guided exploration tool: user picks a theme (housing, demographics, environment, economy), gets suggested questions, can refine with natural language, and results come back as interactive charts rather than text. Opinionated, curated, visual.

**Why:** Best positioning piece, shows AI product craft, MCP timing is perfect. Timely, showcases AI-native product instinct, excellent content story.

---

### 3. DVF Explorer ("What Listings Lie About")

The DVF dataset = every actual real estate transaction in France, address-level, multi-year. Build a viz showing actual sale prices per arrondissement/commune. Gap analysis vs asking prices reveals where buyers have leverage.

**Sharper scope:** Drop the asking-price comparison (would need scraping SeLoger/PAP -- kills momentum). Just build the DVF explorer: actual transaction prices by address, neighborhood, city. Most people have no idea this data is public. "Your neighbor sold for X" is inherently viral. Search bar, map, price histograms per quartier. Clean, fast, beautiful.

**Why:** Viral potential, ships fast, standalone value. Very shareable.

---

### 4. SIRENE Startup Pulse (as weekly digest)

Every company registered in France is in SIRENE. Filter for tech sectors, last 12 months, by city. Live dashboard showing where new tech company registrations are accelerating.

**Sharper scope:** Don't build a dashboard. Build a weekly newsletter/digest with a web archive. Automated: every Monday, query SIRENE for new tech-sector registrations, generate a map + top cities + trend lines, publish to a static page. Add email signup. Content product, not a SaaS -- way easier to grow and monetize later.

**Why:** Every founder, VC, journalist, and city government employee in France would bookmark this. B2B audience aligns with independence goals.

---

## Additional Ideas

### 5. "Baguette Index" -- Cost of Living Comparator

Play on the project name. Pull food prices, housing (DVF), transport costs, and salary data from INSEE. Build a playful index: "How many baguettes does your rent cost in Lyon vs Paris?" Humor + real data = shareability. Light, fun, ships fast.

---

### 6. "Where Should I Open a Business?" Tool

Combine SIRENE (competitor density), DVF (commercial real estate prices), INSEE (foot traffic proxies via population density), and transport data. Pick a business type (bakery, coworking, restaurant), pick a city, get a heat map of opportunity zones. Useful for small business owners, data-rich, visually impressive.

---

### 7. French Public Spending Explorer

Budget data is on data.gouv. Build a clear, zoomable treemap: where does French tax money actually go, by ministry, by region, by year. "You paid X in taxes -- here's where it went." Tax season makes this extremely timely and shareable every spring.

---

### 8. Data Journalism Scrollytelling Piece

Pick one striking dataset (accidents routiers, political shift by commune over 10 years, pollution vs life expectancy by region) and build a single beautifully crafted scrollytelling article. The Pudding format. High shareability, builds "taste" reputation, not a full product -- just a great piece.

---

### 9. Pollution vs Health Dashboard

Combine air quality monitoring data, water quality, and regional health statistics (hospitalizations, respiratory conditions). Map overlay. Which regions are you actually risking your health living in? Environmental justice angle.

---

### 10. Road Accident Heatmap

Accidents routiers dataset is very granular -- time, conditions, type, severity. Interactive heatmap with filters. "Show me the most dangerous hours to drive in Paris." Weekend vs weekday, rain vs dry.

---

### 11. Election Shift Explorer

Very granular election results at commune level going back years. Visualize political drift per commune on an animated timeline. Which areas swung hardest, and when? Cross-reference with economic or demographic changes for a real data journalism story.

---

## Phasing Strategy

Ideas 1 and 2 can merge into the same project:

- **Phase 1:** City comparison tool (DVF data), focused and useful.
- **Phase 2:** Add natural language querying as the interaction model.

Gives you a focused v1 you actually use, then a v2 that's portfolio-worthy.

---

## References

- datagouv MCP server: https://github.com/datagouv/datagouv-mcp
- datagouv MCP blog post: https://www.data.gouv.fr/posts/experimentation-autour-dun-serveur-mcp-pour-datagouv
- data.gouv.fr: https://www.data.gouv.fr
- DVF (Demandes de Valeurs Foncieres): https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/
- SIRENE: https://www.data.gouv.fr/fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/
- INSEE: https://www.insee.fr/fr/accueil
