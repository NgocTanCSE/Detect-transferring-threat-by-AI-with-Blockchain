import pathlib

path = pathlib.Path(r'C:\Users\Ngoc Tan\Downloads\blockchain-ai-project\backend\app\main.py')
text = path.read_text('utf-8')

old = '''@router.get("/organizations")
def get_organizations(
    admin: User = Depends(require_admin),
    database_session: Session = Depends(get_db),
) -> Dict[str, Any]:
    """List organizations."""
    try:
        orgs = database_session.query(Organization).order_by(Organization.name).all()
        items = [
            {
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "status": "Active" if org.is_active else "Suspended",
                "users": database_session.query(User).filter(User.organization_id == org.id).count(),
                "api_calls": "0",
            }
            for org in orgs
        ]
        return {"count": len(items), "items": items}
    except Exception as exc:
        logger.exception(f"Failed to fetch organizations: {exc}")
        return {"count": 0, "items": [], "error": str(exc)}'''

new = '''@app.get("/ops/system/organizations", tags=["System Admin"])
def get_organizations(admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get all organizations from database without hardcoded fallbacks."""
    try:
        orgs = database_session.query(Organization).order_by(Organization.name).all()
        items = []
        for org in orgs:
            user_count = database_session.query(User).filter(User.organization_id == org.id).count()
            items.append({
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "status": "Active" if org.is_active else "Suspended",
                "users": user_count,
                "api_calls": "0"
            })
        return {"count": len(items), "items": items}
    except Exception as e:
        logger.exception(f"Failed to fetch organizations: {e}")
        return {"count": 0, "items": [], "error": str(e)}'''

if old in text:
    path.write_text(text.replace(old, new), 'utf-8')
    print('FIXED organizations endpoint')
else:
    print('NOT FOUND - check text')
