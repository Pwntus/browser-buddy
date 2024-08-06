// Helper functions
function getElementScore(element) {
  const text = element.innerText || "";
  const textLength = text.length;
  const linkDensity = getLinkDensity(element);
  const classAndId = (element.className + " " + element.id).toLowerCase();

  let score = textLength;

  if (classAndId.match(/article|content|main|body/)) {
    score += 25;
  }
  if (classAndId.match(/sidebar|comment|footer|header|menu|nav/)) {
    score -= 25;
  }

  score *= 1 - linkDensity;

  return score;
}

function getLinkDensity(element) {
  const linkLength = Array.from(element.getElementsByTagName("a")).reduce(
    (sum, a) => sum + (a.innerText || "").length,
    0
  );
  const textLength = element.innerText.length;
  return textLength > 0 ? linkLength / textLength : 0;
}

function isElementVisible(element) {
  const style = window.getComputedStyle(element);
  return !(
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0"
  );
}

function shouldExtractElement(element) {
  const tagName = element.tagName.toLowerCase();
  const ignoredTags = ["script", "style", "noscript", "iframe"];
  return !ignoredTags.includes(tagName);
}

async function extractMainContent() {
  const bodyClone = document.body.cloneNode(true);
  const paragraphs = bodyClone.getElementsByTagName("p");
  let topCandidate = null;
  const candidates = [];

  // First pass: score paragraphs and their parent elements
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    if (!isElementVisible(paragraph) || paragraph.innerText.length < 25)
      continue;

    let parentNode = paragraph.parentNode;
    if (!parentNode.__score) {
      parentNode.__score = getElementScore(parentNode);
      candidates.push(parentNode);
    }
    parentNode.__score += getElementScore(paragraph);
  }

  // Second pass: find the top candidate
  candidates.forEach((candidate) => {
    candidate.__score *= 1 - getLinkDensity(candidate);
    if (!topCandidate || candidate.__score > topCandidate.__score) {
      topCandidate = candidate;
    }
  });

  // If we couldn't find a top candidate, use the body
  if (!topCandidate) {
    topCandidate = bodyClone;
  }

  // Clean up the top candidate
  const content = cleanAndExtractText(topCandidate);
  return content.trim().substring(0, 8096);
}

function cleanAndExtractText(element) {
  const clone = element.cloneNode(true);
  const elementsToRemove = clone.querySelectorAll(
    "script, style, noscript, iframe, header, footer, nav"
  );
  elementsToRemove.forEach((el) => el.remove());

  return clone.innerText;
}

// New function to extract relevant visible links
function extractRelevantLinks() {
  const links = document.getElementsByTagName("a");
  const relevantLinks = [];

  for (let link of links) {
    if (isElementVisible(link) && link.href && link.href.startsWith("http")) {
      relevantLinks.push({
        text: link.innerText.trim(),
        href: link.href,
      });
    }
  }

  return relevantLinks;
}

// New function to randomly select 20 links
function selectRandomLinks(links, count = 1) {
  const shuffled = links.slice().sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageText") {
    Promise.all([extractMainContent(), extractRelevantLinks()]).then(
      ([text, links]) => {
        const randomLinks = selectRandomLinks(links);
        const link = randomLinks[0];
        sendResponse({ text: text, link });
      }
    );
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === "getScreenshot") {
    captureScreenshot().then((screenshot) => {
      sendResponse({ screenshot: screenshot });
    });
    return true; // Indicates that the response is sent asynchronously
  }
});

// Placeholder for screenshot capture (unchanged)
async function captureScreenshot() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("Screenshot data would be here");
    }, 100);
  });
}
