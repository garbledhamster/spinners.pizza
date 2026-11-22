The road, stream and settlement geometry in grovespring-map.json is an adapted
OpenStreetMap extract, © OpenStreetMap contributors, available under the
[Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).
The file records the [original map extract](https://api.openstreetmap.org/api/0.6/map?bbox=-92.647,37.373,-92.558,37.435).
To refresh the extract, download that XML, then run
`python3 scripts/import-grovespring-map.py /path/to/extract.osm`.

The independent map origin is the restaurant pin in the existing Google Maps
place embed. The importer projects OSM coordinates to local whole-meter offsets
from that origin. The restaurant name, address and Google Maps links are separate
from the OSM dataset.
