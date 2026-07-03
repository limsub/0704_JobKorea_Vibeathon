async function loadDocs() {
  const response = await fetch("/api/docs");
  if (!response.ok) throw new Error("Failed to load documentation data");
  return response.json();
}

function text(id, value) {
  const element = document.querySelector(`#${id}`);
  if (element) element.textContent = value;
}

function renderFeatures(features) {
  document.querySelector("#featureList").innerHTML = features
    .map(
      (feature) => `
        <article class="feature-card">
          <header>
            <strong>${feature.name}</strong>
            <span class="badge">${feature.status}</span>
          </header>
          <p>${feature.detail}</p>
        </article>
      `
    )
    .join("");
}

function renderApis(apis) {
  document.querySelector("#apiTable").innerHTML = apis
    .map(
      (api) => `
        <article class="api-row">
          <span class="method ${api.method.toLowerCase()}">${api.method}</span>
          <code>${api.path}</code>
          <p>${api.description}</p>
        </article>
      `
    )
    .join("");
}

function renderRisks(risks) {
  document.querySelector("#riskList").innerHTML = risks
    .map((risk) => `<article class="risk-card">${risk}</article>`)
    .join("");
}

function render(data) {
  text("servedAt", data.project.servedAt);
  text("featureCount", data.features.length);
  text("apiCount", data.apis.length);
  text("notesCount", data.state.notesCount);
  text("classifiedJobs", data.state.classifiedJobs);
  text("dataPath", data.runtime.dataPath);
  text("externalShare", data.runtime.externalShare);
  text("aiProvider", data.runtime.aiProvider);

  renderFeatures(data.features);
  renderApis(data.apis);
  renderRisks(data.risks);

  document.querySelector("#statePreview").textContent = JSON.stringify(
    {
      runtime: data.runtime,
      state: data.state,
      project: data.project,
    },
    null,
    2
  );
}

loadDocs()
  .then(render)
  .catch((error) => {
    document.querySelector("#statePreview").textContent = error.message;
  });
