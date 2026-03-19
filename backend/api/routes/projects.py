from fastapi import APIRouter, HTTPException, status

from backend.middleware.auth import CurrentUser
from backend.schemas.project import Project, ProjectCreate, ProjectUpdate
from backend.services import firebase_service

router = APIRouter(prefix="/projects", tags=["projects"])


def _assert_member(project: dict, uid: str, required_role: str = "viewer") -> None:
    roles = {"viewer": 0, "editor": 1, "admin": 2}
    members: dict = project.get("members", {})
    user_role = members.get(uid)
    if user_role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    if roles.get(user_role, -1) < roles.get(required_role, 0):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions.")


@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(body: ProjectCreate, user: CurrentUser):
    project = firebase_service.create_project(
        owner_uid=user["uid"],
        name=body.name,
        description=body.description or "",
    )
    # Ensure the user doc exists in Firestore
    firebase_service.upsert_user(
        uid=user["uid"],
        email=user.get("email", ""),
        display_name=user.get("name", ""),
    )
    return project


@router.get("", response_model=list[Project])
async def list_projects(user: CurrentUser):
    return firebase_service.list_projects(user["uid"])


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, user: CurrentUser):
    project = firebase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    _assert_member(project, user["uid"])
    return project


@router.patch("/{project_id}", response_model=Project)
async def update_project(project_id: str, body: ProjectUpdate, user: CurrentUser):
    project = firebase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    _assert_member(project, user["uid"], required_role="editor")

    updates = body.model_dump(exclude_none=True)
    if updates:
        firebase_service.update_project(project_id, updates)

    return firebase_service.get_project(project_id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, user: CurrentUser):
    project = firebase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    _assert_member(project, user["uid"], required_role="admin")
    firebase_service.delete_project(project_id)
