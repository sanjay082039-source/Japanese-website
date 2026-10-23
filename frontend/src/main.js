/**
 * 🌸 Sensei AI Tutor - Full Stack Chatbot Logic
 * Handles multi-turn sessions, Furigana annotations, voice recording,
 * editable transcript review, neural speech playback, and study deck export.
 */

import './style.css';

// ============================================================================
// State Management
// ============================================================================
const STATE = {
  currentSessionId: null,
  sessions: [],
  activeMode: 'conversation',
  isVoiceEnabled: true,
  playbackSpeed: 1.0,
  studyDeck: [],
  generation: {
    temperature: 0.3,
    top_p: 0.9,
    max_new_tokens: 384
  },
  // Audio recording state
  mediaRecorder: null,
  audioChunks: [],
  isRecording: false,
  audioContext: null,
  analyser: null,
  animFrameId: null
};

// Mode Prompts & Labels
const MODES = {
  conversation: {
    name: 'Free Conversation',
    icon: '🌸',
    hint: 'Type in Japanese or English, or click the mic to speak...'
  },
  corrector: {
    name: 'Sentence Fixer',
    icon: '🔍',
    hint: 'Paste a Japanese sentence to receive gentle native correction & explanations...'
  },
  particles: {
    name: 'Particle Mastery',
    icon: '🎯',
    hint: 'Ask about は, が, に, で, を, へ, or request a particle drill...'
  },
  jlpt: {
    name: 'JLPT Drill',
    icon: '⛩️',
    hint: 'Ask for JLPT N5, N4, N3, N2, or N1 grammar and reading questions...'
  },
  roleplay: {
    name: 'Tokyo Roleplay',
    icon: '🍵',
    hint: 'Practice ordering at an izakaya, booking a hotel, or asking directions...'
  }
};

