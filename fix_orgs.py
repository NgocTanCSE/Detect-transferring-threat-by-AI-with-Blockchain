import pathlib

path = pathlib.Path(r'C:\Users\Ngoc Tan\Downloads\blockchain-ai-project\backend\app\main.py')
text = path.read_text('utf-8')

old = '''@app.get("/ops/system/organizations", tags=["System Admin"])
def get_organizations(admin: User = Depends(require_admin), database_session: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get all organizations with default fallback seeding."""
    try:
        orgs = database_session.query(Organization).all()
        if not orgs:
            # Seed them
            org1 = Organization(
                name="Global Bank Vietnam",
                slug="gbv",
                contact_email="admin@gbv.com",
                api_key="sk_live_" + secrets.token_hex(24),
                is_active=True
            )
            org2 = Organization(
                name="DNTU Exchange",
                slug="dntu",
                contact_email="security@dntu.edu.vn",
                api_key="sk_live_" + secrets.token_hex(24),
                is_active=True
            )
            org3 = Organization(
                name="SafeTrade Singapore",
                slug="sts",
                contact_email="compliance@safetrade.sg",
                api_key="sk_live_" + secrets.token_hex(24),
                is_active=False
            )
            database_session.add_all([org1, org2, org3])
            database_session.commit()
            orgs = [org1, org2, org3]
            
        items = []
        for org in orgs:
            # Count actual users in DB
            user_count = database_session.query(User).filter(User.organization_id == org.id).count()
            if org.slug == 'gbv' and user_count == 0:
                user_count = 12
            elif org.slug == 'dntu' and user_count == 0:
                user_count = 5
                
            # Formatting API Calls
            api_calls = "0"
            if org.slug == 'gbv':
                api_calls = "1.2M"
            elif org.slug == 'dntu':
                api_calls = "450K"
                
            items.append({
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "status": "Active" if org.is_active else "Suspended",
                "users": user_count,
                "api_calls": api_calls
            })
        return {"count": len(items), "items": items}
    except Exception as e:
        logger.exception(f"Failed to fetch organizations: {e}")
        return {"count": 0, "items": [], "error": str(e)}'''

new = '''@router.get("/organizations")
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

if old in text:
    path.write_text(text.replace(old, new), 'utf-8')
    print('FIXED')
else:
    print('NOT FOUND')
