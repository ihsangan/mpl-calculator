#!/usr/bin/env python3
"""
Liquipedia Match Schedule & Score Synchronizer
Fetches match results and revision timestamps from Liquipedia MediaWiki Revisions API
and synchronizes schedule and scores for MPL Indonesia (ID), Philippines (PH), and Malaysia (MY).
"""

import argparse
import gzip
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

API_BASE_URL = "https://liquipedia.net/mobilelegends/api.php"
DEFAULT_USER_AGENT = "MPL-Sync-Script/1.0 (https://github.com/ihsangan/mpl-shadcn; contact: developer@example.com)"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

LEAGUES_CONFIG: Dict[str, Dict[str, Any]] = {
    "id": {
        "name": "Indonesia",
        "title": "MPL/Indonesia/Season_18/Regular_Season",
        "file": os.path.join(SCRIPT_DIR, "src", "schedule-id.json"),
        "default_league_name": "MPL Indonesia Season 18",
    },
    "ph": {
        "name": "Philippines",
        "title": "MPL/Philippines/Season_18/Regular_Season",
        "file": os.path.join(SCRIPT_DIR, "src", "schedule-ph.json"),
        "default_league_name": "MPL Philippines Season 18",
    },
    "my": {
        "name": "Malaysia",
        "title": "MPL/Malaysia/Season_18/Regular_Season",
        "file": os.path.join(SCRIPT_DIR, "src", "schedule-my.json"),
        "default_league_name": "MPL Malaysia Season 18",
    },
}

# Map Liquipedia team names to project team IDs across ID, PH, and MY
TEAM_MAP: Dict[str, str] = {
    # --- INDONESIA (ID) ---
    "team liquid id": "TLID",
    "tlid": "TLID",
    "liquid id": "TLID",
    "liquid": "TLID",
    "onic": "ONIC",
    "onic esports": "ONIC",
    "fnatic onic": "ONIC",
    "dewa united esports": "DEWA",
    "dewa united": "DEWA",
    "dewa": "DEWA",
    "alter ego": "AE",
    "alter ego esports": "AE",
    "ae": "AE",
    "bigetron by vitality": "BTR",
    "bigetron vitality": "BTR",
    "bigetron esports": "BTR",
    "bigetron": "BTR",
    "btr": "BTR",
    "evos": "EVOS",
    "evos esports": "EVOS",
    "evos glory": "EVOS",
    "natus vincere": "NAVI",
    "navi": "NAVI",
    "geek fam id": "GEEK",
    "geek fam": "GEEK",
    "geek": "GEEK",
    "rrq hoshi": "RRQ",
    "rrq": "RRQ",
    # --- PHILIPPINES (PH) ---
    "ap.bren": "APBR",
    "apbren": "APBR",
    "bren": "APBR",
    "aurora gaming ph": "RORA",
    "aurora gaming": "RORA",
    "aurora ph": "RORA",
    "aurora": "RORA",
    "rora": "RORA",
    "team falcons ph": "FLCN",
    "falcons ph": "FLCN",
    "falcons": "FLCN",
    "flcn": "FLCN",
    "onic philippines": "ONIC",
    "onic ph": "ONIC",
    "fnatic onic ph": "ONIC",
    "onph": "ONIC",
    "omega esports": "OMG",
    "smart omega": "OMG",
    "omega": "OMG",
    "omg": "OMG",
    "team liquid ph": "TLPH",
    "liquid ph": "TLPH",
    "tlph": "TLPH",
    "twisted minds ph": "TWIS",
    "twisted minds": "TWIS",
    "twisted": "TWIS",
    "twis": "TWIS",
    "tnc pro team": "TNC",
    "tnc": "TNC",
    # --- MALAYSIA (MY) ---
    "ac esports": "AC",
    "ac": "AC",
    "bigetron my by vit": "BTRM",
    "bigetron my": "BTRM",
    "btrm": "BTRM",
    "invictus gaming": "iG",
    "invictus": "iG",
    "ig": "iG",
    "team rey": "TR",
    "rey": "TR",
    "tr": "TR",
    "team vamos": "VMS",
    "vamos": "VMS",
    "vms": "VMS",
    "rrq tora": "RRQ",
    "rrqt": "RRQ",
    "selangor red giants": "SRG",
    "selangor red giant": "SRG",
    "srg": "SRG",
    "team flash": "FL",
    "flash": "FL",
    "fl": "FL",
}


