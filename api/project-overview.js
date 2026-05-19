export default async function handler(req, res) {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    const data = await response.json();

    const counts = {
      active: 0,
      budget: 0,
      ready: 0,
      dreaming: 0
    };

    data.results.forEach(page => {
      const phase = page.properties["Phase"]?.status?.name;

      if (phase === "Active this month") counts.active++;
      if (phase === "Waiting on budget") counts.budget++;
      if (phase === "Ready soon") counts.ready++;
      if (phase === "Dreaming") counts.dreaming++;
    });

    res.status(200).json(counts);
  } catch (error) {
    res.status(500).json({ error: "Could not load project stats" });
  }
}
