export default async function handler(req, res) {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  if (!NOTION_TOKEN || !DATABASE_ID) {
    return res.status(500).json({
      error: "Missing environment variables",
      hasToken: Boolean(NOTION_TOKEN),
      hasDatabaseId: Boolean(DATABASE_ID)
    });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/data_sources/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        page_size: 100
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Notion API error",
        status: response.status,
        message: data.message,
        code: data.code
      });
    }

    const counts = {
      active: 0,
      budget: 0,
      ready: 0,
      dreaming: 0
    };

    const phasesFound = [];

    data.results.forEach(page => {
      const phase = page.properties["Phase"]?.status?.name;

      if (phase) phasesFound.push(phase);

      if (phase === "Active this month") counts.active++;
      if (phase === "Waiting on budget") counts.budget++;
      if (phase === "Ready soon") counts.ready++;
      if (phase === "Dreaming") counts.dreaming++;
    });

    return res.status(200).json({
      ...counts,
      debug: {
        totalPagesFound: data.results.length,
        phasesFound: [...new Set(phasesFound)],
        propertyNamesFoundOnFirstPage: data.results[0]
          ? Object.keys(data.results[0].properties)
          : []
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: "Could not load project stats",
      message: error.message
    });
  }
}
