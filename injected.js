(function () {
  if (window.__xtaPageLoaded) {
    return;
  }

  window.__xtaPageLoaded = true;

  const FROM_CONTENT_SOURCE = 'xta-content';
  const TO_CONTENT_SOURCE = 'xta-page';
  const FOLLOW_URL = 'https://x.com/i/api/1.1/friendships/create.json';
  const CREATE_TWEET_URL = 'https://x.com/i/api/graphql/5CdvsV_zjv4L64XFifAglw/CreateTweet';
  const AUTHORIZATION = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  const DEFAULT_KEYWORD = 'mutual follow';
  const FOLLOW_TO_COMMENT_DELAY_SECONDS = 10;
  const AFTER_COMMENT_MIN_SECONDS = 30;
  const AFTER_COMMENT_MAX_SECONDS = 60;
  const SPACE_SCROLL_MIN = 2;
  const SPACE_SCROLL_MAX = 5;
  const AFTER_TIMELINE_CAPTURE_MIN_SECONDS = 5;
  const AFTER_TIMELINE_CAPTURE_MAX_SECONDS = 10;

  let stopRequested = false;
  let running = false;
  let capturedTimeline = null;
  const timelineWaiters = [];

  const createTweetFeatures = {
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    rweb_cashtags_composer_attachment_enabled: true,
    responsive_web_jetfuel_frame: true,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_grok_annotations_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    rweb_conversational_replies_downvote_enabled: false,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    content_disclosure_indicator_enabled: true,
    content_disclosure_ai_generated_indicator_enabled: true,
    responsive_web_grok_show_grok_translated_post: true,
    responsive_web_grok_analysis_button_from_backend: true,
    post_ctas_fetch_enabled: false,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: false,
    rweb_tipjar_consumption_enabled: false,
    verified_phone_label_enabled: false,
    articles_preview_enabled: true,
    rweb_cashtags_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true
  };

  function post(type, runId, payload) {
    window.postMessage({
      source: TO_CONTENT_SOURCE,
      type,
      runId,
      ...payload
    }, '*');
  }

  function log(runId, level, message, details = {}) {
    post('LOG', runId, { level, message, details });
  }

  function emitStatsDelta(runId, delta) {
    post('STATS_DELTA', runId, { delta });
  }

  function isSearchTimelineUrl(url) {
    const text = String(url || '');
    return text.includes('https://x.com/i/api/graphql/')
      && text.includes('SearchTimeline');
  }

  function rememberTimeline(url, status, text) {
    if (capturedTimeline) {
      return;
    }

    if (!text) {
      return;
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return;
    }

    capturedTimeline = {
      json,
      status,
      url: String(url),
      capturedAt: Date.now()
    };

    post('LOG', null, {
      level: 'success',
      message: 'Captured the real page SearchTimeline response',
      details: {
        StatusCode: status,
        URL: String(url).slice(0, 180)
      }
    });

    while (timelineWaiters.length > 0) {
      const waiter = timelineWaiters.shift();
      waiter.resolve(capturedTimeline);
    }
  }

  function installTimelineCapture() {
    if (window.__xtaTimelineCaptureInstalled) {
      return;
    }

    window.__xtaTimelineCaptureInstalled = true;

    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = async function patchedFetch(input, init) {
        const response = await originalFetch.apply(this, arguments);
        const url = input instanceof Request ? input.url : input;

        if (isSearchTimelineUrl(url)) {
          response.clone().text()
            .then((text) => rememberTimeline(url, response.status, text))
            .catch(() => {});
        }

        return response;
      };
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
      this.__xtaRequestUrl = url;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function patchedSend() {
      if (isSearchTimelineUrl(this.__xtaRequestUrl)) {
        this.addEventListener('loadend', () => {
          if (this.responseType && this.responseType !== 'text') {
            return;
          }

          rememberTimeline(this.__xtaRequestUrl, this.status, this.responseText);
        });
      }

      return originalSend.apply(this, arguments);
    };
  }

  installTimelineCapture();

  function getCookie(name) {
    const value = document.cookie
      .split('; ')
      .find((item) => item.startsWith(`${name}=`))
      ?.slice(name.length + 1);

    if (!value) {
      return '';
    }

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  async function getXClientTransactionId(inputUrl, method = 'GET') {
    let req;
    const chunk = globalThis.webpackChunk_twitter_responsive_web;

    if (!chunk?.push) {
      throw new Error('Cannot access the X page runtime. Refresh x.com and try again.');
    }

    chunk.push([
      [Date.now()],
      {},
      (webpackRequire) => {
        req = webpackRequire;
      }
    ]);

    const mod = req?.(991160);
    if (!mod?.kc) {
      throw new Error('Could not find the x-client-transaction-id generator module');
    }

    const url = new URL(inputUrl, location.origin);
    return mod.kc(
      url.host,
      `${url.pathname}${url.search}`,
      method.toUpperCase()
    );
  }

  function buildHeaders({ csrfToken, transactionId, contentType }) {
    return {
      accept: '*/*',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7,zh-TW;q=0.6,ru;q=0.5',
      authorization: AUTHORIZATION,
      'cache-control': 'no-cache',
      'content-type': contentType,
      pragma: 'no-cache',
      priority: 'u=1, i',
      'x-client-transaction-id': transactionId,
      'x-csrf-token': csrfToken,
      'x-twitter-active-user': 'yes',
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-client-language': 'zh-cn'
    };
  }

  function pushEntry(entries, entry) {
    if (!entry) {
      return;
    }

    entries.push(entry);

    const items = entry?.content?.items;
    if (!Array.isArray(items)) {
      return;
    }

    for (const item of items) {
      pushEntry(entries, item?.item || item);
    }
  }

  function collectEntries(responseJson) {
    const instructionSets = [
      responseJson?.data?.home?.home_timeline_urt?.instructions,
      responseJson?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions,
      responseJson?.data?.search_by_raw_query?.search_timeline?.instructions
    ].filter(Array.isArray);
    const entries = [];

    for (const instructions of instructionSets) {
      for (const instruction of instructions) {
        if (Array.isArray(instruction?.entries)) {
          for (const entry of instruction.entries) {
            pushEntry(entries, entry);
          }
        }

        if (instruction?.entry) {
          pushEntry(entries, instruction.entry);
        }
      }
    }

    return entries;
  }

  function getTweetResult(entry) {
    const itemContent = entry?.content?.itemContent
      || entry?.content?.item_content
      || entry?.item?.itemContent
      || entry?.item?.item_content;
    return itemContent?.tweet_results?.result || itemContent?.tweetResults?.result || null;
  }

  function textPreview(text) {
    return text.length > 120 ? `${text.slice(0, 120)}...` : text;
  }

  function extractCandidates(entries, keyword) {
    const candidates = [];

    for (const entry of entries) {
      const tweet = getTweetResult(entry);
      const fullText = tweet?.legacy?.full_text || '';

      if (!tweet || !fullText.includes(keyword)) {
        continue;
      }

      const user = tweet?.core?.user_results?.result;
      const following = user?.relationship_perspectives?.following;
      const tweetId = tweet?.legacy?.id_str || tweet?.rest_id || '';
      const userId = user?.rest_id || '';

      candidates.push({
        entryId: entry?.entryId || '',
        tweetId,
        userId,
        name: user?.core?.name || '',
        screenName: user?.core?.screen_name || '',
        following,
        isBlueVerified: user?.is_blue_verified === true,
        preview: textPreview(fullText)
      });
    }

    return candidates;
  }

  function isOwnTweet(candidate, twidCookie) {
    return Boolean(candidate?.userId)
      && String(twidCookie || '').includes(String(candidate.userId));
  }

  function isActionableCandidate(candidate, options = {}) {
    return !isOwnTweet(candidate, options.twidCookie)
      && (!options.onlyBlueVerified || candidate?.isBlueVerified === true)
      && candidate?.following === false
      && Boolean(candidate.userId)
      && Boolean(candidate.tweetId);
  }

  function buildFollowBody(userId) {
    return new URLSearchParams({
      include_profile_interstitial_type: '1',
      include_blocking: '1',
      include_blocked_by: '1',
      include_followed_by: '1',
      include_want_retweets: '1',
      include_mute_edge: '1',
      include_can_dm: '1',
      include_can_media_tag: '1',
      include_ext_is_blue_verified: '1',
      include_ext_verified_type: '1',
      include_ext_profile_image_shape: '1',
      skip_status: '1',
      user_id: userId
    }).toString();
  }

  function buildReplyBody(tweetId, commentText) {
    return JSON.stringify({
      variables: {
        tweet_text: commentText,
        reply: {
          in_reply_to_tweet_id: tweetId,
          exclude_reply_user_ids: []
        },
        media: {
          media_entities: [],
          possibly_sensitive: false
        },
        semantic_annotation_ids: [],
        disallowed_reply_options: null,
        semantic_annotation_options: {
          source: 'Unknown'
        }
      },
      features: createTweetFeatures,
      queryId: '5CdvsV_zjv4L64XFifAglw'
    });
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomSeconds(min, max) {
    return randomInt(min, max);
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function sleepWithStop(seconds, runId, message) {
    for (let remaining = seconds; remaining > 0; remaining -= 1) {
      if (stopRequested) {
        return false;
      }

      if (remaining === seconds || remaining % 10 === 0 || remaining <= 3) {
        log(runId, 'info', message, { RemainingSeconds: remaining });
      }

      await sleep(1000);
    }

    return !stopRequested;
  }

  async function simulateSpaceAccess(runId) {
    const count = randomSeconds(SPACE_SCROLL_MIN, SPACE_SCROLL_MAX);
    log(runId, 'info', 'Simulating space-key scrolling', { Count: count });

    await sleep(600);

    for (let index = 0; index < count; index += 1) {
      if (stopRequested) {
        return;
      }

      const target = document.activeElement || document.body || document.documentElement;
      const eventOptions = {
        key: ' ',
        code: 'Space',
        keyCode: 32,
        which: 32,
        bubbles: true,
        cancelable: true
      };

      target.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
      target.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
      target.dispatchEvent(new KeyboardEvent('keyup', eventOptions));

      window.scrollBy({
        top: Math.max(320, Math.floor(window.innerHeight * 0.75)),
        left: 0,
        behavior: 'smooth'
      });

      await sleep(randomInt(1000, 3000));
    }
  }

  async function waitForTimelineCapture(runId) {
    log(runId, 'info', 'Waiting for the real page SearchTimeline response', {
      Source: 'Page request after opening X live search'
    });

    if (capturedTimeline) {
      log(runId, 'success', 'Using captured SearchTimeline response', {
        StatusCode: capturedTimeline.status
      });
      return capturedTimeline.json;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error('Timed out waiting for SearchTimeline capture'));
      }, 60000);

      timelineWaiters.push({
        resolve: (timeline) => {
          window.clearTimeout(timeoutId);
          resolve(timeline.json);
        },
        reject
      });
    });
  }

  function xhrJsonRequest({ url, method, headers, body, actionName }) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.withCredentials = true;

      for (const [name, value] of Object.entries(headers)) {
        xhr.setRequestHeader(name, value);
      }

      xhr.onload = () => {
        const text = xhr.responseText || '';
        let json = {};

        if (text) {
          try {
            json = JSON.parse(text);
          } catch {
            if (xhr.status < 200 || xhr.status >= 300) {
              reject(new Error(`${actionName} failed, HTTP ${xhr.status}`));
              return;
            }
          }
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`${actionName} failed, HTTP ${xhr.status}`));
          return;
        }

        resolve(json);
      };

      xhr.onerror = () => reject(new Error(`${actionName} network error`));
      xhr.send(body);
    });
  }

  async function followUser(userId, csrfToken) {
    const transactionId = await getXClientTransactionId(FOLLOW_URL, 'POST');
    return xhrJsonRequest({
      url: FOLLOW_URL,
      method: 'POST',
      headers: buildHeaders({
        csrfToken,
        transactionId,
        contentType: 'application/x-www-form-urlencoded'
      }),
      body: buildFollowBody(userId),
      actionName: 'follow request'
    });
  }

  async function replyTweet(tweetId, commentText, csrfToken) {
    const transactionId = await getXClientTransactionId(CREATE_TWEET_URL, 'POST');
    return xhrJsonRequest({
      url: CREATE_TWEET_URL,
      method: 'POST',
      headers: buildHeaders({
        csrfToken,
        transactionId,
        contentType: 'application/json'
      }),
      body: buildReplyBody(tweetId, commentText),
      actionName: 'reply request'
    });
  }

  async function handleCandidate(candidate, options, csrfToken, counters, runId) {
    if (stopRequested) {
      return;
    }

    if (isOwnTweet(candidate, options.twidCookie)) {
      log(runId, 'info', 'Keyword matched, but this is your own post. Skipping', {
        User: candidate.screenName,
        UserId: candidate.userId,
        PostId: candidate.tweetId
      });
      return;
    }

    if (options.onlyBlueVerified && candidate.isBlueVerified !== true) {
      log(runId, 'info', 'Keyword matched, but the author is not blue verified. Skipping', {
        User: candidate.screenName,
        UserId: candidate.userId,
        PostId: candidate.tweetId
      });
      return;
    }

    if (candidate.following === true) {
      log(runId, 'info', 'Keyword matched, but the author is already followed. Skipping', {
        User: candidate.screenName,
        PostId: candidate.tweetId
      });
      return;
    }

    if (candidate.following !== false) {
      log(runId, 'warn', 'Keyword matched, but follow state is unknown. Skipping', {
        User: candidate.screenName,
        PostId: candidate.tweetId,
        State: String(candidate.following)
      });
      return;
    }

    if (!candidate.userId || !candidate.tweetId) {
      log(runId, 'warn', 'Keyword matched, but user or post ID is missing. Skipping', {
        UserId: candidate.userId,
        PostId: candidate.tweetId
      });
      return;
    }

    const commentText = randomItem(options.comments);

    if (options.testMode) {
      counters.plannedFollowCount += 1;
      counters.plannedCommentCount += 1;
      emitStatsDelta(runId, {
        plannedFollows: 1,
        plannedComments: 1
      });
      log(runId, 'success', 'Dry run: planned follow and reply', {
        User: candidate.screenName,
        UserId: candidate.userId,
        PostId: candidate.tweetId,
        BlueVerified: candidate.isBlueVerified ? 'Yes' : 'No',
        ReplyPreview: textPreview(commentText)
      });
      log(runId, 'success', 'Single item flow finished', {
        Mode: 'DryRun',
        User: candidate.screenName,
        PostId: candidate.tweetId
      });
      return;
    }

    try {
      await followUser(candidate.userId, csrfToken);
      counters.followedCount += 1;
      emitStatsDelta(runId, { followed: 1 });
      log(runId, 'success', 'Follow succeeded', {
        User: candidate.screenName,
        UserId: candidate.userId
      });
    } catch (error) {
      log(runId, 'error', 'Follow failed, skipping reply', {
        User: candidate.screenName,
        UserId: candidate.userId,
        Error: error.message
      });
      return;
    }

    const canComment = await sleepWithStop(FOLLOW_TO_COMMENT_DELAY_SECONDS, runId, 'Waiting after follow before reply');
    if (!canComment) {
      return;
    }

    try {
      await replyTweet(candidate.tweetId, commentText, csrfToken);
      counters.commentedCount += 1;
      emitStatsDelta(runId, { commented: 1 });
      log(runId, 'success', 'Reply succeeded', {
        User: candidate.screenName,
        PostId: candidate.tweetId,
        ReplyPreview: textPreview(commentText)
      });
    } catch (error) {
      log(runId, 'error', 'Reply failed', {
        User: candidate.screenName,
        PostId: candidate.tweetId,
        Error: error.message
      });
      return;
    }

    const waitSeconds = randomSeconds(AFTER_COMMENT_MIN_SECONDS, AFTER_COMMENT_MAX_SECONDS);
    await sleepWithStop(waitSeconds, runId, 'Random wait after reply');
    log(runId, 'success', 'Single item flow finished', {
      Mode: 'Live',
      User: candidate.screenName,
      PostId: candidate.tweetId
    });
  }

  async function runCycle(payload, runId) {
    if (!location.hostname.endsWith('x.com')) {
      throw new Error('Run this on a signed-in x.com page');
    }

    if (running) {
      throw new Error('A page task is already running');
    }

    const comments = Array.isArray(payload.comments)
      ? payload.comments.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const keyword = String(payload.keyword || DEFAULT_KEYWORD).trim() || DEFAULT_KEYWORD;

    if (comments.length === 0) {
      throw new Error('Comment library is empty');
    }

    const csrfToken = getCookie('ct0');
    if (!csrfToken) {
      throw new Error('Missing ct0 cookie. Sign in to x.com and refresh the page');
    }
    const twidCookie = getCookie('twid');

    running = true;
    stopRequested = false;

    const counters = {
      followedCount: 0,
      commentedCount: 0,
      plannedFollowCount: 0,
      plannedCommentCount: 0
    };

    try {
      log(runId, 'info', 'Round started', {
        DryRun: Boolean(payload.testMode),
        BlueVerifiedOnly: Boolean(payload.onlyBlueVerified),
        Keyword: keyword,
        TimelineSource: 'Real page SearchTimeline capture',
        CommentCount: comments.length
      });

      const timeline = await waitForTimelineCapture(runId);
      const afterCaptureWaitSeconds = randomSeconds(
        AFTER_TIMELINE_CAPTURE_MIN_SECONDS,
        AFTER_TIMELINE_CAPTURE_MAX_SECONDS
      );
      const canContinueAfterCapture = await sleepWithStop(
        afterCaptureWaitSeconds,
        runId,
        'Waiting after timeline response before scrolling'
      );

      if (!canContinueAfterCapture) {
        return {
          stopped: true,
          entriesCount: 0,
          matchedCount: 0,
          actionableCount: 0,
          ...counters
        };
      }

      await simulateSpaceAccess(runId);

      const entries = collectEntries(timeline);
      const candidates = extractCandidates(entries, keyword);
      const actionOptions = {
        onlyBlueVerified: Boolean(payload.onlyBlueVerified),
        twidCookie
      };
      const actionableCount = candidates.filter((candidate) => (
        isActionableCandidate(candidate, actionOptions)
      )).length;

      log(runId, 'success', 'Timeline parsing completed', {
        Entries: entries.length,
        Matches: candidates.length,
        ActionableItems: actionableCount
      });

      for (const candidate of candidates) {
        if (stopRequested) {
          break;
        }

        await handleCandidate(candidate, {
          testMode: Boolean(payload.testMode),
          onlyBlueVerified: Boolean(payload.onlyBlueVerified),
          twidCookie,
          comments
        }, csrfToken, counters, runId);
      }

      const result = {
        stopped: stopRequested,
        entriesCount: entries.length,
        matchedCount: candidates.length,
        actionableCount,
        ...counters
      };

      log(runId, 'success', 'Round flow completed', {
        Stopped: result.stopped ? 'Yes' : 'No',
        TimelineEntries: result.entriesCount,
        MatchedItems: result.matchedCount,
        ActionableItems: result.actionableCount,
        FollowedThisRound: result.followedCount,
        RepliedThisRound: result.commentedCount,
        PlannedFollows: result.plannedFollowCount,
        PlannedReplies: result.plannedCommentCount
      });

      return result;
    } finally {
      running = false;
    }
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.data?.source !== FROM_CONTENT_SOURCE) {
      return;
    }

    const { type, runId, payload } = event.data;

    if (type === 'STOP') {
      stopRequested = true;
      return;
    }

    if (type !== 'RUN_CYCLE') {
      return;
    }

    try {
      const result = await runCycle(payload || {}, runId);
      post('RESULT', runId, { result });
    } catch (error) {
      running = false;
      log(runId, 'error', error.message, {});
      post('ERROR', runId, { error: error.message });
    }
  });
})();
