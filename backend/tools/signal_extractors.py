import re

def detect_pricing_signals(text: str):
    """Basic heuristic for pricing signals."""
    patterns = [r"\$\d+", r"pricing", r"subscription", r"free trial", r"freemium"]
    found = []
    for p in patterns:
        if re.search(p, text, re.I):
            found.append(p)
    return found

def detect_positioning_signals(text: str):
    """Basic heuristic for positioning signals."""
    patterns = [r"leader", r"first", r"platform", r"solution", r"revolutionize"]
    found = []
    for p in patterns:
        if re.search(p, text, re.I):
            found.append(p)
    return found

def detect_review_signals(text: str):
    """Basic heuristic for review/sentiment signals."""
    patterns = [r"worst", r"best", r"issue", r"bug", r"love", r"hate"]
    found = []
    for p in patterns:
        if re.search(p, text, re.I):
            found.append(p)
    return found
