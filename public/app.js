const API = "";
const MAX_PROFILE_PDF_BYTES = 40 * 1024 * 1024;
const LOCAL_STATE_KEY = "slezzuk_local_state_v1";

const DEFAULT_ENABLED_CHANNEL_IDS = ["pm", "ios", "server", "frontend", "data"];
const DEFAULT_PROFILE = {
  resume: "",
  portfolio: "",
  skills: "PM, 서비스기획, 데이터분석, iOS, Swift, 서버개발, API",
  preferences: "성장 가능성, 좋은 동료, 명확한 역할, 합리적인 연봉",
};
const DEFAULT_PROFILE_ANALYSIS = {
  status: "not_started",
  attempts: 0,
  locked: false,
  lastError: "",
  sourceDocument: null,
  extractedText: "",
  convertedJsonText: "",
  result: null,
  model: "",
  attemptedAt: "",
  completedAt: "",
};
const DIRECT_CHANNEL = {
  id: "direct",
  name: "direct-parsing",
  query: "",
  subtitle: "채용공고 URL을 붙여넣으면 thread로 파싱",
  bookmarks: ["URL parser", "Raw posting", "Thread"],
  source: "system",
  protected: true,
};

let channels = [];

const reactionTypes = [
  { key: "watch", emoji: "👀", label: "관심 있음" },
  { key: "candidate", emoji: "⭐", label: "지원 후보" },
  { key: "salary", emoji: "💰", label: "연봉 좋음" },
];
const validReactionKeys = new Set(reactionTypes.map((reaction) => reaction.key));

const state = {
  activeMode: "channel",
  activeChannel: "pm",
  activeDm: null,
  activeLaterReaction: "watch",
  jobs: { direct: [] },
  savedJobs: {},
  channelCatalog: [],
  enabledChannelIds: [],
  customChannels: [],
  classifications: {},
  notes: {},
  profile: {},
  profileAnalysis: {},
  profileUploading: false,
  profileUploadError: "",
  profileSelectedFileName: "",
  selectedJob: null,
  loading: false,
  searchBotMessages: [],
};

let threadRenderToken = 0;

const appShell = document.querySelector(".app-shell");
const channelList = document.querySelector("#channels");
const directList = document.querySelector("#directs");
const messageList = document.querySelector("#messageList");
const channelTitle = document.querySelector("#channelTitle");
const channelSubtitle = document.querySelector("#channelSubtitle");
const memberCount = document.querySelector("#memberCount");
const bookmarks = document.querySelector("#bookmarks");
const messageInput = document.querySelector("#messageInput");
const composer = document.querySelector("#composer");
const threadPanel = document.querySelector("#threadPanel");
const threadBody = document.querySelector("#threadBody");
const threadChannel = document.querySelector("#threadChannel");
const closeThread = document.querySelector("#closeThread");
const threadReply = document.querySelector("#threadReply");
const threadInput = document.querySelector("#threadInput");
const laterRailButton = document.querySelector("#laterRailButton");
const searchTrigger = document.querySelector("#searchTrigger");
const searchOverlay = document.querySelector("#searchOverlay");
const searchInput = document.querySelector("#searchInput");
const searchResults = document.querySelector("#searchResults");
const channelOverlay = document.querySelector("#channelOverlay");
const channelManager = document.querySelector("#channelManager");
const channelFilter = document.querySelector("#channelFilter");
const channelManagerSummary = document.querySelector("#channelManagerSummary");
const closeChannelManager = document.querySelector("#closeChannelManager");

async function parseApiResponse(res) {
  const contentType = res.headers.get("Content-Type") || "";
  const raw = await res.text();
  let data = {};
  if (raw && contentType.includes("application/json")) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw };
    }
  } else if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw };
    }
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function api(path, options = {}) {
  return fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  }).then(parseApiResponse);
}

function uploadApi(path, body) {
  return fetch(`${API}${path}`, {
    method: "POST",
    body,
  }).then(parseApiResponse);
}

function currentChannel() {
  return channels.find((channel) => channel.id === state.activeChannel) || channels[0] || { ...DIRECT_CHANNEL };
}

function initials(name = "?") {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function colorFor(value = "") {
  const palette = ["#007a5a", "#1264a3", "#e01e5a", "#ecb22e", "#611f69", "#36c5f0"];
  return palette[value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length];
}

function escapeHtml(value = "") {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultLocalState() {
  return {
    version: 1,
    classifications: {},
    notes: {},
    profile: clone(DEFAULT_PROFILE),
    profileAnalysis: clone(DEFAULT_PROFILE_ANALYSIS),
    directParsedJobs: [],
    savedJobs: {},
    enabledChannelIds: [...DEFAULT_ENABLED_CHANNEL_IDS],
    customChannels: [],
  };
}

function readLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_STATE_KEY);
    if (!raw) return defaultLocalState();
    const parsed = JSON.parse(raw);
    return { ...defaultLocalState(), ...parsed };
  } catch (err) {
    console.warn("Failed to read local state", err);
    return defaultLocalState();
  }
}

function localStateSnapshot() {
  return {
    version: 1,
    classifications: normalizeClassifications(state.classifications),
    notes: state.notes,
    profile: state.profile,
    profileAnalysis: state.profileAnalysis,
    directParsedJobs: compactJobsForStorage(state.jobs.direct || []),
    savedJobs: compactSavedJobsForStorage(state.savedJobs),
    enabledChannelIds: state.enabledChannelIds,
    customChannels: state.customChannels,
  };
}

function normalizeClassifications(classifications = {}) {
  return Object.fromEntries(
    Object.entries(classifications)
      .map(([jobId, reactions]) => [
        jobId,
        [...new Set(Array.isArray(reactions) ? reactions : [])].filter((reaction) => validReactionKeys.has(reaction)),
      ])
      .filter(([, reactions]) => reactions.length)
  );
}

function compactAnalysisForStorage(analysis = {}) {
  const compact = { ...analysis };
  if (typeof compact.extractedText === "string" && compact.extractedText.length > 120000) {
    compact.extractedText = `${compact.extractedText.slice(0, 120000)}\n\n[브라우저 저장 공간 보호를 위해 이후 텍스트는 생략됨]`;
  }
  if (typeof compact.convertedJsonText === "string" && compact.convertedJsonText.length > 240000) {
    compact.convertedJsonText = `${compact.convertedJsonText.slice(0, 240000)}\n\n[브라우저 저장 공간 보호를 위해 이후 JSON 텍스트는 생략됨]`;
  }
  return compact;
}

function compactJobsForStorage(jobs = []) {
  return jobs.map((job) => {
    const compact = { ...job };
    if (compact.raw?.raw_text && compact.raw.raw_text.length > 60000) {
      compact.raw = {
        ...compact.raw,
        raw_text: `${compact.raw.raw_text.slice(0, 60000)}\n\n[브라우저 저장 공간 보호를 위해 이후 원문은 생략됨]`,
      };
    }
    return compact;
  });
}

function compactSavedJobsForStorage(savedJobs = {}) {
  return Object.fromEntries(
    Object.entries(savedJobs)
      .filter(([, job]) => job)
      .map(([jobId, job]) => [jobId, compactJobsForStorage([job])[0]])
  );
}

function saveLocalState() {
  const snapshot = localStateSnapshot();
  try {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    try {
      localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify({
        ...snapshot,
        profileAnalysis: compactAnalysisForStorage(snapshot.profileAnalysis),
      }));
      console.warn("Local state was saved in compact form", err);
    } catch (compactErr) {
      console.warn("Failed to save local state", compactErr);
    }
  }
}

function localTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function allLocalChannels() {
  return [...state.channelCatalog, ...state.customChannels];
}

function selectedClassifications(jobId) {
  return (state.classifications[jobId] || []).filter((reaction) => validReactionKeys.has(reaction));
}

