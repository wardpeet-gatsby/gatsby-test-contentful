exports.createRemoteFileNode = function createRemoteImageNode(
  { url, cacheKey, contentType, filename, width = null, height = null },
  actions
) {
  const id = actions.createNodeId(url)

  actions.createNode({
    id,
    url,
    contentType,
    filename,
    width,
    height,
    internal: {
      type: 'RemoteFile',
      contentDigest: actions.createContentDigest(cacheKey),
    },
  })

  return id
}
