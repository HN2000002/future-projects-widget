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

  const headers = {
    "Authorization": `Bearer ${NOTION_TOKEN}`,
    "Notion-Version": "2025-09-03",
    "Content-Type": "application/json"
  };

  try {
    // Step 1: retrieve the database container
    const dbResponse = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}`, {
      method: "GET",
      headers
    });

    const dbData = await dbResponse.json();

    if (!dbResponse.ok) {
      return res.status(dbResponse.status).json({
        error: "Could not retrieve database",
        status: dbResponse.status,
        message: dbData.message,
        code: dbData.code,
        hint: "The integration may be connected to the wrong workspace/database, or the database ID may be the wrong object."
      });
    }

    // Step 2: try to find the real data source inside the database
    const dataSources = dbData.data_sources || dbData.dataSources || [];

    if (!dataSources.length) {
      return res.status(400).json({
        error: "No data sources found inside this database",
        databaseId: DATABASE_ID,
        databaseKeys: Object.keys(dbData),
        hint: "This usually means this is a linked view or Notion has not exposed the source table to the integration."
      });
    }

    const dataSourceId = dataSources[0].id;

    // Step 3: query the actual data source
    const response = await fetch(`https://api.notion.com/v1/data_sources/${dataSourceId}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        page_size: 100
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Could not query data source",
        status: response.status,
        message: data.message,
        code: data.code,
        dataSourceId
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
      if (phase === "Waiting on budget" || phase === "Waiting on Budget") counts.budget++;
      if (phase === "Ready soon") counts.ready++;
      if (phase === "Dreaming") counts.dreaming++;
    });

    return res.status(200).json({
      ...counts,
      debug: {
        databaseId: DATABASE_ID,
        dataSourceId,
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
