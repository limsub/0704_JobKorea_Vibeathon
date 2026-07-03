const API = "";
const MAX_PROFILE_PDF_BYTES = 40 * 1024 * 1024;

let channels = [];

const reactionTypes = [
  { key: "watch", emoji: "👀", label: "관심 있음" },
  { key: "candidate", emoji: "⭐", label: "지원 후보" },
  { key: "pass", emoji: "❌", label: "패스" },
  { key: "salary", emoji: "💰", label: "연봉 좋음" },
];

const state = {
  activeMode: "channel",
  activeChannel: "pm",
  activeDm: null,
  jobs: { direct: [] },
  channelCatalog: [],
  enabledChannelIds: [],
  classifications: {},
  notes: {},
  profile: {},
  profileAnalysis: {},
  profileUploading: false,
  profileUploadError: "",
  profileSelectedFileName: "",
  selectedJob: null,
  tone: "business",
  loading: false,
  searchBotMessages: [],
};

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
const searchTrigger = document.querySelector("#searchTrigger");
const searchOverlay = document.querySelector("#searchOverlay");
const searchInput = document.querySelector("#searchInput");
const searchResults = document.querySelector("#searchResults");
const channelOverlay = document.querySelector("#channelOverlay");
const channelManager = document.querySelector("#channelManager");
const channelFilter = document.querySelector("#channelFilter");
const closeChannelManager = document.querySelector("#closeChannelManager");
const customChannelForm = document.querySelector("#customChannelForm");

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
  return channels.find((channel) => channel.id === state.activeChannel) || channels[0] || {
    id: "direct",
    name: "direct-parsing",
    query: "",
    subtitle: "채용공고 URL을 붙여넣으면 thread로 파싱",
    bookmarks: [],
  };
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

function jobRaw(job) {
  return job.raw || {};
}

function jobProfile(job) {
  return job.job_profile || {};
}

