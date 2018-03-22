const { GraphQLServer } = require('graphql-yoga');
const { Prisma } = require('prisma-binding');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { APP_SECRET } = require('./utils');

const resolvers = {
  Query: {
    feed(parent, { filter, first, skip }, ctx, info) {
      const where = filter
        ? { OR: [{ url_contains: filter }, { description_contains: filter }] }
        : {};

      return ctx.db.query.links({ first, skip, where }, info);
    },
  },
  Mutation: {
    post(parent, { url, description }, ctx, info) {
      return ctx.db.mutation.createLink({ data: { url, description } }, info);
    },
    async signup(parent, args, ctx, info) {
      const password = await bcrypt.hash(args.password, 10);
      const user = await ctx.db.mutation.createUser(
        {
          data: { ...args, password },
        },
        info,
      );

      const token = jwt.sign({ userId: user.id }, APP_SECRET);

      return {
        token,
        user,
      };
    },
    async login(parent, args, ctx, info) {
      const user = await ctx.db.query.user({ where: { email: args.email } }, info);
      if (!user) {
        throw new Error(`Could not find user with email: ${args.email}`);
      }

      const valid = await bcrypt.compare(args.password, user.password);
      if (!valid) {
        throw new Error('Invalid password');
      }

      const token = jwt.sign({ userId: user.id }, APP_SECRET);

      return {
        token,
        user,
      };
    },
  },
};

const server = new GraphQLServer({
  typeDefs: './src/schema.graphql',
  resolvers,
  context: req => ({
    ...req,
    db: new Prisma({
      typeDefs: 'src/generated/prisma.graphql',
      endpoint: 'https://us1.prisma.sh/public-ringthief-327/hackernews/dev', // the endpoint of the Prisma DB service
      secret: 'mysecret123', // specified in database/prisma.yml
      debug: true, // log all GraphQL queryies & mutations
    }),
  }),
});

server.start(() => console.log('Server is running on http://localhost:4000'));
