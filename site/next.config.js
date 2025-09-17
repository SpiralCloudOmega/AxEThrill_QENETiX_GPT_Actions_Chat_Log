/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production'
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'AxEThrill_QENETiX_GPT_Actions_Chat_Log-visibility-public'

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  ...(isProd && {
    basePath: `/${repoName}`,
    assetPrefix: `/${repoName}/`
  })
}

module.exports = nextConfig