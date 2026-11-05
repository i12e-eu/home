#!/usr/bin/env python3
"""Version the homepage stylesheet URL without changing the stylesheet itself."""

import argparse
import hashlib
import html
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import unquote_plus, urlsplit, urlunsplit


ATTRIBUTE = re.compile(
    r"(?P<name>[^\s/>=]+)(?:\s*=\s*(?:\"(?P<double>[^\"]*)\""
    r"|'(?P<single>[^']*)'|(?P<unquoted>[^\s>]+)))?"
)
LOCAL_STYLES = {"styles.css", "./styles.css", "/styles.css"}


class StylesheetReference(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=False)
        self.offsets = [0]
        for line in source.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.references = []
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag != "link" or "stylesheet" not in (attributes.get("rel") or "").lower().split():
            return
        href = attributes.get("href")
        if href is None:
            return
        url = urlsplit(href)
        if url.scheme or url.netloc or url.path not in LOCAL_STYLES:
            return

        start_tag = self.get_starttag_text()
        tag_end = re.match(r"<\s*link\b", start_tag, re.IGNORECASE).end()
        line, column = self.getpos()
        tag_offset = self.offsets[line - 1] + column
        for match in ATTRIBUTE.finditer(start_tag, tag_end):
            if match.group("name").lower() != "href":
                continue
            for value in ("double", "single", "unquoted"):
                if match.group(value) is not None:
                    start, end = match.span(value)
                    self.references.append((tag_offset + start, tag_offset + end))
                    break


def versioned_html(source: str, version: str) -> str:
    """Replace only the local stylesheet's v parameter, preserving other URL parts."""
    references = StylesheetReference(source).references
    if len(references) != 1:
        raise ValueError(f"Expected one local styles.css stylesheet reference; found {len(references)}")
    start, end = references[0]
    raw_href = source[start:end]
    href = html.unescape(raw_href)
    url = urlsplit(href)
    parameters = url.query.split("&") if url.query else []
    found = False
    for index, parameter in enumerate(parameters):
        if unquote_plus(parameter.partition("=")[0]) == "v":
            parameters[index] = f"v={version}"
            found = True
    if not found:
        parameters.append(f"v={version}")
    updated = urlunsplit(url._replace(query="&".join(parameters)))
    if updated == href:
        return source
    return source[:start] + html.escape(updated, quote=True) + source[end:]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="report a stale version without writing files")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    try:
        version = hashlib.sha256((root / "styles.css").read_bytes()).hexdigest()[:12]
        index = root / "index.html"
        source = index.read_bytes().decode("utf-8")
        updated = versioned_html(source, version)
        if updated == source:
            print(f"Stylesheet version is current ({version}).")
            return 0
        if args.check:
            print(f"Stylesheet version is stale; run {Path(__file__).name} to update it.", file=sys.stderr)
            return 1
        index.write_bytes(updated.encode("utf-8"))
        print(f"Updated the homepage stylesheet version to {version}.")
        return 0
    except (OSError, UnicodeError, ValueError) as error:
        print(f"Cannot version the homepage stylesheet: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
