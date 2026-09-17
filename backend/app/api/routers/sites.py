import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.project import Project
from app.models.site import Site
from app.models.site_status import HealthStatus, SiteStatus
from app.models.user import User
from app.schemas.site import SiteCreate, SiteOut
from app.services.geospatial import compute_area_ha, geometry_from_geojson, geometry_to_geojson_dict
from app.services.intelligence import ensure_synthetic_metrics, evaluate_site

router = APIRouter(tags=["sites"])


def _get_owned_project(db: Session, project_id: uuid.UUID, owner_id: uuid.UUID) -> Project:
    project = db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == owner_id)
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _to_out(site: Site) -> SiteOut:
    return SiteOut(
        id=site.id,
        project_id=site.project_id,
        name=site.name,
        area_ha=site.area_ha,
        geometry=geometry_to_geojson_dict(site.geom),
        status=site.status.status if site.status else HealthStatus.healthy,
        created_at=site.created_at,
    )


@router.post(
    "/projects/{project_id}/sites",
    response_model=SiteOut,
    status_code=status.HTTP_201_CREATED,
)
def create_site(
    project_id: uuid.UUID,
    payload: SiteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SiteOut:
    _get_owned_project(db, project_id, current_user.id)

    geom_expr = geometry_from_geojson(payload.geometry)
    area_ha = compute_area_ha(db, geom_expr)

    site = Site(project_id=project_id, name=payload.name, geom=geom_expr, area_ha=area_ha)
    db.add(site)
    db.flush()  # get site.id before creating the dependent status row

    db.add(SiteStatus(site_id=site.id, status=HealthStatus.healthy))
    ensure_synthetic_metrics(db, site.id)
    evaluate_site(db, site.id)
    db.commit()
    db.refresh(site)
    return _to_out(site)


@router.get("/projects/{project_id}/sites", response_model=list[SiteOut])
def list_project_sites(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SiteOut]:
    _get_owned_project(db, project_id, current_user.id)
    sites = (
        db.execute(select(Site).where(Site.project_id == project_id).order_by(Site.created_at.desc()))
        .scalars()
        .all()
    )
    for site in sites:
        evaluate_site(db, site.id)
    db.commit()
    return [_to_out(site) for site in sites]


@router.get("/sites/{site_id}", response_model=SiteOut)
def get_site(
    site_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SiteOut:
    site = db.execute(
        select(Site).join(Project).where(Site.id == site_id, Project.owner_id == current_user.id)
    ).scalar_one_or_none()
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    evaluate_site(db, site.id)
    db.commit()
    return _to_out(site)
