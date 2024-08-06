document.addEventListener("DOMContentLoaded", function () {
  const saveTokensButton = document.getElementById("saveTokens");
  const analyzeTextButton = document.getElementById("analyzeText");
  const analyzeVisualButton = document.getElementById("analyzeVisual");
  const resultDiv = document.getElementById("result");

  const doSaveTokens = function () {
    const openAIToken = document.getElementById("openAIToken").value;
    const elevenLabsToken = document.getElementById("elevenLabsToken").value;

    chrome.runtime.sendMessage(
      {
        action: "saveTokens",
        openAIToken: openAIToken,
        elevenLabsToken: elevenLabsToken,
      },
      function (response) {
        if (response.success) {
          resultDiv.textContent = "API tokens saved successfully!";
        } else {
          resultDiv.textContent = "Error saving tokens: " + response.error;
        }
      }
    );
  };

  const doAnalyzeText = function () {
    resultDiv.textContent = "Analyzing page text...";
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "getPageText" },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error("Error getting page text:", chrome.runtime.lastError);
            resultDiv.textContent =
              "Error getting page text. Please try again.";
            return;
          }

          console.log("Page text received, sending to background for analysis");
          chrome.runtime.sendMessage(
            {
              action: "analyzeText",
              text: response.text,
              link: response.link,
            },
            function (result) {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error in analyzeText:",
                  chrome.runtime.lastError
                );
                resultDiv.textContent =
                  "Error analyzing text. Please try again.";
                return;
              }

              if (result.success && result.audioData) {
                console.log(
                  "Received audio data, size:",
                  result.audioData.length,
                  "chars"
                );
                playAudio(result.audioData, response.link);
                resultDiv.textContent = "Playing audio response...";
              } else {
                console.error("Failed to generate audio:", result.error);
                resultDiv.textContent =
                  result.error || "Failed to generate audio";
              }
            }
          );
        }
      );
    });
  };

  saveTokensButton.addEventListener("click", doSaveTokens);

  analyzeTextButton.addEventListener("click", doAnalyzeText);

  analyzeVisualButton.addEventListener("click", function () {
    // ... (visual analysis code remains the same)
  });

  function playAudio(audioData, link) {
    console.log("Attempting to play audio");
    let audio;

    if (audioData instanceof Blob) {
      // If it's a Blob, create an object URL
      const audioURL = URL.createObjectURL(audioData);
      audio = new Audio(audioURL);
    } else if (
      typeof audioData === "string" &&
      audioData.startsWith("data:audio")
    ) {
      // If it's a base64 data URI, use it directly
      audio = new Audio(audioData);
    } else {
      console.error("Invalid audio data format");
      return;
    }

    audio
      .play()
      .then(() => {
        console.log("Audio playback started");
      })
      .catch((error) => {
        console.error("Error playing audio:", error);
        // Assuming resultDiv is defined elsewhere in your code
        if (typeof resultDiv !== "undefined") {
          resultDiv.textContent = "Error playing audio. Please try again.";
        }
      });

    // Add event listener for when audio ends
    audio.addEventListener("ended", () => {
      console.log("Audio playback ended");
      if (audioData instanceof Blob) {
        URL.revokeObjectURL(audio.src);
      }
      console.log("Sending navigation message for:", link);
      // Send message to background script to navigate
      chrome.runtime.sendMessage({ action: "navigate", url: link.href });
    });
  }

  setTimeout(() => {
    doSaveTokens();
    doAnalyzeText();
  }, 500);

  const leftPupil = document.getElementById("leftPupil");
  const rightPupil = document.getElementById("rightPupil");

  let currentLeftX = 50,
    currentLeftY = 50;
  let currentRightX = 150,
    currentRightY = 50;

  function moveEyes() {
    const moveIndependently = Math.random() < 0; // 30% chance of independent movement
    const isQuickMovement = Math.random() < 0.2; // 20% chance of a quick movement

    let targetLeftX, targetLeftY, targetRightX, targetRightY;

    if (moveIndependently) {
      targetLeftX = getNewPosition(currentLeftX, 50, 18);
      targetLeftY = getNewPosition(currentLeftY, 50, 18);
      targetRightX = getNewPosition(currentRightX, 150, 18);
      targetRightY = getNewPosition(currentRightY, 50, 18);
    } else {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 18; // Max distance increased to 18
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;

      targetLeftX = 50 + offsetX;
      targetLeftY = 50 + offsetY;
      targetRightX = 150 + offsetX;
      targetRightY = 50 + offsetY;
    }

    // Apply central tendency (reduced for more movement)
    targetLeftX = applyTendency(targetLeftX, 50, 0.1);
    targetLeftY = applyTendency(targetLeftY, 50, 0.1);
    targetRightX = applyTendency(targetRightX, 150, 0.1);
    targetRightY = applyTendency(targetRightY, 50, 0.1);

    // Update positions
    currentLeftX = targetLeftX;
    currentLeftY = targetLeftY;
    currentRightX = targetRightX;
    currentRightY = targetRightY;

    // Set new positions with varying transition duration
    const duration = isQuickMovement
      ? 0.1 + Math.random() * 0.1
      : 0.2 + Math.random() * 0.3;
    leftPupil.style.transition = `cx ${duration}s ease-out, cy ${duration}s ease-out`;
    rightPupil.style.transition = `cx ${duration}s ease-out, cy ${duration}s ease-out`;

    leftPupil.setAttribute("cx", targetLeftX);
    leftPupil.setAttribute("cy", targetLeftY);
    rightPupil.setAttribute("cx", targetRightX);
    rightPupil.setAttribute("cy", targetRightY);
  }

  function getNewPosition(current, center, maxDistance) {
    const offset = (Math.random() - 0.5) * 2 * maxDistance;
    return Math.max(
      center - maxDistance,
      Math.min(center + maxDistance, current + offset)
    );
  }

  function applyTendency(value, center, strength) {
    return value + (center - value) * strength;
  }

  function randomInterval() {
    return Math.random() * 1000 + 500; // Random interval between 500ms and 1500ms
  }

  function scheduleNextMove() {
    setTimeout(() => {
      moveEyes();
      scheduleNextMove();
    }, randomInterval());
  }

  // Initial movement
  moveEyes();
  // Start the cycle of random movements
  scheduleNextMove();
});
