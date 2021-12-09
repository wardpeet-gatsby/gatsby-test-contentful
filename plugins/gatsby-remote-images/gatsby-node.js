const { createRemoteFileNode } = require('./index.js')
const fs = require('fs-extra')
const { stream } = require('got')
const ImgixClient = require('@imgix/js-core')
const {
  generateImageData,
  getLowResolutionImageURL,
} = require('gatsby-plugin-image')
const { fetchRemoteFile } = require('gatsby-core-utils')
const {
  getGatsbyImageFieldConfig,
} = require('gatsby-plugin-image/graphql-utils')

const imageMapper = new Map()

const client = new ImgixClient({
  domain: 'gatsby-cloud.imgix.net',
  secureURLToken: 'WAbYXcycj8S94VJ8',
})

/** @type {import('gatsby').GatsbyNode["createResolvers"]} */
exports.createResolvers = ({ createResolvers, reporter, cache }) => {
  const resolvers = {
    ContentfulAsset: {
      gatsbyImageData: {
        resolve: async (source, args, context, info) => {
          const item = await context.nodeModel.findOne({
            type: `RemoteFile`,
            query: {
              filter: { id: { eq: imageMapper.get(source.id) } },
            },
          })

          return generateImageDataResolver(item, args, { reporter, cache })
        },
      },
    },
  }

  createResolvers(resolvers)
}

/** @type {import('gatsby').GatsbyNode["onCreateNode"]} */
exports.onCreateNode = ({
  node,
  actions,
  createContentDigest,
  createNodeId,
}) => {
  if (node.internal.type === 'ContentfulAsset') {
    const id = createRemoteFileNode(
      {
        url: `https:${node.file.url}`,
        contentType: node.file.contentType,
        cacheKey: node.internal.contentDigest,
        filename: node.file.fileName,
        width: node.file.details?.image?.width,
        height: node.file.details?.image?.height,
      },
      {
        ...actions,
        createContentDigest,
        createNodeId,
      }
    )

    imageMapper.set(node.id, id)
  }

  if (node.internal.type === 'WpMediaItem') {
    const id = createRemoteFileNode(
      {
        url: `${node.sourceUrl}`,
        contentType: node.mimeType,
        cacheKey: node.internal.contentDigest,
        filename: node.mediaDetails.file.split('/').pop(),
        width: node.mediaDetails?.image?.width,
        height: node.mediaDetails?.image?.height,
      },
      {
        ...actions,
        createContentDigest,
        createNodeId,
      }
    )

    imageMapper.set(node.id, id)
  }
}

/** @type {import('gatsby').GatsbyNode["createSchemaCustomization"]} */
exports.createSchemaCustomization = ({ actions, schema, reporter, cache }) => {
  actions.createTypes([
    schema.buildObjectType({
      name: 'RemoteFile',
      extensions: {
        infer: false,
      },
      fields: {
        url: 'String!',
        filename: 'String!',
        contentType: 'String!',
        filesize: 'Int',
        width: 'Int',
        height: 'Int',
        gatsbyImageData: getGatsbyImageFieldConfig((source, args) =>
          generateImageDataResolver(source, args, { reporter, cache })
        ),
      },
      interfaces: ['Node'],
    }),
  ])
}

async function generateImageDataResolver(source, args, context) {
  const sourceMetadata = {
    width: source.width,
    height: source.height,
    format: source.contentType.replace('image/', ''),
  }

  const generateLocalImageSource = (imageUrl, width, height, toFormat) => {
    return {
      src: `/_gatsby/image/${Buffer.from(imageUrl).toString(
        'base64'
      )}?w=${width}&h=${height}&fm=${toFormat}`,
      width: width,
      height: height,
      format: toFormat,
    }
  }

  const generateExternalImageSource = (imageUrl, width, height, toFormat) => {
    return {
      src: generateImgIXUrl(imageUrl, { w: width, h: height, fm: toFormat }),
      width: width,
      height: height,
      format: toFormat,
    }
  }

  if (args.placeholder === 'blurred') {
    // This function returns the URL for a 20px-wide image, to use as a blurred placeholder
    const lowResImageURL = getLowResolutionImageURL({
      sourceMetadata,
      pluginName: `gatsby-remote-images`,
      filename: source.url,
      generateImageSource: generateExternalImageSource,
      ...args,
    })

    const filePath = await fetchRemoteFile({
      url: lowResImageURL,
      cache: context.cache,
    })

    const imageBase64 = await fs.readFile(filePath)

    args.placeholderURL = `data:image/png;base64,${imageBase64.toString(
      'base64'
    )}`
  }

  return generateImageData({
    pluginName: 'gatsby-remote-images',
    filename: source.url,
    sourceMetadata,
    generateImageSource: generateLocalImageSource,
    ...context,
    ...args,
  })
}

function generateImgIXUrl(url, args) {
  return client.buildURL(url, args)
}

/** @type {import('gatsby').GatsbyNode["onCreateDevServer"]} */
exports.onCreateDevServer = function onCreateDevServer({ app }) {
  app.use('/_gatsby/image/:source', (req, res) => {
    console.log(
      `Streaming ${Buffer.from(req.params.source, 'base64').toString()}`
    )

    stream(
      generateImgIXUrl(
        Buffer.from(req.params.source, 'base64').toString(),
        req.query
      )
    ).pipe(res)
  })

  app.use('/_gatsby/file/:source', (req, res) => {
    console.log(
      `Streaming ${Buffer.from(req.params.source, 'base64').toString()}`
    )

    stream(Buffer.from(req.params.source, 'base64').toString()).pipe(res)
  })
}