function jobSlackMessages(job) {
  return job.slack_messages || { message_title: "", message_body: "" };
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

function toneText(job) {
  const slack = jobSlackMessages(job);
  if (slack.message_title || slack.message_body) return [slack.message_title, slack.message_body].filter(Boolean).join(" ");
  if (state.tone === "raw") return `${jobCompany(job)} · ${jobTitle(job)}`;
  if (state.tone === "friendly") return `${jobCompany(job)}에서 ${jobTitle(job)} 포지션을 찾았어요. 현재 slack_messages는 ChatGPT API 미사용으로 비어 있습니다.`;
  return `${jobCompany(job)} 채용공고 원문 JSON입니다. slack_messages는 ChatGPT API 연동 전까지 빈 값으로 유지됩니다.`;
}

async function boot() {
  await loadState();
  await loadChannels();
  if (!channels.some((channel) => channel.id === state.activeChannel)) {
    state.activeChannel = channels.find((channel) => channel.id !== "direct")?.id || channels[0]?.id || "direct";
  }
  render();
  await Promise.all(channels.filter((channel) => channel.id !== "direct").map((channel) => loadJobs(channel.id)));
  render();
}

async function loadState() {
  const data = await api("/api/state").catch(() => ({}));
  state.classifications = data.classifications || {};
  state.notes = data.notes || {};
  state.profile = data.profile || {};
  state.profileAnalysis = data.profileAnalysis || {};
  state.jobs.direct = data.directParsedJobs || [];
}

async function loadChannels() {
  const data = await api("/api/channels");
  channels = data.channels || [];
  state.channelCatalog = data.catalog || [];
  state.enabledChannelIds = data.enabledChannelIds || [];
  channels.forEach((channel) => {
    if (!state.jobs[channel.id]) state.jobs[channel.id] = [];
  });
}

async function loadJobs(channelId) {
  const data = await api(`/api/jobs?channel=${encodeURIComponent(channelId)}`).catch(() => ({ jobs: [] }));
  state.jobs[channelId] = data.jobs || [];
}

function render() {
  renderSidebar();
  if (state.activeMode === "channel") renderChannel();
  else renderDm();
  scrollSlackSurfacesToBottom();
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

  const jobDms = Object.values(state.jobs).flat().slice(0, 12).map((job) => ({
    id: `job:${job.id}`,
    name: jobCompany(job),
    job,
  }));
  const fixed = [
    { id: "ai-search", name: "검색 봇", icon: "⌕" },
    { id: "profile", name: "Resume & Portfolio", icon: "📎" },
    { id: "search", name: "Search DM", icon: "⌕" },
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
}

function renderChannel() {
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
      ${jobs.length ? timelineItems(jobs).map(renderJobMessage).join("") : emptyBlock("아직 파싱된 URL이 없습니다.")}
    `;
    renderThread(jobs[0]);
    return;
  }

  messageList.innerHTML = `
    ${channelIntro(channel, "개발 단계에서는 JobKorea 크롤링 결과를 JSON_1 형태 그대로 보여줍니다. slack_messages는 ChatGPT API 연동 전까지 빈 값입니다.")}
    <div class="job-toolbar">
      <button data-refresh="${channel.id}">JobKorea 새로고침</button>
      <label>톤
        <input type="range" min="0" max="2" value="${["raw", "business", "friendly"].indexOf(state.tone)}" id="toneSlider" />
        <span>${toneLabel()}</span>
      </label>
    </div>
    <div class="day-divider"><span>${channel.query} results</span></div>
    ${jobs.length ? timelineItems(jobs).map(renderJobMessage).join("") : emptyBlock("공고를 불러오는 중입니다.")}
  `;
  renderThread(state.selectedJob || jobs[0]);
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

function timelineItems(items = []) {
  return [...items].reverse();
}

function scrollToBottom(element) {
  if (!element) return;
  requestAnimationFrame(() => {
    element.scrollTop = element.scrollHeight;
  });
}

function scrollSlackSurfacesToBottom() {
  scrollToBottom(messageList);
  scrollToBottom(threadBody);
}

function renderJobMessage(job) {
  const selected = state.classifications[job.id] || [];
  const company = jobCompany(job);
  return `
    <article class="message job-message" data-job="${job.id}">
      <button class="message-avatar" style="background:${colorFor(company)}" data-open-dm="${job.id}">${initials(company)}</button>
      <div class="message-content">
        <div class="message-meta">
          <button class="message-name" data-open-dm="${job.id}">${escapeHtml(company)}</button>
          <span class="message-time">${escapeHtml(jobSource(job))}</span>
        </div>
        <div class="message-text">${escapeHtml(toneText(job))}</div>
        ${renderJobCard(job)}
        <div class="reactions">
          ${reactionTypes.map((reaction) => `
            <button class="reaction ${selected.includes(reaction.key) ? "selected" : ""}" data-classify="${job.id}" data-reaction="${reaction.key}">
              <span>${reaction.emoji}</span><span>${reaction.label}</span>
            </button>
          `).join("")}
        </div>
        <button class="reply-summary" data-thread-job="${job.id}">
          <span>${(state.notes[job.id] || []).length} notes</span>
          <strong>View thread + local match</strong>
        </button>
      </div>
      <div class="message-actions">
        <button title="DM" data-open-dm="${job.id}">💬</button>
        <button title="Thread" data-thread-job="${job.id}">↪</button>
        <button title="Open" data-open-url="${jobUrl(job)}">↗</button>
      </div>
    </article>
  `;
}

function renderJobCard(job) {
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
        <span>${escapeHtml(jobUrl(job))}</span>
        <a href="${jobUrl(job)}" target="_blank" rel="noreferrer">원문 열기</a>
      </div>
    </div>
  `;
}

function renderDm() {
  if (state.activeDm === "ai-search") return renderAiSearchDm();
  if (state.activeDm === "profile") return renderProfileDm();
  if (state.activeDm === "search") return renderSearchDm();
  const job = findJob(state.activeDm?.replace("job:", ""));
  return renderJobDm(job);
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
        <span>No GPT API key</span>
        <span>No local Codex</span>
        <span>JobKorea crawl</span>
      </div>
    </section>
    <div id="aiSearchResults">
      ${state.searchBotMessages.length ? timelineItems(state.searchBotMessages).map(renderAiSearchTurn).join("") : emptyBlock("원하는 공고를 자연어로 입력해보세요.")}
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
  const result = analysis.result;
  const extractedText = profileExtractedText(analysis);
  const locked = analysis.locked || Number(analysis.attempts || 0) >= 1;
  const uploadDisabled = locked || state.profileUploading;
  const statusLabel = profileAnalysisStatusLabel(analysis);
  return `
    <section class="channel-intro profile-intro">
      <div class="intro-icon">PDF</div>
      <h2>Resume & Portfolio</h2>
      <p>이력서와 포트폴리오는 PDF 파일만 받습니다. 분석이 끝나면 저장된 사용자 프로필 JSON을 그대로 표시합니다.</p>
      <div class="intro-meta">
        <span>${escapeHtml(statusLabel)}</span>
        <span>${analysis.attempts || 0}/1 AI call</span>
        <span>${locked ? "locked" : "ready"}</span>
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
            <small>${locked ? "AI 분석은 이미 1회 사용되었습니다." : "application/pdf"}</small>
          </label>
          ${state.profileUploadError ? `<p class="profile-upload-error">${escapeHtml(state.profileUploadError)}</p>` : ""}
          ${analysis.lastError && analysis.status === "failed" ? `<p class="profile-upload-error">${escapeHtml(analysis.lastError)}</p>` : ""}
          <button type="submit" ${uploadDisabled ? "disabled" : ""}>${state.profileUploading ? "분석 중" : "AI 분석 시작"}</button>
        </form>
      </div>
    </article>

    ${extractedText ? renderExtractedTextResult(analysis, extractedText) : ""}
    ${result ? renderProfileAnalysisResult(result) : emptyBlock(locked ? "AI 분석 시도 기록이 있습니다." : "아직 업로드된 PDF가 없습니다.")}
  `;
}

function profileExtractedText(analysis = {}) {
  return analysis.result?.extracted_text || analysis.extractedText || "";
}

function profileAnalysisStatusLabel(analysis = {}) {
  if (state.profileUploading || analysis.status === "running") return "분석 중";
  if (analysis.status === "completed") return "분석 완료";
  if (analysis.status === "failed") return "분석 실패";
  return "분석 대기";
}

function renderProfileAnalysisResult(result) {
  const display = result.ai_analysis_result?.chat_display_message || {};
  return `
    <article class="message profile-result-message">
      <div class="message-avatar" style="background:#007a5a">AI</div>
      <div class="message-content">
        <div class="message-meta">
          <span class="message-name">${escapeHtml(display.title || "PDF 분석이 완료되었습니다.")}</span>
          <span class="message-time">${escapeHtml(result.generated_at || "")}</span>
        </div>
        <div class="message-text">${escapeHtml(display.summary || result.ai_analysis_result?.overall_summary || "")}</div>
        ${display.bullets?.length ? `<ul class="profile-result-bullets">${display.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        <section class="json-output-card">
          <div class="json-card-head">
            <div>
              <span class="job-source">2. JSON 변환 결과</span>
              <h3>${escapeHtml(result.candidate_profile?.headline || "AI 분석 결과")}</h3>
            </div>
            <span class="job-dday">${escapeHtml(result.model || "OpenAI")}</span>
          </div>
          <pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>
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
  channelTitle.textContent = "Search DM";
  channelSubtitle.textContent = "자연어로 JobKorea 공고를 검색합니다. 예: LG전자에서 SW 개발 직군 공고 보여줘";
  memberCount.textContent = "search";
  bookmarks.innerHTML = `<button class="bookmark">natural language</button><button class="bookmark">JobKorea search</button>`;
  messageInput.placeholder = "NC 채용 공고 보여줘";
  messageList.innerHTML = `
    <section class="channel-intro">
      <div class="intro-icon">⌕</div>
      <h2>Search DM</h2>
      <p>검색 문장을 보내면 로컬 서버가 핵심 키워드를 뽑아 JobKorea에서 검색하고, 결과를 DM 답장처럼 보여줍니다.</p>
    </section>
    <div id="searchDmResults">${emptyBlock("검색어를 입력해보세요.")}</div>
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
  renderThread(job);
}

async function renderThread(job) {
  if (!job) {
    threadChannel.textContent = "# empty";
    threadBody.innerHTML = emptyBlock("공고를 선택하면 로컬 매칭 결과가 표시됩니다.");
    scrollToBottom(threadBody);
    return;
  }
  state.selectedJob = job;
  threadChannel.textContent = `# ${state.activeMode === "channel" ? currentChannel().name : "DM"}`;
  threadBody.innerHTML = `
    <div class="thread-context"><span>local matching</span><strong>계산 중</strong></div>
    ${renderJobMessage(job)}
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
  const match = await api("/api/match", { method: "POST", body: JSON.stringify({ job }) }).catch((err) => ({ match: { score: 0, summary: err.message, strengths: [], risks: [], nextActions: [] } }));
  const result = document.querySelector("#matchResult");
  if (result) {
    result.innerHTML = renderMatch(match.match);
    scrollToBottom(threadBody);
  }
}

function renderProfileThread() {
  const analysis = state.profileAnalysis || {};
  const result = analysis.result || {};
  const message = result.ai_analysis_result?.chat_display_message || {};
  const keywords = result.matching_profile?.core_keywords || [];
  threadChannel.textContent = "# profile";
  threadBody.innerHTML = `
    <div class="thread-context"><span>상태</span><strong>${escapeHtml(profileAnalysisStatusLabel(analysis))}</strong></div>
    ${result.schema_version ? `
      <section class="profile-thread-summary">
        <strong>${escapeHtml(message.title || "AI 분석 결과")}</strong>
        <p>${escapeHtml(message.summary || result.ai_analysis_result?.overall_summary || "")}</p>
        <div class="thread-keywords">${keywords.slice(0, 8).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      </section>
      <div class="empty-thread">이 JSON은 공고 스레드의 로컬 매칭 키워드에도 반영됩니다.</div>
    ` : `
      <div class="empty-thread">${analysis.status === "failed" ? escapeHtml(analysis.lastError || "분석 실패") : "PDF 분석 결과가 여기에 표시됩니다."}</div>
    `}
  `;
}

function renderSearchThread() {
  threadChannel.textContent = "# search";
  threadBody.innerHTML = `
    <div class="thread-context"><span>검색 방식</span><strong>local NLP</strong></div>
    <div class="empty-thread">예: “NC 채용 공고 보여줘”, “LG전자에서 SW 개발 직군 공고 보여줘”</div>
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
        <div class="message-meta"><span class="message-name">검색 봇</span><span class="message-time">${turn.response.aiTrace.mode}</span></div>
        <div class="message-text">${escapeHtml(turn.response.answer)}</div>
        ${renderAiTrace(turn.response)}
        <div class="day-divider"><span>crawled jobs</span></div>
        ${timelineItems(turn.response.jobs || []).map(renderJobMessage).join("") || emptyBlock("검색 결과가 없습니다.")}
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
  ];
}

function renderMatch(match) {
  return `
    <section class="ai-match">
      <div class="match-score">${match.score}<span>%</span></div>
      <div>
        <h3>나와의 로컬 매칭</h3>
        <p>${escapeHtml(match.summary || "")}</p>
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
  return Object.values(state.jobs).flat().find((job) => String(job.id) === String(jobId));
}

function toneLabel() {
  return { raw: "완전 raw", business: "비즈니스 레벨", friendly: "친근함" }[state.tone];
}

async function submitComposer(text) {
  if (state.activeMode === "channel" && state.activeChannel === "direct") {
    const match = text.match(/https?:\/\/\S+/);
    if (!match) return alert("채용공고 URL을 붙여넣어 주세요.");
    const data = await api(`/api/parse?url=${encodeURIComponent(match[0])}`);
    state.jobs.direct.unshift(data.job);
    render();
    renderThread(data.job);
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
    state.searchBotMessages.unshift(pending);
    render();
    const data = await api("/api/ai-search", { method: "POST", body: JSON.stringify({ message: text }) });
    pending.response = data;
    render();
    return;
  }

  if (state.activeMode === "dm" && state.activeDm === "search") {
    const query = extractSearchQuery(text);
    const data = await api(`/api/search?q=${encodeURIComponent(query)}`);
    const container = document.querySelector("#searchDmResults");
    container.innerHTML = `
      <div class="day-divider"><span>${escapeHtml(query)} results</span></div>
      ${timelineItems(data.jobs || []).map(renderJobMessage).join("") || emptyBlock("검색 결과가 없습니다.")}
    `;
    state.jobs.search = data.jobs || [];
    renderSidebar();
    scrollToBottom(messageList);
    return;
  }

  if (state.activeMode === "dm" && state.activeDm?.startsWith("job:")) {
    const jobId = state.activeDm.replace("job:", "");
    const data = await api("/api/note", { method: "POST", body: JSON.stringify({ jobId, text }) });
    state.notes[jobId] = data.notes;
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
  channels = data.channels || channels;
  state.channelCatalog = data.catalog || state.channelCatalog;
  state.enabledChannelIds = data.enabledChannelIds || state.enabledChannelIds;
  channels.forEach((channel) => {
    if (!state.jobs[channel.id]) state.jobs[channel.id] = [];
  });
  if (!channels.some((channel) => channel.id === state.activeChannel)) {
    state.activeChannel = channels.find((channel) => channel.id !== "direct")?.id || "direct";
  }
}

async function mutateChannels(payload) {
  const data = await api("/api/channels", { method: "POST", body: JSON.stringify(payload) });
  applyChannelPayload(data);
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
  const visibleChannels = state.channelCatalog.filter((channel) => {
    const haystack = `${channel.name} ${channel.query} ${channel.category} ${(channel.bookmarks || []).join(" ")}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  channelManager.innerHTML = visibleChannels.map((channel) => {
    const isEnabled = enabled.has(channel.id);
    const isCustom = channel.source === "custom";
    return `
      <article class="channel-option">
        <div class="channel-option-main">
          <span class="channel-hash">#</span>
          <div>
            <strong>${escapeHtml(channel.name)}</strong>
            <p>${escapeHtml(channel.subtitle || channel.query)}</p>
            <small>${escapeHtml(channel.category || "직군")} · ${escapeHtml(channel.query || "")}</small>
          </div>
        </div>
        <div class="channel-option-actions">
          <button class="${isEnabled ? "selected" : ""}" data-toggle-channel="${channel.id}" data-enabled="${String(!isEnabled)}">
            ${isEnabled ? "숨기기" : "표시"}
          </button>
          ${isCustom ? `<button class="danger" data-delete-channel="${channel.id}">삭제</button>` : ""}
        </div>
      </article>
    `;
  }).join("") || emptyBlock("조건에 맞는 직군 채널이 없습니다.");
}

document.addEventListener("click", async (event) => {
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
    render();
  }

  const dmButton = event.target.closest("[data-dm]");
  if (dmButton) {
    state.activeMode = "dm";
    state.activeDm = dmButton.dataset.dm;
    render();
  }

  const refresh = event.target.closest("[data-refresh]");
  if (refresh) {
    await loadJobs(refresh.dataset.refresh);
    render();
  }

  const classify = event.target.closest("[data-classify]");
  if (classify) {
    const jobId = classify.dataset.classify;
    const reaction = classify.dataset.reaction;
    const current = new Set(state.classifications[jobId] || []);
    current.has(reaction) ? current.delete(reaction) : current.add(reaction);
    state.classifications[jobId] = [...current];
    await api("/api/classify", { method: "POST", body: JSON.stringify({ jobId, classification: state.classifications[jobId] }) }).catch(() => null);
    render();
  }

  const threadJob = event.target.closest("[data-thread-job]");
  if (threadJob) renderThread(findJob(threadJob.dataset.threadJob));

  const openDm = event.target.closest("[data-open-dm]");
  if (openDm) {
    state.activeMode = "dm";
    state.activeDm = `job:${openDm.dataset.openDm}`;
    render();
  }

  const openUrl = event.target.closest("[data-open-url]");
  if (openUrl) window.open(openUrl.dataset.openUrl, "_blank", "noopener");

  if (event.target.id === "saveProfile") {
    const profile = {
      resume: document.querySelector("#resumeInput").value,
      portfolio: document.querySelector("#portfolioInput").value,
      skills: document.querySelector("#skillsInput").value,
      preferences: document.querySelector("#preferencesInput").value,
    };
    const data = await api("/api/profile", { method: "POST", body: JSON.stringify({ profile }) });
    state.profile = data.profile;
    render();
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "toneSlider") {
    state.tone = ["raw", "business", "friendly"][Number(event.target.value)];
    render();
  }
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
    state.profile = data.profile || state.profile;
    state.profileSelectedFileName = "";
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

customChannelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(customChannelForm);
  const name = String(form.get("name") || "").trim();
  const query = String(form.get("query") || "").trim();
  if (!name || !query) return alert("채널 이름과 검색 키워드를 입력해 주세요.");
  await mutateChannels({ action: "create", name, query }).catch((err) => alert(err.message));
  customChannelForm.reset();
});

threadReply.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = threadInput.value.trim();
  if (!text || !state.selectedJob) return;
  threadInput.value = "";
  const data = await api("/api/note", { method: "POST", body: JSON.stringify({ jobId: state.selectedJob.id, text }) });
  state.notes[state.selectedJob.id] = data.notes;
  renderThread(state.selectedJob);
});

closeThread.addEventListener("click", () => threadPanel.classList.remove("open"));
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
