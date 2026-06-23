from fastapi import APIRouter

from app.api.v1 import (
    admin,
    admin_agent,
    admin_blog,
    admin_properties,
    auth,
    blog,
    inquiries,
    mbti_results,
    oauth,
    open_house,
    open_house_inquiries,
    properties,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(oauth.router)
api_router.include_router(users.router)
api_router.include_router(properties.router)
api_router.include_router(inquiries.router)
api_router.include_router(mbti_results.router)
api_router.include_router(open_house.router)
api_router.include_router(open_house_inquiries.router)
api_router.include_router(admin.router)
api_router.include_router(admin_agent.router)
api_router.include_router(admin_properties.router)
api_router.include_router(blog.router)
api_router.include_router(admin_blog.router)
