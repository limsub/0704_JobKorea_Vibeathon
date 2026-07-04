const API = "";
const MAX_PROFILE_PDF_BYTES = 40 * 1024 * 1024;
const LOCAL_STATE_KEY = "slezzuk_local_state_v1";
const LOCAL_STATE_VERSION = 5;
const INITIAL_JOB_BATCH_SIZE = 4;
const FULL_JOB_BATCH_SIZE = 10;
const SKELETON_JOB_COUNT = 4;
const PROFILE_KEYWORD_FIELDS = [
  "role_keywords",
  "domain_keywords",
  "industry_keywords",
  "technical_keywords",
  "tool_keywords",
  "methodology_keywords",
  "business_keywords",
  "data_keywords",
  "product_keywords",
  "project_keywords",
  "achievement_keywords",
  "soft_skill_keywords",
  "seniority_keywords",
  "education_keywords",
  "certification_keywords",
  "language_keywords",
  "search_aliases",
  "all_keywords",
];

const DEFAULT_ENABLED_CHANNEL_IDS = ["pm"];
const DUMMY_JOB_AVATARS = [
  { bg: "#d7efe7", skin: "#f3c2a5", hair: "#263238", shirt: "#007a5a", mark: "A" },
  { bg: "#e7eef9", skin: "#d9a47f", hair: "#3c2a21", shirt: "#1264a3", mark: "B" },
  { bg: "#fde9ef", skin: "#efb8a0", hair: "#1d1c1d", shirt: "#e01e5a", mark: "C" },
  { bg: "#fff2cf", skin: "#c98961", hair: "#4b2f24", shirt: "#ecb22e", mark: "D" },
  { bg: "#ece7f4", skin: "#f0c7ac", hair: "#2f2350", shirt: "#611f69", mark: "E" },
  { bg: "#dff6fb", skin: "#b98261", hair: "#202124", shirt: "#36c5f0", mark: "F" },
  { bg: "#edf5df", skin: "#e4ae8a", hair: "#5a3825", shirt: "#2f8f5b", mark: "G" },
  { bg: "#f2e8dc", skin: "#c78d6d", hair: "#2d2520", shirt: "#9b5a2e", mark: "H" },
  { bg: "#e3f0ff", skin: "#f1b99e", hair: "#101828", shirt: "#2457c5", mark: "I" },
  { bg: "#ffe7dc", skin: "#b97858", hair: "#382218", shirt: "#d4582f", mark: "J" },
  { bg: "#e9f7f1", skin: "#e8b795", hair: "#2b3137", shirt: "#00856f", mark: "K" },
  { bg: "#f5e8ff", skin: "#c68c6c", hair: "#42275a", shirt: "#7c3aed", mark: "L" },
  { bg: "#e6f4ea", skin: "#f0c4a8", hair: "#6b3f28", shirt: "#168a4a", mark: "M" },
  { bg: "#eaf1f8", skin: "#d8a17d", hair: "#202c33", shirt: "#0f6b8f", mark: "N" },
  { bg: "#fff4e5", skin: "#ba7656", hair: "#29170f", shirt: "#b7791f", mark: "O" },
  { bg: "#fce7f3", skin: "#e7ad91", hair: "#111827", shirt: "#be185d", mark: "P" },
];
const DUMMY_SENDERS = [
  { name: "Seungyeon LJ", title: "Talent" },
  { name: "Minji Kim", title: "PM Lead" },
  { name: "Joon Park", title: "Ops" },
  { name: "Hannah Choi", title: "Strategy" },
  { name: "Daniel K", title: "Product" },
  { name: "Yuna Lee", title: "Growth" },
  { name: "Alex Han", title: "Recruiting" },
  { name: "Soojin Bae", title: "Data" },
  { name: "Mason Ryu", title: "Biz" },
  { name: "Nari Jung", title: "People" },
  { name: "Chris Oh", title: "Research" },
  { name: "Eunseo Lim", title: "Planning" },
  { name: "Jay Moon", title: "PO" },
  { name: "Lina Seo", title: "Brand" },
  { name: "Hyun Woo", title: "Lead" },
  { name: "Grace Shin", title: "Careers" },
];
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
  name: "URL 가져오기",
  query: "",
  subtitle: "채용공고 URL을 붙여넣으면 메시지로 정리합니다.",
  bookmarks: [],
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
  openJobDmIds: [],
  openedJobDms: {},
  analyzeJobMessages: [],
  channelLoading: {},
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
  jobDmMatches: {},
  jobDmMatchLoading: {},
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

function stableIndex(value = "", length = 1) {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % Math.max(length, 1);
}

function avatarSvgDataUrl(avatar) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="16" fill="${avatar.bg}"/>
      <circle cx="40" cy="34" r="18" fill="${avatar.skin}"/>
      <path d="M22 34c2-18 32-22 38 0-6-7-13-10-22-8-8 1-13 4-16 8z" fill="${avatar.hair}"/>
      <path d="M16 76c3-18 15-28 24-28s21 10 24 28z" fill="${avatar.shirt}"/>
      <circle cx="33" cy="37" r="2" fill="#1d1c1d"/>
      <circle cx="47" cy="37" r="2" fill="#1d1c1d"/>
      <path d="M33 46c4 4 10 4 14 0" fill="none" stroke="#1d1c1d" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function formatSlackText(value = "") {
  const emojiMap = {
    ":eyes:": "👀",
    ":memo:": "📝",
    ":bulb:": "💡",
    ":mag:": "🔍",
    ":sparkles:": "✨",
  };
  return String(value ?? "").replace(/:eyes:|:memo:|:bulb:|:mag:|:sparkles:/g, (token) => emojiMap[token] || token);
}

