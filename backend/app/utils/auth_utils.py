from fastapi import Header

async def get_org_id(x_org_id: str | None = Header(None)) -> str | None:
    """Dependency to extract organization ID from request headers."""
    return x_org_id