function savedJobIds() {
  return Object.entries(state.classifications)
    .filter(([, reactions]) => reactions.some((reaction) => validReactionKeys.has(reaction)))
    .map(([jobId]) => jobId);
}

function knownJobMap() {
  const jobs = new Map();
  Object.values(state.savedJobs || {}).forEach((job) => {
    if (job?.id != null) jobs.set(String(job.id), job);
  });
  Object.values(state.jobs).flat().forEach((job) => {
    if (job?.id != null) jobs.set(String(job.id), job);
  });
  return jobs;
}

function rememberSavedJob(job) {
  if (job?.id == null) return;
  state.savedJobs[String(job.id)] = compactJobsForStorage([job])[0];
}

function reconcileSavedJobs() {
  state.classifications = normalizeClassifications(state.classifications);
  const classified = new Set(savedJobIds().map(String));
  Object.keys(state.savedJobs || {}).forEach((jobId) => {
    if (!classified.has(String(jobId))) delete state.savedJobs[jobId];
  });
  Object.values(state.jobs).flat().forEach((job) => {
    if (job?.id != null && classified.has(String(job.id))) rememberSavedJob(job);
  });
}

function rebuildChannels() {
  const enabled = new Set(state.enabledChannelIds);
  channels = allLocalChannels().filter((channel) => enabled.has(channel.id));
  channels.push({ ...DIRECT_CHANNEL });
  channels.forEach((channel) => {
    if (!state.jobs[channel.id]) state.jobs[channel.id] = [];
  });
}

function slugifyChannelId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || `channel-${Date.now()}`;
}

function normalizeLocalChannel(channel, source = "custom") {
  const query = String(channel.query || channel.name || "개발자").trim();
  const name = String(channel.name || query).trim();
  const rawBookmarks = channel.bookmarks || query;
  const bookmarks = Array.isArray(rawBookmarks)
    ? rawBookmarks
    : String(rawBookmarks).split(/[,/ ]+/).filter(Boolean);
  return {
    id: String(channel.id || `custom-${slugifyChannelId(query)}`).trim(),
    name,
    query,
    subtitle: String(channel.subtitle || `JobKorea ${query} 공고 피드`).trim(),
    bookmarks: bookmarks.slice(0, 8),
    category: channel.category || "사용자 추가",
    source,
    protected: Boolean(channel.protected),
  };
}

function jobRaw(job) {
  return job.raw || {};
}

function jobProfile(job) {
  return job.job_profile || {};
}

function jobSlackMessages(job) {
  return {
    message_title: "",
    message_body: "",
    thread_comment: "",
    thread_summary: "",
    key_points: [],
    ai_mode: "",
    model: "",
    generated_at: "",
    error: "",
    ...(job.slack_messages || {}),
  };
}

function jobCompany(job) {
  return jobProfile(job).company_name || jobRaw(job).company_name || job.company || "-";
}

function jobTitle(job) {
  return jobProfile(job).job_title || jobRaw(job).title || job.title || "Untitled posting";
}

function jobUrl(job) {
  return job.source_url || job.url || "";
}

function jobSource(job) {
  return job.source || "jobkorea";
}

function jobCareer(job) {
  return jobRaw(job).career || job.career || "공고";
}

function jobLocation(job) {
  return jobRaw(job).location || job.location || "-";
}

function jobPeriod(job) {
  return jobRaw(job).period || job.period || "-";
}

function jobKeywords(job) {
  const profile = jobProfile(job);
  return [
    ...(profile.responsibilities || []),
    ...(profile.required_skills || []),
    ...(profile.preferred_skills || []),
    ...(job.keywords || []),
  ].filter(Boolean);
}

function jobSearchText(job) {
  return `${jobCompany(job)} ${jobTitle(job)} ${jobCareer(job)} ${jobLocation(job)} ${jobKeywords(job).join(" ")}`;
}

function jobMessageText(job) {
  const slack = jobSlackMessages(job);
  if (slack.message_title || slack.message_body) return [slack.message_title, slack.message_body].filter(Boolean).join(" ");
  return `${jobCompany(job)} 채용공고를 불러왔습니다. Slack 메시지 변환 결과가 없으면 원문 JSON을 확인해 주세요.`;
}

async function boot() {
  await loadState();
  await loadChannels();
  if (!channels.some((channel) => channel.id === state.activeChannel)) {
    state.activeChannel = channels.find((channel) => channel.id !== "direct")?.id || channels[0]?.id || "direct";
  }
  if (window.__slezzukPendingMode === "later") state.activeMode = "later";
  render();
  await Promise.all(channels.filter((channel) => channel.id !== "direct").map((channel) => loadJobs(channel.id)));
  render();
}

async function loadState() {
  const data = readLocalState();
  state.classifications = normalizeClassifications(data.classifications || {});
  state.notes = data.notes || {};
  state.profile = { ...clone(DEFAULT_PROFILE), ...(data.profile || {}) };
  state.profileAnalysis = { ...clone(DEFAULT_PROFILE_ANALYSIS), ...(data.profileAnalysis || {}) };
  state.jobs.direct = data.directParsedJobs || [];
  state.savedJobs = data.savedJobs || {};
  state.enabledChannelIds = data.enabledChannelIds || [...DEFAULT_ENABLED_CHANNEL_IDS];
  state.customChannels = (data.customChannels || []).map((channel) => normalizeLocalChannel(channel, "custom"));
  reconcileSavedJobs();
}

async function loadChannels() {
  const data = await api("/api/channels");
  state.channelCatalog = (data.catalog || []).filter((channel) => channel.source !== "custom");
  const knownIds = new Set(allLocalChannels().map((channel) => channel.id));
  state.enabledChannelIds = state.enabledChannelIds.filter((channelId) => knownIds.has(channelId));
  if (!state.enabledChannelIds.length) state.enabledChannelIds = [...DEFAULT_ENABLED_CHANNEL_IDS].filter((channelId) => knownIds.has(channelId));
  rebuildChannels();
  saveLocalState();
}

async function loadJobs(channelId) {
  const channel = channels.find((item) => item.id === channelId);
  const path = channel?.source === "custom"
    ? `/api/search?q=${encodeURIComponent(channel.query || channel.name || channelId)}`
    : `/api/jobs?channel=${encodeURIComponent(channelId)}`;
  const data = await api(path).catch(() => ({ jobs: [] }));
  state.jobs[channelId] = data.jobs || [];
  reconcileSavedJobs();
  saveLocalState();
}

function render(options = {}) {
  renderSidebar();
  if (state.activeMode === "channel") renderChannel(options);
  else if (state.activeMode === "later") renderLater(options);
  else renderDm(options);
}

function renderPreservingMessageScroll() {
  const scrollTop = messageList.scrollTop;
  render({ preserveMessageScroll: true });
  requestAnimationFrame(() => {
    messageList.scrollTop = scrollTop;
  });
}

function renderSidebar() {
  channelList.innerHTML = channels.map((channel) => {
    const count = state.jobs[channel.id]?.length || 0;
    return `
      <button class="sidebar-row ${state.activeMode === "channel" && state.activeChannel === channel.id ? "active" : ""}" data-channel="${channel.id}">
        <span class="row-icon">#</span>
        <span class="row-label">${escapeHtml(channel.name)}</span>
        <span class="sidebar-count">${count}</span>
      </button>
    `;
  }).join("") + `
    <button class="sidebar-row channel-manage-row" id="openChannelManager">
      <span class="row-icon">＋</span>
      <span class="row-label">채널 관리</span>
    </button>
  `;

  const compactSection = document.querySelector(".sidebar-section.compact");
  if (compactSection) {
    compactSection.innerHTML = state.activeMode === "later" ? renderLaterSidebarRows() : renderDefaultSidebarRows();
  }

  const jobDms = Object.values(state.jobs).flat().slice(0, 12).map((job) => ({
    id: `job:${job.id}`,
    name: jobCompany(job),
    job,
  }));
  const fixed = [
    { id: "search", name: "Search", icon: "⌕" },
    { id: "profile", name: "Resume & Portfolio", icon: "📎" },
  ];

  directList.innerHTML = fixed.map((dm) => `
    <button class="sidebar-row ${state.activeMode === "dm" && state.activeDm === dm.id ? "active" : ""}" data-dm="${dm.id}">
      <span class="row-icon">${dm.icon}</span>
      <span class="row-label">${dm.name}</span>
    </button>
  `).join("") + jobDms.map((dm) => `
    <button class="sidebar-row ${state.activeMode === "dm" && state.activeDm === dm.id ? "active" : ""}" data-dm="${dm.id}">
      <span class="dm-avatar" style="background:${colorFor(dm.name)}">${initials(dm.name)}</span>
      <span class="status-dot active"></span>
      <span class="row-label">${dm.name}</span>
    </button>
  `).join("");

  renderRailState();
}