def normalize_team(name: str) -> str:
    """Normalize raw team name from Liquipedia to project team ID."""
    clean = name.strip().lower()
    return TEAM_MAP.get(clean, name.strip().upper())


def normalize_title(title: str) -> str:
    """Normalize page title for consistent matching (spaces and underscores)."""
    return title.replace(" ", "_").strip().lower()


def fetch_pages_batch(
    titles: List[str], user_agent: str
) -> Dict[str, Dict[str, Any]]:
    """
    Fetch wikitext content and revision timestamp for multiple page titles in a single HTTP request.
    Returns a dict mapping normalized title -> {'wikitext': str, 'timestamp': str, 'raw_title': str}.
    """
    titles_param = "|".join(titles)
    encoded_titles = urllib.parse.quote(titles_param)
    url = (
        f"{API_BASE_URL}?action=query&prop=revisions&titles={encoded_titles}"
        f"&rvprop=content|timestamp&rvslots=main&format=json"
    )

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept-Encoding": "gzip",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            if (
                response.info().get("Content-Encoding") == "gzip"
                or raw[:2] == b"\x1f\x8b"
            ):
                raw = gzip.decompress(raw)
            data = json.loads(raw.decode("utf-8"))

            if "error" in data:
                raise RuntimeError(f"Liquipedia API Error: {data['error']}")

            pages = data.get("query", {}).get("pages", {})
            results: Dict[str, Dict[str, Any]] = {}

            for pid, pdata in pages.items():
                if pid == "-1":
                    raw_title = pdata.get("title", "")
                    print(
                        f"Warning: Page '{raw_title}' not found on Liquipedia",
                        file=sys.stderr,
                    )
                    continue

                raw_title = pdata.get("title", "")
                revs = pdata.get("revisions", [])
                if not revs:
                    continue

                rev = revs[0]
                timestamp = rev.get("timestamp", "")
                content = rev.get("slots", {}).get("main", {}).get("*", "")
                if not content:
                    content = rev.get("*", "")

                results[normalize_title(raw_title)] = {
                    "wikitext": content,
                    "timestamp": timestamp,
                    "raw_title": raw_title,
                }

            return results
    except urllib.error.HTTPError as e:
        if e.code == 406:
            raise RuntimeError(
                "HTTP 406: Liquipedia requires gzip encoding and a descriptive User-Agent."
            ) from e
        raise


def parse_schedule_from_wikitext(wikitext: str) -> List[Dict[str, Any]]:
    """Parse all matches, days, teams, and scores from Liquipedia wikitext."""
    # Find all Week sections (e.g. ==={{HiddenSort|RS: Week 1}}=== or === Week 1 ===)
    week_sections = re.findall(
        r"==+.*?Week\s*(\d+).*?==+([\s\S]*?)(?===+.*?Week|\Z)",
        wikitext,
        re.IGNORECASE,
    )

    all_matches: List[Dict[str, Any]] = []

    for week_str, content in week_sections:
        week_num = int(week_str)

        # Map match indices to Day numbers (e.g. |M1header=Day 1|M3header=Day 2|M6header=Day 3)
        headers = re.findall(r"\|M(\d+)header=Day\s*(\d+)", content)
        day_starts = {int(m): int(d) for m, d in headers}
        current_day = 1

        day_match_count: Dict[int, int] = {}

        # Split content by match templates: |M1={{Match ...
        parts = re.split(r"\|M(\d+)=\{\{Match", content)
        for i in range(1, len(parts), 2):
            m_num = int(parts[i])
            m_body = parts[i + 1]

            if m_num in day_starts:
                current_day = day_starts[m_num]

            day_match_count[current_day] = day_match_count.get(current_day, 0) + 1
            m_in_day = day_match_count[current_day]

            # Extract opponent teams
            opp1_match = re.search(r"opponent1=\{\{TeamOpponent\|([^|\n}]+)", m_body)
            opp2_match = re.search(r"opponent2=\{\{TeamOpponent\|([^|\n}]+)", m_body)

            t1 = normalize_team(opp1_match.group(1) if opp1_match else "")
            t2 = normalize_team(opp2_match.group(1) if opp2_match else "")

            # Extract map winners to compute scores
            maps = re.findall(r"\|map\d+=\{\{Map[\s\S]*?\}\}", m_body)
            winners = [re.search(r"\|winner=([12])", mp) for mp in maps]
            valid_winners = [w.group(1) for w in winners if w]

            score1 = valid_winners.count("1")
            score2 = valid_winners.count("2")

            match_id = f"w{week_num}d{current_day}m{m_in_day}"

            all_matches.append(
                {
                    "id": match_id,
                    "teamA": t1,
                    "teamB": t2,
                    "scoreA": score1,
                    "scoreB": score2,
                }
            )

    return all_matches


