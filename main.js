import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  DisconnectReason
} from "livekit-client";
import "./style.css";

const app = document.querySelector("#app");
let room = null;
let localName = "";
let currentRoomName = "";
let micOn = false;
let chatMessages = [];

app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <a class="brand" href="#"><span class="moon">☾</span> MIDNIGHT <b>WORLD</b></a>
      <span class="live-label"><i></i> LIVE ROOMS</span>
    </header>
    <main>
      <section id="home" class="hero">
        <div class="eyebrow">YOUR PEOPLE. YOUR ROOM. YOUR WORLD.</div>
        <h1>Find your <span>people</span><br/>after dark.</h1>
        <p class="sub">Join a room, turn on your mic, and talk live with everyone inside.</p>
        <div class="join-card">
          <label for="displayName">YOUR DISPLAY NAME</label>
          <input id="displayName" maxlength="24" placeholder="What should people call you?" autocomplete="nickname"/>
          <label for="roomName">ROOM NAME</label>
          <input id="roomName" maxlength="40" placeholder="e.g. midnight-lounge" value="midnight-lounge"/>
          <button id="joinBtn" class="primary">Join voice room <span>↗</span></button>
          <div id="homeError" class="error" role="alert"></div>
          <p class="hint">Anyone who enters the same room name can join that room.</p>
        </div>
        <div class="feature-row">
          <div><strong>01</strong><span>Join together</span></div>
          <div><strong>02</strong><span>Talk live</span></div>
          <div><strong>03</strong><span>Chat in room</span></div>
        </div>
      </section>

      <section id="roomView" class="room-view hidden">
        <div class="room-heading">
          <div>
            <div class="eyebrow">YOU ARE HANGING OUT IN</div>
            <h2 id="roomTitle"># midnight-lounge</h2>
            <div class="room-status"><i></i> Voice room connected</div>
          </div>
          <button id="leaveBtn" class="ghost">Leave room</button>
        </div>
        <div class="room-grid">
          <section class="panel people-panel">
            <div class="panel-title"><span>IN THE ROOM</span><span id="peopleCount" class="count">0</span></div>
            <div id="peopleList" class="people-list"></div>
            <div class="mic-controls">
              <button id="micBtn" class="mic-button">🎙 Turn mic on</button>
              <p id="micStatus" class="hint">Your microphone is off.</p>
            </div>
          </section>
          <section class="panel chat-panel">
            <div class="panel-title">ROOM CHAT <span class="chat-lock">LIVE</span></div>
            <div id="chatMessages" class="messages">
              <div class="empty-chat">Say hello to the room 👋</div>
            </div>
            <form id="chatForm" class="chat-form">
              <input id="chatInput" maxlength="300" placeholder="Send a message..." autocomplete="off"/>
              <button type="submit" aria-label="Send message">➤</button>
            </form>
          </section>
        </div>
        <p class="safety-note">Be respectful. Don’t share your address, school, phone number, or other private information. Leave and tell a trusted adult if someone makes you uncomfortable.</p>
      </section>
    </main>
    <footer> MIDNIGHT WORLD <span>·</span> A place to connect</footer>
  </div>
