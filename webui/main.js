"use strict";

let state = {
  audio: undefined,
  audioPath: undefined,
  audioSource: undefined,
  audioContext: undefined
};

function updateDisplay() {
  document.querySelectorAll(".directory").forEach(function (element) {
    console.log(state.audioPath, element.dataset.path);
    if (state.audioPath && state.audioPath.startsWith(element.dataset.path + "/")) {
      element.dataset.state = "play";
    } else {
      element.removeAttribute("data-state");
    }
  });

  document.querySelectorAll("x-track").forEach(function (element) {
    if (state.audioPath && element.dataset.path == state.audioPath) {
      element.dataset.state = "play";
    } else {
      element.dataset.state = "start";
    }
  })
}

async function playTrack(path) {
  console.log("PLAY", path);

  state.audioPath = path;

  if (!state.audioContext) {
    state.audioContext = new AudioContext();
  }

  if (state.audioSource) {
    state.audioSource.disconnect();
  }

  if (state.audio) {
    state.audio.remove();
  }

  state.audio = new Audio(`/api/download?path=${encodeURIComponent(path)}`);
  state.audioSource = state.audioContext.createMediaElementSource(state.audio);
  state.audioSource.connect(state.audioContext.destination);

  try {
    await state.audioContext.resume();
    await state.audio.play();
  } catch (e) {
    console.error(e);
  }

  updateDisplay();
}

async function fetchFileList(path = "") {
  console.log(path);
  let res = await fetch(`/api/list?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    alert("Failed to list directory");
    return [];
  }
  return res.json();
}

async function navigateTo(path) {
  history.pushState({}, "", path || "/");
  renderBrowser(path);
}

function renderTrack(element) {
  if (element.getAttribute("data-initialized") === "true") {
    return;
  }

  element.dataset.state = "start";

  var cover = document.createElement("x-track-cover");
  var coverImage = document.createElement("img");
  var detail = document.createElement("x-track-detail");
  var release = document.createElement("x-track-release");
  var title = document.createElement("x-track-title");
  var controls = document.createElement("x-track-controls");
  var control = document.createElement("x-track-control");
  var playButton = document.createElement("button");
  var playIcon = document.createElement("img");
  var timeline = document.createElement("x-track-timeline");

  release.textContent = element.dataset.release || "";
  title.textContent = element.dataset.title || "";

  if (element.dataset.cover) {
    coverImage.src = element.dataset.cover;
    coverImage.alt = "";
    cover.append(coverImage);
  }

  control.addEventListener("click", async function () {
    await playTrack(element.dataset.path);
  });

  control.append(playButton);

  controls.append(control, timeline);
  detail.append(release, title, controls);
  element.replaceChildren(cover, detail);
  element.setAttribute("data-initialized", "true");
}

async function renderBrowser(path) {
  let files = await fetchFileList(path);

  let mainElem = document.querySelector("main");
  mainElem.innerHTML = `
    <nav>
      <span class="path"></span>
    </nav>

    <div id="browser"></div>
  `;

  let pathComponents = path.split("/");
  let pathElem = mainElem.querySelector(".path");
  for (let i = 0; i < pathComponents.length; ++i) {
    let pathCompLabel;
    if (i == 0) {
      pathCompLabel = "~/";
    } else if (i + 1 < pathComponents.length) {
      pathCompLabel = pathComponents[i] + "/";
    } else {
      pathCompLabel = pathComponents[i];
    }

    let pathCompURL = pathComponents.slice(0, i + 1).join("/");
    let pathCompElem = document.createElement("a");
    pathCompElem.innerText = pathCompLabel;
    pathCompElem.addEventListener("click", () => navigateTo(pathCompURL));
    pathElem.appendChild(pathCompElem);
  }

  let browserElem = mainElem.querySelector("#browser");

  for (let f of files) {
    let filePath = path + "/" + f.name;

    if (f.dir) {
      let directoryElem = document.createElement("div");
      directoryElem.classList.add("directory");
      directoryElem.dataset.path = filePath;
      let directoryLinkElem = document.createElement("a");
      directoryLinkElem.innerText = f.name + "/";
      directoryLinkElem.addEventListener("click", () => navigateTo(filePath));
      directoryElem.appendChild(directoryLinkElem);
      browserElem.appendChild(directoryElem);
    } else if (f.name.toLowerCase().endsWith(".mp3")) {
      let trackElem = document.createElement("x-track");
      trackElem.dataset.path = filePath;
      trackElem.dataset.title = f.name;
      trackElem.dataset.release = f.name;
      browserElem.appendChild(trackElem);
      renderTrack(trackElem);
    }
  }

  updateDisplay();
}

if (document.querySelector("main")) {
  renderBrowser(document.location.pathname === "/" ? "" : decodeURIComponent(document.location.pathname));
}