def process_league_data(
    league_key: str,
    wikitext: str,
    revision_timestamp: str,
    dry_run: bool = False,
) -> Tuple[bool, str, int, int]:
    """
    Process wikitext and revision timestamp for a league and update its JSON file.
    Returns (is_modified, file_path, updated_count, total_matches).
    """
    config = LEAGUES_CONFIG[league_key.lower()]
    target_file = config["file"]
    league_name = config["name"]

    parsed_matches = parse_schedule_from_wikitext(wikitext)
    print(f"\n[{league_name.upper()}] Parsed {len(parsed_matches)} matches")

    if not parsed_matches:
        raise ValueError(f"No matches could be parsed for {league_name}")

    # Load existing JSON file if present
    if os.path.exists(target_file):
        with open(target_file, "r", encoding="utf-8") as f:
            existing_data = json.load(f)
    else:
        existing_data = {
            "LEAGUE_NAME": config["default_league_name"],
            "CURRENT_WEEK": 1,
            "LAST_UPDATED": "",
            "ALL_MATCHES": [],
        }

    existing_matches = {m["id"]: m for m in existing_data.get("ALL_MATCHES", [])}

    updated_count = 0
    matchup_changed_count = 0
    played_count = 0
    final_matches: List[Dict[str, Any]] = []

    print("=" * 65)
    print(
        f"{'MATCH ID':<10} {'MATCHUP':<25} {'OLD':<10} {'NEW':<10} {'STATUS'}"
    )
    print("=" * 65)

    for match in parsed_matches:
        m_id = match["id"]
        old_match = existing_matches.get(m_id)

        old_score = (
            f"{old_match['scoreA']}-{old_match['scoreB']}" if old_match else "N/A"
        )
        new_score = f"{match['scoreA']}-{match['scoreB']}"

        is_played = match["scoreA"] > 0 or match["scoreB"] > 0
        if is_played:
            played_count += 1

        matchup_changed = old_match and (
            old_match["teamA"] != match["teamA"]
            or old_match["teamB"] != match["teamB"]
        )
        score_changed = not old_match or (
            old_match["scoreA"] != match["scoreA"]
            or old_match["scoreB"] != match["scoreB"]
        )

        if matchup_changed:
            matchup_changed_count += 1
            status = "MATCHUP CHANGED"
        elif score_changed:
            updated_count += 1
            status = "SCORE UPDATED" if old_match else "NEW MATCH"
        else:
            status = "UNCHANGED"

        if matchup_changed or score_changed or is_played:
            matchup = f"{match['teamA']} vs {match['teamB']}"
            print(
                f"{m_id:<10} {matchup:<25} {old_score:<10} {new_score:<10} {status}"
            )

        final_matches.append(match)

    print("=" * 65)

    # Determine current week (first week with unplayed matches, or maximum week)
    current_week = 1
    for m in final_matches:
        if m["scoreA"] == 0 and m["scoreB"] == 0:
            current_week = int(m["id"].split("d")[0][1:])
            break

    # Use Liquipedia revision timestamp for LAST_UPDATED
    last_updated = (
        revision_timestamp
        if revision_timestamp
        else datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    )

    # Check if there are actual modifications compared to file on disk
    is_modified = (
        updated_count > 0
        or matchup_changed_count > 0
        or len(final_matches) != len(existing_data.get("ALL_MATCHES", []))
        or existing_data.get("CURRENT_WEEK") != current_week
        or existing_data.get("LAST_UPDATED") != last_updated
    )

    output_data = {
        "LEAGUE_NAME": existing_data.get(
            "LEAGUE_NAME", config["default_league_name"]
        ),
        "CURRENT_WEEK": current_week,
        "LAST_UPDATED": last_updated,
        "ALL_MATCHES": final_matches,
    }

    if not dry_run:
        with open(target_file, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2)
            f.write("\n")
        print(f"[{league_name.upper()}] Written to {target_file}")
        print(f"[{league_name.upper()}] Current Week: Week {current_week}")
        print(f"[{league_name.upper()}] Last Updated: {last_updated}")
    else:
        print(
            f"[DRY RUN] [{league_name.upper()}] No changes written to {target_file}"
        )

    print(
        f"[{league_name.upper()}] Played: {played_count}/{len(final_matches)} | Updates: {updated_count + matchup_changed_count}"
    )

    return (
        is_modified,
        target_file,
        (updated_count + matchup_changed_count),
        len(final_matches),
    )


