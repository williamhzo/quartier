# Quartier

Paris has 20 arrondissements. Everyone who's ever lived there has opinions about which one is best. This app replaces those opinions with data (and then you can argue about the data instead).

Pick a persona (young professional, family, tourist, business owner) and Quartier ranks all 20 arrondissements across 9 dimensions using French open data: housing prices, income, safety, transport, green space, noise, amenities, culture, and sports facilities.

Map-first. Mobile-first. French and English. No backend, just pre-computed static JSON.

**[quartier.sh](https://quartier.sh)**

## Run locally

Needs [Bun](https://bun.sh).

```bash
git clone git@github.com:williamhzo/quartier.git
cd quartier
bun install
bun dev
```

Open [localhost:3000](http://localhost:3000). No env vars required for the app.

## Commands

| Command              | What it does                      |
| -------------------- | --------------------------------- |
| `bun dev`            | Dev server                        |
| `bun run build`      | Production build                  |
| `bun run lint`       | ESLint                            |
| `bun run format`     | Prettier                          |
| `bun run data:build` | Rebuild data from source datasets |

## Fork it

1. Fork + clone
2. `bun install`
3. `bun dev`

All source data is French open data, no paid APIs needed. Want to add a dimension? Look at `scripts/data-config.ts` for the pattern and `scripts/sources/` for existing parsers.

## Current data coverage

- Shipped in the app: housing, income, safety, transport, green space, noise, amenities, culture, sports
- Not shipped in v1: nightlife. There is an experimental SIRENE-based pipeline in `scripts/`, but it is not part of the public scoring model yet.

## Stack

Next.js 16 · TypeScript · Tailwind CSS 4 · shadcn/ui · MapLibre GL · react-map-gl · Recharts · nuqs · next-intl · Vercel

## Where the data comes from

Everything is French government open data:

- Housing prices: [DVF](https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/) (actual transaction records, not asking prices). Geo-split CSVs from [files.data.gouv.fr](https://files.data.gouv.fr/geo-dvf/latest/csv/)
- Income & poverty: [INSEE Filosofi](https://www.insee.fr/fr/statistiques/5359146) (dossier complet)
- Safety: [SSMSI](https://www.data.gouv.fr/fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/) (communal crime stats)
- Transport: [IDFM](https://data.iledefrance-mobilites.fr/explore/dataset/emplacement-des-gares-idf/) (metro/RER station locations)
- Noise: [Bruitparif / Ville de Paris](https://www.data.gouv.fr/fr/datasets/bruit-routier-exposition-des-parisien-ne-s-aux-depassements-des-seuils-nocturne-ou-journee-complete/) (road noise exposure)
- Green space: [opendata.paris.fr](https://opendata.paris.fr/explore/dataset/espaces_verts/) (park polygons, clipped per arrondissement)
- Amenities: [INSEE BPE](https://www.data.gouv.fr/fr/datasets/base-permanente-des-equipements-1/) (pharmacies, doctors, schools, gyms, cinemas). Parser source: [OpenDataSoft BPE](https://public.opendatasoft.com/explore/dataset/buildingref-france-bpe-all-millesime/)
- Culture: [INSEE BPE](https://www.insee.fr/fr/statistiques/fichier/3232691/correspondance_sous_domaine_fonction_type_equipement_2023.htm) (cinemas, libraries, heritage, live performance venues, archives, museums)
- Sports facilities: [Data ES](https://equipements.sports.gouv.fr/explore/assets/data-es/) (Ministry of Sports). [API](https://equipements.sports.gouv.fr/api/explore/v2.1/catalog/datasets/data-es/records), also on [data.gouv.fr](https://www.data.gouv.fr/datasets/recensement-des-equipements-sportifs-espaces-et-sites-de-pratiques)
- Nightlife (not shipped in v1): [INSEE SIRENE API](https://api.insee.fr/entreprises/sirene/V3.11) / [Base SIRENE stock files](https://www.data.gouv.fr/fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/) for restaurants, bars, cafes
- Arrondissement boundaries: [opendata.paris.fr](https://opendata.paris.fr/explore/dataset/arrondissements/)

## Contributing

Contributions welcome. Bug reports, new data dimensions, UI improvements, translations, whatever.

1. Fork the repo
2. Create a branch (`git checkout -b your-thing`)
3. Make your changes
4. Run `bun run lint && bun run build` to check nothing's broken
5. Open a PR

If you're adding a new data dimension, open an issue first so we can discuss the data source and schema before you write a parser.

See ya!

## License

[MIT](LICENSE)
