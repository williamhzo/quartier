declare module "*.geojson" {
  import type { FeatureCollection, Geometry } from "geojson";
  const value: FeatureCollection<Geometry>;
  export default value;
}
