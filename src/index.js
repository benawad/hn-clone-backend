const { GraphQLServer } = require("graphql-yoga");
const { Prisma } = require("prisma-binding");

const resolvers = {
  Query: {
    feed(parent, { filter, first, skip }, ctx, info) {
      const where = filter
        ? { OR: [{ url_contains: filter }, { description_contains: filter }] }
        : {};

      return ctx.db.query.links({ first, skip, where }, info);
    }
  }
};

const server = new GraphQLServer({
  typeDefs: "./src/schema.graphql",
  resolvers,
  context: req => ({
    ...req,
    db: new Prisma({
      typeDefs: "src/generated/prisma.graphql",
      endpoint: "https://us1.prisma.sh/public-ringthief-327/hackernews/dev", // the endpoint of the Prisma DB service
      secret: "mysecret123", // specified in database/prisma.yml
      debug: true // log all GraphQL queryies & mutations
    })
  })
});

server.start(() => console.log("Server is running on http://localhost:4000"));
