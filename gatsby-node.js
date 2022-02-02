const path = require('path')
const graphql = require('gatsby/graphql')

/**
 * @type {import('gatsby').GatsbyNode['onPreInit']}
 */
exports.onPreInit = ({ actions }) => {
  // actions.toggleFeature('imageService', true)
}

exports.createPages = async ({
  graphql,
  actions,
  reporter,
  isFeatureEnabled,
}) => {
  const { createPage } = actions

  console.log(isFeatureEnabled('imageService'))

  // Define a template for blog post
  const blogPost = path.resolve('./src/templates/blog-post.js')

  const result = await graphql(
    `
      {
        allContentfulBlogPost {
          nodes {
            title
            slug
          }
        }
      }
    `
  )

  if (result.errors) {
    reporter.panicOnBuild(
      `There was an error loading your Contentful posts`,
      result.errors
    )
    return
  }

  const posts = result.data.allContentfulBlogPost.nodes

  // Create blog posts pages
  // But only if there's at least one blog post found in Contentful
  // `context` is available in the template as a prop and as a variable in GraphQL

  if (posts.length > 0) {
    posts.forEach((post, index) => {
      const previousPostSlug = index === 0 ? null : posts[index - 1].slug
      const nextPostSlug =
        index === posts.length - 1 ? null : posts[index + 1].slug

      createPage({
        path: `/blog/${post.slug}/`,
        component: blogPost,
        context: {
          slug: post.slug,
          previousPostSlug,
          nextPostSlug,
        },
        defer: false,
      })
    })
  }
}
