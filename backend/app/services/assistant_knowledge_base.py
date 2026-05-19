"""Documentation retrieval helpers for the dashboard assistant."""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import List, Optional


@dataclass(frozen=True)
class KnowledgeSnippet:
    source: str
    heading: str
    content: str
    score: int


_WORD_PATTERN = re.compile(r"[a-z0-9_/-]+", re.IGNORECASE)


def _workspace_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _read_text_file(relative_path: str) -> str:
    file_path = _workspace_root() / relative_path
    if not file_path.exists():
        return ""
    return file_path.read_text(encoding="utf-8", errors="ignore")


def _chunk_text(text: str, max_chars: int = 900) -> List[str]:
    chunks: List[str] = []
    paragraphs = [paragraph.strip() for paragraph in text.splitlines()]
    buffer = ""

    for paragraph in paragraphs:
        if not paragraph:
            continue
        if len(buffer) + len(paragraph) + 1 > max_chars and buffer:
            chunks.append(buffer.strip())
            buffer = paragraph
        else:
            buffer = f"{buffer}\n{paragraph}".strip() if buffer else paragraph

    if buffer:
        chunks.append(buffer.strip())

    return chunks


@lru_cache(maxsize=1)
def _load_knowledge_base() -> List[KnowledgeSnippet]:
    documents = {
        "SYSTEM_COMPONENTS.md": _read_text_file("SYSTEM_COMPONENTS.md"),
        "README.md": _read_text_file("README.md"),
        "DEPLOY_HF_SUPABASE.md": _read_text_file("DEPLOY_HF_SUPABASE.md"),
        "API_ENDPOINTS_BY_TABLE.md": _read_text_file("API_ENDPOINTS_BY_TABLE.md"),
        "DATABASE_SCHEMA.md": _read_text_file("DATABASE_SCHEMA.md"),
        "CHAIN_ASSET_MATRIX.md": _read_text_file("CHAIN_ASSET_MATRIX.md"),
        "DATABASE_RELATIONSHIPS.md": _read_text_file("DATABASE_RELATIONSHIPS.md"),
        "EXCHANGE_API_CONTRACT.md": _read_text_file("EXCHANGE_API_CONTRACT.md"),
        "IMPLEMENTATION_PLAN_CHAIN_ASSET.md": _read_text_file("IMPLEMENTATION_PLAN_CHAIN_ASSET.md"),
        "word_formulas_unicode.txt": _read_text_file("word_formulas_unicode.txt"),
        "database/docs/role-based-rearchitecture-plan.md": _read_text_file("database/docs/role-based-rearchitecture-plan.md"),
    }

    snippets: List[KnowledgeSnippet] = []
    for source, text in documents.items():
        if not text:
            continue
        for chunk in _chunk_text(text):
            heading = chunk.splitlines()[0][:120]
            snippets.append(KnowledgeSnippet(source=source, heading=heading, content=chunk[:1000], score=0))
    return snippets


def _tokenize(value: str) -> List[str]:
    return [token.lower() for token in _WORD_PATTERN.findall(value)]


def retrieve_relevant_snippets(
    question: str,
    role: str,
    wallet_address: Optional[str] = None,
    scope: Optional[str] = None,
    limit: int = 4,
) -> List[KnowledgeSnippet]:
    """Return the most relevant project documentation chunks for a question."""
    question_tokens = set(_tokenize(question))
    role_tokens = set(_tokenize(role))
    wallet_tokens = set(_tokenize(wallet_address or ""))
    scope_tokens = set(_tokenize(scope or ""))
    all_tokens = question_tokens | role_tokens | wallet_tokens | scope_tokens

    scored: List[KnowledgeSnippet] = []
    for snippet in _load_knowledge_base():
        snippet_tokens = set(_tokenize(f"{snippet.heading} {snippet.content}"))
        overlap = len(all_tokens.intersection(snippet_tokens))

        bonus = 0
        lower_text = snippet.content.lower()
        if "assistant" in question.lower() and "chat" in lower_text:
            bonus += 2
        if any(term in question.lower() for term in ["deploy", "hf", "supabase"]) and "deploy" in lower_text:
            bonus += 2
        if any(term in question.lower() for term in ["role", "admin", "analyst", "compliance", "security"]) and "role" in lower_text:
            bonus += 2
        if any(term in question.lower() for term in ["dashboard", "alert", "flow", "wallet", "case"]):
            for keyword in ["dashboard", "alert", "flow", "wallet", "case"]:
                if keyword in lower_text:
                    bonus += 1
        if scope and scope.lower() in lower_text:
            bonus += 3

        score = overlap + bonus
        if score > 0:
            scored.append(KnowledgeSnippet(snippet.source, snippet.heading, snippet.content, score))

    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[:limit]


def render_snippets_for_prompt(snippets: List[KnowledgeSnippet]) -> str:
    if not snippets:
        return ""

    sections = []
    for index, snippet in enumerate(snippets, start=1):
        sections.append(
            f"[{index}] Source: {snippet.source}\nHeading: {snippet.heading}\nContent: {snippet.content}"
        )
    return "\n\n".join(sections)
