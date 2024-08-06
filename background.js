// Simple encoding function (for demonstration purposes only)
function encode(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

// Simple decoding function (for demonstration purposes only)
function decode(encoded) {
  return decodeURIComponent(escape(atob(encoded)));
}

// Function to convert Blob to base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const arrayBuffer = reader.result;
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

// Function to store API tokens
function storeTokens(openAIToken, elevenLabsToken) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      {
        encodedOpenAIToken: encode(openAIToken),
        encodedElevenLabsToken: encode(elevenLabsToken),
      },
      function () {
        if (chrome.runtime.lastError) {
          console.error("Error storing tokens:", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log("Tokens stored successfully");
          resolve();
        }
      }
    );
  });
}

// Function to get API tokens
function getTokens() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      ["encodedOpenAIToken", "encodedElevenLabsToken"],
      function (result) {
        if (chrome.runtime.lastError) {
          console.error("Error retrieving tokens:", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          if (result.encodedOpenAIToken && result.encodedElevenLabsToken) {
            resolve({
              openAIToken: decode(result.encodedOpenAIToken),
              elevenLabsToken: decode(result.encodedElevenLabsToken),
            });
          } else {
            reject(new Error("Tokens not found"));
          }
        }
      }
    );
  });
}

// Function to send data to OpenAI ChatGPT API
async function sendToChatGPT(text, link) {
  try {
    const tokens = await getTokens();

    if (!tokens.openAIToken) {
      return "Error: OpenAI API token not set";
    }

    const systemPrompt = `You are a funny, but nervous Morty from Rick & Morty, but never mention Rick nor Morty. Provide a comment on the following web page content, as if you were sitting next to the user browsing the page. Stutter on your words! You have also selected the next URL to navigate to (${link.text}), so include in your commend about it and why you chose it!`;
    console.log("ChatGPT system prompt: ", systemPrompt);

    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.openAIToken}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Web page content: ${text}`,
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error in sendToChatGPT:", error);
    return `Error: Unable to get response from OpenAI API. Details: ${error.message}`;
  }
}

// Function to generate spoken feedback using ElevenLabs API
async function generateSpokenFeedback(text) {
  try {
    const tokens = await getTokens();

    if (!tokens.elevenLabsToken) {
      return { error: "Error: ElevenLabs API token not set" };
    }

    const voiceId = "ODq5zmih8GrVes37Dizd"; // Replace with your preferred voice ID
    const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    console.log("Sending request to ElevenLabs API");
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": tokens.elevenLabsToken,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Received response from ElevenLabs API");
    const audioBlob = await response.blob();
    console.log("Audio data size:", audioBlob.size, "bytes");

    // Convert the audio blob to base64
    const base64 = await blobToBase64(audioBlob);

    // Create the data URI
    const mimeType = audioBlob.type; // Get the MIME type of the blob
    const dataUri = `data:${mimeType};base64,${base64}`;

    return { audioData: dataUri };
  } catch (error) {
    console.error("Error in generateSpokenFeedback:", error);
    return { error: error.message };
  }
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveTokens") {
    storeTokens(request.openAIToken, request.elevenLabsToken)
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({ success: false, error: error.toString() })
      );
    return true; // Indicates we will send a response asynchronously
  } else if (request.action === "analyzeText") {
    sendToChatGPT(request.text, request.link)
      .then((result) => {
        console.log("ChatGPT response:", result);

        const removeAsterisks = (str) => str.replace(/\s?\*[^*]+\*/g, "");
        const removeParentheses = (str) => str.replace(/\s?\([^)]+\)/g, "");
        const result_clean = removeParentheses(removeAsterisks(result));

        console.log("Cleaned response:", result_clean);
        console.log("Link:", request.link);

        return generateSpokenFeedback(result_clean);
      })
      .then((audioResult) => {
        if (audioResult.audioData) {
          console.log("Sending audio data to popup");
          sendResponse({ success: true, audioData: audioResult.audioData });
        } else {
          console.error("Failed to generate audio:", audioResult.error);
          sendResponse({
            success: false,
            error: audioResult.error || "Failed to generate audio",
          });
        }
      })
      .catch((error) => {
        console.error("Error in analyzeText:", error);
        sendResponse({ success: false, error: error.toString() });
      });
    return true; // Indicates we will send a response asynchronously
  } else if (request.action === "analyzeVisual") {
    // For now, we'll just send a message that visual analysis is not implemented
    sendResponse({
      success: false,
      error: "Visual analysis is not yet implemented",
    });
    return true;
  } else if (request.action === "navigate") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.update(tabs[0].id, { url: request.url });
      } else {
        chrome.tabs.update(undefined, { url: request.url });
      }
    });
  }
});
