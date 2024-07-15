export default async function fetchWarnings(id: number | null = null) {
    const data = {
        warnings: [
            {
              id: 20457,
              goal: 'green energy',
              category: 'fossil fuel',
              description: 'warning blah blah',
              suggestion: 'suggestion',
              data: {}
            },
            {
              id: 20456,
              goal: 'green energy',
              category: 'fossil fuel',
              description: 'warning blah blah',
              suggestion: 'suggestion',
              data: {}
            },
            {
              id: 20455,
              goal: 'green energy',
              category: 'fossil fuel',
              description: 'warning blah blah',
              suggestion: 'suggestion',
              data: {}
            },
            {
              id: 20454,
              goal: 'green energy',
              category: 'fossil fuel',
              description: 'warning blah blah',
              suggestion: 'suggestion',
              data: {}
            },
            {
              id: 20453,
              goal: 'green energy',
              category: 'fossil fuel',
              description: 'warning blah blah',
              suggestion: 'suggestion',
              data: {}
            },
          ],
    }
    
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulating a delay of 3 seconds

    if (id !== undefined && id !== null) {
        // Filter the warnings by id and return
        const warning = data.warnings.find((item) => item.id === id);
        if (warning) {
        return [warning]; // Always return an array, even if it's a single item
        } else {
        throw new Error(`Warning with ID ${id} not found`);
        }
    } else {
        // Return all warnings if no id is provided
        return { warnings: data.warnings };
    }
}