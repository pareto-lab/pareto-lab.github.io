import fs from 'fs';
import path from 'path';

const basePath = 'https://paretolab.kr';
const distDir = path.resolve('dist');

// Define the routes that need their own HTML files for SEO
const routes = [
  'about',
  'housing-mbti',
  'property/4'
];

function generateSeoPages() {
  const indexPath = path.join(distDir, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    console.error('dist/index.html not found. Did you run vite build first?');
    process.exit(1);
  }

  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  // We are removing index.html from old directories where it might exist
  const oldDirsToRemove = [
    path.join(distDir, 'about'),
    path.join(distDir, 'housing-mbti'),
    path.join(distDir, 'property', '4')
  ];

  for (const oldDir of oldDirsToRemove) {
    const oldHtml = path.join(oldDir, 'index.html');
    if (fs.existsSync(oldHtml)) {
      console.log(`Cleaning up old directory-based html: ${oldHtml}`);
      fs.unlinkSync(oldHtml);
    }
  }

  // Generate a .html file for each route
  routes.forEach(route => {
    // Generate the correct meta tags for this route
    const canonicalUrl = `${basePath}/${route}`;
    
    // Replace the default meta tags with the page-specific ones
    let newHtml = indexHtml;
    newHtml = newHtml.replace(
      /<link rel="canonical" href="https:\/\/paretolab\.kr\/" \/>/g,
      `<link rel="canonical" href="${canonicalUrl}" />`
    );
    newHtml = newHtml.replace(
      /<meta property="og:url" content="https:\/\/paretolab\.kr\/" \/>/g,
      `<meta property="og:url" content="${canonicalUrl}" />`
    );

    // Make sure the directory exists before writing the file
    const targetPath = path.join(distDir, `${route}.html`);
    const targetDir = path.dirname(targetPath);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, newHtml);
    console.log(`Generated SEO page: ${targetPath} (Canonical: ${canonicalUrl})`);
  });
}

generateSeoPages();