function renderDefaultSidebarRows() {
  return `
    <button class="sidebar-row">
      <span class="row-icon">▣</span>
      <span class="row-label">Threads</span>
      <span class="sidebar-count">3</span>
    </button>
    <button class="sidebar-row">
      <span class="row-icon">@</span>
      <span class="row-label">Mentions & reactions</span>
      <span class="sidebar-count urgent">2</span>
    </button>
    <button class="sidebar-row">
      <span class="row-icon">⌁</span>
      <span class="row-label">Drafts & sent</span>
    </button>
  `;
}

function renderLaterSidebarRows() {
  const groups = laterGroups();
  return groups.map((group) => `
    <button class="sidebar-row later-filter-row ${group.reaction.key === state.activeLaterReaction ? "active" : ""}" data-later-reaction="${group.reaction.key}">
      <span class="row-icon later-filter-emoji">${group.reaction.emoji}</span>
      <span class="row-label">${escapeHtml(group.reaction.label)}</span>
      <span class="sidebar-count">${group.jobs.length}</span>
    </button>
  `).join("");
}

function renderRailState() {
  appShell.classList.toggle("later-mode", state.activeMode === "later");
  document.querySelectorAll("[data-rail-home]").forEach((button) => {
    button.classList.toggle("active", state.activeMode === "channel");
    button.setAttribute("aria-pressed", String(state.activeMode === "channel"));
  });
  document.querySelectorAll("[data-rail-dms]").forEach((button) => {
    button.classList.toggle("active", state.activeMode === "dm");
    button.setAttribute("aria-pressed", String(state.activeMode === "dm"));
  });
  document.querySelectorAll("[data-later-view]").forEach((button) => {
    button.classList.toggle("active", state.activeMode === "later");
    button.setAttribute("aria-pressed", String(state.activeMode === "later"));
  });
}

function openLaterView(reactionKey = state.activeLaterReaction) {
  state.activeMode = "later";
  state.activeDm = null;
  if (reactionKey && validReactionKeys.has(reactionKey)) state.activeLaterReaction = reactionKey;
  window.__slezzukPendingMode = "later";
  closeThreadPanel();
  render();
}

window.JobKoreaVibeOpenLater = () => openLaterView();
window.addEventListener("slezzuk:open-later", () => openLaterView());

function renderChannel(options = {}) {
  const channel = currentChannel();
  const jobs = state.jobs[channel.id] || [];
  channelTitle.textContent = `# ${channel.name}`;
  channelSubtitle.textContent = channel.subtitle;
  memberCount.textContent = jobs.length;
  bookmarks.innerHTML = (channel.bookmarks || []).map((item) => `<button class="bookmark">${escapeHtml(item)}</button>`).join("");
  messageInput.placeholder = channel.id === "direct" ? "채용공고 URL 붙여넣기" : `Message #${channel.name}`;

  if (channel.id === "direct") {
    messageList.innerHTML = `
      ${channelIntro(channel, "URL을 composer에 붙여넣으면 서버가 공고 본문을 파싱해서 이 채널에 메시지로 추가합니다.")}
      <div class="day-divider"><span>Parsed postings</span></div>
      ${jobs.length ? bottomAnchoredItems(jobs).map(renderJobMessage).join("") : emptyBlock("아직 파싱된 URL이 없습니다.")}
    `;
    if (!options.preserveMessageScroll) scrollToBottom(messageList);
    return;
  }

  messageList.innerHTML = `
    ${channelIntro(channel, "JobKorea 크롤링 결과를 Slack 공유 메시지로 변환하고, 원문 JSON과 스레드 코멘트를 함께 보관합니다.")}
    <div class="job-toolbar">
      <button data-refresh="${channel.id}">JobKorea 새로고침</button>
    </div>
    <div class="day-divider"><span>${channel.query} results</span></div>
    ${jobs.length ? bottomAnchoredItems(jobs).map(renderJobMessage).join("") : emptyBlock("공고를 불러오는 중입니다.")}
  `;
  if (!options.preserveMessageScroll) scrollToBottom(messageList);
}

function renderLater(options = {}) {
  const groups = laterGroups();
  const total = savedJobIds().length;
  const activeGroup = groups.find((group) => group.reaction.key === state.activeLaterReaction) || groups[0];
  state.activeLaterReaction = activeGroup.reaction.key;
  channelTitle.textContent = "나중에 보기";
  channelSubtitle.textContent = "이모지로 저장한 공고를 태그별로 모아봅니다.";
  memberCount.textContent = total;
  bookmarks.innerHTML = "";
  messageInput.placeholder = "저장한 공고의 스레드에서 메모를 남길 수 있습니다.";

  messageList.innerHTML = `
    <section class="later-board">
      <header class="later-board-header">
        <div>
          <h2>나중에</h2>
          <nav class="later-tabs" aria-label="나중에 보기 분류">
            ${groups.map((group) => renderLaterTab(group, activeGroup.reaction.key)).join("")}
          </nav>
        </div>
        <div class="later-board-actions">
          <button type="button" title="필터">≡</button>
          <button type="button" title="추가">＋</button>
        </div>
      </header>
      <div class="later-list">
        ${activeGroup.jobs.length ? activeGroup.jobs.map((job) => renderLaterListItem(job, activeGroup.reaction)).join("") : renderLaterEmpty(activeGroup.reaction)}
      </div>
    </section>
  `;
  if (!options.preserveMessageScroll) scrollToTop(messageList);
}

function laterGroups() {
  const jobs = knownJobMap();
  return reactionTypes.map((reaction) => ({
    reaction,
    jobs: Object.entries(state.classifications)
      .filter(([, selected]) => selected.includes(reaction.key))
      .map(([jobId]) => jobs.get(String(jobId)))
      .filter(Boolean),
  }));
}

function renderLaterGroup(group) {
  return `
    <section class="later-group" id="later-${group.reaction.key}">
      <div class="later-group-header">
        <span>${group.reaction.emoji}</span>
        <div>
          <h3>${escapeHtml(group.reaction.label)}</h3>
          <p>${group.jobs.length}개 공고</p>
        </div>
      </div>
      ${group.jobs.length ? group.jobs.map(renderJobMessage).join("") : emptyBlock(`${group.reaction.emoji} 태그가 찍힌 공고가 없습니다.`)}
    </section>
  `;
}

function renderLaterTab(group, activeReactionKey) {
  return `
    <button type="button" class="later-tab ${group.reaction.key === activeReactionKey ? "active" : ""}" data-later-reaction="${group.reaction.key}">
      <span>${group.reaction.emoji}</span>
      <strong>${escapeHtml(group.reaction.label)}</strong>
      <small>${group.jobs.length}</small>
    </button>
  `;
}

function renderLaterCategoryButton(group, activeReactionKey) {
  return `
    <button class="later-category-button ${group.reaction.key === activeReactionKey ? "active" : ""}" data-later-reaction="${group.reaction.key}">
      <span>${group.reaction.emoji}</span>
      <strong>${escapeHtml(group.reaction.label)}</strong>
      <small>${group.jobs.length}개 공고</small>
    </button>
  `;
}

