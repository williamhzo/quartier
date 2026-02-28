# Quartier

Paris has 20 arrondissements. Everyone who's ever lived there has opinions about which one is best. This app replaces those opinions with data (and then you can argue about the data instead).

Pick a persona (young professional, family, tourist, business owner) and Quartier ranks all 20 arrondissements using French open data: real estate prices, crime stats, metro density, income, noise. Nightlife, green space, and amenities are next.

Map-first. Mobile-first. French and English. No backend, just pre-computed static JSON.

**[quartier.sh](https://quartier.sh)**

## Run locally

Needs [Bun](https://bun.sh).

```bash
git clone git@github.com:williamhzo/quartier.git
cd quartier
bun install
```

Grab a free [MapTiler key](https://cloud.maptiler.com/account/keys/) and drop it in `.env.local`:

```
NEXT_PUBLIC_MAPTILER_KEY=your_key_here
```

```bash
bun dev
```

Open [localhost:3000](http://localhost:3000). That's it.

## Commands

| Command | What it does |
| --- | --- |
| `bun dev` | Dev server |
| `bun run build` | Production build |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |
| `bun run data:build` | Rebuild data from source datasets |

## Fork it

1. Fork + clone
2. `bun install`
3. Get a [MapTiler key](https://cloud.maptiler.com/account/keys/) (free tier works)
4. `bun dev`

All source data is French open data, no paid APIs needed. Want to add a dimension? Look at `scripts/data-config.ts` for the pattern and `scripts/sources/` for existing parsers.

## Stack

Next.js 16 · TypeScript · Tailwind CSS 4 · shadcn/ui · MapLibre GL · react-map-gl · Recharts · nuqs · next-intl · Vercel

## Where the data comes from

Everything is French government open data:

- Housing prices: [DVF](https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/) (actual transaction records, not asking prices)
- Income & poverty: [INSEE Filosofi](https://www.insee.fr/fr/statistiques/5359146)
- Crime: [SSMSI](https://www.data.gouv.fr/fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/)
- Transport: [IDFM](https://data.iledefrance-mobilites.fr/explore/dataset/emplacement-des-gares-idf/)
- Noise: [Bruitparif / Ville de Paris](https://www.data.gouv.fr/fr/datasets/bruit-routier-exposition-des-parisien-ne-s-aux-depassements-des-seuils-nocturne-ou-journee-complete/)
- Nightlife (soon): [SIRENE](https://www.data.gouv.fr/fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/)
- Green space (soon): [opendata.paris.fr](https://opendata.paris.fr/explore/dataset/espaces_verts/)
- Amenities (soon): [INSEE BPE](https://www.data.gouv.fr/fr/datasets/base-permanente-des-equipements-1/)

## Contributing

Contributions welcome. Bug reports, new data dimensions, UI improvements, translations, whatever.

1. Fork the repo
2. Create a branch (`git checkout -b your-thing`)
3. Make your changes
4. Run `bun run lint && bun run build` to check nothing's broken
5. Open a PR

If you're adding a new data dimension, open an issue first so we can discuss the data source and schema before you write a parser.

## License

[MIT](LICENSE)
