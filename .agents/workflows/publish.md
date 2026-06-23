---
description: Deploy the application to GitHub Pages
---

To deploy the latest version of the application to GitHub Pages, follow these steps:

1. Build the application and copy assets to the github.io repository:
```bash
// turbo-all
npm run publish
```

2. Commit and push the changes in the target repository to trigger the GitHub Pages deployment:
```bash
// turbo-all
git -C ../pareto-lab.github.io add .
git -C ../pareto-lab.github.io commit -m "Update website"
git -C ../pareto-lab.github.io push
```