function renderLaterListItem(job, reaction) {
  const jobId = String(job.id);
  const company = jobCompany(job);
  const keywords = jobKeywords(job).slice(0, 3);
  return `
    <article class="later-list-item" data-job="${escapeHtml(jobId)}" tabindex="0" aria-label="${escapeHtml(company)} 공고 스레드 열기">
      <div class="later-list-source">${reaction.emoji} ${escapeHtml(jobSource(job))}</div>
      <button class="later-list-avatar" style="background:${colorFor(company)}" data-open-dm="${escapeHtml(jobId)}">${initials(company)}</button>
      <div class="later-list-main">
        <div class="later-list-title">
          <strong>${escapeHtml(company)}</strong>
          <span>${escapeHtml(jobTitle(job))}</span>
        </div>
        <p>${escapeHtml(jobMessageText(job))}</p>
        <div class="later-list-meta">
          <span>${escapeHtml(jobCareer(job))}</span>
          <span>${escapeHtml(jobLocation(job))}</span>
          ${keywords.map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join("")}
        </div>
      </div>
      <div class="later-list-actions">
        <button type="button" title="스레드" data-thread-job="${escapeHtml(jobId)}">◷</button>
        <button type="button" title="원문 열기" data-open-url="${escapeHtml(jobUrl(job))}">↗</button>
        <button type="button" title="더 보기">⋮</button>
      </div>
    </article>
  `;
}

function renderLaterEmpty(reaction) {
  return `
    <div class="later-empty">
      <span>${reaction.emoji}</span>
      <strong>${escapeHtml(reaction.label)}</strong>
      <p>이 이모지로 저장한 공고가 없습니다.</p>
    </div>
  `;
}

function channelIntro(channel, text) {
  return `
    <section class="channel-intro">
      <div class="intro-icon">#</div>
      <h2>${channel.name}</h2>
      <p>${text}</p>
      <div class="intro-meta">
        <span>JobKorea source</span>
        <span>Local notes</span>
        <span>Local matching</span>
      </div>
    </section>
  `;
}

function emptyBlock(text) {
  return `<div class="empty-thread">${text}</div>`;
}

function bottomAnchoredItems(items = []) {
  // Message surfaces always open at the bottom, so the source/API first item must render last.
  return [...items].reverse();
}

function topAnchoredItems(items = []) {
  return [...items];
}

function scrollToTop(element) {
  if (!element) return;
  requestAnimationFrame(() => {
    element.scrollTop = 0;
  });
}

function scrollToBottom(element) {
  if (!element) return;
  requestAnimationFrame(() => {
    element.scrollTop = element.scrollHeight;
  });
}

function renderJobMessage(job) {
  const jobId = String(job.id);
  const selected = selectedClassifications(jobId);
  const isThreadSelected = threadPanel.classList.contains("open") && String(state.selectedJob?.id) === jobId;
  const company = jobCompany(job);
  return `
    <article class="message job-message ${isThreadSelected ? "thread-selected" : ""}" data-job="${escapeHtml(jobId)}" tabindex="0" aria-label="${escapeHtml(jobCompany(job))} 공고 스레드 열기">
      <button class="message-avatar" style="background:${colorFor(company)}" data-open-dm="${escapeHtml(jobId)}">${initials(company)}</button>
      <div class="message-content">
        <div class="message-meta">
          <button class="message-name" data-open-dm="${escapeHtml(jobId)}">${escapeHtml(company)}</button>
          <span class="message-time">${escapeHtml(jobSource(job))}</span>
        </div>
        <div class="message-text">${escapeHtml(jobMessageText(job))}</div>
        ${renderJobCard(job)}
        <div class="reactions">
          ${reactionTypes.map((reaction) => `
            <button class="reaction ${selected.includes(reaction.key) ? "selected" : ""}" data-classify="${escapeHtml(jobId)}" data-reaction="${reaction.key}" title="${reaction.label}">
              <span>${reaction.emoji}</span><span>${reaction.label}</span>
            </button>
          `).join("")}
        </div>
        <button class="reply-summary" data-thread-job="${escapeHtml(jobId)}">
          <span>${(state.notes[job.id] || []).length} notes</span>
          <strong>View thread + AI match</strong>
        </button>
      </div>
      <div class="message-actions">
        <button title="DM" data-open-dm="${escapeHtml(jobId)}">💬</button>
        <button title="Thread" data-thread-job="${escapeHtml(jobId)}">↪</button>
        <button title="Open" data-open-url="${escapeHtml(jobUrl(job))}">↗</button>
      </div>
    </article>
  `;
}

function renderJobCard(job) {
  const url = jobUrl(job);
  return `
    <div class="job-json-card">
      <div class="json-card-head">
        <div>
          <span class="job-source">${escapeHtml(jobSource(job))}</span>
          <h3>${escapeHtml(jobTitle(job))}</h3>
        </div>
        <span class="job-dday">${escapeHtml(jobCareer(job))}</span>
      </div>
      <pre>${escapeHtml(JSON.stringify(job, null, 2))}</pre>
      <div class="job-card-footer">
        <span>${escapeHtml(url)}</span>
        <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">원문 열기</a>
      </div>
    </div>
  `;
}

function renderSlackThreadComment(job) {
  const slack = jobSlackMessages(job);
  if (!slack.thread_comment) return "";
  const source = slack.ai_mode === "openai" ? (slack.model || "OpenAI") : "fallback";
  return `
    <article class="message slack-thread-comment">
      <div class="message-avatar" style="background:#1264a3">JK</div>
      <div class="message-content">
        <div class="message-meta">
          <span class="message-name">공고 큐레이터</span>
          <span class="message-time">${escapeHtml(source)}</span>
        </div>
        <div class="message-text">${escapeHtml(slack.thread_comment)}</div>
      </div>
    </article>
  `;
}

function renderDm(options = {}) {
  if (state.activeDm === "ai-search") renderAiSearchDm();
  else if (state.activeDm === "profile") renderProfileDm();
  else if (state.activeDm === "search") renderSearchDm();
  else renderJobDm(findJob(state.activeDm?.replace("job:", "")));
  if (!options.preserveMessageScroll) scrollToTop(messageList);
}

function renderAiSearchDm() {
  channelTitle.textContent = "검색 봇";
  channelSubtitle.textContent = "자연어 입력 → 로컬 키워드 파싱 → JobKorea 크롤링 → 근거와 결과 출력";
  memberCount.textContent = "bot";
  bookmarks.innerHTML = `<button class="bookmark">local intent</button><button class="bookmark">crawler trace</button><button class="bookmark">JobKorea</button>`;
  messageInput.placeholder = "예: LG전자에서 SW 개발 직군 공고 보여줘";
  messageList.innerHTML = `
    <section class="channel-intro">
      <div class="intro-icon">⌕</div>
      <h2>검색 봇</h2>
      <p>입력 문장을 로컬에서 어떻게 해석했는지, 어떤 URL을 크롤링했는지, 어떤 공고를 가져왔는지 답장에 표시합니다.</p>
      <div class="intro-meta">
        <span>OpenAI message transform</span>
        <span>local intent</span>
        <span>JobKorea crawl</span>
      </div>
    </section>
    <div id="aiSearchResults">
      ${state.searchBotMessages.length ? topAnchoredItems(state.searchBotMessages).map(renderAiSearchTurn).join("") : emptyBlock("원하는 공고를 자연어로 입력해보세요.")}
    </div>
  `;
  renderAiSearchThread();
}

