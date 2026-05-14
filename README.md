# X Mutual Follow Assistant

## Project Links

- English version: [X-Mutual-Follow-Assistant](https://github.com/fangdididi/X-Mutual-Follow-Assistant)
- Chinese version: [x-huguanzhushou](https://github.com/fangdididi/x-huguanzhushou)

A local Chrome MV3 extension for twitter/x.com. It shows a movable in-page control panel, visits the live search page, captures the real `SearchTimeline` response, filters posts by keyword, and decides whether each matched author should be followed and replied to.

## Features

- Movable in-page control panel that can collapse into a round icon
- Custom keyword, defaulting to `mutual follow`
- Local `.txt` comment library selected by clicking the comment file field
- Dry run mode enabled by default, so no follow or reply requests are sent until you disable it
- Loop mode with loop count and interval controls
- Optional blue-verified-only filter
- Skips your own posts, already-followed users, and users with unknown follow state
- Runs against the current browser page and signed-in session, following the real page flow to simulate manual operation
- Reads the comment file and settings locally. Comment libraries, logs, and account data are never uploaded to any project-owned or third-party service; the project includes no third-party API calls outside official twitter/x.com pages, APIs, and static assets
- Keeps the latest 500 operation logs
- Tracks followed and replied counts

## What's New in 0.3.2

- Improved stop handling so pending capture waits are interrupted faster, reducing timeout noise after Stop is clicked.
- Improved the initial panel state: the in-page panel now starts as a compact round X icon with cleaner expand, collapse, and drag behavior.
- Improved task continuity so mutual-follow runs and Followed Target Check can resume after a page refresh.

## What's New in 0.3.1

- Added the Followed Target Check tab for checking the following list by latest page, all pages, or a custom page count.
- Followed Target Check can either inspect only or unfollow accounts that do not follow you back, with checked, not-following-back, and unfollowed counters.
- Mutual follow runs now deduplicate by `userId` within each round, so multiple matched posts from the same author are handled only once.
- Following-list pagination now stops on terminal `0|...` cursors to avoid unnecessary page requests.
- Logs now append incrementally, and the background worker broadcasts only new log entries to reduce long-run UI lag.
- Countdown status updates are throttled, and long-running loops periodically reopen the page to release accumulated page resources.

## Installation

First, download the latest ZIP package:

- GitHub downloads: [X-Mutual-Follow-Assistant Releases](https://github.com/fangdididi/X-Mutual-Follow-Assistant/releases/latest)
- Gitee downloads: [X-Mutual-Follow-Assistant Releases](https://gitee.com/fanglongqing/x-mutual-follow-assistant/releases)

Download `x-mutual-follow-assistant-v*.zip`, extract it locally, then load the extracted folder:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the extracted extension folder
5. Open and sign in to twitter/x.com (`https://x.com`)
6. Click the extension icon, then click "Show Page Panel"
7. Set the keyword, choose a comment file, and click "Start"

## How It Works

The extension opens the twitter/x.com search page (`https://x.com/search?q=<keyword>&src=recent_search_click&f=live`) and waits for the page's real `SearchTimeline` API response. It parses the timeline entries and filters posts whose text contains your keyword.

For each matched post, it checks whether the post is yours, whether the author is already followed, and whether the author is blue verified when that option is enabled. In dry run mode it only logs planned actions. Real follow and reply requests are sent only after dry run mode is disabled.

## Notes

- The comment library is a local `.txt` file, one comment per line.
- This repository does not include a comment file.
- Keep dry run mode enabled until the logs confirm the logic is correct.
- Make sure the current Chrome profile is signed in to twitter/x.com before running.
- This project is under active maintenance and will continue to be improved based on real usage feedback.
