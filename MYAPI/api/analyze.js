module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  function getResponseText(apiJson) {
    if (typeof apiJson?.output_text === "string" && apiJson.output_text.trim()) {
      return apiJson.output_text.trim();
    }

    let text = "";

    for (const item of apiJson?.output || []) {
      for (const content of item?.content || []) {
        if (content?.type === "output_text" && typeof content.text === "string") {
          text += content.text;
        }
      }
    }

    return text.trim();
  }

  function extractJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Invalid JSON from AI");
      return JSON.parse(match[0]);
    }
  }

  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const { pageData, screenshot } = req.body || {};

    if (!pageData || typeof pageData !== "object") {
      return res.status(400).json({ error: "Missing or invalid pageData" });
    }

    const userContent = [
      {
        type: "input_text",
        text:
          "Analyze this Amazon listing and return ONLY valid JSON with exactly these keys: " +
          "validity_score, risk_level, summary, flags.\n\n" +
          "Rules:\n" +
          "- validity_score must be a number from 0 to 100\n" +
          '- risk_level must be one of "Low", "Medium", or "High"\n' +
          "- summary must be a short plain-English explanation\n" +
          "- flags must be an array of short strings\n\n" +
          "Focus on title quality, brand/seller consistency, pricing weirdness, suspicious wording, " +
          "missing details, and screenshot/listing mismatches.\n\n" +
          `Listing data:\n${JSON.stringify(pageData, null, 2)}`
      }
    ];

    if (typeof screenshot === "string" && screenshot.startsWith("data:image/")) {
      userContent.push({
        type: "input_image",
        image_url: screenshot
      });
    }

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        text: {
          format: {
            type: "json_schema",
            name: "amazon_listing_analysis",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                validity_score: { type: "number" },
                risk_level: {
                  type: "string",
                  enum: ["Low", "Medium", "High"]
                },
                summary: { type: "string" },
                flags: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["validity_score", "risk_level", "summary", "flags"]
            }
          }
        },
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You are an Amazon listing risk analyst. Return only valid JSON."
              }
            ]
          },
          {
            role: "user",
            content: userContent
          }
        ]
      })
    });

    const apiJson = await apiResponse.json();

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({
        error: "OpenAI API error",
        details: apiJson
      });
    }

    const parsed = extractJson(getResponseText(apiJson));

    return res.status(200).json({
      validity_score: Number(parsed.validity_score ?? 0),
      risk_level: ["Low", "Medium", "High"].includes(parsed.risk_level)
        ? parsed.risk_level
        : "Medium",
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : "No summary",
      flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : []
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Unknown server error"
    });
  }
};