function renderProfileDm() {
  channelTitle.textContent = "Resume & Portfolio";
  channelSubtitle.textContent = "PDF 업로드 → 텍스트 추출 → ChatGPT API 분석 → JSON 저장";
  memberCount.textContent = "me";
  bookmarks.innerHTML = `<button class="bookmark">PDF only</button><button class="bookmark">one AI run</button><button class="bookmark">JSON output</button>`;
  messageInput.placeholder = "PDF 업로드는 위 패널에서만 가능합니다.";
  messageList.innerHTML = renderProfileUploadSurface();
  renderProfileThread();
}

function renderProfileUploadSurface() {
  const analysis = state.profileAnalysis || {};
  const extractedText = profileExtractedText(analysis);
  const convertedJsonText = profileConvertedJsonText(analysis);
  const locked = Boolean(analysis.locked);
  const uploadDisabled = locked || state.profileUploading;
  const statusLabel = profileAnalysisStatusLabel(analysis);
  return `
    <section class="channel-intro profile-intro">
      <div class="intro-icon">PDF</div>
      <h2>Resume & Portfolio</h2>
      <p>이력서와 포트폴리오는 PDF 파일만 받습니다. 분석이 끝나면 저장된 사용자 프로필 JSON을 그대로 표시합니다.</p>
      <div class="intro-meta">
        <span>${escapeHtml(statusLabel)}</span>
        <span>${convertedJsonText ? "JSON ready" : "JSON blank"}</span>
        <span>${locked ? "locked" : "retry ready"}</span>
      </div>
    </section>

    <article class="message">
      <div class="message-avatar" style="background:#1264a3">RP</div>
      <div class="message-content">
        <div class="message-meta">
          <span class="message-name">Resume & Portfolio</span>
          <span class="message-time">${escapeHtml(statusLabel)}</span>
        </div>
        <form class="profile-upload-form ${uploadDisabled ? "disabled" : ""}" id="profileUploadForm">
          <div class="document-type-row">
            <label>문서 유형
              <select id="profileDocumentType" ${uploadDisabled ? "disabled" : ""}>
                <option value="resume_portfolio">이력서 + 포트폴리오</option>
                <option value="resume">이력서</option>
                <option value="portfolio">포트폴리오</option>
              </select>
            </label>
          </div>
          <label class="pdf-dropzone ${state.profileSelectedFileName ? "has-file" : ""}">
            <input id="profilePdfInput" type="file" accept="application/pdf,.pdf" ${uploadDisabled ? "disabled" : ""} />
            <span class="pdf-icon">PDF</span>
            <strong>${escapeHtml(state.profileSelectedFileName || "PDF 파일 선택")}</strong>
            <small>${locked ? "AI 분석은 이미 완료되었습니다." : "application/pdf"}</small>
          </label>
          ${state.profileUploadError ? `<p class="profile-upload-error">${escapeHtml(state.profileUploadError)}</p>` : ""}
          ${analysis.lastError ? `<p class="profile-upload-error">${escapeHtml(analysis.lastError)}</p>` : ""}
          <button type="submit" ${uploadDisabled ? "disabled" : ""}>${state.profileUploading ? "분석 중" : "AI 분석 시작"}</button>
        </form>
      </div>
    </article>

    ${extractedText ? renderExtractedTextResult(analysis, extractedText) : ""}
    ${extractedText ? renderProfileAnalysisResult(analysis) : emptyBlock("아직 업로드된 PDF가 없습니다.")}
  `;
}

function profileExtractedText(analysis = {}) {
  return analysis.result?.extracted_text || analysis.extractedText || "";
}

function profileConvertedJsonText(analysis = {}) {
  if (analysis.convertedJsonText) return analysis.convertedJsonText;
  if (analysis.result && typeof analysis.result === "object") return JSON.stringify(analysis.result, null, 2);
  return "";
}

function profileAnalysisStatusLabel(analysis = {}) {
  if (state.profileUploading || analysis.status === "running") return "분석 중";
  if (analysis.status === "completed") return "분석 완료";
  if (analysis.status === "text_extracted") return "텍스트 추출 완료";
  if (analysis.status === "failed") return "분석 실패";
  return "분석 대기";
}

