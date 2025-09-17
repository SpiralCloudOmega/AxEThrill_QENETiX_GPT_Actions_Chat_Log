/** @type {import('next').NextConfig} */
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
const isPages = process.env.GITHUB_ACTIONS === 'true';
const basePath = isPages ? `/${repoName}` : '';

module.exports = {
  output: 'export',
  basePath,
  assetPrefix: basePath,
  trailingSlash: true
};