`;

const $ = (id) => document.getElementById(id);
const home = $("home");
const roomView = $("roomView");

$("joinBtn").addEventListener("click", joinRoom);
$("leaveBtn").addEventListener("click", leaveRoom);
$("micBtn").addEventListener("click", toggleMic);
$("chatForm").addEventListener("submit", sendChat);

async function joinRoom() {
  const name = $("displayName").value.trim();
  const roomName = $("roomName").value.trim();
  $("homeError").textContent = "";

  if (!name || !roomName) {
    $("homeError").textContent = "Enter your display name and a room name.";
    return;
  }

  localName = name;
  $("joinBtn").disabled = true;
  $("joinBtn").textContent = "Connecting…";

  try {
    const response = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantName: name, roomName })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not connect.");

    room = new Room({
      adaptiveStream: true,
      dynacast: true
    });

    room
      .on(RoomEvent.ParticipantConnected, renderPeople)
      .on(RoomEvent.ParticipantDisconnected, renderPeople)
      .on(RoomEvent.TrackMuted, renderPeople)
      .on(RoomEvent.TrackUnmuted, renderPeople)
      .on(RoomEvent.LocalTrackPublished, renderPeople)
      .on(RoomEvent.LocalTrackUnpublished, renderPeople)
      .on(RoomEvent.DataReceived, onData)
      .on(RoomEvent.Disconnected, () => {
        if (room) showHome();
      });

    currentRoomName = data.roomName;
    await room.connect(data.serverUrl, data.token);
    await room.startAudio().catch(() => {});
    home.classList.add("hidden");
    roomView.classList.remove("hidden");
    $("roomTitle").textContent = `# ${currentRoomName}`;
    $("micStatus").textContent = "Your microphone is off.";
    renderPeople();
    renderChat();
  } catch (error) {
    $("homeError").textContent = error.message;
    if (room) {
      try { await room.disconnect(); } catch {}
      room = null;
    }
  } finally {
    $("joinBtn").disabled = false;
    $("joinBtn").innerHTML = 'Join voice room <span>↗</span>';
  }
}

async function toggleMic() {
  if (!room) return;
  try {
    await room.localParticipant.setMicrophoneEnabled(!micOn);
    micOn = !micOn;
    $("micBtn").textContent = micOn ? "🔇 Mute microphone" : "🎙 Turn mic on";
    $("micBtn").classList.toggle("enabled", micOn);
    $("micStatus").textContent = micOn ? "Your microphone is on." : "Your microphone is off.";
    renderPeople();
  } catch (error) {
    $("micStatus").textContent = "Microphone unavailable. Check browser permissions.";
  }
}

async function sendChat(event) {
  event.preventDefault();
  const input = $("chatInput");
  const message = input.value.trim();
  if (!message || !room) return;
  const payload = { type: "chat", name: localName, message, time: Date.now() };
  try {
    await room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(payload)),
      { reliable: true }
    );
    addMessage(payload);
    input.value = "";
  } catch {
    addMessage({ ...payload, message: "Message could not be sent." });
  }
}

function onData(payload, participant) {
  try {
    const data = JSON.parse(new TextDecoder().decode(payload));
    if (data.type === "chat") addMessage({ ...data, name: participant?.name || data.name });
  } catch {}
}

function addMessage(message) {
  chatMessages.push(message);
  chatMessages = chatMessages.slice(-100);
  renderChat();
}

function renderChat() {
  const box = $("chatMessages");
  if (!chatMessages.length) {
    box.innerHTML = '<div class="empty-chat">Say hello to the room 👋</div>';
    return;
  }
  box.innerHTML = chatMessages.map(m => `
    <div class="message">
      <div><strong>${escapeHTML(m.name)}</strong><time>${new Date(m.time).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</time></div>
      <p>${escapeHTML(m.message)}</p>
    </div>
  `).join("");
  box.scrollTop = box.scrollHeight;
}

function renderPeople() {
  if (!room) return;
  const participants = [room.localParticipant, ...room.remoteParticipants.values()];
  $("peopleCount").textContent = participants.length;
  $("peopleList").innerHTML = participants.map((p, i) => {
    const isLocal = p === room.localParticipant;
    const muted = !p.isMicrophoneEnabled;
    const name = p.name || p.identity || "Guest";
    return `<div class="person">
      <div class="avatar">${escapeHTML(name.slice(0,1).toUpperCase())}</div>
      <div class="person-info"><strong>${escapeHTML(name)}${isLocal ? " (you)" : ""}</strong><small>${isLocal ? "You" : "In this room"}</small></div>
      <span class="mic-state" title="${muted ? "Muted" : "Microphone on"}">${muted ? "🔇" : "🎙"}</span>
    </div>`;
  }).join("");
}

async function leaveRoom() {
  if (room) {
    try { await room.disconnect(); } catch {}
  }
  room = null;
  micOn = false;
  chatMessages = [];
  showHome();
}

function showHome() {
  roomView.classList.add("hidden");
  home.classList.remove("hidden");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);
}