def git_commit_and_push(changed_files: List[str]):
    """Stage modified JSON files, commit, and push to remote."""
    if not changed_files:
        print("\nNo files modified. Skipping git commit & push.")
        return

    print("\n" + "=" * 65)
    print("GIT COMMIT & PUSH")
    print("=" * 65)

    rel_paths = [os.path.relpath(p, SCRIPT_DIR) for p in changed_files]
    print(f"Staging files: {', '.join(rel_paths)}")

    try:
        subprocess.run(["git", "add"] + changed_files, check=True, cwd=SCRIPT_DIR)

        commit_msg = f"chore(data): sync league schedule and scores from Liquipedia\n\nUpdated: {', '.join(rel_paths)}"
        print(f"Committing changes...")
        res = subprocess.run(
            ["git", "commit", "-m", commit_msg],
            capture_output=True,
            text=True,
            cwd=SCRIPT_DIR,
        )

        if res.returncode != 0:
            if "nothing to commit" in res.stdout or "nothing to commit" in res.stderr:
                print("Working tree clean (no new changes to commit).")
                return
            print(f"Commit error:\n{res.stderr}", file=sys.stderr)
            return

        print(res.stdout.strip())

        print("Pushing to remote...")
        push_res = subprocess.run(
            ["git", "push"],
            capture_output=True,
            text=True,
            cwd=SCRIPT_DIR,
        )

        if push_res.returncode == 0:
            print("Git push successful! 🚀")
        else:
            print(f"Git push error:\n{push_res.stderr}", file=sys.stderr)
    except Exception as e:
        print(f"Git operation failed: {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(
        description="Sync MPL match schedule and results from Liquipedia to JSON"
    )
    parser.add_argument(
        "--league",
        "-l",
        choices=["all", "id", "ph", "my"],
        default="all",
        help="League to sync: 'id', 'ph', 'my', or 'all' (default: all)",
    )
    parser.add_argument(
        "--push",
        action="store_true",
        help="Automatically git commit and push modified JSON files",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and parse without writing to files",
    )
    args = parser.parse_args()

    leagues_to_sync = (
        ["id", "ph", "my"] if args.league == "all" else [args.league]
    )

    # Collect page titles to fetch in a single batch request
    titles = [LEAGUES_CONFIG[k]["title"] for k in leagues_to_sync]

    print(
        f"Fetching {len(titles)} league page(s) from Liquipedia in 1 request..."
    )
    batch_data = fetch_pages_batch(titles, DEFAULT_USER_AGENT)
    print(f"Successfully received data for {len(batch_data)} page(s)")

    changed_files: List[str] = []

    for league in leagues_to_sync:
        cfg = LEAGUES_CONFIG[league]
        title_key = normalize_title(cfg["title"])
        page_info = batch_data.get(title_key)

        if not page_info:
            print(
                f"Error: Missing API data for league '{league}' (title: {cfg['title']})",
                file=sys.stderr,
            )
            continue

        try:
            is_mod, file_path, _, _ = process_league_data(
                league_key=league,
                wikitext=page_info["wikitext"],
                revision_timestamp=page_info["timestamp"],
                dry_run=args.dry_run,
            )
            if is_mod and not args.dry_run:
                changed_files.append(file_path)
        except Exception as e:
            print(f"\nError processing league '{league}': {e}", file=sys.stderr)

    if args.push and not args.dry_run:
        git_commit_and_push(changed_files)


if __name__ == "__main__":
    main()
