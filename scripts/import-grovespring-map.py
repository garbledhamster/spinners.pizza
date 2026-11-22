"""Turn one Grovespring OpenStreetMap XML extract into the site's local map data."""
import json
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from math import cos, radians
from pathlib import Path

# The original Google Maps place marker, independent of the OSM road geometry.
LATITUDE = 37.4046822
LONGITUDE = -92.6018155
METERS_PER_DEGREE = 111_195
BOUNDS = "-92.647,37.373,-92.558,37.435"
SOURCE = "https://api.openstreetmap.org/api/0.6/map?bbox=" + BOUNDS


def tags(element):
    return {tag.get("k"): tag.get("v") for tag in element.findall("tag")}


def xy(element):
    longitude = float(element.get("lon"))
    latitude = float(element.get("lat"))
    return [
        round((longitude - LONGITUDE) * METERS_PER_DEGREE * cos(radians(LATITUDE))),
        round((LATITUDE - latitude) * METERS_PER_DEGREE),
    ]


def extract(source):
    root = ET.parse(source).getroot()
    nodes = {node.get("id"): xy(node) for node in root.findall("node")}
    lines = defaultdict(list)
    route_labels = []
    for way in root.findall("way"):
        fields = tags(way)
        highway = fields.get("highway")
        if fields.get("waterway") in ("river", "stream", "creek"):
            kind = "water"
        elif highway in ("primary", "secondary", "tertiary"):
            kind = highway
        elif highway in ("residential", "unclassified", "service"):
            kind = "service" if highway == "service" else "local"
        else:
            continue
        path = [nodes[node.get("ref")] for node in way.findall("nd")]
        if len(path) < 2:
            continue
        lines[kind].append(path)
        if fields.get("ref") in ("MO 5", "MO AA"):
            route_labels.append([fields["ref"].removeprefix("MO "), kind, len(lines[kind]) - 1])
    places = [[name, *nodes[node.get("id")]] for node in root.findall("node")
              if (name := tags(node).get("name")) == "Grovespring"]
    return {"origin": [LONGITUDE, LATITUDE], "source": SOURCE, "license": "ODbL-1.0",
            "lines": lines, "routes": route_labels, "places": places}


if __name__ == "__main__":
    output = Path(__file__).resolve().parents[1] / "data" / "grovespring-map.json"
    output.write_text(json.dumps(extract(sys.argv[1]), separators=(",", ":")) + "\n")