// ============================================================================
// Helper: Furigana and Markdown Parser
// ============================================================================
function parseJapaneseMarkdown(text) {
  if (!text) return '';

  let html = text;

  // 1. Convert Kanji【furigana】into HTML5 <ruby>Kanji<rt>furigana</rt></ruby>
  html = html.replace(/([\u4e00-\u9faf\u3400-\u4dbf]+)【(.*?)】/g, '<ruby>$1<rt>$2</rt></ruby>');

  // 2. Bold text
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 3. Italic text
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 4. Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // 5. Code blocks
  html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // 6. Bullet lists
  html = html.replace(/^\s*[\*\-]\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

  // 7. Line breaks
  html = html.replace(/\n\n/g, '<br><br>');

  return html;
}

// ============================================================================
// DOM Elements Initialization
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Navigation & Sidebar
  const sidebar = document.getElementById('sidebar');
  const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const historyList = document.getElementById('historyList');
  const activeModeBadge = document.getElementById('activeModeText');
  const modeButtons = document.querySelectorAll('.mode-item');

  // Messages & Hero
  const messagesContainer = document.getElementById('messagesContainer');
  const welcomeHero = document.getElementById('welcomeHero');

  // Input & Controls
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const micBtn = document.getElementById('micBtn');
  const micIcon = document.getElementById('micIcon');
  const voiceLanguageSelect = document.getElementById('voiceLanguageSelect');
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  const audioToggleIcon = document.getElementById('audioToggleIcon');
  const audioToggleText = document.getElementById('audioToggleText');
  const playbackSpeedSelect = document.getElementById('playbackSpeedSelect');
  const globalAudioPlayer = document.getElementById('globalAudioPlayer');

  // Review Drawer
  const reviewDrawer = document.getElementById('reviewDrawer');
  const reviewTextarea = document.getElementById('reviewTextarea');
  const reviewLangTag = document.getElementById('reviewLangTag');
  const confirmVoiceBtn = document.getElementById('confirmVoiceBtn');
  const discardVoiceBtn = document.getElementById('discardVoiceBtn');
  const voiceBar = document.getElementById('voiceBar');
  const visualizerCanvas = document.getElementById('visualizerCanvas');

  // Study Deck Modal
  const openDeckBtn = document.getElementById('openDeckBtn');
  const closeDeckBtn = document.getElementById('closeDeckBtn');
  const deckOverlay = document.getElementById('deckOverlay');
  const deckList = document.getElementById('deckList');
  const deckCount = document.getElementById('deckCount');
  const clearDeckBtn = document.getElementById('clearDeckBtn');
  const exportAnkiBtn = document.getElementById('exportAnkiBtn');

  // Settings & Diagnostics Modal
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const tempSlider = document.getElementById('tempSlider');
  const tempValDisplay = document.getElementById('tempValDisplay');
  const tokensSlider = document.getElementById('tokensSlider');
  const tokensValDisplay = document.getElementById('tokensValDisplay');
  const topPSlider = document.getElementById('topPSlider');
  const topPValDisplay = document.getElementById('topPValDisplay');

  // VRAM Indicators
  const vramPill = document.getElementById('vramPill');
  const vramStatusText = document.getElementById('vramStatusText');
  const diagModelVal = document.getElementById('diagModelVal');
  const diagAdapterVal = document.getElementById('diagAdapterVal');
  const diagGpuVal = document.getElementById('diagGpuVal');
  const vramBarPercent = document.getElementById('vramBarPercent');
  const vramBarFill = document.getElementById('vramBarFill');

  // ==========================================================================
  // Storage & Session Management
  // ==========================================================================
  function loadFromStorage() {
    try {
      const savedSessions = localStorage.getItem('sensei_sessions');
      if (savedSessions) STATE.sessions = JSON.parse(savedSessions);

      const savedDeck = localStorage.getItem('sensei_study_deck');
      if (savedDeck) STATE.studyDeck = JSON.parse(savedDeck);

      const savedGen = localStorage.getItem('sensei_gen_settings');
      if (savedGen) STATE.generation = JSON.parse(savedGen);
    } catch (e) {
      console.warn('Storage load error:', e);
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem('sensei_sessions', JSON.stringify(STATE.sessions));
      localStorage.setItem('sensei_study_deck', JSON.stringify(STATE.studyDeck));
      localStorage.setItem('sensei_gen_settings', JSON.stringify(STATE.generation));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }

  function renderHistorySidebar() {
    historyList.innerHTML = '';
    if (STATE.sessions.length === 0) {
      historyList.innerHTML = '<div style="padding: 0.5rem 0.75rem; font-size: 0.75rem; color: var(--text-dim);">No saved chats yet</div>';
      return;
    }

    STATE.sessions.forEach(sess => {
      const item = document.createElement('div');
      item.className = `history-item ${sess.id === STATE.currentSessionId ? 'active' : ''}`;
      item.innerHTML = `
        <span class="history-title" title="${sess.title}">${sess.title}</span>
        <button class="delete-session-btn" title="Delete chat">&times;</button>
      `;

      item.querySelector('.history-title').onclick = () => loadSession(sess.id);
      item.querySelector('.delete-session-btn').onclick = (e) => {
        e.stopPropagation();
        deleteSession(sess.id);
      };

      historyList.appendChild(item);
    });
  }

  function createNewSession(mode = 'conversation') {
    const id = 'sess_' + Date.now();
    const newSess = {
      id,
      title: 'New Conversation',
      mode,
      created_at: new Date().toISOString(),
      messages: []
    };
    STATE.sessions.unshift(newSess);
    STATE.currentSessionId = id;
    saveToStorage();
    renderHistorySidebar();
    renderMessages();
    chatInput.focus();
  }

  function loadSession(id) {
    STATE.currentSessionId = id;
    const sess = STATE.sessions.find(s => s.id === id);
    if (sess) {
      setMode(sess.mode || 'conversation');
    }
    renderHistorySidebar();
    renderMessages();
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('open');
    }
  }

  function deleteSession(id) {
    STATE.sessions = STATE.sessions.filter(s => s.id !== id);
    if (STATE.currentSessionId === id) {
      STATE.currentSessionId = STATE.sessions.length > 0 ? STATE.sessions[0].id : null;
    }
    saveToStorage();
    renderHistorySidebar();
    renderMessages();
  }

  function getCurrentSession() {
    return STATE.sessions.find(s => s.id === STATE.currentSessionId);
  }

  // ==========================================================================
  // Learning Mode Switching
  // ==========================================================================
  function setMode(modeKey) {
    if (!MODES[modeKey]) return;
    STATE.activeMode = modeKey;

    const sess = getCurrentSession();
    if (sess) sess.mode = modeKey;

    activeModeBadge.textContent = `${MODES[modeKey].icon} ${MODES[modeKey].name}`;
    chatInput.placeholder = MODES[modeKey].hint;

    modeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === modeKey);
    });
  }

  modeButtons.forEach(btn => {
    btn.onclick = () => setMode(btn.dataset.mode);
  });

  // ==========================================================================
  // Render Messages
  // ==========================================================================
  function renderMessages() {
    const sess = getCurrentSession();
    messagesContainer.innerHTML = '';

    if (!sess || sess.messages.length === 0) {
      welcomeHero.style.display = 'flex';
      messagesContainer.appendChild(welcomeHero);
      return;
    }

    welcomeHero.style.display = 'none';

    sess.messages.forEach((msg, idx) => {
      appendMessageToDOM(msg.role, msg.content, msg.audioBase64, idx);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function appendMessageToDOM(role, content, audioBase64 = null, index = null) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    if (role === 'user') {
      avatar.textContent = '🧑';
    } else {
      avatar.innerHTML = '<img src="/sensei.jpg" alt="Sensei" />';
    }
    row.appendChild(avatar);

    // Body Wrapper
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'msg-body-wrapper';

    // Bubble with Furigana parsing
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = parseJapaneseMarkdown(content);
    bodyWrap.appendChild(bubble);

    // Actions bar for Assistant messages
    if (role === 'assistant') {
      const actions = document.createElement('div');
      actions.className = 'msg-actions';

      // 1. Listen Button
      const listenBtn = document.createElement('button');
      listenBtn.className = 'action-pill-btn';
      listenBtn.innerHTML = '<span>🔊</span><span>Listen</span>';
      listenBtn.onclick = () => playSpeech(content, audioBase64, listenBtn);
      actions.appendChild(listenBtn);

      // 2. Save to Study Deck Button
      const saveCardBtn = document.createElement('button');
      saveCardBtn.className = 'action-pill-btn';
      saveCardBtn.innerHTML = '<span>⭐</span><span>Save Word</span>';
      saveCardBtn.onclick = () => addSelectedOrPromptToDeck(content);
      actions.appendChild(saveCardBtn);

      // 3. Copy Button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'action-pill-btn';
      copyBtn.innerHTML = '<span>📋</span><span>Copy</span>';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(content);
        copyBtn.innerHTML = '<span>✅</span><span>Copied!</span>';
        setTimeout(() => copyBtn.innerHTML = '<span>📋</span><span>Copy</span>', 2000);
      };
      actions.appendChild(copyBtn);

      bodyWrap.appendChild(actions);
    }

    row.appendChild(bodyWrap);
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ==========================================================================
  // Audio Playback
  // ==========================================================================
  async function playSpeech(text, audioBase64 = null, buttonElement = null) {
    if (buttonElement) buttonElement.classList.add('playing');

    try {
      if (audioBase64) {
        globalAudioPlayer.src = `data:audio/mp3;base64,${audioBase64}`;
      } else {
        // Request on-demand TTS synthesis from backend
        const res = await fetch('/api/v1/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language: 'ja' })
        });
        if (!res.ok) throw new Error('TTS synthesis failed');
        const blob = await res.blob();
        globalAudioPlayer.src = URL.createObjectURL(blob);
      }

      globalAudioPlayer.playbackRate = STATE.playbackSpeed;
      await globalAudioPlayer.play();

      globalAudioPlayer.onended = () => {
        if (buttonElement) buttonElement.classList.remove('playing');
      };
    } catch (err) {
      console.warn('Speech playback error:', err);
      if (buttonElement) buttonElement.classList.remove('playing');
    }
  }

  // ==========================================================================
  // Send User Query & Chat Inference
  // ==========================================================================
  async function handleSendMessage(text) {
    const query = text ? text.trim() : chatInput.value.trim();
    if (!query) return;

    let sess = getCurrentSession();
    if (!sess) {
      createNewSession(STATE.activeMode);
      sess = getCurrentSession();
    }

    // Set title on first message
    if (sess.messages.length === 0) {
      sess.title = query.slice(0, 32);
      renderHistorySidebar();
    }

    // Add User Message
    sess.messages.push({ role: 'user', content: query });
    saveToStorage();
    renderMessages();
    chatInput.value = '';
    reviewDrawer.classList.remove('active');

    sendBtn.disabled = true;
    micBtn.disabled = true;

    // Show temporary typing indicator bubble
    const typingBubble = document.createElement('div');
    typingBubble.className = 'message-row assistant';
    typingBubble.id = 'typingBubble';
    typingBubble.innerHTML = `
      <div class="msg-avatar"><img src="/sensei.jpg" alt="Sensei" /></div>
      <div class="msg-body-wrapper">
        <div class="msg-bubble" style="color: var(--text-dim); font-style: italic;">
          Sensei is thinking... 🌸
        </div>
      </div>
    `;
    messagesContainer.appendChild(typingBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      // Build history for backend API (excluding system messages)
      const historyPayload = sess.messages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          generation: STATE.generation,
          enable_tts: STATE.isVoiceEnabled,
          tts_language: voiceLanguageSelect.value === 'en' ? 'en' : 'ja'
        })
      });

      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.detail || data.error || 'Sensei was unable to respond.');
      }

      // Remove typing indicator
      const typingEl = document.getElementById('typingBubble');
      if (typingEl) typingEl.remove();

      // Add Assistant Turn
      sess.messages.push({
        role: 'assistant',
        content: data.response,
        audioBase64: data.audio_base64
      });
      saveToStorage();
      renderMessages();

      // Auto-play audio if voice toggle is on
      if (STATE.isVoiceEnabled && data.audio_base64) {
        playSpeech(data.response, data.audio_base64);
      }

    } catch (err) {
      const typingEl = document.getElementById('typingBubble');
      if (typingEl) typingEl.remove();

      sess.messages.push({
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message}\n\nPlease check your server or try asking your question again.`
      });
      saveToStorage();
      renderMessages();
    } finally {
      sendBtn.disabled = false;
      micBtn.disabled = false;
    }
  }

  sendBtn.onclick = () => handleSendMessage();
  chatInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Quick Card click handlers
  document.querySelectorAll('.quick-card').forEach(card => {
    card.onclick = () => {
      const prompt = card.dataset.prompt;
      if (prompt) handleSendMessage(prompt);
    };
  });

  // ==========================================================================
  // Voice Recording & Visualizer (Local STT)
  // ==========================================================================
  micBtn.onclick = async () => {
    if (STATE.isRecording) {
      stopRecording();
      return;
    }
    startRecording();
  };

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      STATE.audioChunks = [];

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
      }

      STATE.mediaRecorder = new MediaRecorder(stream, { mimeType });

      STATE.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) STATE.audioChunks.push(e.data);
      };

      STATE.mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(STATE.audioChunks, { type: mimeType });
        if (blob.size > 200) {
          uploadAudioForTranscription(blob);
        }
      };

      STATE.mediaRecorder.start();
      STATE.isRecording = true;
      micBtn.classList.add('recording');
      micIcon.textContent = '⏹️';
      voiceBar.classList.add('active');

      // Audio Visualizer
      setupVisualizer(stream);

    } catch (err) {
      alert(`Microphone error: ${err.message}. Please allow microphone permissions in your browser.`);
    }
  }

  function stopRecording() {
    if (STATE.mediaRecorder && STATE.isRecording) {
      STATE.mediaRecorder.stop();
      STATE.isRecording = false;
      micBtn.classList.remove('recording');
      micIcon.textContent = '🎙️';
      voiceBar.classList.remove('active');
      if (STATE.animFrameId) cancelAnimationFrame(STATE.animFrameId);
    }
  }

  function setupVisualizer(stream) {
    try {
      STATE.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = STATE.audioContext.createMediaStreamSource(stream);
      STATE.analyser = STATE.audioContext.createAnalyser();
      STATE.analyser.fftSize = 64;
      source.connect(STATE.analyser);

      const ctx = visualizerCanvas.getContext('2d');
      const bufferLength = STATE.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      function draw() {
        if (!STATE.isRecording) return;
        STATE.animFrameId = requestAnimationFrame(draw);
        STATE.analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        const barWidth = (visualizerCanvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * visualizerCanvas.height;
          ctx.fillStyle = '#f472b6';
          ctx.fillRect(x, visualizerCanvas.height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }
      }
      draw();
    } catch (e) {
      console.warn('Visualizer setup skipped:', e);
    }
  }

  async function uploadAudioForTranscription(blob) {
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    formData.append('language', voiceLanguageSelect.value);

    reviewTextarea.value = 'Transcribing audio locally on-device...';
    reviewDrawer.classList.add('active');

    try {
      const res = await fetch('/api/v1/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Transcription failed');

      reviewTextarea.value = data.transcription;
      reviewLangTag.textContent = `Language: ${data.language || 'Auto'} • Confidence: ${Math.round(data.confidence * 100)}%`;
      reviewTextarea.focus();
    } catch (err) {
      reviewTextarea.value = `Error: ${err.message}`;
    }
  }

  confirmVoiceBtn.onclick = () => {
    const text = reviewTextarea.value.trim();
    if (text) handleSendMessage(text);
  };

  discardVoiceBtn.onclick = () => {
    reviewDrawer.classList.remove('active');
    reviewTextarea.value = '';
  };

  // ==========================================================================
  // Study Deck & Anki Export
  // ==========================================================================
  function updateDeckBadge() {
    deckCount.textContent = STATE.studyDeck.length;
  }

  function addSelectedOrPromptToDeck(messageContent) {
    const selection = window.getSelection().toString().trim();
    let term = selection || prompt('Enter Japanese word or kanji to save:');
    if (!term) return;

    let meaning = prompt(`Enter meaning/notes for 「${term}」:`) || '';
    STATE.studyDeck.unshift({
      id: Date.now(),
      term,
      meaning,
      context: messageContent.slice(0, 100),
      savedAt: new Date().toLocaleDateString()
    });

    saveToStorage();
    updateDeckBadge();
    alert(`Saved 「${term}」 to your Study Deck! 🌸`);
  }

  function renderDeck() {
    deckList.innerHTML = '';
    if (STATE.studyDeck.length === 0) {
      deckList.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 2rem;">Your study deck is empty.<br>Save vocabulary from chat messages to review them here!</div>';
      return;
    }

    STATE.studyDeck.forEach((card, idx) => {
      const el = document.createElement('div');
      el.className = 'deck-card';
      el.innerHTML = `
        <div>
          <div class="deck-japanese">${parseJapaneseMarkdown(card.term)}</div>
          <div class="deck-english">${card.meaning || 'No meaning notes'}</div>
        </div>
        <button class="icon-btn" style="color: var(--accent-red);" title="Remove card">&times;</button>
      `;
      el.querySelector('button').onclick = () => {
        STATE.studyDeck.splice(idx, 1);
        saveToStorage();
        updateDeckBadge();
        renderDeck();
      };
      deckList.appendChild(el);
    });
  }

  openDeckBtn.onclick = () => {
    renderDeck();
    deckOverlay.classList.add('active');
  };
  closeDeckBtn.onclick = () => deckOverlay.classList.remove('active');
  deckOverlay.onclick = (e) => {
    if (e.target === deckOverlay) deckOverlay.classList.remove('active');
  };

  clearDeckBtn.onclick = () => {
    if (confirm('Clear all saved flashcards?')) {
      STATE.studyDeck = [];
      saveToStorage();
      updateDeckBadge();
      renderDeck();
    }
  };

  exportAnkiBtn.onclick = () => {
    if (STATE.studyDeck.length === 0) {
      alert('Deck is empty!');
      return;
    }
    // Export standard TSV / CSV for Anki import
    let tsv = '#separator:tab\n#html:true\n';
    STATE.studyDeck.forEach(c => {
      tsv += `${c.term}\t${c.meaning}\t${c.context}\n`;
    });

    const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sensei_anki_deck_${Date.now()}.txt`;
    link.click();
  };

  // ==========================================================================
  // Settings & Live Diagnostics Polling
  // ==========================================================================
  openSettingsBtn.onclick = () => {
    tempSlider.value = STATE.generation.temperature;
    tempValDisplay.textContent = STATE.generation.temperature;
    tokensSlider.value = STATE.generation.max_new_tokens;
    tokensValDisplay.textContent = STATE.generation.max_new_tokens;
    topPSlider.value = STATE.generation.top_p;
    topPValDisplay.textContent = STATE.generation.top_p;
    fetchLiveHealth();
    settingsOverlay.classList.add('active');
  };

  closeSettingsBtn.onclick = () => settingsOverlay.classList.remove('active');
  settingsOverlay.onclick = (e) => {
    if (e.target === settingsOverlay) settingsOverlay.classList.remove('active');
  };

  tempSlider.oninput = (e) => tempValDisplay.textContent = e.target.value;
  tokensSlider.oninput = (e) => tokensValDisplay.textContent = e.target.value;
  topPSlider.oninput = (e) => topPValDisplay.textContent = e.target.value;

  saveSettingsBtn.onclick = () => {
    STATE.generation.temperature = parseFloat(tempSlider.value);
    STATE.generation.max_new_tokens = parseInt(tokensSlider.value);
    STATE.generation.top_p = parseFloat(topPSlider.value);
    saveToStorage();
    settingsOverlay.classList.remove('active');
  };

  async function fetchLiveHealth() {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        const data = await res.json();
        vramStatusText.textContent = `GPU: ${data.vram_allocated_gb} / ${data.vram_total_gb} GB`;
        diagModelVal.textContent = data.model;
        diagAdapterVal.textContent = data.adapter_loaded ? `✅ Active (${data.adapter_path})` : '⚠️ Base Model';
        
        const pct = Math.round((data.vram_allocated_gb / (data.vram_total_gb || 1)) * 100);
        vramBarPercent.textContent = `${pct}% (${data.vram_allocated_gb} GB)`;
        vramBarFill.style.width = `${pct}%`;
      }
    } catch (e) {
      vramStatusText.textContent = 'API Connected';
    }
  }

  // Poll VRAM every 15 seconds
  fetchLiveHealth();
  setInterval(fetchLiveHealth, 15000);

  // Audio Toggle
  audioToggleBtn.onclick = () => {
    STATE.isVoiceEnabled = !STATE.isVoiceEnabled;
    audioToggleBtn.classList.toggle('active', STATE.isVoiceEnabled);
    audioToggleIcon.textContent = STATE.isVoiceEnabled ? '🔊' : '🔇';
    audioToggleText.textContent = STATE.isVoiceEnabled ? 'Voice On' : 'Voice Off';
  };

  playbackSpeedSelect.onchange = (e) => {
    STATE.playbackSpeed = parseFloat(e.target.value);
  };

  // Sidebar Toggle
  toggleSidebarBtn.onclick = () => sidebar.classList.toggle('open');
  closeSidebarBtn.onclick = () => sidebar.classList.remove('open');
  newChatBtn.onclick = () => createNewSession(STATE.activeMode);

  // ==========================================================================
  // Initialization
  // ==========================================================================
  loadFromStorage();
  updateDeckBadge();

  if (STATE.sessions.length > 0) {
    loadSession(STATE.sessions[0].id);
  } else {
    createNewSession('conversation');
  }
});
