const setupPanel = document.querySelector("#setup-panel");
const stage = document.querySelector("#stage");
const recapPanel = document.querySelector("#recap-panel");
const setupForm = document.querySelector("#setup-form");
const chatFile = document.querySelector("#chat-file");
const parseStatus = document.querySelector("#parse-status");
const awardCount = document.querySelector("#award-count");
const awardTitle = document.querySelector("#award-title");
const awardDescription = document.querySelector("#award-description");
const nominees = document.querySelector("#nominees");
const revealCard = document.querySelector("#reveal-card");
const revealKicker = document.querySelector("#reveal-kicker");
const winnerName = document.querySelector("#winner-name");
const winnerStat = document.querySelector("#winner-stat");
const nextAward = document.querySelector("#next-award");
const recapList = document.querySelector("#recap-list");
const restart = document.querySelector("#restart");

let chatTitleSender = "";
let parsedMessages = [];
let awards = [];
let currentAward = 0;
let revealTimer = null;
let revealed = false;

function cleanText(text) {
  return text
    .replace(/\u200e/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseChatExport(text) {
  const entryRegex = /^[\u200e\s]*\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s+([^:]+):\s*([\s\S]*)$/;
  const parsed = [];

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const match = line.match(entryRegex);

    if (match) {
      parsed.push({
        month: Number(match[1]),
        day: Number(match[2]),
        year: Number(match[3]),
        hour: Number(match[4]),
        sender: cleanText(match[7]),
        text: cleanText(match[8]),
      });
      return;
    }

    const last = parsed[parsed.length - 1];
    if (last && line.trim()) {
      last.text = cleanText(`${last.text} ${line}`);
    }
  });

  return parsed;
}

function isPseudoSender(sender) {
  const normalized = sender.toLowerCase().trim();
  const blockedSenders = ["you", "meta ai", "whatsapp"];
  return blockedSenders.includes(normalized) || normalized === chatTitleSender;
}

function isSystemMessage(message) {
  const text = message.text.toLowerCase();
  const banned = [
    "messages and calls are end-to-end encrypted",
    "created group",
    "changed this group's icon",
    "changed the group description",
    "tap to change who can add other members",
    "added you",
    " added ",
    " left",
    " removed ",
  ];

  return banned.some((phrase) => text.includes(phrase));
}

function getEmojiCount(text) {
  return (text.match(/\p{Extended_Pictographic}/gu) || []).length;
}

function getWordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function createStats(messages) {
  const stats = new Map();

  messages.forEach((message) => {
    if (isPseudoSender(message.sender) || isSystemMessage(message)) {
      return;
    }

    if (!stats.has(message.sender)) {
      stats.set(message.sender, {
        name: message.sender,
        total: 0,
        words: 0,
        emojis: 0,
        questions: 0,
        media: 0,
        deleted: 0,
        lateNight: 0,
        suspicious: 0,
        longest: "",
      });
    }

    const person = stats.get(message.sender);
    const text = message.text.toLowerCase();
    const wordCount = getWordCount(message.text);

    person.total += 1;
    person.words += wordCount;
    person.emojis += getEmojiCount(message.text);
    person.questions += message.text.includes("?") ? 1 : 0;
    person.media += /(image|video|audio|sticker|gif|document) omitted/i.test(message.text) ? 1 : 0;
    person.deleted += /this message was deleted/i.test(message.text) ? 1 : 0;
    person.lateNight += message.hour <= 4 ? 1 : 0;
    person.suspicious += /(sus|suspicious|caught|hide|secret|explain|don't tell|do not tell|trust me|why are you)/i.test(text) ? 1 : 0;

    if (message.text.length > person.longest.length && wordCount >= 4) {
      person.longest = message.text;
    }
  });

  return [...stats.values()].filter((person) => person.total > 0);
}

function topNominees(stats, scoreFn) {
  return [...stats]
    .map((person) => ({ ...person, score: scoreFn(person) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function formatCount(value, label) {
  return `${value} ${label}${value === 1 ? "" : "s"}`;
}

function buildAwards(stats) {
  const definitions = [
    {
      title: "Yapper of the Year",
      description: "for sending the most messages and refusing silence",
      score: (person) => person.total,
      stat: (person) => formatCount(person.total, "message"),
    },
    {
      title: "Emoji Criminal",
      description: "for crimes against Unicode",
      score: (person) => person.emojis,
      stat: (person) => formatCount(person.emojis, "emoji"),
    },
    {
      title: "Professional Waffler",
      description: "for producing the highest word count",
      score: (person) => person.words,
      stat: (person) => formatCount(person.words, "word"),
    },
    {
      title: "Question Merchant",
      description: "for asking the most questions",
      score: (person) => person.questions,
      stat: (person) => formatCount(person.questions, "question"),
    },
    {
      title: "Media Spammer",
      description: "for sending the most omitted media",
      score: (person) => person.media,
      stat: (person) => formatCount(person.media, "media drop"),
    },
    {
      title: "Deleted Message Specialist",
      description: "for leaving the most suspicious blank spaces",
      score: (person) => person.deleted,
      stat: (person) => formatCount(person.deleted, "deleted message"),
    },
    {
      title: "After Hours Menace",
      description: "for being active when normal people are asleep",
      score: (person) => person.lateNight,
      stat: (person) => formatCount(person.lateNight, "late-night message"),
    },
    {
      title: "Most Suspicious",
      description: "for messages that needed explaining immediately",
      score: (person) => person.suspicious,
      stat: (person) => formatCount(person.suspicious, "suspicious message"),
    },
  ];

  return definitions
    .map((definition) => {
      const nomineesList = topNominees(stats, definition.score);
      const winner = nomineesList[0];
      return {
        ...definition,
        nominees: nomineesList,
        winner,
        winnerStat: winner ? definition.stat(winner) : "no data",
      };
    })
    .filter((award) => award.winner && award.winner.score > 0);
}

function showPanel(panel) {
  setupPanel.hidden = panel !== setupPanel;
  stage.hidden = panel !== stage;
  recapPanel.hidden = panel !== recapPanel;
}

function renderAward() {
  clearInterval(revealTimer);
  revealed = false;
  const award = awards[currentAward];

  awardCount.textContent = `award ${currentAward + 1} of ${awards.length}`;
  awardTitle.textContent = award.title;
  awardDescription.textContent = award.description;
  revealKicker.textContent = "and the winner is...";
  winnerName.textContent = "nominees";
  winnerStat.textContent = "hold for dramatic effect";
  revealCard.classList.remove("revealed");
  nextAward.textContent = "Reveal";
  nextAward.disabled = false;

  nominees.replaceChildren(
    ...award.nominees.map((nominee) => {
      const item = document.createElement("span");
      item.textContent = nominee.name;
      return item;
    }),
  );
}

function startSuspenseReveal() {
  nextAward.disabled = true;
  revealKicker.textContent = "opening the envelope...";
  const names = awards[currentAward].nominees.map((nominee) => nominee.name);
  let index = 0;

  revealTimer = setInterval(() => {
    winnerName.textContent = names[index % names.length];
    index += 1;
  }, 120);

  setTimeout(() => {
    clearInterval(revealTimer);
    const award = awards[currentAward];
    winnerName.textContent = award.winner.name;
    winnerStat.textContent = award.winnerStat;
    revealKicker.textContent = "winner";
    revealCard.classList.add("revealed");
    nextAward.textContent = currentAward === awards.length - 1 ? "See Recap" : "Next Award";
    nextAward.disabled = false;
    revealed = true;
  }, 2600);
}

function showRecap() {
  showPanel(recapPanel);
  const rows = awards.map((award) => {
    const row = document.createElement("div");
    row.className = "recap-row";
    row.innerHTML = `
      <span>${award.title}</span>
      <strong>${award.winner.name}</strong>
      <span>${award.winnerStat}</span>
    `;
    return row;
  });

  recapList.replaceChildren(...rows);
}

chatFile.addEventListener("change", async () => {
  const [file] = chatFile.files;
  if (!file) {
    return;
  }

  const text = await file.text();
  const parsed = parseChatExport(text);
  chatTitleSender = parsed[0]?.sender.toLowerCase().trim() || "";
  parsedMessages = parsed;
  const stats = createStats(parsedMessages);
  awards = buildAwards(stats);
  parseStatus.textContent = `${stats.length} people found. ${awards.length} awards ready.`;
});

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (awards.length < 1) {
    parseStatus.textContent = "Need a chat with enough messages to create awards.";
    return;
  }

  currentAward = 0;
  showPanel(stage);
  renderAward();
});

nextAward.addEventListener("click", () => {
  if (!revealed) {
    startSuspenseReveal();
    return;
  }

  currentAward += 1;
  if (currentAward >= awards.length) {
    showRecap();
    return;
  }

  renderAward();
});

restart.addEventListener("click", () => showPanel(setupPanel));
