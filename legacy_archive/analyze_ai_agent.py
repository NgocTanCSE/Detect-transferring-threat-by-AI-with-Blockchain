#!/usr/bin/env python3
"""
Analyze AI Agent code to identify issues and generate improvement recommendations.
This identifies context understanding and response quality issues.
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Tuple, Any

class AIAgentAnalyzer:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.issues = []
        self.recommendations = []

    def read_file(self, path: str) -> str:
        """Read file content"""
        try:
            return (self.project_root / path).read_text(encoding="utf-8")
        except Exception as e:
            print(f"Error reading {path}: {e}")
            return ""

    def analyze_hardcoded_responses(self):
        """Check for hardcoded template responses"""
        print("\n1. Analyzing hardcoded responses...")
        main_file = self.read_file("backend/app/main.py")

        # Find hardcoded support answers
        support_section = re.search(
            r"def _build_account_support_answer.*?return \(",
            main_file,
            re.DOTALL
        )
        if support_section:
            content = support_section.group(0)
            hardcoded = re.findall(r'"([^"]{50,})"', content)
            self.issues.append({
                "type": "hardcoded_responses",
                "severity": "high",
                "description": f"Found {len(hardcoded)} hardcoded template responses in _build_account_support_answer",
                "lines": len(hardcoded),
            })
            self.recommendations.append({
                "type": "hardcoded_responses",
                "action": "Dynamic context usage",
                "description": "Replace hardcoded responses with dynamic queries from database",
                "impact": "Higher contextual relevance, personalized answers",
            })

    def analyze_question_detection(self):
        """Check question type detection logic"""
        print("\n2. Analyzing question detection...")
        main_file = self.read_file("backend/app/main.py")

        # Find all detection functions
        functions = [
            "_is_dashboard_analytics_question",
            "_is_account_support_question",
            "_is_system_component_question",
        ]

        for func_name in functions:
            pattern = rf"def {func_name}\(.*?\).*?return.*?any\(term in.*?\)"
            match = re.search(pattern, main_file, re.DOTALL)
            if match:
                # Count terms
                terms = re.findall(r'"([^"]+)"', match.group(0))
                self.issues.append({
                    "type": "question_detection",
                    "severity": "medium",
                    "description": f"{func_name} uses {len(terms)} hardcoded keywords only",
                    "example_keywords": terms[:5],
                })

        self.recommendations.append({
            "type": "question_detection",
            "action": "AI-powered intent detection",
            "description": "Use LLM or ML model to understand question intent instead of keyword matching",
            "impact": "Handles questions with similar meaning but different wording",
        })

    def analyze_context_building(self):
        """Check context passed to AI"""
        print("\n3. Analyzing context building...")
        main_file = self.read_file("backend/app/main.py")

        # Find _build_dashboard_assistant_context
        context_func = re.search(
            r"def _build_dashboard_assistant_context\(.*?\).*?return context",
            main_file,
            re.DOTALL
        )

        if context_func:
            content = context_func.group(0)
            context_keys = re.findall(r'"(\w+)":\s*', content)
            unique_keys = set(context_keys)

            # Check what's missing
            missing_context = {
                "recent_cases": "High priority fraud cases in last 24h",
                "alert_trend": "Alert spike detection and patterns",
                "policy_effectiveness": "Which policies are most effective",
                "user_actions": "Recent user actions and decisions",
                "system_health": "ML model accuracy, processing delays",
                "risk_distribution": "Distribution of risk levels",
            }

            for key, description in missing_context.items():
                self.issues.append({
                    "type": "context_gaps",
                    "severity": "medium",
                    "description": f"Missing context: {key} - {description}",
                })

    def analyze_prompts(self):
        """Analyze prompt engineering"""
        print("\n4. Analyzing prompt engineering...")
        analyst_file = self.read_file("backend/app/services/hf_security_analyst.py")

        # Find prompts
        prompts = re.findall(r"return f\"\"\"(.*?)\"\"\"", analyst_file, re.DOTALL)

        for i, prompt in enumerate(prompts):
            lines = prompt.split("\n")
            has_system_role = "system<|end_header_id|>" in prompt
            has_examples = "Ví dụ" in prompt or "Example" in prompt
            has_constraints = "không" in prompt or "KHÔNG" in prompt

            self.issues.append({
                "type": "prompt_quality",
                "severity": "low",
                "description": f"Prompt {i+1}: has_examples={has_examples}, has_constraints={has_constraints}",
                "suggestions": [
                    "Add few-shot examples to improve answer quality",
                    "Add explicit constraints (max response length, format)",
                    "Specify output format more clearly",
                ] if not has_examples else []
            })

    def analyze_fallbacks(self):
        """Check fallback mechanisms"""
        print("\n5. Analyzing fallback mechanisms...")
        analyst_file = self.read_file("backend/app/services/hf_security_analyst.py")

        # Find fallback functions
        fallbacks = [
            "_fallback_dashboard_answer",
            "_fallback_general_answer",
        ]

        for fallback_name in fallbacks:
            match = re.search(
                rf"def {fallback_name}\(.*?\).*?return .*?\)",
                analyst_file,
                re.DOTALL
            )
            if match:
                content = match.group(0)
                if "database_session" not in content and "query" not in content:
                    self.issues.append({
                        "type": "weak_fallbacks",
                        "severity": "high",
                        "description": f"{fallback_name} doesn't use live data",
                    })

    def analyze_knowledge_base(self):
        """Check knowledge base retrieval"""
        print("\n6. Analyzing knowledge base...")
        kb_file = self.read_file("backend/app/services/assistant_knowledge_base.py")

        # Find score calculation
        score_section = re.search(r"score = overlap \+ bonus", kb_file)
        if score_section:
            # Check what bonuses exist
            bonuses = re.findall(r'if.*?".*?" in.*?:\s*bonus \+= (\d+)', kb_file)
            if len(bonuses) < 5:
                self.issues.append({
                    "type": "kb_scoring",
                    "severity": "medium",
                    "description": f"Knowledge base scoring has only {len(bonuses)} bonus rules",
                    "suggestion": "Add more context-aware scoring (role, scope, temporal relevance)",
                })

    def check_model_integration(self):
        """Check LLM model integration"""
        print("\n7. Checking model integration...")
        analyst_file = self.read_file("backend/app/services/hf_security_analyst.py")

        # Check temperature settings
        temps = re.findall(r'"temperature":\s*([\d.]+)', analyst_file)

        self.issues.append({
            "type": "model_config",
            "severity": "low",
            "description": f"Temperature settings: {set(temps)}",
            "note": "Lower temp (0.3-0.5) = factual, Higher (0.7+) = creative",
        })

    def generate_report(self) -> Dict[str, Any]:
        """Generate analysis report"""
        return {
            "timestamp": str(Path(__file__).stat().st_mtime),
            "total_issues": len(self.issues),
            "critical_issues": len([i for i in self.issues if i.get("severity") == "high"]),
            "issues": self.issues,
            "recommendations": self.recommendations,
        }

    def run_analysis(self):
        """Run complete analysis"""
        print("="*70)
        print("AI Agent Code Analysis")
        print("="*70)

        self.analyze_hardcoded_responses()
        self.analyze_question_detection()
        self.analyze_context_building()
        self.analyze_prompts()
        self.analyze_fallbacks()
        self.analyze_knowledge_base()
        self.check_model_integration()

        return self.generate_report()

    def print_report(self, report: Dict[str, Any]):
        """Print analysis report"""
        print("\n" + "="*70)
        print("ANALYSIS RESULTS")
        print("="*70)
        print(f"Total Issues Found: {report['total_issues']}")
        print(f"Critical Issues: {report['critical_issues']}")

        # Group by type
        by_type = {}
        for issue in report["issues"]:
            issue_type = issue.get("type", "unknown")
            if issue_type not in by_type:
                by_type[issue_type] = []
            by_type[issue_type].append(issue)

        print("\n" + "-"*70)
        print("ISSUES BY TYPE:")
        print("-"*70)
        for issue_type, issues in by_type.items():
            severity_counts = {}
            for issue in issues:
                sev = issue.get("severity", "unknown")
                severity_counts[sev] = severity_counts.get(sev, 0) + 1

            print(f"\n{issue_type}:")
            for sev, count in severity_counts.items():
                print(f"  {sev}: {count}")

        print("\n" + "-"*70)
        print("RECOMMENDATIONS:")
        print("-"*70)
        for i, rec in enumerate(report["recommendations"], 1):
            print(f"\n{i}. {rec.get('action', 'Action')}")
            print(f"   Current: {rec.get('description', '')}")
            print(f"   Impact: {rec.get('impact', '')}")


def main():
    project_root = "C:\\Users\\Ngoc Tan\\Downloads\\blockchain-ai-project"
    analyzer = AIAgentAnalyzer(project_root)
    report = analyzer.run_analysis()
    analyzer.print_report(report)

    # Save report
    output_file = Path(project_root) / "ai_agent_analysis.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nReport saved to {output_file}")


if __name__ == "__main__":
    main()
