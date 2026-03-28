async function captureVisibleTab() {
  const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
  return dataUrl;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_LISTING") {
    (async () => {
      try {
        const screenshot = await captureVisibleTab();

        const apiResponse = await fetch("http://localhost:3000/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            pageData: message.payload.pageData,
            screenshot
          })
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
          throw new Error(data.error || "API error");
        }

        sendResponse({ ok: true, data });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();

    return true;
  }
});