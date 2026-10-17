"use strict";

let state = {
  audio: undefined,
  audioPath: undefined,
  audioSource: undefined,
  audioContext: undefined
};

function formatTime(value) {
  let time = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  let hours = String(Math.floor(time / 3600)).padStart(2, "0");
  let minutes = String(Math.floor(time % 3600 / 60)).padStart(2, "0");
  let seconds = String(time % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function updateDisplay() {
  document.querySelectorAll(".directory").forEach(function (element) {
    if (state.audioPath && state.audioPath.startsWith(element.dataset.path + "/")) {
      element.dataset.state = "play";
    } else {
      element.removeAttribute("data-state");
    }
  });

  document.querySelectorAll("x-track").forEach(function (element) {
    let timeline = element.querySelector("x-track-timeline");
    let timelinePosition = timeline.querySelector("x-track-timeline-position");
    let timelineDuration = timeline.querySelector("x-track-timeline-duration");

    if (state.audioPath && element.dataset.path == state.audioPath) {
      element.dataset.state = "play";
      if (state.audio && Number.isFinite(state.audio.duration)) {
        element.dataset.duration = state.audio.duration;
      }
      timelinePosition.textContent = formatTime(state.audio ? state.audio.currentTime : 0);
      let progress = state.audio && Number.isFinite(state.audio.duration) && state.audio.duration > 0
        ? state.audio.currentTime / state.audio.duration * 100
        : 0;
      timeline.style.setProperty("--progress", progress + "%");
    } else {
      element.dataset.state = "start";
      timelinePosition.textContent = formatTime(0);
      timeline.style.setProperty("--progress", "0%");
    }

    timelineDuration.textContent = formatTime(Number(element.dataset.duration));
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

  let audio = state.audio;
  audio.addEventListener("durationchange", function () {
    if (state.audio === audio) {
      updateDisplay();
    }
  });
  audio.addEventListener("timeupdate", function () {
    if (state.audio === audio) {
      updateDisplay();
    }
  });
  audio.addEventListener("ended", function () {
    if (state.audio === audio) {
      state.audioPath = undefined;
      state.audioSource.disconnect();
      state.audioSource = undefined;
      state.audio = undefined;
      updateDisplay();
      playNextTrack(path);
    }
  });

  try {
    await state.audioContext.resume();
    await state.audio.play();
  } catch (e) {
    console.error(e);
  }

  updateDisplay();
}

async function playNextTrack(pathPrev) {
  let tracks = Array.from(document.querySelectorAll("x-track"));
  let indexPrev = tracks.findIndex(function (element) {
    return element.dataset.path === pathPrev;
  });

  if (indexPrev >= 0 && indexPrev + 1 < tracks.length) {
    await playTrack(tracks[indexPrev + 1].dataset.path);
  }
}

async function fetchFileList(path = "") {
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
  var timelinePosition = document.createElement("x-track-timeline-position");
  var timelineDuration = document.createElement("x-track-timeline-duration");
  var timelineCursor = document.createElement("x-track-timeline-cursor");
  var timelineCursorLabel = document.createElement("x-track-timeline-cursor-label");

  timelinePosition.textContent = formatTime(0);
  timelineDuration.textContent = formatTime(0);
  timelineCursor.append(timelineCursorLabel);
  timeline.append(timelinePosition, timelineDuration, timelineCursor);

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

  timeline.addEventListener("click", function (event) {
    if (state.audioPath !== element.dataset.path || !state.audio || !Number.isFinite(state.audio.duration)) {
      return;
    }

    let bounds = timeline.getBoundingClientRect();
    if (bounds.width === 0) {
      return;
    }

    let position = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
    state.audio.currentTime = position / bounds.width * state.audio.duration;
    updateDisplay();
  });

  timeline.addEventListener("mousemove", function (event) {
    let bounds = timeline.getBoundingClientRect();
    let position = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
    timelineCursor.style.left = position + "px";

    if (state.audioPath === element.dataset.path && state.audio && Number.isFinite(state.audio.duration) && bounds.width > 0) {
      timelineCursorLabel.textContent = formatTime(position / bounds.width * state.audio.duration);
      timelineCursorLabel.dataset.position = position < bounds.width / 2 ? "left" : "right";
    }
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

function displayPage(path) {
  if (path.endsWith("/")) {
    path = path.slice(0,  -1);
  }

  renderBrowser(path);
}

displayPage(decodeURIComponent(document.location.pathname));

window.addEventListener("popstate", function () {
  displayPage(decodeURIComponent(document.location.pathname));
});
