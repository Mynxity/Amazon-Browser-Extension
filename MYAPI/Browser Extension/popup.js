const checkBtn = document.getElementById("checkBtn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

checkBtn.addEventListener("click", async () => {
  resultEl.textContent = "";
  statusEl.textContent = "Collecting listing data...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }

    const pageData = await chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT_AMAZON_DATA"
    });

    if (!pageData || pageData.error) {
      throw new Error(pageData?.error || "Could not extract Amazon listing data.");
    }

    statusEl.textContent = "Analyzing listing...";

    const response = await chrome.runtime.sendMessage({
      type: "ANALYZE_LISTING",
      payload: {
        pageData,
        tabId: tab.id
      }
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Analysis failed.");
    }

    const data = response.data;

    resultEl.textContent =
`Score: ${data.validity_score}/100
Risk: ${data.risk_level}

Summary:
${data.summary}

Flags:
${(data.flags || []).map(x => "- " + x).join("\n") || "- None"}`;

    statusEl.textContent = "Done.";
  } catch (err) {
    statusEl.textContent = "Error.";
    resultEl.textContent = err.message;
  }
});