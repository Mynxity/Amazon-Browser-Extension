function getText(selector) {
  const el = document.querySelector(selector);
  return el ? el.innerText.trim() : "";
}

function getAllTexts(selector) {
  return Array.from(document.querySelectorAll(selector))
    .map(el => el.innerText.trim())
    .filter(Boolean);
}

function getAttr(selector, attr) {
  const el = document.querySelector(selector);
  return el ? el.getAttribute(attr) || "" : "";
}

function extractASIN() {
  const fromInput = document.querySelector("#ASIN");
  if (fromInput?.value) return fromInput.value.trim();

  const match = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
  return match ? match[1] : "";
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_AMAZON_DATA") {
    try {
      const data = {
        url: location.href,
        title: getText("#productTitle"),
        price:
          getText(".a-price .a-offscreen") ||
          getText("#priceblock_ourprice") ||
          getText("#priceblock_dealprice"),
        brand: getText("#bylineInfo"),
        seller:
          getText("#sellerProfileTriggerId") ||
          getText("#merchant-info") ||
          getText("#shipsFromSoldByFeature_feature_div"),
        rating: getText("span[data-hook='rating-out-of-text']"),
        reviewCount: getText("#acrCustomerReviewText"),
        bullets: getAllTexts("#feature-bullets ul li span"),
        description: getText("#productDescription"),
        asin: extractASIN(),
        image: getAttr("#landingImage", "src"),
        shipping: getText("#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE"),
        returns: getText("#RETURNS_POLICY")
      };

      sendResponse(data);
    } catch (e) {
      sendResponse({ error: e.message });
    }
  }

  return true;
});