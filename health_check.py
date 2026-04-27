#!/usr/bin/env python3
"""
Comprehensive Project Health Check & Testing Script
Tests all components of the Blockchain AI Sentinel system
"""

import subprocess
import sys
import os
import json
from pathlib import Path
from datetime import datetime

class ProjectHealthCheck:
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "checks": [],
            "errors": [],
            "warnings": [],
            "summary": {}
        }

    def check_python_syntax(self):
        """Check Python file syntax"""
        print("\n" + "="*70)
        print("1️⃣  PYTHON SYNTAX CHECK")
        print("="*70)

        files_to_check = [
            "backend/app/main.py",
            "backend/app/core/config.py",
            "backend/app/services/hf_security_analyst.py",
            "backend/app/services/ai_agent_improvements.py",
            "backend/app/services/ai_engine.py",
        ]

        syntax_ok = True
        for file_path in files_to_check:
            full_path = self.project_root / file_path
            if full_path.exists():
                result = subprocess.run(
                    f'python -m py_compile "{full_path}"',
                    shell=True,
                    capture_output=True,
                    timeout=10
                )
                if result.returncode == 0:
                    print(f"  ✓ {file_path}")
                    self.results["checks"].append({"file": file_path, "status": "OK"})
                else:
                    print(f"  ✗ {file_path} - SYNTAX ERROR")
                    error_msg = result.stderr.decode()[:200]
                    print(f"    Error: {error_msg}")
                    self.results["errors"].append({"file": file_path, "error": error_msg})
                    syntax_ok = False
            else:
                print(f"  ⚠ {file_path} - NOT FOUND")
                self.results["warnings"].append({"file": file_path, "warning": "File not found"})

        return syntax_ok

    def check_imports(self):
        """Test critical imports"""
        print("\n" + "="*70)
        print("2️⃣  IMPORT VERIFICATION")
        print("="*70)

        imports_to_test = [
            ("fastapi", "FastAPI"),
            ("sqlalchemy", "SQLAlchemy"),
            ("requests", "HTTP Requests"),
            ("pydantic", "Pydantic"),
        ]

        imports_ok = True
        for module_name, description in imports_to_test:
            try:
                __import__(module_name)
                print(f"  ✓ {description} ({module_name})")
                self.results["checks"].append({"import": module_name, "status": "OK"})
            except ImportError as e:
                print(f"  ✗ {description} ({module_name}) - NOT INSTALLED")
                self.results["errors"].append({"import": module_name, "error": str(e)})
                imports_ok = False

        return imports_ok

    def check_backend_structure(self):
        """Verify backend directory structure"""
        print("\n" + "="*70)
        print("3️⃣  BACKEND STRUCTURE CHECK")
        print("="*70)

        required_dirs = [
            "backend/app",
            "backend/app/services",
            "backend/app/core",
            "backend/app/models",
        ]

        required_files = [
            "backend/app/main.py",
            "backend/app/core/config.py",
            "backend/app/core/database.py",
            "backend/app/services/hf_security_analyst.py",
            "backend/app/services/ai_agent_improvements.py",
        ]

        structure_ok = True

        # Check directories
        for dir_path in required_dirs:
            full_path = self.project_root / dir_path
            if full_path.exists() and full_path.is_dir():
                print(f"  ✓ Directory: {dir_path}")
            else:
                print(f"  ✗ Directory: {dir_path} - MISSING")
                structure_ok = False
                self.results["errors"].append({"directory": dir_path, "error": "Not found"})

        # Check files
        for file_path in required_files:
            full_path = self.project_root / file_path
            if full_path.exists() and full_path.is_file():
                size_kb = full_path.stat().st_size / 1024
                print(f"  ✓ File: {file_path} ({size_kb:.1f} KB)")
            else:
                print(f"  ✗ File: {file_path} - MISSING")
                structure_ok = False
                self.results["errors"].append({"file": file_path, "error": "Not found"})

        return structure_ok

    def check_config(self):
        """Verify critical configurations"""
        print("\n" + "="*70)
        print("4️⃣  CONFIGURATION CHECK")
        print("="*70)

        config_checks = [
            ("GEMINI_MODEL", "gemini-1.5-flash", "Gemini Model"),
            ("GEMINI_API_BASE_URL", "https://generativelanguage.googleapis.com/v1", "Gemini API URL"),
            ("DATABASE_URL", None, "Database URL (Optional - can use Supabase)"),
        ]

        config_ok = True

        for env_var, expected_value, description in config_checks:
            value = os.getenv(env_var, "NOT SET")

            if expected_value and value != expected_value:
                if value == "NOT SET":
                    print(f"  ℹ {description} ({env_var}): NOT SET")
                    self.results["warnings"].append({
                        "config": env_var,
                        "expected": expected_value,
                        "actual": value
                    })
                else:
                    print(f"  ⚠ {description} ({env_var}): {value[:50]}")
                    print(f"     Expected: {expected_value}")
            elif value != "NOT SET":
                print(f"  ✓ {description} ({env_var}): {value[:40]}")
                self.results["checks"].append({"config": env_var, "status": "OK"})
            else:
                print(f"  ℹ {description} ({env_var}): Optional, not set")

        return config_ok

    def check_ai_agent_status(self):
        """Check AI Agent improvements"""
        print("\n" + "="*70)
        print("5️⃣  AI AGENT IMPROVEMENTS STATUS")
        print("="*70)

        improvements = [
            ("Enhanced Context Building", "ai_agent_improvements.py", "_build_enhanced_dashboard_context"),
            ("Intent Detection", "ai_agent_improvements.py", "_detect_question_intent"),
            ("Dynamic Fallbacks", "hf_security_analyst.py", "_fallback_dashboard_answer"),
            ("Improved Prompts", "hf_security_analyst.py", "_construct_dashboard_chat_prompt"),
        ]

        ai_ok = True

        for feature_name, file_name, function_name in improvements:
            file_path = self.project_root / "backend/app/services" / file_name

            if file_path.exists():
                content = file_path.read_text(encoding='utf-8')
                if function_name in content:
                    print(f"  ✓ {feature_name}")
                    self.results["checks"].append({"feature": feature_name, "status": "ENABLED"})
                else:
                    print(f"  ⚠ {feature_name} - Function not found")
                    self.results["warnings"].append({"feature": feature_name, "error": "Function not found"})
                    ai_ok = False
            else:
                print(f"  ✗ {feature_name} - File not found")
                self.results["errors"].append({"feature": feature_name, "error": "File not found"})
                ai_ok = False

        return ai_ok

    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "="*70)
        print("📊 TEST SUMMARY")
        print("="*70)

        total_checks = len(self.results["checks"])
        total_warnings = len(self.results["warnings"])
        total_errors = len(self.results["errors"])

        print(f"\n✅ Checks Passed: {total_checks}")
        print(f"⚠️  Warnings: {total_warnings}")
        print(f"❌ Errors: {total_errors}")

        self.results["summary"] = {
            "checks_passed": total_checks,
            "warnings": total_warnings,
            "errors": total_errors,
            "overall_status": "✅ OK" if total_errors == 0 else "❌ ERRORS FOUND"
        }

        return total_errors == 0

    def run_all_checks(self):
        """Run all health checks"""
        print("""
╔══════════════════════════════════════════════════════════════════════════╗
║    BLOCKCHAIN AI SENTINEL - PROJECT HEALTH CHECK & TEST                  ║
║                    April 28, 2026                                        ║
╚══════════════════════════════════════════════════════════════════════════╝
""")

        checks_results = [
            ("Python Syntax", self.check_python_syntax()),
            ("Imports", self.check_imports()),
            ("Backend Structure", self.check_backend_structure()),
            ("Configuration", self.check_config()),
            ("AI Agent Status", self.check_ai_agent_status()),
        ]

        all_ok = all(result for _, result in checks_results)

        # Print summary
        self.generate_summary()

        print("\n" + "="*70)
        print("RECOMMENDATIONS")
        print("="*70)

        if all_ok:
            print("""
✅ All checks passed! Your system is ready.

Next steps:
1. Start backend:
   $ docker-compose up --build
   OR
   $ cd backend && python -m uvicorn app.main:app --port 7860

2. Test improvements:
   $ python test_ai_agent.py

3. Access dashboard:
   http://localhost:3000 (frontend)
   http://localhost:7860/docs (API docs)
""")
        else:
            print(f"""
⚠️  {len(self.results['errors'])} error(s) found. Review above.

Common fixes:
- Install missing dependencies: pip install -r backend/requirements.txt
- Set GEMINI_API_KEY: export GEMINI_API_KEY="your-key"
- Check database connection: DATABASE_URL env var

Detailed errors below:
""")

            if self.results["errors"]:
                print("\n❌ ERRORS:")
                for error in self.results["errors"]:
                    print(f"  - {error}")

            if self.results["warnings"]:
                print("\n⚠️  WARNINGS:")
                for warning in self.results["warnings"]:
                    print(f"  - {warning}")

        # Save report
        report_file = self.project_root / "health_check_report.json"
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)

        print(f"\n📄 Full report saved to: {report_file}")

        return 0 if all_ok else 1

def main():
    health_check = ProjectHealthCheck()
    return health_check.run_all_checks()

if __name__ == "__main__":
    sys.exit(main())
