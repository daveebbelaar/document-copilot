"""
SEC HTML to clean text/markdown parser using standard library html.parser.
"""
from __future__ import annotations

import html
import re
from html.parser import HTMLParser

# Regex to detect standard SEC 10-K Item headings (e.g. "ITEM 1. BUSINESS", "Item 1A: Risk Factors")
# Allows optional leading horizontal space and uses [^\r\n] so it never spans across newlines.
ITEM_PATTERN = re.compile(
    r"^[ \t]*(Item\s+(?:1[A-C]?|[2-9]|1[0-5])[\.\:\t \-]+[A-Za-z\[][^\r\n]{2,120})$",
    re.IGNORECASE | re.MULTILINE,
)


class SECHTMLParser(HTMLParser):
    """
    Strips inline XBRL/HTML markup while preserving document structure and tables.
    Uses standard library only — no external dependency.
    """

    def __init__(self) -> None:
        super().__init__()
        self.text_parts: list[str] = []
        self._skip_depth: int = 0
        self._skip_tags: set[str] = {
            "style",
            "script",
            "head",
            "ix:header",
            "ix:hidden",
            "noscript",
        }
        self._heading_depth: int = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag_lower = tag.lower()
        if tag_lower in self._skip_tags:
            self._skip_depth += 1
            return

        if self._skip_depth > 0:
            return

        if tag_lower in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.text_parts.append("\n\n## ")
            self._heading_depth += 1
        elif tag_lower in ("p", "div", "section", "article"):
            self.text_parts.append("\n\n")
        elif tag_lower == "br":
            self.text_parts.append("\n")
        elif tag_lower == "tr":
            self.text_parts.append("\n| ")
        elif tag_lower in ("td", "th"):
            self.text_parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()
        if tag_lower in self._skip_tags:
            self._skip_depth = max(0, self._skip_depth - 1)
            return

        if self._skip_depth > 0:
            return

        if tag_lower in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.text_parts.append("\n\n")
            self._heading_depth = max(0, self._heading_depth - 1)
        elif tag_lower in ("p", "div", "section", "article"):
            self.text_parts.append("\n")
        elif tag_lower in ("td", "th"):
            self.text_parts.append(" |")

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0 and data:
            self.text_parts.append(data)

    def get_clean_text(self) -> str:
        """Post-process accumulated parts into clean markdown text."""
        raw = "".join(self.text_parts)
        # Unescape HTML entities (&amp;, &nbsp;, &#160;, etc.)
        unescaped = html.unescape(raw)
        # Replace non-breaking spaces with standard space
        unescaped = unescaped.replace("\xa0", " ").replace("\u200b", "")

        # Normalize line-by-line whitespace
        lines: list[str] = []
        for line in unescaped.splitlines():
            cleaned = re.sub(r"[ \t]+", " ", line).strip()
            if cleaned:
                lines.append(cleaned)
            elif lines and lines[-1] != "":
                # Keep a single blank line between paragraphs
                lines.append("")

        text = "\n".join(lines).strip()
        # Collapse excessive newlines
        return re.sub(r"\n{3,}", "\n\n", text)


def parse_sec_html(raw_html: str) -> str:
    """Parse raw SEC EDGAR HTML/inline XBRL into clean text."""
    parser = SECHTMLParser()
    parser.feed(raw_html)
    return parser.get_clean_text()


def split_into_sections(text: str) -> list[tuple[str, str]]:
    """
    Split a 10-K filing into named sections based on ITEM headers.

    Returns a list of tuples: (section_title, section_text).
    If no ITEM headers are found, returns [("Full Document", text)].
    """
    matches = list(ITEM_PATTERN.finditer(text))
    if not matches:
        return [("Full Document", text)]

    sections: list[tuple[str, str]] = []

    # Text before the first ITEM header (preamble, cover page)
    if matches[0].start() > 0:
        preamble = text[: matches[0].start()].strip()
        if preamble:
            sections.append(("Cover Page / Preamble", preamble))

    for i, match in enumerate(matches):
        section_title = match.group(1).strip()
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        section_body = text[start:end].strip()
        sections.append((section_title, section_body))

    return sections
