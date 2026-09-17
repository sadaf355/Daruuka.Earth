import json

from geoalchemy2.functions import ST_Area, ST_AsGeoJSON, ST_GeomFromGeoJSON, ST_Transform
from geoalchemy2.shape import to_shape
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.schemas.site import GeoJSONPolygon


def geometry_from_geojson(polygon: GeoJSONPolygon):
    """Build a PostGIS geometry expression (SRID 4326) from a validated GeoJSON polygon."""
    return ST_GeomFromGeoJSON(json.dumps(polygon.model_dump()))


def area_hectares_expr(geom_column):
    """
    SQL expression: project the geometry to Web Mercator (3857) for an area calculation in
    square meters, then convert to hectares. Good enough for a demo at typical site sizes;
    an equal-area projection would be the production-grade choice for very large/high-latitude sites.
    """
    return ST_Area(ST_Transform(geom_column, 3857)) / 10000.0


def compute_area_ha(db: Session, geom_column) -> float:
    """Run the area calculation as a scalar query (used right after insert, before commit)."""
    result = db.execute(select(area_hectares_expr(geom_column))).scalar_one()
    return round(float(result), 2)


def geometry_to_geojson_dict(geom) -> dict:
    """Convert a loaded GeoAlchemy2 geometry (WKBElement) into a plain GeoJSON dict for API responses."""
    shape = to_shape(geom)
    return json.loads(json.dumps(shape.__geo_interface__))


def geojson_column_expr(geom_column):
    """SQL expression returning the geometry column as a GeoJSON string, for use in SELECT."""
    return ST_AsGeoJSON(geom_column)