function formatMatchCommentText(value = "") {
  let text = formatSlackText(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return "";

  const starters = [
    "다만",
    "근데",
    "반대로",
    "아쉬운",
    "걸리는",
    "확인할",
    "보완 포인트",
    "보완하면",
    "보완할",
    "추천 방향",
    "추천 포지셔닝",
    "방향은",
    "그래서",
    "저라면",
    "다음",
    "우선",
    "한 줄",
    "면접",
    "자소서",
    "포트폴리오",
    "지원 메시지",
    "정리하면",
  ];
  text = text.replace(new RegExp(`\\s+(${starters.join("|")})`, "g"), "\n\n$1");
  text = text.replace(/\s+(?=(?:\d+\.|[-•])\s)/g, "\n");
  const hasReadableBreaks = text.includes("\n\n") || text.split("\n").filter(Boolean).length >= 4;
  if (hasReadableBreaks) return text.replace(/\n{3,}/g, "\n\n").trim();
  if (text.includes("\n\n")) return text.replace(/\n{3,}/g, "\n\n").trim();

  const sentences = [];
  text.replace(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g, (part) => {
    const sentence = part.trim();
    if (sentence) sentences.push(sentence);
    return part;
  });
  if (sentences.length < 3 || text.length < 120) return text;

  const paragraphs = [];
  sentences.forEach((sentence, index) => {
    const last = paragraphs[paragraphs.length - 1] || "";
    if (index === 0 || last.length > 95 || paragraphs.length >= 3) {
      paragraphs.push(sentence);
    } else {
      paragraphs[paragraphs.length - 1] = `${last} ${sentence}`;
    }
  });
  return paragraphs.join("\n\n");
}

function decorateJobs(channelId, jobs = []) {
  const used = new Set();
  return jobs.map((job, index) => {
    const seed = `${channelId}:${job.id || job.source_url || jobUrl(job)}:${index}`;
    let avatarIndex = stableIndex(seed, DUMMY_JOB_AVATARS.length);
    while (used.has(avatarIndex) && used.size < DUMMY_JOB_AVATARS.length) {
      avatarIndex = (avatarIndex + 1) % DUMMY_JOB_AVATARS.length;
    }
    used.add(avatarIndex);
    return {
      ...job,
      avatar: job.avatar || DUMMY_JOB_AVATARS[avatarIndex],
      sender: job.sender || DUMMY_SENDERS[stableIndex(`${seed}:sender`, DUMMY_SENDERS.length)],
    };
  });
}

function jobAvatar(job) {
  const seed = job?.id || (job ? jobCompany(job) : "job");
  return job?.avatar || DUMMY_JOB_AVATARS[stableIndex(seed, DUMMY_JOB_AVATARS.length)];
}

function jobSender(job) {
  const seed = job?.id || (job ? jobCompany(job) : "job");
  return job?.sender || DUMMY_SENDERS[stableIndex(`${seed}:sender`, DUMMY_SENDERS.length)];
}

function renderAvatarElement(job, attrs = "", tag = "button") {
  const avatar = jobAvatar(job);
  const label = escapeHtml(jobSender(job).name);
  const src = avatarSvgDataUrl(avatar);
  return `<${tag} class="message-avatar avatar-photo" ${attrs} aria-label="${label} 프로필"><img src="${src}" alt="" /></${tag}>`;
}

function escapeHtml(value = "") {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultLocalState() {
  return {
    version: LOCAL_STATE_VERSION,
    classifications: {},
    notes: {},
    profile: clone(DEFAULT_PROFILE),
    profileAnalysis: clone(DEFAULT_PROFILE_ANALYSIS),
    directParsedJobs: [],
    channelJobs: {},
    savedJobs: {},
    openJobDmIds: [],
    openedJobDms: {},
    analyzeJobMessages: [],
    enabledChannelIds: [...DEFAULT_ENABLED_CHANNEL_IDS],
    customChannels: [],
  };
}

function readLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_STATE_KEY);
    if (!raw) return defaultLocalState();
    const parsed = JSON.parse(raw);
    if ((parsed.version || 1) < LOCAL_STATE_VERSION) {
      if ((parsed.version || 1) < 2) {
        parsed.enabledChannelIds = [...DEFAULT_ENABLED_CHANNEL_IDS];
        parsed.openJobDmIds = [];
        parsed.openedJobDms = {};
      }
      if ((parsed.version || 1) < 3) {
        parsed.channelJobs = {};
      }
      if ((parsed.version || 1) < 4) {
        parsed.channelJobs = {};
      }
      if ((parsed.version || 1) < 5) {
        parsed.channelJobs = {};
      }
      parsed.version = LOCAL_STATE_VERSION;
    }
    return { ...defaultLocalState(), ...parsed };
  } catch (err) {
    console.warn("Failed to read local state", err);
    return defaultLocalState();
  }
}

function localStateSnapshot() {
  return {
    version: LOCAL_STATE_VERSION,
    classifications: normalizeClassifications(state.classifications),
    notes: state.notes,
    profile: state.profile,
    profileAnalysis: state.profileAnalysis,
    directParsedJobs: compactJobsForStorage(state.jobs.direct || []),
    channelJobs: compactChannelJobsForStorage(),
    savedJobs: compactSavedJobsForStorage(state.savedJobs),
    openJobDmIds: state.openJobDmIds,
    openedJobDms: compactSavedJobsForStorage(state.openedJobDms),
    analyzeJobMessages: compactAnalyzeJobMessages(state.analyzeJobMessages),
    enabledChannelIds: state.enabledChannelIds,
    customChannels: state.customChannels,
  };
}