function renderProfileAnalysisResult(analysis) {
  const result = analysis.result && typeof analysis.result === "object" ? analysis.result : {};
  const convertedJsonText = profileConvertedJsonText(analysis);
  const display = result.ai_analysis_result?.chat_display_message || {};
  return `
    <article class="message profile-result-message">
      <div class="message-avatar" style="background:#007a5a">AI</div>
      <div class="message-content">
        <div class="message-meta">
          <span class="message-name">${escapeHtml(display.title || "PDF 분석이 완료되었습니다.")}</span>
          <span class="message-time">${escapeHtml(result.generated_at || "")}</span>
        </div>
        <div class="message-text">${escapeHtml(display.summary || result.ai_analysis_result?.overall_summary || (analysis.lastError ? "OpenAI 변환은 실패했습니다. JSON은 빈 문자열로 표시합니다." : ""))}</div>
        ${display.bullets?.length ? `<ul class="profile-result-bullets">${display.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        <section class="json-output-card">
          <div class="json-card-head">
            <div>
              <span class="job-source">2. JSON 변환 결과</span>
              <h3>${escapeHtml(result.candidate_profile?.headline || "AI 분석 결과")}</h3>
            </div>
            <span class="job-dday">${escapeHtml(result.model || "OpenAI")}</span>
          </div>
          <pre>${escapeHtml(convertedJsonText)}</pre>
        </section>
      </div>
    </article>
  `;
}

function renderExtractedTextResult(analysis, extractedText) {
  const source = analysis.result?.source_documents?.[0] || analysis.sourceDocument || {};
  return `
    <article class="message profile-result-message">
      <div class="message-avatar" style="background:#e01e5a">TXT</div>
      <div class="message-content">
        <div class="message-meta">
          <span class="message-name">1. PDF 추출 텍스트</span>
          <span class="message-time">${escapeHtml(source.original_file_name || "")}</span>
        </div>
        <section class="text-output-card">
          <div class="json-card-head">
            <div>
              <span class="job-source">${escapeHtml(source.text_extractor || "PDF text")}</span>
              <h3>${Number(source.extracted_text_char_count || extractedText.length).toLocaleString()} chars</h3>
            </div>
            <span class="job-dday">${source.page_count ? `${source.page_count}p` : "PDF"}</span>
          </div>
          <pre>${escapeHtml(extractedText)}</pre>
        </section>
      </div>
    </article>
  `;
}

function renderSearchDm() {
  channelTitle.textContent = "Search";
  channelSubtitle.textContent = "자연어 입력 → 로컬 키워드 파싱 → JobKorea 크롤링 → 공고 10개 출력";
  memberCount.textContent = "search";
  bookmarks.innerHTML = `<button class="bookmark">local intent</button><button class="bookmark">JobKorea crawl</button><button class="bookmark">10 results</button>`;
  messageInput.placeholder = "LG전자 SW 개발자 채용 공고 보여줘";
  messageList.innerHTML = `
    <section class="channel-intro">
      <div class="intro-icon">⌕</div>
      <h2>Search</h2>
      <p>검색 문장을 보내면 로컬 서버가 핵심 키워드를 뽑아 JobKorea에서 검색하고, 결과를 DM 답장처럼 보여줍니다.</p>
    </section>
    <div id="searchDmResults">
      ${state.searchBotMessages.length ? topAnchoredItems(state.searchBotMessages).map(renderSearchTurn).join("") : emptyBlock("원하는 공고를 자연어로 입력해보세요.")}
    </div>
  `;
  renderSearchThread();
}

function renderJobDm(job) {
  if (!job) return;
  channelTitle.textContent = jobCompany(job);
  channelSubtitle.textContent = "공고 담당자 DM처럼 쓰는 개인 기록 공간";
  memberCount.textContent = "DM";
  bookmarks.innerHTML = `<button class="bookmark">자소서 초안</button><button class="bookmark">면접 메모</button>`;
  messageInput.placeholder = "이 공고에 대한 메모나 자소서 초안을 남기기";
  const notes = state.notes[job.id] || [];
  messageList.innerHTML = `
    ${renderJobMessage(job)}
    <div class="day-divider"><span>My notes</span></div>
    ${notes.length ? notes.map((note) => `
      <article class="message">
        <div class="message-avatar" style="background:#007a5a">ME</div>
        <div><div class="message-meta"><span class="message-name">Me</span><span class="message-time">${note.createdAt}</span></div>
        <div class="message-text">${escapeHtml(note.text)}</div></div>
      </article>
    `).join("") : emptyBlock("아직 기록이 없습니다. composer에 자소서 초안/인재상/메모를 남겨보세요.")}
  `;
}

function openThreadPanel() {
  appShell.classList.add("thread-open");
  threadPanel.classList.add("open");
  threadPanel.setAttribute("aria-hidden", "false");
}

function resetThreadPanel() {
  threadChannel.textContent = "# thread";
  threadBody.innerHTML = emptyBlock("공고를 선택하면 Slack 코멘트와 매칭 결과가 표시됩니다.");
}

function closeThreadPanel({ clearSelection = true } = {}) {
  threadRenderToken += 1;
  appShell.classList.remove("thread-open");
  threadPanel.classList.remove("open");
  threadPanel.setAttribute("aria-hidden", "true");
  if (clearSelection) state.selectedJob = null;
  resetThreadPanel();
  renderRailState();
}

async function openJobThread(job) {
  if (!job) return;
  openThreadPanel();
  await renderThread(job);
}

async function renderThread(job) {
  if (!job) {
    resetThreadPanel();
    scrollToBottom(threadBody);
    return;
  }
  const renderToken = ++threadRenderToken;
  state.selectedJob = job;
  const threadScope = state.activeMode === "channel"
    ? currentChannel().name
    : state.activeMode === "later"
      ? "나중에 보기"
      : "DM";
  threadChannel.textContent = `# ${threadScope}`;
  threadBody.innerHTML = `
    <div class="thread-context"><span>AI matching</span><strong>계산 중</strong></div>
    ${renderJobMessage(job)}
    ${renderSlackThreadComment(job)}
    <div class="day-divider"><span>Parsed details</span></div>
    ${(job.details || defaultDetails(job)).map((detail) => `
      <article class="message compact-message">
        <div class="message-avatar" style="background:#1264a3">JK</div>
        <div><div class="message-meta"><span class="message-name">Local parser</span><span class="message-time">detail</span></div>
        <div class="message-text">${escapeHtml(detail)}</div></div>
      </article>
    `).join("")}
    <div id="matchResult">${emptyBlock("매칭 결과를 불러오는 중입니다.")}</div>
  `;
  scrollToBottom(threadBody);
  const match = await api("/api/match", {
    method: "POST",
    body: JSON.stringify({ job, profile: state.profile, profileAnalysis: state.profileAnalysis }),
  }).catch((err) => ({ match: { score: 0, summary: err.message, strengths: [], risks: [], nextActions: [] } }));
  if (renderToken !== threadRenderToken || String(state.selectedJob?.id) !== String(job.id)) return;
  const result = threadBody.querySelector("#matchResult");
  if (result) {
    result.innerHTML = renderMatch(match.match);
    scrollToBottom(threadBody);
  }
}

function renderProfileThread() {
  const analysis = state.profileAnalysis || {};
  const result = analysis.result && typeof analysis.result === "object" ? analysis.result : {};
  const message = result.ai_analysis_result?.chat_display_message || {};
  const keywords = result.matching_profile?.core_keywords || [];
  const extractedText = profileExtractedText(analysis);
  threadChannel.textContent = "# profile";
  threadBody.innerHTML = `
    <div class="thread-context"><span>상태</span><strong>${escapeHtml(profileAnalysisStatusLabel(analysis))}</strong></div>
    ${result.schema_version ? `
      <section class="profile-thread-summary">
        <strong>${escapeHtml(message.title || "AI 분석 결과")}</strong>
        <p>${escapeHtml(message.summary || result.ai_analysis_result?.overall_summary || "")}</p>
        <div class="thread-keywords">${keywords.slice(0, 8).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      </section>
      <div class="empty-thread">이 JSON은 공고 스레드의 AI/fallback 매칭에도 반영됩니다.</div>
    ` : extractedText ? `
      <section class="profile-thread-summary">
        <strong>텍스트 추출 완료</strong>
        <p>OpenAI 변환 결과는 빈 문자열입니다. ${analysis.lastError ? escapeHtml(analysis.lastError) : ""}</p>
      </section>
    ` : `
      <div class="empty-thread">PDF 분석 결과가 여기에 표시됩니다.</div>
    `}
  `;
}

function renderSearchThread() {
  threadChannel.textContent = "# search";
  threadBody.innerHTML = `
    <div class="thread-context"><span>검색 방식</span><strong>local parser + crawler</strong></div>
    <div class="empty-thread">예: “NC 채용 공고 보여줘”, “LG전자 SW 개발자 채용 공고 보여줘”</div>
  `;
}

function renderAiSearchThread() {
  threadChannel.textContent = "# search-bot";
  threadBody.innerHTML = `
    <div class="thread-context"><span>검증 포인트</span><strong>parser + crawler</strong></div>
    <div class="empty-thread">답장 카드의 trace에서 parser mode, 해석된 query, crawl URL, 결과 수를 확인하세요.</div>
  `;
}

function renderAiSearchTurn(turn) {
  return renderSearchTurn(turn);
}

function renderSearchTurn(turn) {
  return `
    <article class="message">
      <div class="message-avatar" style="background:#007a5a">ME</div>
      <div>
        <div class="message-meta"><span class="message-name">Me</span><span class="message-time">${turn.time}</span></div>
        <div class="message-text">${escapeHtml(turn.message)}</div>
      </div>
    </article>
    <article class="message">
      <div class="message-avatar" style="background:#1264a3">JK</div>
      <div class="message-content">
        <div class="message-meta"><span class="message-name">Search</span><span class="message-time">${turn.response.aiTrace.mode}</span></div>
        <div class="message-text">${escapeHtml(turn.response.answer)}</div>
        ${renderAiTrace(turn.response)}
        <div class="day-divider"><span>crawled jobs</span></div>
        ${topAnchoredItems(turn.response.jobs || []).map(renderJobMessage).join("") || emptyBlock("검색 결과가 없습니다.")}
      </div>
    </article>
  `;
}

function renderAiTrace(response) {
  const intent = response.intent || {};
  const trace = response.aiTrace || {};
  return `
    <section class="ai-trace">
      <div class="trace-grid">
        <span><strong>parser mode</strong>${escapeHtml(trace.mode || "-")}</span>
        <span><strong>query</strong>${escapeHtml(intent.query || "-")}</span>
        <span><strong>company</strong>${escapeHtml(intent.company || "-")}</span>
        <span><strong>role</strong>${escapeHtml(intent.role || "-")}</span>
        <span><strong>results</strong>${trace.resultCount ?? 0}</span>
      </div>
      <a href="${trace.crawlUrl}" target="_blank" rel="noreferrer">${escapeHtml(trace.crawlUrl || "")}</a>
      <ol>${(trace.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      ${response.topDetail ? `<p><strong>Top detail:</strong> ${escapeHtml((response.topDetail.details || [response.topDetail.title || ""])[0] || response.topDetail.error || "")}</p>` : ""}
    </section>
  `;
}

function defaultDetails(job) {
  return [
    `회사: ${jobCompany(job)}`,
    `공고명: ${jobTitle(job)}`,
    `접수기간: ${jobPeriod(job)}`,
    `근무지: ${jobLocation(job)}`,
    `키워드: ${jobKeywords(job).join(", ") || "상세 공고 참고"}`,
    `slack_messages.message_title: ${jobSlackMessages(job).message_title || "(empty)"}`,
    `slack_messages.message_body: ${jobSlackMessages(job).message_body || "(empty)"}`,
    `slack_messages.thread_comment: ${jobSlackMessages(job).thread_comment || "(empty)"}`,
  ];
}

function renderMatch(match) {
  return `
    <section class="ai-match">
      <div class="match-score">${match.score}<span>%</span></div>
      <div>
        <h3>나와의 매칭</h3>
        <p>${escapeHtml(match.summary || "")}</p>
        ${match.comment_text ? `<div class="match-comment">${escapeHtml(match.comment_text)}</div>` : ""}
        <strong>강점</strong>
        <ul>${(match.strengths || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <strong>주의</strong>
        <ul>${(match.risks || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <strong>다음 행동</strong>
        <ul>${(match.nextActions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <small>${escapeHtml(match.aiMode || "local")}</small>
      </div>
    </section>
  `;
}

function findJob(jobId) {
  return knownJobMap().get(String(jobId));
}

async function submitComposer(text) {
  if (state.activeMode === "channel" && state.activeChannel === "direct") {
    const match = text.match(/https?:\/\/\S+/);
    if (!match) return alert("채용공고 URL을 붙여넣어 주세요.");
    const data = await api(`/api/parse?url=${encodeURIComponent(match[0])}`);
    if (!state.jobs.direct.some((job) => (job.source_url || job.url) === match[0])) {
      state.jobs.direct.unshift(data.job);
      state.jobs.direct = state.jobs.direct.slice(0, 30);
      saveLocalState();
    }
    render();
    return;
  }

  if (state.activeMode === "dm" && state.activeDm === "ai-search") {
    const pending = {
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      message: text,
      response: {
        answer: "검색 봇이 로컬에서 의도를 해석하고 JobKorea를 크롤링하는 중입니다.",
        aiTrace: { mode: "running", resultCount: 0, steps: ["request sent"] },
        jobs: [],
      },
    };
    state.searchBotMessages.push(pending);
    render();
    const data = await api("/api/ai-search", { method: "POST", body: JSON.stringify({ message: text }) });
    pending.response = data;
    render();
    return;
  }

  if (state.activeMode === "dm" && state.activeDm === "search") {
    const pending = {
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      message: text,
      response: {
        answer: "Search가 문장을 해석하고 JobKorea를 크롤링하는 중입니다.",
        aiTrace: { mode: "running", resultCount: 0, steps: ["request sent"] },
        jobs: [],
      },
    };
    state.searchBotMessages.push(pending);
    render();
    try {
      const data = await api("/api/ai-search", { method: "POST", body: JSON.stringify({ message: text }) });
      pending.response = data;
      state.jobs.search = data.jobs || [];
    } catch (err) {
      pending.response = {
        answer: `검색 중 오류가 발생했습니다: ${err.message}`,
        aiTrace: { mode: "error", resultCount: 0, steps: ["request failed"] },
        jobs: [],
      };
    }
    render();
    return;
  }

  if (state.activeMode === "dm" && state.activeDm?.startsWith("job:")) {
    const jobId = state.activeDm.replace("job:", "");
    state.notes[jobId] = [...(state.notes[jobId] || []), { text, createdAt: localTimestamp() }];
    saveLocalState();
    render();
    return;
  }

  if (state.activeMode === "dm" && state.activeDm === "profile") {
    alert("Resume & Portfolio DM은 PDF 업로드만 지원합니다.");
  }
}

function extractSearchQuery(text) {
  return text
    .replace(/채용\s*공고/g, "")
    .replace(/보여줘|찾아줘|검색해줘|리스트|출력/g, "")
    .replace(/에서/g, " ")
    .trim() || text;
}

function applyChannelPayload(data) {
  if (data.catalog) state.channelCatalog = data.catalog.filter((channel) => channel.source !== "custom");
  if (data.customChannels) state.customChannels = data.customChannels.map((channel) => normalizeLocalChannel(channel, "custom"));
  if (data.enabledChannelIds) state.enabledChannelIds = data.enabledChannelIds;
  rebuildChannels();
  if (!channels.some((channel) => channel.id === state.activeChannel)) {
    state.activeChannel = channels.find((channel) => channel.id !== "direct")?.id || "direct";
  }
}

async function mutateChannels(payload) {
  if (payload.action === "create") {
    const channel = normalizeLocalChannel({
      name: payload.name,
      query: payload.query,
      id: `custom-${slugifyChannelId(payload.query || payload.name)}`,
      bookmarks: payload.bookmarks || payload.query || payload.name,
    }, "custom");
    const existingIds = new Set(allLocalChannels().map((item) => item.id));
    let channelId = channel.id;
    let suffix = 2;
    while (existingIds.has(channelId)) {
      channelId = `${channel.id}-${suffix}`;
      suffix += 1;
    }
    channel.id = channelId;
    state.customChannels.push(channel);
    state.enabledChannelIds.push(channel.id);
  } else if (payload.action === "setEnabled") {
    const enabled = new Set(state.enabledChannelIds);
    if (payload.enabled) enabled.add(payload.channelId);
    else enabled.delete(payload.channelId);
    state.enabledChannelIds = allLocalChannels().map((channel) => channel.id).filter((channelId) => enabled.has(channelId));
  } else if (payload.action === "delete") {
    state.customChannels = state.customChannels.filter((channel) => channel.id !== payload.channelId);
    state.enabledChannelIds = state.enabledChannelIds.filter((channelId) => channelId !== payload.channelId);
    delete state.jobs[payload.channelId];
  } else {
    throw new Error("unknown channel action");
  }
  applyChannelPayload({
    customChannels: state.customChannels,
    enabledChannelIds: state.enabledChannelIds,
  });
  saveLocalState();
  await Promise.all(channels.filter((channel) => channel.id !== "direct" && !state.jobs[channel.id]?.length).map((channel) => loadJobs(channel.id)));
  renderChannelManager();
  render();
}

function openChannelBrowser() {
  channelOverlay.classList.add("open");
  channelFilter.value = "";
  renderChannelManager();
  channelFilter.focus();
}

function renderChannelManager() {
  if (!channelManager) return;
  const query = (channelFilter?.value || "").trim().toLowerCase();
  const enabled = new Set(state.enabledChannelIds);
  const localChannels = allLocalChannels();
  const visibleChannels = localChannels.filter((channel) => {
    const haystack = `${channel.name} ${channel.query} ${channel.category} ${(channel.bookmarks || []).join(" ")}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  if (channelManagerSummary) {
    channelManagerSummary.textContent = `${enabled.size}/${localChannels.length}개 선택됨`;
  }

  channelManager.innerHTML = visibleChannels.map((channel) => {
    const isEnabled = enabled.has(channel.id);
    const isCustom = channel.source === "custom";
    const bookmarkChips = (channel.bookmarks || []).slice(0, 4).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
    return `
      <article class="channel-option ${isEnabled ? "selected" : ""}">
        <div class="channel-option-main">
          <span class="channel-hash">#</span>
          <div>
            <div class="channel-option-top">
              <strong>${escapeHtml(channel.name)}</strong>
              <small>${escapeHtml(channel.category || "직군")}</small>
            </div>
            <p>${escapeHtml(channel.subtitle || `${channel.name} 공고 피드`)}</p>
            <div class="channel-option-tags">${bookmarkChips}</div>
          </div>
        </div>
        <div class="channel-option-actions">
          <button class="${isEnabled ? "selected" : ""}" data-toggle-channel="${channel.id}" data-enabled="${String(!isEnabled)}">
            ${isEnabled ? "선택됨" : "선택"}
          </button>
          ${isCustom ? `<button class="danger" data-delete-channel="${channel.id}">삭제</button>` : ""}
        </div>
      </article>
    `;
  }).join("") || emptyBlock("조건에 맞는 직군 채널이 없습니다.");
}

document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-rail-home]")) {
    state.activeMode = "channel";
    state.activeDm = null;
    closeThreadPanel();
    render();
    return;
  }

  if (event.target.closest("[data-rail-dms]")) {
    state.activeMode = "dm";
    state.activeDm = state.activeDm || "search";
    closeThreadPanel();
    render();
    return;
  }

  if (event.target.closest("[data-later-view]")) {
    openLaterView();
    return;
  }

  if (event.target.closest("#openChannelManager")) {
    openChannelBrowser();
    return;
  }

  if (event.target.closest("#closeChannelManager")) {
    channelOverlay.classList.remove("open");
    return;
  }

  if (event.target === channelOverlay) {
    channelOverlay.classList.remove("open");
    return;
  }

  const toggleChannel = event.target.closest("[data-toggle-channel]");
  if (toggleChannel) {
    await mutateChannels({
      action: "setEnabled",
      channelId: toggleChannel.dataset.toggleChannel,
      enabled: toggleChannel.dataset.enabled === "true",
    }).catch((err) => alert(err.message));
    return;
  }

  const deleteChannel = event.target.closest("[data-delete-channel]");
  if (deleteChannel) {
    await mutateChannels({ action: "delete", channelId: deleteChannel.dataset.deleteChannel }).catch((err) => alert(err.message));
    return;
  }

  const channelButton = event.target.closest("[data-channel]");
  if (channelButton) {
    state.activeMode = "channel";
    state.activeChannel = channelButton.dataset.channel;
    state.activeDm = null;
    closeThreadPanel();
    render();
    return;
  }

  const dmButton = event.target.closest("[data-dm]");
  if (dmButton) {
    state.activeMode = "dm";
    state.activeDm = dmButton.dataset.dm;
    closeThreadPanel();
    render();
    return;
  }

  const refresh = event.target.closest("[data-refresh]");
  if (refresh) {
    await loadJobs(refresh.dataset.refresh);
    render();
  }

  const laterReaction = event.target.closest("[data-later-reaction]");
  if (laterReaction) {
    openLaterView(laterReaction.dataset.laterReaction);
    return;
  }

  const classify = event.target.closest("[data-classify]");
  if (classify) {
    const jobId = classify.dataset.classify;
    const reaction = classify.dataset.reaction;
    if (!validReactionKeys.has(reaction)) return;
    const current = new Set(state.classifications[jobId] || []);
    current.has(reaction) ? current.delete(reaction) : current.add(reaction);
    if (current.size) {
      state.classifications[jobId] = [...current].filter((item) => validReactionKeys.has(item));
      const job = findJob(jobId);
      if (job) rememberSavedJob(job);
    } else {
      delete state.classifications[jobId];
      delete state.savedJobs[jobId];
    }
    reconcileSavedJobs();
    saveLocalState();
    renderPreservingMessageScroll();
    if (threadPanel.classList.contains("open") && String(state.selectedJob?.id) === String(jobId)) {
      await renderThread(findJob(jobId) || state.selectedJob);
    }
    return;
  }

  const threadJob = event.target.closest("[data-thread-job]");
  if (threadJob) {
    searchOverlay.classList.remove("open");
    await openJobThread(findJob(threadJob.dataset.threadJob));
    return;
  }

  const openDm = event.target.closest("[data-open-dm]");
  if (openDm) {
    state.activeMode = "dm";
    state.activeDm = `job:${openDm.dataset.openDm}`;
    closeThreadPanel();
    render();
    return;
  }

  const openUrl = event.target.closest("[data-open-url]");
  if (openUrl) {
    window.open(openUrl.dataset.openUrl, "_blank", "noopener");
    return;
  }

  const jobMessage = event.target.closest("[data-job]");
  if (jobMessage && !event.target.closest("button, a, input, textarea, select")) {
    await openJobThread(findJob(jobMessage.dataset.job));
    return;
  }

  if (event.target.id === "saveProfile") {
    const profile = {
      resume: document.querySelector("#resumeInput").value,
      portfolio: document.querySelector("#portfolioInput").value,
      skills: document.querySelector("#skillsInput").value,
      preferences: document.querySelector("#preferencesInput").value,
    };
    state.profile = { ...state.profile, ...profile };
    saveLocalState();
    render();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "channelFilter") {
    renderChannelManager();
  }
  if (event.target.id === "profilePdfInput") {
    const file = event.target.files?.[0];
    state.profileSelectedFileName = file?.name || "";
    const dropzone = event.target.closest(".pdf-dropzone");
    if (dropzone) {
      dropzone.classList.toggle("has-file", Boolean(file));
      const label = dropzone.querySelector("strong");
      if (label) label.textContent = state.profileSelectedFileName || "PDF 파일 선택";
    }
  }
});

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "profileUploadForm") return;
  event.preventDefault();
  const input = document.querySelector("#profilePdfInput");
  const documentType = document.querySelector("#profileDocumentType")?.value || "resume_portfolio";
  const file = input?.files?.[0];
  if (!file) return alert("PDF 파일을 선택해 주세요.");
  const fileType = (file.type || "").toLowerCase();
  if (!file.name.toLowerCase().endsWith(".pdf") || (fileType && !["application/pdf", "application/octet-stream"].includes(fileType))) {
    return alert("PDF 파일만 업로드할 수 있습니다.");
  }
  if (file.size > MAX_PROFILE_PDF_BYTES) {
    return alert(`PDF 파일은 최대 ${Math.round(MAX_PROFILE_PDF_BYTES / 1024 / 1024)}MB까지 업로드할 수 있습니다.`);
  }

  const form = new FormData();
  form.append("document", file);
  form.append("documentType", documentType);
  state.profileUploading = true;
  state.profileUploadError = "";
  render();
  try {
    const data = await uploadApi("/api/profile/analyze-pdf", form);
    state.profileAnalysis = data.analysis || {};
    if (data.profile && Object.keys(data.profile).length) {
      state.profile = { ...state.profile, ...data.profile };
    }
    state.profileSelectedFileName = "";
    saveLocalState();
  } catch (err) {
    state.profileUploadError = err.message;
  } finally {
    state.profileUploading = false;
    render();
  }
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  messageInput.value = "";
  await submitComposer(text).catch((err) => alert(err.message));
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  composer.requestSubmit();
});

document.addEventListener("keydown", async (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const jobMessage = event.target.closest?.("[data-job]");
  if (!jobMessage || event.target.closest("button, a, input, textarea, select")) return;
  event.preventDefault();
  await openJobThread(findJob(jobMessage.dataset.job));
});

threadReply.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = threadInput.value.trim();
  if (!text || !state.selectedJob) return;
  threadInput.value = "";
  state.notes[state.selectedJob.id] = [...(state.notes[state.selectedJob.id] || []), { text, createdAt: localTimestamp() }];
  saveLocalState();
  renderThread(state.selectedJob);
});

closeThread.addEventListener("click", () => closeThreadPanel());
laterRailButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  openLaterView();
});
searchTrigger.addEventListener("click", () => {
  searchOverlay.classList.add("open");
  searchInput.focus();
});
searchOverlay.addEventListener("click", (event) => {
  if (event.target === searchOverlay) searchOverlay.classList.remove("open");
});
searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();
  const jobs = Object.values(state.jobs).flat().filter((job) => jobSearchText(job).toLowerCase().includes(query));
  searchResults.innerHTML = jobs.map((job) => `
    <button class="search-result" data-thread-job="${job.id}">
      <span class="search-avatar" style="background:${colorFor(jobCompany(job))}">${initials(jobCompany(job))}</span>
      <span><strong>${escapeHtml(jobCompany(job))}</strong><p>${escapeHtml(jobTitle(job))}</p><small>${jobKeywords(job).slice(0, 4).map(escapeHtml).join(", ")}</small></span>
    </button>
  `).join("") || emptyBlock("결과가 없습니다.");
});

boot().catch((err) => {
  messageList.innerHTML = emptyBlock(err.message);
});
