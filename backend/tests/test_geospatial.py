"""Tests for the geospatial layer.

Area is the one number a carbon-project admin will actually check against their own
records, so the SQL we generate for it is worth asserting on directly.
"""

import json

import pytest
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql

from app.schemas.site import GeoJSONPolygon
from app.services.geospatial import area_hectares_expr, geometry_from_geojson

SQUARE = {
    "type": "Polygon",
    "coordinates": [[[0.0, 0.0], [0.01, 0.0], [0.01, 0.01], [0.0, 0.01], [0.0, 0.0]]],
}


def _compile(expression) -> str:
    return str(expression.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


def test_geometry_from_geojson_emits_st_geomfromgeojson():
    sql = _compile(geometry_from_geojson(GeoJSONPolygon(**SQUARE)))
    assert "ST_GeomFromGeoJSON" in sql
    assert "Polygon" in sql


def test_area_expression_projects_before_measuring():
    """Measuring ST_Area on a 4326 geometry returns square degrees, not square metres."""
    sql = _compile(area_hectares_expr(geometry_from_geojson(GeoJSONPolygon(**SQUARE))))
    assert "ST_Area" in sql
    assert "ST_Transform" in sql
    assert "3857" in sql


def test_area_expression_converts_square_metres_to_hectares():
    sql = _compile(area_hectares_expr(geometry_from_geojson(GeoJSONPolygon(**SQUARE))))
    assert "10000" in sql, "1 hectare == 10,000 m2; the divisor must be present"


def test_polygon_schema_rejects_non_polygon():
    with pytest.raises(ValidationError):
        GeoJSONPolygon(type="Point", coordinates=[[[0.0, 0.0]]])


def test_polygon_schema_roundtrips_coordinates():
    polygon = GeoJSONPolygon(**SQUARE)
    assert json.loads(json.dumps(polygon.model_dump()))["coordinates"] == SQUARE["coordinates"]