function compactChannelJobsForStorage() {
  const ignored = new Set(["direct", "search"]);
  return Object.fromEntries(
    Object.entries(state.jobs)
      .filter(([channelId, jobs]) => !ignored.has(channelId) && Array.isArray(jobs) && jobs.length)
      .map(([channelId, jobs]) => [channelId, compactJobsForStorage(jobs.slice(0, FULL_JOB_BATCH_SIZE))])
  );
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

function compactAnalyzeJobMessages(messages = []) {
  return messages.slice(-30).map((message) => ({
    ...message,
    response: {
      ...(message.response || {}),
      job: message.response?.job ? compactJobsForStorage([message.response.job])[0] : null,
    },
  }));
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
  Object.values(state.openedJobDms || {}).forEach((job) => {
    if (job?.id != null) jobs.set(String(job.id), job);
  });
  (state.analyzeJobMessages || []).forEach((message) => {
    const job = message.response?.job;
    if (job?.id != null) jobs.set(String(job.id), job);
  });
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

function rememberOpenJobDm(job) {
  if (job?.id == null) return;
  const jobId = String(job.id);
  state.openedJobDms[jobId] = compactJobsForStorage([job])[0];
  state.openJobDmIds = [jobId, ...state.openJobDmIds.filter((id) => String(id) !== jobId)].slice(0, 12);
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
  if (slack.message_body) return slack.message_body;
  if (slack.message_title) return slack.message_title;
  return `${jobCompany(job)} 채용공고를 불러왔습니다. 세부 내용은 스레드에서 확인해 주세요.`;
}

async function boot() {
  await loadState();
  await loadChannels();
  if (!channels.some((channel) => channel.id === state.activeChannel)) {
    state.activeChannel = channels.find((channel) => channel.id !== "direct")?.id || channels[0]?.id || "direct";
  }
  if (window.__slezzukPendingMode === "later") state.activeMode = "later";
  render();
  const activeChannelId = state.activeMode === "channel" ? state.activeChannel : channels[0]?.id;
  if (activeChannelId && activeChannelId !== "direct") {
    loadJobsProgressive(activeChannelId);
  }
}

async function loadState() {
  const data = readLocalState();
  state.classifications = normalizeClassifications(data.classifications || {});
  state.notes = data.notes || {};
  state.profile = { ...clone(DEFAULT_PROFILE), ...(data.profile || {}) };
  state.profileAnalysis = { ...clone(DEFAULT_PROFILE_ANALYSIS), ...(data.profileAnalysis || {}) };
  state.jobs = {
    ...(data.channelJobs || {}),
    direct: data.directParsedJobs || [],
  };
  state.savedJobs = data.savedJobs || {};
  state.openJobDmIds = (data.openJobDmIds || []).map(String).slice(0, 12);
  state.openedJobDms = data.openedJobDms || {};
  state.analyzeJobMessages = (data.analyzeJobMessages || []).map((message) => (
    message.response?.status === "running"
      ? { ...message, response: { status: "failed", job: null, error: "페이지 분석이 중단되었습니다. URL을 다시 보내 주세요." } }
      : message
  ));
  state.channelLoading = {};
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

function jobApiPath(channelId, limit = FULL_JOB_BATCH_SIZE) {
  const channel = channels.find((item) => item.id === channelId);
  const path = channel?.source === "custom"
    ? `/api/search?q=${encodeURIComponent(channel.query || channel.name || channelId)}`
    : `/api/jobs?channel=${encodeURIComponent(channelId)}`;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}limit=${encodeURIComponent(limit)}`;
}

async function fetchJobs(channelId, limit = FULL_JOB_BATCH_SIZE) {
  const data = await api(jobApiPath(channelId, limit));
  return decorateJobs(channelId, data.jobs || []);
}

function updateVisibleAfterJobLoad(channelId) {
  saveLocalState();
  if (state.activeMode === "channel" && state.activeChannel === channelId) {
    renderPreservingMessageScroll();
  } else {
    renderSidebar();
  }
}

function markChannelLoading(channelId, patch = {}) {
  state.channelLoading[channelId] = {
    loading: true,
    phase: "initial",
    error: "",
    ...(state.channelLoading[channelId] || {}),
    ...patch,
  };
}

function finishChannelLoading(channelId, patch = {}) {
  state.channelLoading[channelId] = {
    ...(state.channelLoading[channelId] || {}),
    loading: false,
    phase: "done",
    ...patch,
  };
}

async function loadJobsProgressive(channelId, { force = false } = {}) {
  if (!channelId || channelId === "direct") return;
  const current = state.channelLoading[channelId];
  if (current?.loading && !force) return;
  const existingJobs = state.jobs[channelId] || [];
  const token = `${Date.now()}-${Math.random()}`;
  markChannelLoading(channelId, {
    token,
    phase: existingJobs.length ? "refresh" : "initial",
    loaded: existingJobs.length,
    error: "",
  });
  updateVisibleAfterJobLoad(channelId);

  const loadBatch = async (limit, phase) => {
    markChannelLoading(channelId, { token, phase });
    const jobs = await fetchJobs(channelId, limit);
    if (state.channelLoading[channelId]?.token !== token) return false;
    state.jobs[channelId] = jobs;
    reconcileSavedJobs();
    markChannelLoading(channelId, { token, phase, loaded: jobs.length });
    updateVisibleAfterJobLoad(channelId);
    return true;
  };

  try {
    if (!existingJobs.length || force) {
      const quickLoaded = await loadBatch(INITIAL_JOB_BATCH_SIZE, "first");
      if (!quickLoaded) return;
    }
    const fullJobs = await fetchJobs(channelId, FULL_JOB_BATCH_SIZE);
    if (state.channelLoading[channelId]?.token !== token) return;
    state.jobs[channelId] = fullJobs;
    reconcileSavedJobs();
    finishChannelLoading(channelId, { loaded: fullJobs.length, error: "" });
    updateVisibleAfterJobLoad(channelId);
  } catch (err) {
    finishChannelLoading(channelId, { error: err.message || "공고를 불러오지 못했습니다." });
    updateVisibleAfterJobLoad(channelId);
  }
}

async function loadJobs(channelId) {
  const data = await api(jobApiPath(channelId, FULL_JOB_BATCH_SIZE)).catch(() => ({ jobs: [] }));
  state.jobs[channelId] = decorateJobs(channelId, data.jobs || []);
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
    const compactRows = state.activeMode === "later" ? renderLaterSidebarRows() : renderDefaultSidebarRows();
    compactSection.innerHTML = compactRows;
    compactSection.hidden = !compactRows;
  }

  const jobs = knownJobMap();
  state.openJobDmIds = state.openJobDmIds.filter((jobId) => jobs.has(String(jobId)));
  const jobDms = state.openJobDmIds.map((jobId) => {
    const job = jobs.get(String(jobId));
    return { id: `job:${job.id}`, name: `${jobSender(job).name} · ${jobCompany(job)}`, job };
  });
  const fixed = [
    { id: "search", name: "Search", icon: "⌕" },
    { id: "analyze-job", name: "Analyze Job Posting", icon: "🔗" },
    { id: "profile", name: "Resume & Portfolio", icon: "📎" },
  ];

  directList.innerHTML = fixed.map((dm) => `
    <button class="sidebar-row ${state.activeMode === "dm" && state.activeDm === dm.id ? "active" : ""}" data-dm="${dm.id}">
      <span class="row-icon">${dm.icon}</span>
      <span class="row-label">${dm.name}</span>
    </button>
  `).join("") + jobDms.map((dm) => `
    <button class="sidebar-row ${state.activeMode === "dm" && state.activeDm === dm.id ? "active" : ""}" data-dm="${dm.id}">
      <span class="dm-avatar avatar-photo"><img src="${avatarSvgDataUrl(jobAvatar(dm.job))}" alt="" /></span>
      <span class="status-dot active"></span>
      <span class="row-label">${dm.name}</span>
    </button>
  `).join("");

  renderRailState();
}

function renderDefaultSidebarRows() {
  return "";
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
  const loading = state.channelLoading[channel.id] || {};
  channelTitle.textContent = `# ${channel.name}`;
  channelSubtitle.textContent = channel.subtitle;
  if (memberCount) memberCount.textContent = jobs.length;
  bookmarks.innerHTML = "";
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
    ${loading.loading ? renderLoadingBar(loading) : ""}
    <div class="day-divider"><span>채용공고</span></div>
    ${jobs.length ? bottomAnchoredItems(jobs).map(renderJobMessage).join("") : loading.loading ? renderJobSkeletons(SKELETON_JOB_COUNT) : emptyBlock(loading.error || "아직 표시할 공고가 없습니다.")}
    ${jobs.length && loading.loading ? renderJobSkeletons(2, true) : ""}
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
  if (memberCount) memberCount.textContent = total;
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
      ${renderAvatarElement(job, `data-open-dm="${escapeHtml(jobId)}"`, "button").replace("message-avatar", "later-list-avatar avatar-photo")}
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
    </section>
  `;
}

function emptyBlock(text) {
  return `<div class="empty-thread">${text}</div>`;
}

function loadingStatusText(loading = {}) {
  if (loading.phase === "first") return "보이는 공고부터 먼저 정리하고 있어요.";
  if (loading.phase === "refresh") return "기존 공고는 유지하고 새 결과를 뒤에서 확인 중입니다.";
  if (loading.phase === "more") return "나머지 공고를 이어서 채우는 중입니다.";
  if (loading.phase === "profile") return "PDF를 읽고 프로필 키워드를 정리하는 중입니다.";
  if (loading.phase === "search") return "자연어 요청을 공고 검색어로 바꾸고 결과를 정리하는 중입니다.";
  if (loading.phase === "url-parse") return "채용 페이지를 열고 공고 본문을 파싱하는 중입니다.";
  return "JobKorea에서 공고를 가져오는 중입니다.";
}

function renderLoadingBar(loading = {}) {
  const label = loadingStatusText(loading);
  return `
    <div class="feed-progress" role="status" aria-live="polite">
      <span>${escapeHtml(label)}</span>
      <div><i></i></div>
    </div>
  `;
}

function renderJobSkeletons(count = SKELETON_JOB_COUNT, compact = false) {
  return Array.from({ length: count }, (_, index) => `
    <article class="message skeleton-message ${compact ? "compact-skeleton" : ""}" aria-hidden="true">
      <div class="skeleton-avatar"></div>
      <div class="message-content">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line long"></div>
        <div class="skeleton-line long"></div>
      </div>
    </article>
  `).join("");
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderJobMessage(job) {
  const jobId = String(job.id);
  const selected = selectedClassifications(jobId);
  const isThreadSelected = threadPanel.classList.contains("open") && String(state.selectedJob?.id) === jobId;
  const sender = jobSender(job);
  return `
    <article class="message job-message ${isThreadSelected ? "thread-selected" : ""}" data-job="${escapeHtml(jobId)}" tabindex="0" aria-label="${escapeHtml(jobCompany(job))} 공고 스레드 열기">
      ${renderAvatarElement(job, `data-open-dm="${escapeHtml(jobId)}" title="DM에 추가"`)}
      <div class="message-content">
        <div class="message-meta">
          <button class="message-name" data-open-dm="${escapeHtml(jobId)}">${escapeHtml(sender.name)}</button>
          <span class="message-time">${escapeHtml(sender.title)} · ${escapeHtml(jobCompany(job))}</span>
        </div>
        <div class="message-text">${escapeHtml(formatSlackText(jobMessageText(job)))}</div>
        <div class="reactions">
          ${reactionTypes.map((reaction) => `
            <button class="reaction ${selected.includes(reaction.key) ? "selected" : ""}" data-classify="${escapeHtml(jobId)}" data-reaction="${reaction.key}" title="${reaction.label}">
              <span>${reaction.emoji}</span><span>${reaction.label}</span>
            </button>
          `).join("")}
        </div>
        <button class="reply-summary" data-thread-job="${escapeHtml(jobId)}">
          <span>${(state.notes[job.id] || []).length}개 메모</span>
          <strong>스레드에서 상세/매칭 보기</strong>
        </button>
      </div>
      <div class="message-actions">
        <button title="DM에 추가" data-open-dm="${escapeHtml(jobId)}">💬</button>
        <button title="Thread" data-thread-job="${escapeHtml(jobId)}">↪</button>
        <button title="Open" data-open-url="${escapeHtml(jobUrl(job))}">↗</button>
      </div>
    </article>
  `;
}

function renderThreadParentMessage(job) {
  const jobId = String(job.id);
  const sender = jobSender(job);
  return `
    <article class="message thread-parent-message">
      ${renderAvatarElement(job, `data-open-dm="${escapeHtml(jobId)}" title="DM에 추가"`)}
      <div class="message-content">
        <div class="message-meta">
          <button class="message-name" data-open-dm="${escapeHtml(jobId)}">${escapeHtml(sender.name)}</button>
          <span class="message-time">${escapeHtml(sender.title)} · ${escapeHtml(jobCompany(job))}</span>
        </div>
        <div class="message-text">${escapeHtml(formatSlackText(jobMessageText(job)))}</div>
      </div>
    </article>
  `;
}

function renderThreadDetailComment(job) {
  const slack = jobSlackMessages(job);
  const comment = slack.thread_comment || defaultDetails(job).join("\n");
  const sender = jobSender(job);
  const jobId = String(job.id);
  return `
    <article class="message slack-thread-comment thread-reply-message">
      ${renderAvatarElement(job, `data-open-dm="${escapeHtml(jobId)}" title="DM에 추가"`)}
      <div class="message-content">
        <div class="message-meta">
          <button class="message-name" data-open-dm="${escapeHtml(jobId)}">${escapeHtml(sender.name)}</button>
          <span class="message-time">댓글 · 상세 메모</span>
        </div>
        <div class="message-text">${escapeHtml(formatSlackText(comment))}</div>
      </div>
    </article>
  `;
}

function renderDm(options = {}) {
  if (state.activeDm === "ai-search") renderAiSearchDm();
  else if (state.activeDm === "analyze-job") renderAnalyzeJobDm();
  else if (state.activeDm === "profile") renderProfileDm();
  else if (state.activeDm === "search") renderSearchDm();
  else renderJobDm(findJob(state.activeDm?.replace("job:", "")));
  if (!options.preserveMessageScroll) {
    if (state.activeDm === "analyze-job" || state.activeDm?.startsWith("job:")) scrollToBottom(messageList);
    else scrollToTop(messageList);
  }
}

function renderAiSearchDm() {
  channelTitle.textContent = "검색 봇";
  channelSubtitle.textContent = "원하는 회사나 직무를 말하면 관련 공고를 찾아드립니다.";
  if (memberCount) memberCount.textContent = "bot";
  bookmarks.innerHTML = "";
  messageInput.placeholder = "예: LG전자에서 SW 개발 직군 공고 보여줘";
  messageList.innerHTML = `
    <section class="channel-intro">
      <div class="intro-icon">⌕</div>
      <h2>검색 봇</h2>
      <p>회사명, 직무, 지역, 경력 조건을 편하게 적어보세요. 어울리는 공고를 찾아 메시지로 정리해드립니다.</p>
    </section>
    <div id="aiSearchResults">
      ${state.searchBotMessages.length ? topAnchoredItems(state.searchBotMessages).map(renderAiSearchTurn).join("") : emptyBlock("원하는 공고를 자연어로 입력해보세요.")}
    </div>
  `;
}

function renderProfileDm() {
  channelTitle.textContent = "Resume & Portfolio";
  channelSubtitle.textContent = "PDF를 올리면 커리어 요약과 공고 매칭 기준을 정리합니다.";
  if (memberCount) memberCount.textContent = "me";
  bookmarks.innerHTML = "";
  messageInput.placeholder = "PDF 업로드는 위 패널에서만 가능합니다.";
  messageList.innerHTML = renderProfileUploadSurface();
  renderProfileThread();
}

function renderProfileUploadSurface() {
  const analysis = state.profileAnalysis || {};
  const extractedText = profileExtractedText(analysis);
  const locked = Boolean(analysis.locked);
  const uploadDisabled = locked || state.profileUploading;
  const statusLabel = profileAnalysisStatusLabel(analysis);
  return `
    <section class="channel-intro profile-intro">
      <div class="intro-icon">PDF</div>
      <h2>Resume & Portfolio</h2>
      <p>PDF를 올리면 핵심 경험, 강점 키워드, 공고 매칭에 쓸 포인트를 Slack 메모처럼 정리합니다.</p>
      <div class="intro-meta">
        <span>${escapeHtml(statusLabel)}</span>
        <span>${locked ? "분석 완료" : "다시 업로드 가능"}</span>
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
            <small>${locked ? "분석은 완료되었고 공고 스레드 매칭에 반영됩니다." : "PDF를 선택하면 바로 분석을 시작할 수 있어요."}</small>
          </label>
          ${state.profileUploadError ? `<p class="profile-upload-error">${escapeHtml(state.profileUploadError)}</p>` : ""}
          ${analysis.lastError ? `<p class="profile-upload-error">${escapeHtml(analysis.lastError)}</p>` : ""}
          <button type="submit" ${uploadDisabled ? "disabled" : ""}>${state.profileUploading ? "분석 중" : "AI 분석 시작"}</button>
        </form>
      </div>
    </article>

    ${state.profileUploading ? renderProfileLoadingMessage() : ""}
    ${extractedText || analysis.status === "completed" ? renderProfileAnalysisResult(analysis) : emptyBlock("아직 업로드된 PDF가 없습니다.")}
  `;
}

function profileExtractedText(analysis = {}) {
  return analysis.result?.extracted_text || analysis.extractedText || "";
}

function profileAnalysisStatusLabel(analysis = {}) {
  if (state.profileUploading || analysis.status === "running") return "분석 중";
  if (analysis.status === "completed") return "분석 완료";
  if (analysis.status === "text_extracted") return "텍스트 추출 완료";
  if (analysis.status === "failed") return "분석 실패";
  return "분석 대기";
}

function uniqueTextItems(items = [], limit = 72) {
  const result = [];
  const seen = new Set();
  items.flat(Infinity).forEach((item) => {
    const value = String(item ?? "").replace(/\s+/g, " ").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });
  return result.slice(0, limit);
}

function profileKeywordInventory(result = {}, limit = 72) {
  const matching = result.matching_profile || {};
  const inventory = matching.keyword_inventory || {};
  return uniqueTextItems([
    matching.core_keywords || [],
    ...PROFILE_KEYWORD_FIELDS.map((field) => inventory[field] || []),
  ], limit);
}

function renderProfileAnalysisResult(analysis) {
  const result = analysis.result && typeof analysis.result === "object" ? analysis.result : {};
  const display = result.ai_analysis_result?.chat_display_message || {};
  const keywords = profileKeywordInventory(result, 80);
  const evidence = result.matching_profile?.keyword_inventory?.evidence_phrases || [];
  if (!result.schema_version && analysis.status === "text_extracted") {
    return `
      <article class="message profile-result-message">
        <div class="message-avatar" style="background:#1264a3">RP</div>
        <div class="message-content">
          <div class="message-meta">
            <span class="message-name">Resume & Portfolio</span>
            <span class="message-time">텍스트 추출 완료</span>
          </div>
          <div class="message-text">PDF 내용은 읽어뒀어요. 지금은 AI 분석 키가 없거나 응답이 실패해서, 공고 매칭에는 기본 프로필 기준으로만 반영됩니다.</div>
          ${analysis.lastError ? `<p class="profile-upload-error">${escapeHtml(analysis.lastError)}</p>` : ""}
        </div>
      </article>
    `;
  }
  return `
      <article class="message profile-result-message">
      <div class="message-avatar" style="background:#007a5a">분</div>
      <div class="message-content">
        <div class="message-meta">
          <span class="message-name">${escapeHtml(display.title || "프로필분석이")}</span>
          <span class="message-time">${keywords.length ? `${keywords.length}개 키워드` : escapeHtml(result.generated_at || "")}</span>
        </div>
        <div class="message-text">${escapeHtml(display.summary || result.ai_analysis_result?.overall_summary || "분석 결과를 공고 매칭에 반영할 준비가 됐어요.")}</div>
        ${display.bullets?.length ? `<ul class="profile-result-bullets">${display.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        ${keywords.length ? `
          <div class="profile-keyword-label">공고 매칭에 쓸 키워드를 넓게 저장했어요</div>
          <div class="thread-keywords profile-keyword-cloud">${keywords.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
        ` : ""}
        ${evidence.length ? `
          <div class="profile-evidence-list">
            ${evidence.slice(0, 3).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
          </div>
        ` : ""}
      </div>
    </article>
  `;
}

function renderProfileLoadingMessage() {
  return `
    <article class="message profile-result-message">
      <div class="message-avatar" style="background:#1264a3">AI</div>
      <div class="message-content">
        <div class="message-meta">
          <span class="message-name">프로필 분석 중</span>
          <span class="message-time">잠시만요</span>
        </div>
        <div class="message-text">PDF에서 텍스트를 읽고, 공고 매칭에 쓸 키워드를 정리하고 있어요. 화면은 닫지 않아도 됩니다.</div>
        ${renderLoadingBar({ phase: "profile" })}
        <div class="profile-mini-skeleton">
          <span></span><span></span><span></span>
        </div>
      </div>
    </article>
  `;
}

function renderSearchDm() {
  channelTitle.textContent = "Search";
  channelSubtitle.textContent = "회사명이나 직무를 입력하면 관련 공고를 찾아드립니다.";
  if (memberCount) memberCount.textContent = "search";
  bookmarks.innerHTML = "";
  messageInput.placeholder = "LG전자 SW 개발자 채용 공고 보여줘";
  messageList.innerHTML = `
    <section class="channel-intro">
      <div class="intro-icon">⌕</div>
      <h2>Search</h2>
      <p>찾고 싶은 회사, 직무, 지역을 한 문장으로 보내면 관련 공고를 정리해서 보여드립니다.</p>
    </section>
    <div id="searchDmResults">
      ${state.searchBotMessages.length ? topAnchoredItems(state.searchBotMessages).map(renderSearchTurn).join("") : emptyBlock("원하는 공고를 자연어로 입력해보세요.")}
    </div>
  `;
}

function renderAnalyzeJobDm() {
  channelTitle.textContent = "Analyze Job Posting";
  channelSubtitle.textContent = "잡코리아 또는 회사 채용 페이지 URL을 붙여넣으면 공고 내용을 파싱합니다.";
  if (memberCount) memberCount.textContent = "parser";
  bookmarks.innerHTML = `<button class="bookmark">JobKorea URL</button><button class="bookmark">Company career page</button>`;
  messageInput.placeholder = "채용공고 URL 붙여넣기";
  messageList.innerHTML = `
    <section class="channel-intro analyze-job-intro">
      <div class="intro-icon">URL</div>
      <h2>Analyze Job Posting</h2>
      <p>웹에 있는 채용공고 링크를 그대로 보내면, 본문을 읽고 Slack에서 보기 좋은 요약 메시지로 바꿔드립니다.</p>
      <div class="intro-meta">
        <span>JobKorea</span>
        <span>회사 채용 페이지</span>
      </div>
    </section>
    <div id="analyzeJobResults">
      ${state.analyzeJobMessages.length ? bottomAnchoredItems(state.analyzeJobMessages).map(renderAnalyzeJobTurn).join("") : emptyBlock("분석할 채용공고 URL을 composer에 붙여넣어 주세요.")}
    </div>
  `;
}

function renderJobDm(job) {
  if (!job) {
    channelTitle.textContent = "Job DM";
    channelSubtitle.textContent = "공고를 다시 열 수 없습니다.";
    bookmarks.innerHTML = "";
    messageList.innerHTML = emptyBlock("공고 데이터를 찾지 못했어요. 채널이나 검색 결과에서 다시 DM을 열어주세요.");
    return;
  }
  const sender = jobSender(job);
  const jobId = String(job.id);
  const shouldShowMatch = hasProfileAnalysisData();
  const cachedMatch = cachedJobDmMatch(job);
  const shouldLoadMatch = shouldShowMatch && !cachedMatch && !isJobDmMatchLoading(job);
  channelTitle.textContent = sender.name;
  channelSubtitle.textContent = `${jobCompany(job)} · ${jobTitle(job)} 메모`;
  if (memberCount) memberCount.textContent = "DM";
  bookmarks.innerHTML = `<button class="bookmark">공고 브리핑</button><button class="bookmark">AI 매칭</button><button class="bookmark">내 메모</button>`;
  messageInput.placeholder = "이 공고에 대한 메모나 자소서 초안을 남기기";
  const notes = state.notes[job.id] || [];
  messageList.innerHTML = `
    ${renderThreadParentMessage(job)}
    <div class="day-divider"><span>공고 브리핑</span></div>
    ${renderJobDmBriefing(job)}
    ${renderJobDmPrepReply(job)}
    ${renderJobDmUrlReply(job)}
    <div class="day-divider"><span>AI matching</span></div>
    ${shouldShowMatch ? (cachedMatch ? renderMatch(cachedMatch, job) : renderMatchSkeleton()) : renderNoProfileMatchReply(job)}
    <div class="day-divider"><span>My notes</span></div>
    ${notes.length ? notes.map((note) => `
      <article class="message">
        <div class="message-avatar" style="background:#007a5a">ME</div>
        <div><div class="message-meta"><span class="message-name">Me</span><span class="message-time">${note.createdAt}</span></div>
        <div class="message-text">${escapeHtml(note.text)}</div></div>
      </article>
    `).join("") : emptyBlock("이 공고에 대한 메모를 기록하세요.")}
  `;
  if (shouldLoadMatch) loadJobDmMatch(job, jobId);
}

function renderJobDmBriefing(job) {
  const comment = jobSlackMessages(job).thread_comment || defaultDetails(job).join("\n");
  const sender = jobSender(job);
  const jobId = String(job.id);
  return `
    <article class="message job-dm-briefing-message">
      ${renderAvatarElement(job, `data-open-dm="${escapeHtml(jobId)}" title="DM에 추가"`)}
      <div class="message-content">
        <div class="message-meta">
          <button class="message-name" data-open-dm="${escapeHtml(jobId)}">${escapeHtml(sender.name)}</button>
          <span class="message-time">세부 브리핑</span>
        </div>
        <div class="message-text">${escapeHtml(formatSlackText(comment))}</div>
      </div>
    </article>
  `;
}

function renderJobDmPrepReply(job) {
  const sender = jobSender(job);
  const jobId = String(job.id);
  const keywords = jobKeywords(job).slice(0, 5);
  const keywordText = keywords.length ? keywords.join(", ") : "원문 키워드 확인 필요";
  const location = jobLocation(job);
  const period = jobPeriod(job);
  const salary = jobRaw(job).salary || "공고 상세 참고";
  const text = [
    "이 DM은 개인 검토용으로 써도 좋아요.",
    "바로 남겨두면 좋은 메모는 아래 정도입니다.",
    "",
    `1. 자소서 첫 문단: ${jobTitle(job)} 역할을 왜 보고 있는지`,
    `2. 경험 연결: ${keywordText}`,
    `3. 확인 필요: 위치 ${location}, 일정 ${period}, 처우 ${salary}`,
    "",
    "나중에 면접 준비할 때도 이 대화창에 질문/답변 초안을 이어서 남기면 됩니다.",
  ].join("\n");
  return `
    <article class="message job-dm-prep-message">
      ${renderAvatarElement(job, `data-open-dm="${escapeHtml(jobId)}" title="DM에 추가"`)}
      <div class="message-content">
        <div class="message-meta">
          <button class="message-name" data-open-dm="${escapeHtml(jobId)}">${escapeHtml(sender.name)}</button>
          <span class="message-time">검토 가이드</span>
        </div>
        <div class="message-text">${escapeHtml(text)}</div>
      </div>
    </article>
  `;
}

function renderJobDmUrlReply(job) {
  const sender = jobSender(job);
  const jobId = String(job.id);
  const url = jobUrl(job);
  return `
    <article class="message job-dm-url-message">
      ${renderAvatarElement(job, `data-open-dm="${escapeHtml(jobId)}" title="DM에 추가"`)}
      <div class="message-content">
        <div class="message-meta">
          <button class="message-name" data-open-dm="${escapeHtml(jobId)}">${escapeHtml(sender.name)}</button>
          <span class="message-time">원문 링크</span>
        </div>
        <div class="message-text">잡코리아 원문 URL도 같이 남겨둘게요.\n<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a></div>
      </div>
    </article>
  `;
}

function renderNoProfileMatchReply(job) {
  const jobId = String(job?.id || "");
  const sender = jobSender(job);
  return `
    <article class="message match-message">
      ${job ? renderAvatarElement(job, `data-open-dm="${escapeHtml(jobId)}" title="DM에 추가"`) : `<div class="message-avatar match-avatar">매</div>`}
      <div class="message-content">
        <div class="message-meta">
          ${job ? `<button class="message-name" data-open-dm="${escapeHtml(jobId)}">${escapeHtml(sender.name)}</button>` : `<span class="message-name">${escapeHtml(sender.name)}</span>`}
          <span class="message-time">프로필 대기</span>
        </div>
        <div class="message-text match-comment">Resume & Portfolio DM에 이력서나 포트폴리오 PDF를 올리면, 이 자리에서 이 공고와 내 프로필의 매칭 점수와 보완 방향을 바로 붙여둘게요.</div>
      </div>
    </article>
  `;
}

function jobDmMatchCacheKey(job) {
  const analysis = state.profileAnalysis || {};
  const result = analysis.result || {};
  return [
    job.id,
    analysis.completedAt || "",
    result.generated_at || "",
    result.schema_version || "",
    analysis.model || "",
  ].join("|");
}

function cachedJobDmMatch(job) {
  const jobId = String(job.id);
  const cached = state.jobDmMatches[jobId];
  return cached?.cacheKey === jobDmMatchCacheKey(job) ? cached.match : null;
}

function isJobDmMatchLoading(job) {
  return state.jobDmMatchLoading[String(job.id)] === jobDmMatchCacheKey(job);
}

async function loadJobDmMatch(job, jobId = String(job.id)) {
  const cacheKey = jobDmMatchCacheKey(job);
  if (state.jobDmMatchLoading[jobId] === cacheKey || state.jobDmMatches[jobId]?.cacheKey === cacheKey) return;
  state.jobDmMatchLoading[jobId] = cacheKey;
  try {
    const data = await api("/api/match", {
      method: "POST",
      body: JSON.stringify({ job, profile: state.profile, profileAnalysis: state.profileAnalysis }),
    });
    state.jobDmMatches[jobId] = { cacheKey, match: data.match };
  } catch (err) {
    state.jobDmMatches[jobId] = {
      cacheKey,
      match: {
        score: 0,
        comment_text: `매칭을 바로 계산하지 못했어요.\n${err.message}`,
        strengths: [],
        risks: [],
        nextActions: [],
      },
    };
  } finally {
    delete state.jobDmMatchLoading[jobId];
    if (state.activeMode === "dm" && state.activeDm === `job:${jobId}`) renderDm();
  }
}

function renderAnalyzeJobTurn(turn) {
  const running = turn.response?.status === "running";
  const failed = turn.response?.status === "failed";
  const job = turn.response?.job;
  return `
    <article class="message">
      <div class="message-avatar" style="background:#007a5a">ME</div>
      <div>
        <div class="message-meta"><span class="message-name">Me</span><span class="message-time">${escapeHtml(turn.time || "")}</span></div>
        <div class="message-text">${escapeHtml(turn.message)}</div>
      </div>
    </article>
    <article class="message analyze-url-reply">
      <div class="message-avatar analyze-url-avatar">AJ</div>
      <div class="message-content">
        <div class="message-meta">
          <span class="message-name">Analyze Job Posting</span>
          <span class="message-time">${running ? "분석 중" : failed ? "분석 실패" : "URL parsed"}</span>
        </div>
        ${running ? `
          <div class="message-text">링크를 열어서 공고 본문과 메타 정보를 읽고 있어요. 페이지 구조에 따라 몇 초 걸릴 수 있습니다.</div>
          ${renderLoadingBar({ phase: "url-parse" })}
          ${renderJobSkeletons(1, true)}
        ` : failed ? `
          <div class="message-text">이 URL은 바로 분석하지 못했어요.\n${escapeHtml(turn.response?.error || "페이지 접근 또는 파싱 중 오류가 발생했습니다.")}</div>
        ` : job ? `
          <div class="message-text">링크 열어봤고, 지금 보이는 정보 기준으로 이렇게 정리했어요.</div>
          ${renderAnalyzedJobMessage(job)}
        ` : `
          <div class="message-text">분석 결과가 비어 있습니다. URL을 다시 확인해 주세요.</div>
        `}
      </div>
    </article>
  `;
}

function renderAnalyzedJobMessage(job) {
  const jobId = String(job.id);
  return `
    <div class="analyzed-job-result job-message ${threadPanel.classList.contains("open") && String(state.selectedJob?.id) === jobId ? "thread-selected" : ""}" data-job="${escapeHtml(jobId)}" tabindex="0">
      <div class="message-text">${escapeHtml(formatSlackText(jobMessageText(job)))}</div>
      <div class="reactions">
        ${reactionTypes.map((reaction) => `
          <button class="reaction ${selectedClassifications(jobId).includes(reaction.key) ? "selected" : ""}" data-classify="${escapeHtml(jobId)}" data-reaction="${reaction.key}" title="${reaction.label}">
            <span>${reaction.emoji}</span><span>${reaction.label}</span>
          </button>
        `).join("")}
      </div>
      <button class="reply-summary" data-thread-job="${escapeHtml(jobId)}">
        <span>${(state.notes[job.id] || []).length}개 메모</span>
        <strong>스레드에서 상세/매칭 보기</strong>
      </button>
      <div class="message-actions analyze-result-actions">
        <button title="DM에 추가" data-open-dm="${escapeHtml(jobId)}">💬</button>
        <button title="Thread" data-thread-job="${escapeHtml(jobId)}">↪</button>
        <button title="Open" data-open-url="${escapeHtml(jobUrl(job))}">↗</button>
      </div>
    </div>
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
  const shouldShowMatch = hasProfileAnalysisData();
  threadChannel.textContent = `# ${threadScope}`;
  threadBody.innerHTML = `
    ${renderThreadParentMessage(job)}
    <div class="thread-reply-divider"><span>${shouldShowMatch ? "2" : "1"} replies</span></div>
    ${renderThreadDetailComment(job)}
    ${shouldShowMatch ? `<div id="matchResult">${renderMatchSkeleton()}</div>` : ""}
  `;
  scrollToTop(threadBody);
  if (!shouldShowMatch) return;
  const match = await api("/api/match", {
    method: "POST",
    body: JSON.stringify({ job, profile: state.profile, profileAnalysis: state.profileAnalysis }),
  }).catch((err) => ({ match: { score: 0, summary: err.message, strengths: [], risks: [], nextActions: [] } }));
  if (renderToken !== threadRenderToken || String(state.selectedJob?.id) !== String(job.id)) return;
  const result = threadBody.querySelector("#matchResult");
  if (result) {
    result.innerHTML = renderMatch(match.match, job);
    scrollToBottom(threadBody);
  }
}

function hasProfileAnalysisData() {
  const analysis = state.profileAnalysis || {};
  return analysis.status === "completed" && analysis.result && typeof analysis.result === "object";
}

function renderProfileThread() {
  const analysis = state.profileAnalysis || {};
  const result = analysis.result && typeof analysis.result === "object" ? analysis.result : {};
  const message = result.ai_analysis_result?.chat_display_message || {};
  const keywords = profileKeywordInventory(result, 36);
  const extractedText = profileExtractedText(analysis);
  threadChannel.textContent = "# profile";
  threadBody.innerHTML = `
    <div class="thread-context"><span>상태</span><strong>${escapeHtml(profileAnalysisStatusLabel(analysis))}</strong></div>
    ${result.schema_version ? `
      <section class="profile-thread-summary">
        <strong>${escapeHtml(message.title || "AI 분석 결과")}</strong>
        <p>${escapeHtml(message.summary || result.ai_analysis_result?.overall_summary || "")}</p>
        <div class="thread-keywords">${keywords.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      </section>
      <div class="empty-thread">이 분석은 공고 스레드의 매칭 코멘트에 반영됩니다.</div>
    ` : extractedText ? `
      <section class="profile-thread-summary">
        <strong>텍스트 추출 완료</strong>
        <p>PDF 텍스트는 읽었고, AI 분석을 다시 시도할 수 있습니다. ${analysis.lastError ? escapeHtml(analysis.lastError) : ""}</p>
      </section>
    ` : `
      <div class="empty-thread">PDF 분석 결과가 여기에 표시됩니다.</div>
    `}
  `;
}

function renderAiSearchTurn(turn) {
  return renderSearchTurn(turn);
}

function renderSearchTurn(turn) {
  const jobs = turn.response.jobs || [];
  const running = turn.response.aiTrace?.mode === "running";
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
        <div class="message-meta"><span class="message-name">Search</span><span class="message-time">${running ? "검색 중" : `${jobs.length} results`}</span></div>
        <div class="message-text">${escapeHtml(running ? "관련 공고를 찾는 중입니다." : jobs.length ? `${jobs.length}개의 관련 공고를 찾았어요.` : "조건에 맞는 공고를 찾지 못했어요. 회사명이나 직무명을 조금 더 넓게 입력해보세요.")}</div>
        ${running ? renderLoadingBar({ phase: "search" }) : ""}
      </div>
    </article>
    ${running ? "" : `
      <div class="day-divider search-result-divider"><span>검색 결과</span></div>
      <div class="search-result-feed">
        ${topAnchoredItems(jobs).map(renderJobMessage).join("") || emptyBlock("검색 결과가 없습니다.")}
      </div>
    `}
  `;
}

function defaultDetails(job) {
  return [
    `회사: ${jobCompany(job)}`,
    `공고명: ${jobTitle(job)}`,
    `접수기간: ${jobPeriod(job)}`,
    `근무지: ${jobLocation(job)}`,
    `키워드: ${jobKeywords(job).join(", ") || "상세 공고 참고"}`,
  ];
}

function extractFirstUrl(text = "") {
  const match = String(text).match(/https?:\/\/[^\s<>"']+/);
  return match ? match[0].replace(/[)\].,;!?]+$/, "") : "";
}

function renderMatch(match, job = null) {
  const score = Math.max(0, Math.min(100, Math.round(Number(match.score || 0))));
  const jobId = String(job?.id || "");
  const sender = job ? jobSender(job) : { name: "매칭분석이" };
  const fallbackComment = [
    match.summary,
    (match.strengths || []).length ? `좋아 보이는 부분: ${(match.strengths || []).join(", ")}` : "",
    (match.risks || []).length ? `확인할 부분: ${(match.risks || []).join(", ")}` : "",
    (match.nextActions || []).length ? `다음 액션\n${(match.nextActions || []).slice(0, 3).map((item, index) => `${index + 1}. ${item}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  const comment = formatMatchCommentText(match.comment_text || fallbackComment);
  return `
    <article class="message match-message">
      ${job ? renderAvatarElement(job, `data-open-dm="${escapeHtml(jobId)}" title="DM에 추가"`) : `<div class="message-avatar match-avatar">매</div>`}
      <div class="message-content">
        <div class="message-meta">
          ${job ? `<button class="message-name" data-open-dm="${escapeHtml(jobId)}">${escapeHtml(sender.name)}</button>` : `<span class="message-name">${escapeHtml(sender.name)}</span>`}
          <span class="message-time">${score}점 · 매칭 메모</span>
        </div>
        <div class="message-text match-comment">${escapeHtml(comment)}</div>
      </div>
    </article>
  `;
}

function renderMatchSkeleton() {
  return `
    <article class="message skeleton-message match-skeleton" aria-hidden="true">
      <div class="skeleton-avatar"></div>
      <div class="message-content">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line long"></div>
        <div class="skeleton-line long"></div>
      </div>
    </article>
  `;
}

function findJob(jobId) {
  return knownJobMap().get(String(jobId));
}

async function submitComposer(text) {
  if (state.activeMode === "channel" && state.activeChannel === "direct") {
    const url = extractFirstUrl(text);
    if (!url) return alert("채용공고 URL을 붙여넣어 주세요.");
    const data = await api(`/api/parse?url=${encodeURIComponent(url)}`);
    if (!state.jobs.direct.some((job) => (job.source_url || job.url) === url)) {
      state.jobs.direct.unshift(data.job);
      state.jobs.direct = state.jobs.direct.slice(0, 30);
      saveLocalState();
    }
    render();
    return;
  }

  if (state.activeMode === "dm" && state.activeDm === "analyze-job") {
    const url = extractFirstUrl(text);
    if (!url) return alert("분석할 채용공고 URL을 붙여넣어 주세요.");
    const pending = {
      id: `analyze-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      message: url,
      response: {
        status: "running",
        job: null,
        error: "",
      },
    };
    state.analyzeJobMessages.push(pending);
    state.analyzeJobMessages = state.analyzeJobMessages.slice(-30);
    saveLocalState();
    render();
    try {
      const [data] = await Promise.all([
        api("/api/parse-url", { method: "POST", body: JSON.stringify({ url }) }),
        delay(500),
      ]);
      pending.response = {
        status: "completed",
        job: data.job,
        error: "",
      };
    } catch (err) {
      pending.response = {
        status: "failed",
        job: null,
        error: err.message,
      };
    }
    saveLocalState();
    render();
    return;
  }

  if (state.activeMode === "dm" && state.activeDm === "ai-search") {
    const pending = {
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      message: text,
      response: {
        answer: "관련 공고를 찾는 중입니다.",
        aiTrace: { mode: "running", resultCount: 0, steps: ["request sent"] },
        jobs: [],
      },
    };
    state.searchBotMessages.push(pending);
    render();
    const [data] = await Promise.all([
      api("/api/ai-search", { method: "POST", body: JSON.stringify({ message: text }) }),
      delay(750),
    ]);
    pending.response = data;
    render();
    return;
  }

  if (state.activeMode === "dm" && state.activeDm === "search") {
    const pending = {
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      message: text,
      response: {
        answer: "관련 공고를 찾는 중입니다.",
        aiTrace: { mode: "running", resultCount: 0, steps: ["request sent"] },
        jobs: [],
      },
    };
    state.searchBotMessages.push(pending);
    render();
    try {
      const [data] = await Promise.all([
        api("/api/ai-search", { method: "POST", body: JSON.stringify({ message: text }) }),
        delay(750),
      ]);
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
  let channelToLoad = "";
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
    channelToLoad = channel.id;
  } else if (payload.action === "setEnabled") {
    const enabled = new Set(state.enabledChannelIds);
    if (payload.enabled) enabled.add(payload.channelId);
    else enabled.delete(payload.channelId);
    state.enabledChannelIds = allLocalChannels().map((channel) => channel.id).filter((channelId) => enabled.has(channelId));
    if (payload.enabled) channelToLoad = payload.channelId;
  } else if (payload.action === "delete") {
    state.customChannels = state.customChannels.filter((channel) => channel.id !== payload.channelId);
    state.enabledChannelIds = state.enabledChannelIds.filter((channelId) => channelId !== payload.channelId);
    delete state.jobs[payload.channelId];
    delete state.channelLoading[payload.channelId];
  } else {
    throw new Error("unknown channel action");
  }
  applyChannelPayload({
    customChannels: state.customChannels,
    enabledChannelIds: state.enabledChannelIds,
  });
  saveLocalState();
  renderChannelManager();
  render();
  if (channelToLoad && !state.jobs[channelToLoad]?.length) {
    loadJobsProgressive(channelToLoad);
  }
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
    if (!state.jobs[state.activeChannel]?.length) loadJobsProgressive(state.activeChannel);
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
    const job = findJob(openDm.dataset.openDm);
    if (job) rememberOpenJobDm(job);
    state.activeMode = "dm";
    state.activeDm = `job:${openDm.dataset.openDm}`;
    closeThreadPanel();
    saveLocalState();
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
      <span class="search-avatar avatar-photo"><img src="${avatarSvgDataUrl(jobAvatar(job))}" alt="" /></span>
      <span><strong>${escapeHtml(jobCompany(job))}</strong><p>${escapeHtml(jobTitle(job))}</p><small>${jobKeywords(job).slice(0, 4).map(escapeHtml).join(", ")}</small></span>
    </button>
  `).join("") || emptyBlock("결과가 없습니다.");
});

boot().catch((err) => {
  messageList.innerHTML = emptyBlock(err.message);
});
