import type { MetadataRoute } from 'next';

function baseUrl() {
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const owner = process.env.GITHUB_REPOSITORY?.split('/')[0];
  const isPages = process.env.GITHUB_ACTIONS === 'true';
  return isPages && repo && owner ? `https://${owner}.github.io/${repo}` : 'http://localhost:3000';
}

export default function robots(): MetadataRoute.Robots {
  const url = baseUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${url}/sitemap.xml`,
  };
}
