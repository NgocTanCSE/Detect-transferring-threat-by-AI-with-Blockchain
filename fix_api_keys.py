import pathlib

path = pathlib.Path(r'C:\Users\Ngoc Tan\Downloads\blockchain-ai-project\backend\app\main.py')
text = path.read_text('utf-8')

old = '''@app.get("/ops/system/api-keys", tags=["System Admin"])
def get_api_keys(admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get active API keys from organizations."""
    try:
        orgs = database_session.query(Organization).all()
        if not orgs:
            get_organizations(database_session)
            orgs = database_session.query(Organization).all()
            
        items = []
        for org in orgs:
            if org.api_key:
                items.append({
                    "id": str(org.id),
                    "name": f"{org.name} Gateway",
                    "key": org.api_key,
                    "created": org.created_at.strftime("%Y-%m-%d") if org.created_at else "2024-05-01",
                    "usage": "High" if org.slug == "gbv" else "Low"
                })
        return {"count": len(items), "items": items}
    except Exception as e:
        logger.exception(f"Failed to fetch API keys: {e}")
        return {"count": 0, "items": [], "error": str(e)}'''

new = '''@app.get("/ops/system/api-keys", tags=["System Admin"])
def get_api_keys(admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get active API keys from organizations."""
    try:
        orgs = database_session.query(Organization).filter(Organization.api_key.is_not(None)).all()
        items = [
            {
                "id": str(org.id),
                "name": f"{org.name} Gateway",
                "key": org.api_key,
                "created": org.created_at.strftime("%Y-%m-%d") if org.created_at else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "usage": "0"
            }
            for org in orgs
        ]
        return {"count": len(items), "items": items}
    except Exception as e:
        logger.exception(f"Failed to fetch API keys: {e}")
        return {"count": 0, "items": [], "error": str(e)}'''

if old in text:
    path.write_text(text.replace(old, new), 'utf-8')
    print('FIXED api-keys endpoint')
else:
    print('NOT FOUND')
