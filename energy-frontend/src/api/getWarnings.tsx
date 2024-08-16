export default async function fetchWarnings(
  suburb_id: number | null = null,
  consumer_id: number | null = null
) {
  const data = {
    warnings: [
      {
      "suburb_id": 1,
        "category": "outage_hp",
        "description": "Energy outage for high priority consumer",
        "data": {
          consumer_id: 1,
          address: "123 Example Street, Melbourne VIC 3000"
        },
        "suggestion": "Prioritise re-establishing energy for priority consumer at address 123 Example Street, Melbourne VIC 3000."
      },
      {
        "suburb_id": 2,
        "category": "outage_lp",
        "description": "Energy outage for low priority consumer",
        "data": {
          consumer_id: 2,
          address: "456 Sample Avenue, Melbourne VIC 3000"
        },
        "suggestion": "Restore energy for low priority consumer at address 456 Sample Avenue, Melbourne VIC 3000."
      },
      {
        "suburb_id": 3,
        "category": "outage_mp",
        "description": "Energy outage for medium priority consumer",
        "data": {
          consumer_id: 3,
          address: "789 Example Road, Melbourne VIC 3000"
        },
        "suggestion": "Ensure energy restoration for medium priority consumer at address 789 Example Road, Melbourne VIC 3000."
      }
    ]
  };

  await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulating a delay of 3 seconds
  if (suburb_id !== null) {
    const warning = data.warnings.find((item) => item.suburb_id === suburb_id);
    if (warning) {
      return [warning]; // Always return an array, even if it's a single item
    } else {
      throw new Error(`Suburb with ID ${suburb_id} not found`);
    }
  } else if (consumer_id !== null) {
    const consumer_warnings = data.warnings.filter((item) => (item.data.consumer_id).toString() === (consumer_id).toString());

    if (consumer_warnings.length > 0) {
      return consumer_warnings;
    } else {
      throw new Error(`Warnings for consumer ID ${consumer_id} not found`);
    }
  } else {
    return { warnings: data.warnings };
  }
}
