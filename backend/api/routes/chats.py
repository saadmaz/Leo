from fastapi import APIRouter, HTTPException, status

from backend.middleware.auth import CurrentUser
from backend.schemas.chat import Chat, ChatCreate, ChatRename
from backend.schemas.message import Message
from backend.services import firebase_service

router = APIRouter(prefix="/projects/{project_id}/chats", tags=["chats"])


def _get_project_or_404(project_id: str, uid: str) -> dict:
    project = firebase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    if uid not in project.get("members", {}):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    return project


@router.post("", response_model=Chat, status_code=status.HTTP_201_CREATED)
async def create_chat(project_id: str, body: ChatCreate, user: CurrentUser):
    _get_project_or_404(project_id, user["uid"])
    return firebase_service.create_chat(project_id, name=body.name or "New Chat")


@router.get("", response_model=list[Chat])
async def list_chats(project_id: str, user: CurrentUser):
    _get_project_or_404(project_id, user["uid"])
    return firebase_service.list_chats(project_id)


@router.get("/{chat_id}", response_model=Chat)
async def get_chat(project_id: str, chat_id: str, user: CurrentUser):
    _get_project_or_404(project_id, user["uid"])
    chat = firebase_service.get_chat(project_id, chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    return chat


@router.patch("/{chat_id}", response_model=Chat)
async def rename_chat(project_id: str, chat_id: str, body: ChatRename, user: CurrentUser):
    _get_project_or_404(project_id, user["uid"])
    firebase_service.rename_chat(project_id, chat_id, body.name)
    chat = firebase_service.get_chat(project_id, chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    return chat


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(project_id: str, chat_id: str, user: CurrentUser):
    _get_project_or_404(project_id, user["uid"])
    firebase_service.delete_chat(project_id, chat_id)


@router.get("/{chat_id}/messages", response_model=list[Message])
async def list_messages(project_id: str, chat_id: str, user: CurrentUser):
    _get_project_or_404(project_id, user["uid"])
    return firebase_service.list_messages(project_id, chat_id)
